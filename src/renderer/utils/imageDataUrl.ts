/** Parse a data URL into Anthropic-compatible image parts (shared test surface with main/claudeIpc). */
export function parseDataUrlForAnthropic(imageData: string): {
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
} {
    const match = imageData.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
    if (!match) {
        throw new Error('Invalid image data URL');
    }
    let ext = match[1].toLowerCase();
    if (ext === 'jpg') ext = 'jpeg';
    const media_type = (ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp'
        ? (`image/${ext}` as const)
        : ('image/png' as const));
    return { media_type, data: match[2] };
}
