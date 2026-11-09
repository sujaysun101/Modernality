"""Entrypoint to launch Lumina Studio locally or on Google Cloud Run."""
import os
import uvicorn

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0" if os.environ.get("K_SERVICE") else "127.0.0.1")
    port = int(os.environ.get("PORT", "8080" if os.environ.get("K_SERVICE") else "8000"))
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)
