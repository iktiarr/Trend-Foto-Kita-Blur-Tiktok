import io
import os
import base64
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image, ImageFilter

app = FastAPI(
    title="TikTok Blur Cam API",
    description="FastAPI Backend untuk Trend Foto Kita Blur TikTok (Peace Sign Blur Effect)",
    version="1.0.0",
)

# Enable CORS for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to static directory
BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"


class Base64BlurRequest(BaseModel):
    image_base64: str
    blur_radius: int = 25


@app.get("/api/health")
def health_check():
    """Health check endpoint to verify API status."""
    return {
        "status": "online",
        "service": "TikTok Blur Cam API",
        "version": "1.0.0",
        "environment": "Vercel Serverless / Python",
    }


@app.get("/api/info")
def get_info():
    """Information and rules regarding the peace sign gesture and app settings."""
    return {
        "title": "TikTok Peace Sign Blur Cam Effect",
        "description": "Deteksi peace sign (✌️) untuk mengaktifkan efek blur kamera secara real-time.",
        "gesture_rules": {
            "index_finger": "Extended (Terangkat)",
            "middle_finger": "Extended (Terangkat)",
            "ring_finger": "Curled (Tertutup)",
            "pinky_finger": "Curled (Tertutup)",
        },
        "endpoints": {
            "/api/health": "GET - API Health check",
            "/api/info": "GET - Info & gesture rules",
            "/api/blur-image": "POST - Upload multipart image to apply Gaussian Blur",
            "/api/blur-base64": "POST - Send base64 image to receive blurred base64 image",
        },
    }


@app.post("/api/blur-image")
async def blur_image(
    file: UploadFile = File(...),
    blur_radius: int = Form(25),
):
    """
    Process an uploaded image and apply Gaussian blur effect.
    Returns the blurred image as JPEG.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, WebP)")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Apply Gaussian blur
        radius = max(1, min(blur_radius, 100))
        blurred_image = image.filter(ImageFilter.GaussianBlur(radius=radius))

        output_buffer = io.BytesIO()
        blurred_image.save(output_buffer, format="JPEG", quality=90)
        output_buffer.seek(0)

        return Response(content=output_buffer.getvalue(), media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses gambar: {str(e)}")


@app.post("/api/blur-base64")
async def blur_base64_image(payload: Base64BlurRequest):
    """
    Process a base64 encoded image and return the blurred version as base64.
    """
    try:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]

        image_data = base64.b64decode(raw_b64)
        image = Image.open(io.BytesIO(image_data))
        if image.mode != "RGB":
            image = image.convert("RGB")

        radius = max(1, min(payload.blur_radius, 100))
        blurred_image = image.filter(ImageFilter.GaussianBlur(radius=radius))

        output_buffer = io.BytesIO()
        blurred_image.save(output_buffer, format="JPEG", quality=90)
        output_buffer.seek(0)

        encoded_result = base64.b64encode(output_buffer.getvalue()).decode("utf-8")
        return {
            "status": "success",
            "blur_radius": radius,
            "image_base64": f"data:image/jpeg;base64,{encoded_result}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses gambar base64: {str(e)}")


# Serve public directory (HTML, CSS, JS) if running locally or as root
if PUBLIC_DIR.exists():
    index_file = PUBLIC_DIR / "index.html"
    style_file = PUBLIC_DIR / "style.css"
    app_js_file = PUBLIC_DIR / "app.js"

    @app.get("/", response_class=HTMLResponse)
    def read_root():
        if index_file.exists():
            return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
        return HTMLResponse(
            "<h1>TikTok Blur Cam API is running!</h1><p>Visit <a href='/docs'>/docs</a> for API documentation.</p>"
        )

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
        song_file = PUBLIC_DIR / "song.mp3"
        if song_file.exists():
            return FileResponse(song_file, media_type="audio/mpeg")
        raise HTTPException(status_code=404, detail="song.mp3 not found")

    @app.get("/favicon.ico", include_in_schema=False)
    def get_favicon():
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✌️</text></svg>'
        return Response(content=svg, media_type="image/svg+xml")

    app.mount("/static", StaticFiles(directory=str(PUBLIC_DIR)), name="static")
else:
    @app.get("/")
    def read_root():
        return {
            "message": "TikTok Blur Cam API is running",
            "docs": "/docs",
            "health": "/api/health",
        }

