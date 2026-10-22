"""
Local development runner for TikTok Blur Cam FastAPI application.
Run:
    py main.py
Or:
    py -m uvicorn api.index:app --reload
"""

import socket
import uvicorn


def find_available_port(start_port: int = 8000) -> int:
    """Find an available port starting from start_port to prevent WinError 10013."""
    candidate_ports = [start_port, 8080, 5000, 3000, 8001, 8002]
    for port in candidate_ports:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start_port


if __name__ == "__main__":
    port = find_available_port(8000)
    print("🚀 Starting TikTok Blur Cam FastAPI server...")
    print(f"📍 Local URL : http://localhost:{port}")
    print(f"📖 API Docs  : http://localhost:{port}/docs")
    uvicorn.run("api.index:app", host="127.0.0.1", port=port, reload=True)
