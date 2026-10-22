/**
 * TikTok Blur Cam – Clean Real-Time Peace Sign Blur (Light Theme, Natural Color, Responsive FOV)
 */

const videoElement = document.getElementById('webcam-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const audio = document.getElementById('bg-audio');
const audioHint = document.getElementById('audio-hint');
const musicToggleBtn = document.getElementById('music-toggle-btn');
const musicIcon = document.getElementById('music-icon');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const btnCloseHelp = document.getElementById('btn-close-help');

const BLUR_STRENGTH = 60; // Intensitas Gaussian Blur

// ---------------------------------------------------------------------------
// 1. Audio Playback & Kontrol Play / Pause
// ---------------------------------------------------------------------------

function updateMusicButtonState() {
  if (audio.paused) {
    musicIcon.innerText = '▶';
    musicToggleBtn.setAttribute('title', 'Putar Musik');
  } else {
    musicIcon.innerText = '⏸';
    musicToggleBtn.setAttribute('title', 'Jeda Musik');
  }
}

audio.addEventListener('play', () => {
  updateMusicButtonState();
  if (audioHint) audioHint.classList.remove('visible');
});

audio.addEventListener('pause', () => {
  updateMusicButtonState();
});

// Event saat lagu selesai: jeda 2 detik lalu putar ulang (loop)
audio.addEventListener('ended', () => {
  setTimeout(() => {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, 2000);
});

musicToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
});

function tryPlayAudio() {
  audio.volume = 0.7;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        updateMusicButtonState();
        if (audioHint) audioHint.classList.remove('visible');
      })
      .catch(() => {
        updateMusicButtonState();
        if (audioHint) audioHint.classList.add('visible');

        const unlockAudio = () => {
          audio.play().catch(() => {});
          if (audioHint) audioHint.classList.remove('visible');
          window.removeEventListener('click', unlockAudio);
          window.removeEventListener('touchstart', unlockAudio);
        };

        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);
      });
  }
}

// ---------------------------------------------------------------------------
// 2. Tombol Panduan (Ikon ?) di Pojok Atas
// ---------------------------------------------------------------------------

helpBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  helpModal.classList.add('open');
});

btnCloseHelp.addEventListener('click', () => {
  helpModal.classList.remove('open');
});

helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) {
    helpModal.classList.remove('open');
  }
});

// ---------------------------------------------------------------------------
// 3. Deteksi Peace Sign
// ---------------------------------------------------------------------------

function isExtended(landmarks, tipIdx, pipIdx) {
  return landmarks[tipIdx].y < landmarks[pipIdx].y;
}

function isPeaceSign(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  const indexUp   = isExtended(landmarks, 8, 6);
  const middleUp  = isExtended(landmarks, 12, 10);
  const ringDown  = !isExtended(landmarks, 16, 14);
  const pinkyDown = !isExtended(landmarks, 20, 18);
  return indexUp && middleUp && ringDown && pinkyDown;
}

// ---------------------------------------------------------------------------
// 4. Pemrosesan Video MediaPipe (Warna Asli Hardware Video, Tanpa Blue Filter)
// ---------------------------------------------------------------------------

function onHandResults(results) {
  // Gunakan resolusi asli videoElement untuk menjaga rasio aspek dan ketajaman
  const streamWidth = videoElement.videoWidth || (results.image && results.image.width) || 640;
  const streamHeight = videoElement.videoHeight || (results.image && results.image.height) || 480;

  if (canvasElement.width !== streamWidth || canvasElement.height !== streamHeight) {
    canvasElement.width = streamWidth;
    canvasElement.height = streamHeight;
  }

  const hasHands = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
  let peaceDetected = false;

  if (hasHands) {
    for (const landmarks of results.multiHandLandmarks) {
      if (isPeaceSign(landmarks)) {
        peaceDetected = true;
        break;
      }
    }
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // PENTING: Gunakan videoElement langsung (BUKAN results.image)
  // MediaPipe results.image menukar kanal Red-Blue di beberapa browser Android (bug warna biru).
  // videoElement memberikan warna 100% asli alami dari sensor kamera tanpa filter sama sekali.
  const sourceImage = (videoElement.readyState >= 2) ? videoElement : results.image;

  if (peaceDetected) {
    // Blur aktif ketika peace sign terdeteksi
    canvasCtx.filter = `blur(${BLUR_STRENGTH}px)`;
    canvasCtx.drawImage(sourceImage, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.filter = 'none';
  } else {
    // Kamera normal dengan warna 100% asli
    canvasCtx.filter = 'none';
    canvasCtx.drawImage(sourceImage, 0, 0, canvasElement.width, canvasElement.height);

    // Rangka garis tangan (skeleton) untuk kedua tangan jika terdeteksi
    if (hasHands && window.drawConnectors && window.HAND_CONNECTIONS) {
      for (const landmarks of results.multiHandLandmarks) {
        window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, {
          color: '#0066ff',
          lineWidth: 3,
        });
        if (window.drawLandmarks) {
          window.drawLandmarks(canvasCtx, landmarks, {
            color: '#ff3b30',
            fillColor: '#ffffff',
            lineWidth: 1.5,
            radius: 4,
          });
        }
      }
    }
  }

  canvasCtx.restore();
}

// ---------------------------------------------------------------------------
// 5. Inisialisasi Kamera Responsive (Jarak Luas / Tidak Zoom Terlalu Dekat)
// ---------------------------------------------------------------------------

async function initCamera() {
  tryPlayAudio();

  const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2, // Mendukung hingga 2 tangan
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onHandResults);

  // Sesuaikan resolusi kamera dengan orientasi layar HP (portrait vs landscape)
  // agar kamera tidak memaksa rasio landscape yang menyebabkan zoom ekstrem
  const isPortrait = window.innerHeight > window.innerWidth;
  const idealWidth = isPortrait ? 720 : 1280;
  const idealHeight = isPortrait ? 1280 : 720;

  const camera = new window.Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: idealWidth,
    height: idealHeight,
    facingMode: 'user', // Kamera depan (selfie)
  });

  await camera.start();
}

window.addEventListener('DOMContentLoaded', () => {
  initCamera();
});
