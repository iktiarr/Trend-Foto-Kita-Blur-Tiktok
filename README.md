# ✌️ TikTok Blur Cam – Trend Foto Kita Blur (FastAPI + Vercel)

Efek kamera real-time trend TikTok "Foto Kita Blur" yang telah dimodernisasi menggunakan **FastAPI** dan siap dideploy langsung ke **Vercel**.

Tunjukkan pose **peace sign (✌️)** ke arah kamera, dan tampilan video otomatis **blur** dengan iringan audio latar musik. Pengguna juga dapat mengambil foto (snapshot) untuk diunggah ke TikTok atau media sosial lainnya.

---

## 🌟 Fitur Utama

- ⚡ **Real-Time 60 FPS di Browser**: Deteksi tangan dengan Google MediaPipe Hands langsung di sisi client (zero network latency).
- 🐍 **Backend FastAPI (Serverless-Ready)**:
  - `GET /` : Antarmuka Web App Interaktif
  - `GET /api/health` : Health check status API
  - `GET /api/info` : Aturan gestur tangan & metadata
  - `POST /api/blur-image` : Endpoint RESTful untuk memproses dan mengaburkan gambar yang diunggah
  - `POST /api/blur-base64` : Endpoint pemrosesan gambar format Base64
  - `GET /docs` : Dokumentasi interaktif Swagger UI bawaan FastAPI
- 🎵 **Audio Latar & Looping**: Built-in synth melody loop + pemutar file audio MP3 kustom (seperti lagu Sal Priadi).
- 📸 **Snapshot & Download**: Ambil foto dengan efek blur aktif hanya dengan 1 klik.
- 📱 **Mobile & Desktop Responsive**: Mendukung peralihan kamera depan (selfie) & kamera belakang HP.
- ☁️ **Siap Deploy ke Vercel**: Dilengkapi konfigurasi `vercel.json` dan dependencies Python yang ringan.

---

## 📂 Struktur Project

```text
Trend-Foto-Kita-Blur-Tiktok/
├── api/
│   └── index.py            # Entrypoint backend FastAPI (Vercel serverless function)
├── public/                 # Frontend web assets (disajikan via CDN Vercel)
│   ├── index.html          # Web UI kamera fullscreen
│   ├── style.css           # Styling clean & minimalis
│   ├── app.js              # MediaPipe Hands (2 tangan), audio controls & gesture blur
│   └── song.mp3            # Musik latar (loop jeda 2 detik)
├── main.py                 # Runner lokal dengan auto-detect port bebas
├── vercel.json             # Konfigurasi deployment Vercel
├── requirements.txt        # Dependencies Python untuk FastAPI
└── README.md
```

---

## 🚀 Menjalankan Secara Lokal

### 1. Install Dependencies

Pastikan Python (>= 3.10) sudah terpasang, lalu jalankan:

```bash
pip install -r requirements.txt
```

*(Di Windows jika perintah `python` belum terdaftar di PATH, gunakan `py -m pip install -r requirements.txt`)*

### 2. Jalankan Server FastAPI

Jalankan perintah:

```bash
python main.py
```

atau menggunakan Uvicorn langsung:

```bash
uvicorn api.index:app --reload
```

### 3. Buka di Browser

- 🌐 **Web App Utama**: [http://localhost:8000](http://localhost:8000)
- 📖 **Dokumentasi Swagger API**: [http://localhost:8000/docs](http://localhost:8000/docs)
- 🩺 **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## ☁️ Cara Deploy ke Vercel

### Metode 1: Menggunakan Git & Dashboard Vercel (Paling Mudah)

1. Push project ini ke repository GitHub / GitLab / Bitbucket Anda:
   ```bash
   git add .
   git commit -m "feat: convert project to FastAPI with Vercel support"
   git push origin main
   ```
2. Buka [vercel.com](https://vercel.com) dan login.
3. Klik **"Add New..."** → **"Project"**.
4. Pilih repository project ini dari daftar.
5. Vercel akan otomatis mendeteksi file `vercel.json` dan `requirements.txt`.
6. Klik **"Deploy"**. Selesai! Web app Anda langsung aktif secara global dengan HTTPS gratis.

---

### Metode 2: Menggunakan Vercel CLI

1. Pasang Vercel CLI (jika belum):
   ```bash
   npm i -g vercel
   ```
2. Login ke akun Vercel:
   ```bash
   vercel login
   ```
3. Deploy langsung dari terminal:
   ```bash
   vercel
   ```
4. Untuk deployment versi produksi:
   ```bash
   vercel --prod
   ```

---

## ✌️ Aturan Gestur Deteksi Peace Sign

| Jari | Kriteria Pose | Cara Kerja Deteksi |
|---|---|---|
| **Telunjuk (Index)** | 🟢 Terangkat (Extended) | Posisi Y ujung jari (tip #8) lebih tinggi dari sendi (PIP #6) |
| **Tengah (Middle)** | 🟢 Terangkat (Extended) | Posisi Y ujung jari (tip #12) lebih tinggi dari sendi (PIP #10) |
| **Manis (Ring)** | 🔴 Tertutup (Curled) | Posisi Y ujung jari (tip #16) lebih rendah dari sendi (PIP #14) |
| **Kelingking (Pinky)** | 🔴 Tertutup (Curled) | Posisi Y ujung jari (tip #20) lebih rendah dari sendi (PIP #18) |

Ketika ke-4 syarat di atas terpenuhi secara bersamaan pada salah satu tangan, filter **Gaussian Blur** otomatis aktif.

---

## 💻 Menggunakan REST API FastAPI Secara Programatis

Selain melalui antarmuka web, Anda juga dapat memanggil API pemrosesan gambar dari aplikasi lain:

### Endpoint `POST /api/blur-image` (Multipart Form)

```bash
curl -X POST "http://localhost:8000/api/blur-image" \
  -F "file=@foto_kamu.jpg" \
  -F "blur_radius=35" \
  --output foto_blur.jpg
```

### Endpoint `POST /api/blur-base64` (JSON)

```json
POST /api/blur-base64
Content-Type: application/json

{
  "image_base64": "data:image/jpeg;base64,...",
  "blur_radius": 30
}
```

---

## 📌 Catatan Teknis (Mengapa OpenCV Desktop Digantikan untuk Vercel)

Pada script desktop sebelumnya (`foto_kita_blur.py`), program menggunakan:
1. `cv2.VideoCapture(0)` yang membutuhkan hardware webcam fisik pada mesin lokal.
2. `cv2.imshow` yang membutuhkan display server (X11 / Windows GUI).
3. `pygame.mixer` yang memutar audio langsung ke speaker laptop.

Pada lingkungan serverless cloud seperti **Vercel**:
- Server berjalan tanpa layar (headless) dan tanpa webcam fisik.
- AWS Lambda memiliki batasan ukuran package (250 MB). Library `mediapipe` Python dan `opencv-python` sering kali melampaui batasan ini dan mengalami error dependensi sistem (`libGL.so.1 missing`).
- Oleh karena itu, arsitektur baru ini:
  - Memproses deteksi kamera langsung di browser via **MediaPipe CDN WebGL** (sangat responsif, 60 FPS, dan hemat kuota/server).
  - Menyediakan **FastAPI** di server untuk menyediakan REST API, endpoint pengolahan gambar berbasis `Pillow` yang ringan (< 10 MB), dan menyajikan aplikasi secara menyeluruh.

---

*Selamat berkreasi dengan tren TikTok Foto Kita Blur! ✌️*
