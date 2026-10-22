/**
 * TikTok Blur Cam – Clean Real-Time Peace Sign Blur (2-Hand Support & Music Controls)
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
// 1. Audio Playback & Tombol Play / Pause (Jeda 2 Detik saat Loop)
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

// Sinkronisasi status tombol saat audio berputar atau dijeda
audio.addEventListener('play', () => {
  updateMusicButtonState();
  if (audioHint) audioHint.classList.remove('visible');
});

audio.addEventListener('pause', () => {
  updateMusicButtonState();
});

// Event saat lagu selesai: jeda 2 detik lalu putar ulang
audio.addEventListener('ended', () => {
  setTimeout(() => {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, 2000);
});

// Toggle Play / Pause saat tombol musik diklik
musicToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
});

// Fungsi untuk memulai audio saat awal masuk
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
        // Autoplay dibatasi browser sebelum interaksi pengguna
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
// 4. Pemrosesan Video MediaPipe (Mendukung 2 Tangan)
// ---------------------------------------------------------------------------

function onHandResults(results) {
  if (canvasElement.width !== results.image.width || canvasElement.height !== results.image.height) {
    canvasElement.width = results.image.width;
    canvasElement.height = results.image.height;
  }

  const hasHands = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
  let peaceDetected = false;

  // Cek apakah ada salah satu tangan yang menunjukkan pose peace sign
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

  if (peaceDetected) {
    // Blur aktif ketika pose peace sign terbentuk
    canvasCtx.filter = `blur(${BLUR_STRENGTH}px)`;
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.filter = 'none';
  } else {
    // Kamera normal jernih
    canvasCtx.filter = 'none';
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Tampilkan garis bantuan rangka (skeleton) untuk KEDUA TANGAN jika terdeteksi
    if (hasHands && window.drawConnectors && window.HAND_CONNECTIONS) {
      for (const landmarks of results.multiHandLandmarks) {
        window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, {
          color: '#00f2fe',
          lineWidth: 3,
        });
        if (window.drawLandmarks) {
          window.drawLandmarks(canvasCtx, landmarks, {
            color: '#ff0050',
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
// 5. Inisialisasi Kamera & MediaPipe (Mendukung maxNumHands: 2)
// ---------------------------------------------------------------------------

async function initCamera() {
  tryPlayAudio();

  const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2, // Mendukung hingga 2 tangan sekaligus
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onHandResults);

  const camera = new window.Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 1280,
    height: 720,
    facingMode: 'user', // Kamera depan (selfie)
  });

  await camera.start();
}

window.addEventListener('DOMContentLoaded', () => {
  initCamera();
});
