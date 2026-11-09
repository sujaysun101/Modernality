"""
Universal Material Ingestion Engine for Lumina Studio.
Handles:
- PDFs (.pdf) via pypdf & Gemini Files API
- Word Documents (.docx) via python-docx
- PowerPoint Presentations (.pptx) via python-pptx
- Excel Spreadsheets (.xlsx) & CSV/TSV via openpyxl / csv
- ZIP Archives (.zip) — recursively unpacks and ingests all inner files
- Images (.png, .jpg, .jpeg, .webp, .gif) — base64 inline or Gemini Files API
- Audio / Video (.mp3, .wav, .m4a, .mp4, .mov, .webm) — Gemini Files API
- Code, Text, Markdown, JSON, YAML, LaTeX, HTML, Notebooks (.ipynb)
- External Links:
  - YouTube URLs (youtube.com/watch?v=..., youtu.be/...) -> Transcript extraction + metadata fallback
  - Google Drive public links (Docs, Sheets, Slides, or File view links) -> Export/download + parse
  - General Web URLs -> Article & text extraction via BeautifulSoup
"""

import base64
import csv
import io
import json
import mimetypes
import os
import re
import tempfile
import urllib.parse
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Tuple

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader
import docx
import pptx
import openpyxl


TEXT_EXTENSIONS = {
    ".txt", ".md", ".markdown", ".py", ".js", ".ts", ".jsx", ".tsx",
    ".html", ".htm", ".css", ".json", ".yaml", ".yml", ".toml", ".ini",
    ".cfg", ".sh", ".bat", ".ps1", ".c", ".cpp", ".h", ".hpp", ".java",
    ".go", ".rs", ".rb", ".php", ".sql", ".r", ".tex", ".bib", ".xml",
    ".svg", ".log"
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
MEDIA_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".mp4", ".mov", ".webm", ".mkv"}


class IngestedItem:
    """Represents a single processed material artifact."""
    def __init__(
        self,
        source_name: str,
        source_type: str,
        extracted_text: str = "",
        media_part: Dict[str, Any] | None = None,
        local_file_path: str | None = None,
        mime_type: str | None = None,
        metadata: Dict[str, Any] | None = None,
    ):
        self.source_name = source_name
        self.source_type = source_type
        self.extracted_text = extracted_text
        self.media_part = media_part  # e.g., {"type": "image", "data": "...", "mime_type": "..."}
        self.local_file_path = local_file_path
        self.mime_type = mime_type
        self.metadata = metadata or {}

    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "source_name": self.source_name,
            "source_type": self.source_type,
            "char_count": len(self.extracted_text),
            "has_media": self.media_part is not None or self.local_file_path is not None,
            "mime_type": self.mime_type,
            "preview": self.extracted_text[:280].strip() + ("..." if len(self.extracted_text) > 280 else ""),
            "metadata": self.metadata,
        }


def extract_pdf_bytes(data: bytes, filename: str) -> IngestedItem:
    text_pages = []
    try:
        reader = PdfReader(io.BytesIO(data))
        for idx, page in enumerate(reader.pages):
            page_txt = page.extract_text() or ""
            if page_txt.strip():
                text_pages.append(f"--- [Page {idx + 1}] ---\n{page_txt.strip()}")
        full_text = "\n\n".join(text_pages)
        num_pages = len(reader.pages)
    except Exception as e:
        full_text = f"[PDF text extraction warning for {filename}: {e}]"
        num_pages = 0

    # If PDF is scanned or has very little text and is < 20MB, also attach as inline document or save for Files API
    media_part = None
    if len(full_text.strip()) < 200 and len(data) < 15 * 1024 * 1024:
        media_part = {
            "type": "document",
            "data": base64.b64encode(data).decode("ascii"),
            "mime_type": "application/pdf",
        }

    return IngestedItem(
        source_name=filename,
        source_type="PDF Document",
        extracted_text=full_text,
        media_part=media_part,
        mime_type="application/pdf",
        metadata={"pages": num_pages, "size_bytes": len(data)},
    )


def extract_docx_bytes(data: bytes, filename: str) -> IngestedItem:
    try:
        doc = docx.Document(io.BytesIO(data))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        # Also extract tables
        table_texts = []
        for t_idx, table in enumerate(doc.tables):
            rows = []
            for row in table.rows:
                cells = [c.text.strip().replace("\n", " ") for c in row.cells]
                rows.append(" | ".join(cells))
            if rows:
                table_texts.append(f"[Table {t_idx + 1}]\n" + "\n".join(rows))
        combined = "\n\n".join(paragraphs + table_texts)
    except Exception as e:
        combined = f"[Error parsing DOCX {filename}: {e}]"

    return IngestedItem(
        source_name=filename,
        source_type="Word Document (DOCX)",
        extracted_text=combined,
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        metadata={"size_bytes": len(data)},
    )


def extract_pptx_bytes(data: bytes, filename: str) -> IngestedItem:
    try:
        prs = pptx.Presentation(io.BytesIO(data))
        slides_text = []
        for idx, slide in enumerate(prs.slides):
            shapes_txt = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for paragraph in shape.text_frame.paragraphs:
                        txt = paragraph.text.strip()
                        if txt:
                            shapes_txt.append(txt)
            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                notes = slide.notes_slide.notes_text_frame.text.strip()
                if notes:
                    shapes_txt.append(f"[Speaker Notes]: {notes}")
            if shapes_txt:
                slides_text.append(f"--- [Slide {idx + 1}] ---\n" + "\n".join(shapes_txt))
        combined = "\n\n".join(slides_text)
        slide_count = len(prs.slides)
    except Exception as e:
        combined = f"[Error parsing PPTX {filename}: {e}]"
        slide_count = 0

    return IngestedItem(
        source_name=filename,
        source_type="Presentation (PPTX)",
        extracted_text=combined,
        mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        metadata={"slides": slide_count, "size_bytes": len(data)},
    )


def extract_xlsx_bytes(data: bytes, filename: str) -> IngestedItem:
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
        sheets_out = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            rows_out = []
            for row in list(ws.iter_rows(values_only=True))[:250]:
                if any(cell is not None for cell in row):
                    rows_out.append(" | ".join(str(c) if c is not None else "" for c in row))
            if rows_out:
                sheets_out.append(f"--- [Sheet: {sheet_name}] ---\n" + "\n".join(rows_out))
        combined = "\n\n".join(sheets_out)
    except Exception as e:
        combined = f"[Error parsing XLSX {filename}: {e}]"

    return IngestedItem(
        source_name=filename,
        source_type="Spreadsheet (XLSX)",
        extracted_text=combined,
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        metadata={"size_bytes": len(data)},
    )


def extract_ipynb_bytes(data: bytes, filename: str) -> IngestedItem:
    try:
        nb = json.loads(data.decode("utf-8", errors="replace"))
        cells_out = []
        for idx, cell in enumerate(nb.get("cells", [])):
            ctype = cell.get("cell_type", "code")
            source = "".join(cell.get("source", []))
            if source.strip():
                if ctype == "markdown":
                    cells_out.append(f"--- [Notebook Markdown Cell {idx + 1}] ---\n{source}")
                else:
                    cells_out.append(f"--- [Notebook Code Cell {idx + 1}] ---\n```python\n{source}\n```")
        combined = "\n\n".join(cells_out)
    except Exception as e:
        combined = f"[Error parsing Jupyter Notebook {filename}: {e}]"

    return IngestedItem(
        source_name=filename,
        source_type="Jupyter Notebook (IPYNB)",
        extracted_text=combined,
        mime_type="application/x-ipynb+json",
        metadata={"size_bytes": len(data)},
    )


def extract_image_bytes(data: bytes, filename: str, ext: str) -> IngestedItem:
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
    }
    mime_type = mime_map.get(ext.lower(), "image/png")
    b64_data = base64.b64encode(data).decode("ascii")
    return IngestedItem(
        source_name=filename,
        source_type="Image / Diagram",
        extracted_text=f"[Visual Image Asset Attached: {filename} ({mime_type}, {len(data) // 1024} KB)]",
        media_part={
            "type": "image",
            "data": b64_data,
            "mime_type": mime_type,
        },
        mime_type=mime_type,
        metadata={"size_bytes": len(data)},
    )


def extract_single_file_bytes(data: bytes, filename: str, upload_dir: Path) -> List[IngestedItem]:
    """Dispatches a file's raw bytes to the appropriate extractor (including recursive ZIP handling)."""
    ext = Path(filename).suffix.lower()

    if ext == ".zip":
        items: List[IngestedItem] = []
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for info in zf.infolist():
                    if info.is_dir():
                        continue
                    inner_name = info.filename
                    # Skip macOS resource forks or hidden git/node_modules
                    if "__MACOSX" in inner_name or "/." in inner_name or inner_name.startswith("."):
                        continue
                    if info.file_size > 40 * 1024 * 1024:
                        continue
                    inner_bytes = zf.read(info.filename)
                    display_name = f"{filename} -> {inner_name}"
                    items.extend(extract_single_file_bytes(inner_bytes, display_name, upload_dir))
        except Exception as e:
            items.append(
                IngestedItem(
                    source_name=filename,
                    source_type="ZIP Archive",
                    extracted_text=f"[Error unpacking ZIP {filename}: {e}]",
                )
            )
        return items

    if ext == ".pdf":
        return [extract_pdf_bytes(data, filename)]
    if ext == ".docx":
        return [extract_docx_bytes(data, filename)]
    if ext == ".pptx":
        return [extract_pptx_bytes(data, filename)]
    if ext == ".xlsx":
        return [extract_xlsx_bytes(data, filename)]
    if ext == ".ipynb":
        return [extract_ipynb_bytes(data, filename)]
    if ext in {".csv", ".tsv"}:
        text_content = data.decode("utf-8", errors="replace")
        lines = text_content.splitlines()[:300]
        return [
            IngestedItem(
                source_name=filename,
                source_type="Tabular Data (CSV/TSV)",
                extracted_text="\n".join(lines),
                mime_type="text/csv",
                metadata={"total_lines": len(text_content.splitlines()), "size_bytes": len(data)},
            )
        ]
    if ext in IMAGE_EXTENSIONS:
        return [extract_image_bytes(data, filename, ext)]
    if ext in MEDIA_EXTENSIONS:
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", Path(filename).name)
        saved_path = upload_dir / safe_name
        saved_path.write_bytes(data)
        mime_type, _ = mimetypes.guess_type(safe_name)
        mime_type = mime_type or ("audio/mpeg" if ext in {".mp3", ".wav", ".m4a"} else "video/mp4")
        return [
            IngestedItem(
                source_name=filename,
                source_type="Audio / Video Media",
                extracted_text=f"[Media File Attached for Multimodal Analysis: {filename} ({mime_type})]",
                local_file_path=str(saved_path),
                mime_type=mime_type,
                metadata={"size_bytes": len(data)},
            )
        ]

    # Default: treat as text/code/markdown
    decoded = data.decode("utf-8", errors="replace")
    return [
        IngestedItem(
            source_name=filename,
            source_type=f"Text / Code ({ext or 'plain'})",
            extracted_text=decoded[:120000],
            mime_type="text/plain",
            metadata={"size_bytes": len(data)},
        )
    ]


def extract_youtube_video_id(url: str) -> str | None:
    """Extracts the 11-character YouTube video ID from any standard YouTube link."""
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    if "youtu.be" in host:
        vid = parsed.path.lstrip("/").split("/")[0]
        return vid if len(vid) >= 10 else None
    if "youtube.com" in host:
        if parsed.path == "/watch":
            qs = urllib.parse.parse_qs(parsed.query)
            v_list = qs.get("v")
            if v_list:
                return v_list[0]
        for prefix in ("/embed/", "/shorts/", "/v/", "/live/"):
            if parsed.path.startswith(prefix):
                return parsed.path[len(prefix):].split("/")[0].split("?")[0]
    return None


async def ingest_youtube_url(url: str) -> IngestedItem:
    video_id = extract_youtube_video_id(url)
    if not video_id:
        return IngestedItem(
            source_name=url,
            source_type="YouTube Video",
            extracted_text=f"[Could not parse YouTube Video ID from URL: {url}]",
        )

    title = f"YouTube Video ({video_id})"
    author = ""
    description = ""

    # Fetch oEmbed + page metadata for title and description
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        try:
            oembed_resp = await client.get(
                f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            )
            if oembed_resp.status_code == 200:
                odata = oembed_resp.json()
                title = odata.get("title", title)
                author = odata.get("author_name", "")
        except Exception:
            pass

        try:
            page_resp = await client.get(
                f"https://www.youtube.com/watch?v={video_id}",
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            )
            if page_resp.status_code == 200:
                desc_match = re.search(r'"shortDescription":"((?:\\.|[^"\\])*)"', page_resp.text)
                if desc_match:
                    description = bytes(desc_match.group(1), "utf-8").decode("unicode_escape", errors="replace")
        except Exception:
            pass

    # Fetch transcript via youtube-transcript-api
    transcript_lines: List[str] = []
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        ytt_api = YouTubeTranscriptApi()
        if hasattr(ytt_api, "fetch"):
            fetched = ytt_api.fetch(video_id)
            for snippet in fetched:
                start_sec = int(getattr(snippet, "start", 0))
                mins, secs = divmod(start_sec, 60)
                txt = getattr(snippet, "text", "")
                transcript_lines.append(f"[{mins:02d}:{secs:02d}] {txt}")
        else:
            raw_list = YouTubeTranscriptApi.get_transcript(video_id)
            for item in raw_list:
                start_sec = int(item.get("start", 0))
                mins, secs = divmod(start_sec, 60)
                transcript_lines.append(f"[{mins:02d}:{secs:02d}] {item.get('text', '')}")
    except Exception as e:
        transcript_lines.append(f"[Note: Automated closed captions could not be fetched directly: {e}]")

    header = f"YouTube Title: {title}\nChannel: {author}\nURL: https://www.youtube.com/watch?v={video_id}\n"
    if description:
        header += f"\nVideo Description:\n{description[:3000]}\n"
    body = "\n--- [Timestamped Video Transcript] ---\n" + "\n".join(transcript_lines)

    return IngestedItem(
        source_name=f"YouTube: {title}",
        source_type="YouTube Video",
        extracted_text=header + body,
        metadata={"video_id": video_id, "title": title, "author": author, "url": url},
    )


async def ingest_google_drive_url(url: str, upload_dir: Path) -> List[IngestedItem]:
    """Converts public Google Docs/Sheets/Slides/Drive File URLs to export endpoints and parses them."""
    export_url = url
    expected_ext = ".txt"

    doc_match = re.search(r"docs\.google\.com/document/d/([a-zA-Z0-9_-]+)", url)
    sheet_match = re.search(r"docs\.google\.com/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    slide_match = re.search(r"docs\.google\.com/presentation/d/([a-zA-Z0-9_-]+)", url)
    file_match = re.search(r"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)", url)
    open_match = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url)

    resource_id = None
    if doc_match:
        resource_id = doc_match.group(1)
        export_url = f"https://docs.google.com/document/d/{resource_id}/export?format=txt"
        expected_ext = ".txt"
    elif sheet_match:
        resource_id = sheet_match.group(1)
        export_url = f"https://docs.google.com/spreadsheets/d/{resource_id}/export?format=csv"
        expected_ext = ".csv"
    elif slide_match:
        resource_id = slide_match.group(1)
        export_url = f"https://docs.google.com/presentation/d/{resource_id}/export/pptx"
        expected_ext = ".pptx"
    elif file_match or open_match:
        resource_id = file_match.group(1) if file_match else open_match.group(1)
        export_url = f"https://drive.google.com/uc?export=download&id={resource_id}"
        expected_ext = ""

    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        try:
            resp = await client.get(
                export_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            )
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "").lower()
            content_disp = resp.headers.get("content-disposition", "")

            filename = f"google_drive_{resource_id or 'asset'}{expected_ext}"
            fname_match = re.search(r'filename\*?=["\']?(?:UTF-8\'\')?([^"\';]+)', content_disp)
            if fname_match:
                filename = urllib.parse.unquote(fname_match.group(1))
            elif not expected_ext:
                if "pdf" in content_type:
                    filename += ".pdf"
                elif "presentation" in content_type:
                    filename += ".pptx"
                elif "word" in content_type:
                    filename += ".docx"
                elif "sheet" in content_type or "csv" in content_type:
                    filename += ".csv"
                elif "image/png" in content_type:
                    filename += ".png"
                elif "image/jpeg" in content_type:
                    filename += ".jpg"
                else:
                    filename += ".txt"

            return extract_single_file_bytes(resp.content, filename, upload_dir)
        except Exception as e:
            return [
                IngestedItem(
                    source_name=f"Google Drive ({resource_id or url})",
                    source_type="Google Drive Link",
                    extracted_text=f"[Note: Could not directly download Google Drive link '{url}'. Ensure link sharing is set to 'Anyone with the link': {e}]",
                )
            ]


async def ingest_web_url(url: str, upload_dir: Path) -> List[IngestedItem]:
    """Routes URLs to YouTube, Google Drive, or general Web Article extraction."""
    url = url.strip()
    if not url:
        return []
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()

    if "youtube.com" in host or "youtu.be" in host:
        return [await ingest_youtube_url(url)]

    if "drive.google.com" in host or "docs.google.com" in host:
        return await ingest_google_drive_url(url, upload_dir)

    # Check if direct file link (.pdf, .docx, .png, etc.)
    path_ext = Path(parsed.path).suffix.lower()
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        try:
            resp = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LuminaTutor/1.0"},
            )
            resp.raise_for_status()
            ctype = resp.headers.get("content-type", "").lower()

            if path_ext in {".pdf", ".docx", ".pptx", ".xlsx", ".zip", ".png", ".jpg", ".jpeg"} or "application/pdf" in ctype:
                fname = Path(parsed.path).name or ("downloaded_document.pdf" if "pdf" in ctype else "downloaded_asset")
                return extract_single_file_bytes(resp.content, fname, upload_dir)

            # Parse HTML article
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside"]):
                tag.decompose()
            page_title = soup.title.string.strip() if (soup.title and soup.title.string) else url
            main_node = soup.find("article") or soup.find("main") or soup.body or soup
            text_blocks = [line.strip() for line in main_node.get_text(separator="\n").splitlines() if line.strip()]
            cleaned_text = f"Web Source Title: {page_title}\nURL: {url}\n\n" + "\n".join(text_blocks)

            return [
                IngestedItem(
                    source_name=f"Web: {page_title[:65]}",
                    source_type="Web Article / Page",
                    extracted_text=cleaned_text[:100000],
                    metadata={"url": url, "title": page_title},
                )
            ]
        except Exception as e:
            return [
                IngestedItem(
                    source_name=url,
                    source_type="Web Link",
                    extracted_text=f"[Could not fetch URL {url}: {e}]",
                )
            ]
