from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="TikTok Blur Cam",
    description="TikTok Foto Kita Blur - Real-time camera blur",
    docs_url=None,  # Disable Swagger docs since APIs are removed
    redoc_url=None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"

if PUBLIC_DIR.exists():
    index_file = PUBLIC_DIR / "index.html"
    style_file = PUBLIC_DIR / "style.css"
    app_js_file = PUBLIC_DIR / "app.js"
    song_file = PUBLIC_DIR / "song.mp3"
    favicon_file = PUBLIC_DIR / "favicon.svg"

    @app.get("/", response_class=HTMLResponse)
    def read_root():
        if index_file.exists():
            return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
        return HTMLResponse("<h1>TikTok Blur Cam is running</h1>")

    @app.get("/style.css")
    def get_style():
        if style_file.exists():
            return FileResponse(style_file, media_type="text/css")
        raise HTTPException(status_code=404, detail="style.css not found")

    @app.get("/app.js")
    def get_app_js():
        if app_js_file.exists():
            return FileResponse(app_js_file, media_type="application/javascript")
        raise HTTPException(status_code=404, detail="app.js not found")

    @app.get("/song.mp3")
    def get_song():
        if song_file.exists():
            return FileResponse(song_file, media_type="audio/mpeg")
        raise HTTPException(status_code=404, detail="song.mp3 not found")

    @app.get("/favicon.svg")
    def get_favicon_svg():
        if favicon_file.exists():
            return FileResponse(favicon_file, media_type="image/svg+xml")
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✌️</text></svg>'
        return Response(content=svg, media_type="image/svg+xml")

    @app.get("/favicon.ico", include_in_schema=False)
    def get_favicon_ico():
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✌️</text></svg>'
        return Response(content=svg, media_type="image/svg+xml")

    app.mount("/static", StaticFiles(directory=str(PUBLIC_DIR)), name="static")
else:
    @app.get("/", response_class=HTMLResponse)
    def read_root():
        return HTMLResponse("<h1>TikTok Blur Cam</h1>")
