/**
 * TikTok Blur Cam – Direct Hardware Video Rendering with Multi-Mode Color Fix
 */

const videoElement = document.getElementById('webcam-video');
const skeletonCanvas = document.getElementById('skeleton-canvas');
const skeletonCtx = skeletonCanvas.getContext('2d');
const audio = document.getElementById('bg-audio');
const audioHint = document.getElementById('audio-hint');
const musicToggleBtn = document.getElementById('music-toggle-btn');
const musicIcon = document.getElementById('music-icon');
const colorToggleBtn = document.getElementById('color-toggle-btn');
const colorToast = document.getElementById('color-toast');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const btnCloseHelp = document.getElementById('btn-close-help');

const BLUR_STRENGTH = 60; // Intensitas Gaussian Blur

// Color modes: 'swap' (RGB Swap Matrix), 'hue' (Hue 180°), 'normal' (No filter)
const COLOR_MODES = ['swap', 'hue', 'normal'];
const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let colorModeIndex = 0; // Default: 'swap' on mobile (Langsung aktifkan anti-biru)

// Muat preferensi warna jika ada
const savedColorMode = localStorage.getItem('camera_color_mode');
if (savedColorMode && COLOR_MODES.includes(savedColorMode)) {
  colorModeIndex = COLOR_MODES.indexOf(savedColorMode);
} else if (!isMobileDevice) {
  // Laptop biasanya normal, jadi default normal
  colorModeIndex = COLOR_MODES.indexOf('normal');
}

let isPeaceSignDetected = false;
let isAudioPausedManually = false;
let isHandsProcessing = false;
let toastTimeout = null;

// ---------------------------------------------------------------------------
// 1. Logika Filter Warna & Blur
// ---------------------------------------------------------------------------

function getColorFilterString(withBlur = false) {
  const mode = COLOR_MODES[colorModeIndex];
  let filter = '';

  if (mode === 'swap') {
    filter = 'url(#swap-rb)';
  } else if (mode === 'hue') {
    filter = 'hue-rotate(180deg)';
  } else {
    filter = '';
  }

  if (withBlur) {
    filter = filter ? `${filter} blur(${BLUR_STRENGTH}px)` : `blur(${BLUR_STRENGTH}px)`;
  }

  return filter || 'none';
}

function applyCurrentFilter() {
  videoElement.style.filter = getColorFilterString(isPeaceSignDetected);
}

function showColorToast(text) {
  if (colorToast) {
    colorToast.innerText = text;
    colorToast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      colorToast.classList.remove('visible');
    }, 2000);
  }
}

// Tombol Ubah Warna Kamera
colorToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  colorModeIndex = (colorModeIndex + 1) % COLOR_MODES.length;
  const currentMode = COLOR_MODES[colorModeIndex];
  localStorage.setItem('camera_color_mode', currentMode);

  applyCurrentFilter();

  if (currentMode === 'swap') {
    showColorToast('🎨 Mode: Anti-Biru (RGB Swap)');
  } else if (currentMode === 'hue') {
    showColorToast('🎨 Mode: Anti-Biru (Hue 180°)');
  } else {
    showColorToast('🎨 Mode: Kamera Asli (Normal)');
  }
});

// ---------------------------------------------------------------------------
// 2. Audio Playback & Tombol Play / Pause (Jeda 2 Detik saat Loop)
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

// Event saat lagu selesai: jeda 2 detik lalu putar ulang
audio.addEventListener('ended', () => {
  if (!isAudioPausedManually) {
    setTimeout(() => {
      if (!isAudioPausedManually) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    }, 2000);
  }
});

// Klik tombol Play / Pause
musicToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (audio.paused) {
    isAudioPausedManually = false;
    audio.play().catch(() => {});
  } else {
    isAudioPausedManually = true;
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

        const unlockOnFirstTouch = () => {
          if (!isAudioPausedManually) {
            audio.play().catch(() => {});
          }
          if (audioHint) audioHint.classList.remove('visible');
          window.removeEventListener('click', unlockOnFirstTouch);
          window.removeEventListener('touchstart', unlockOnFirstTouch);
        };

        window.addEventListener('click', unlockOnFirstTouch);
        window.addEventListener('touchstart', unlockOnFirstTouch);
      });
  }
}

// ---------------------------------------------------------------------------
// 3. Tombol Panduan (Ikon ?)
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
// 4. Deteksi Peace Sign
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
// 5. Callback MediaPipe Hands
// ---------------------------------------------------------------------------

function onHandResults(results) {
  if (videoElement.videoWidth > 0) {
    if (skeletonCanvas.width !== videoElement.videoWidth || skeletonCanvas.height !== videoElement.videoHeight) {
      skeletonCanvas.width = videoElement.videoWidth;
      skeletonCanvas.height = videoElement.videoHeight;
    }
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

  isPeaceSignDetected = peaceDetected;
  applyCurrentFilter();

  // Bersihkan kanvas skeleton
  skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);

  // Jika tidak blur, gambar garis rangka untuk tangan yang terdeteksi
  if (!peaceDetected && hasHands && window.drawConnectors && window.HAND_CONNECTIONS) {
    for (const landmarks of results.multiHandLandmarks) {
      window.drawConnectors(skeletonCtx, landmarks, window.HAND_CONNECTIONS, {
        color: '#0066ff',
        lineWidth: 3,
      });
      if (window.drawLandmarks) {
        window.drawLandmarks(skeletonCtx, landmarks, {
          color: '#ff3b30',
          fillColor: '#ffffff',
          lineWidth: 1.5,
          radius: 4,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Inisialisasi Aplikasi (Langsung Muncul, Nol Layar Putih)
// ---------------------------------------------------------------------------

async function initApp() {
  tryPlayAudio();
  applyCurrentFilter();

  // Buka kamera native hardware
  try {
    const isPortrait = window.innerHeight > window.innerWidth;
    const constraints = {
      video: {
        facingMode: 'user',
        width: { ideal: isPortrait ? 720 : 1280 },
        height: { ideal: isPortrait ? 1280 : 720 },
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    videoElement.playsInline = true;
    videoElement.muted = true;
    await videoElement.play();

    videoElement.addEventListener('loadedmetadata', () => {
      skeletonCanvas.width = videoElement.videoWidth;
      skeletonCanvas.height = videoElement.videoHeight;
    });
  } catch (err) {
    console.error('Kamera gagal dimulai:', err);
    alert('Mohon izinkan akses kamera pada browser Anda.');
    return;
  }

  // Inisialisasi MediaPipe Hands di latar belakang
  try {
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

    async function detectionLoop() {
      if (!isHandsProcessing && videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
        isHandsProcessing = true;
        try {
          await hands.send({ image: videoElement });
        } catch (e) {
          console.warn('Hands error:', e);
        } finally {
          isHandsProcessing = false;
        }
      }
      requestAnimationFrame(detectionLoop);
    }

    requestAnimationFrame(detectionLoop);
  } catch (err) {
    console.error('MediaPipe Hands init error:', err);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
