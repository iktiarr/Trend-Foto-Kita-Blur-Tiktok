/**
 * TikTok Blur Cam – Direct Hardware Video Rendering
 * Features:
 * 1. Silky-Smooth Cinematic Blur Animation (Fade-in on pose, Fade-out on release)
 * 2. Multi-Mode Anti-Blue Color Correction (RGB Swap Matrix, Hue 180°, Normal)
 * 3. 2-Hand Support with Smooth Skeleton Crossfade
 * 4. Audio Looper with 2-Second Pause & True Pause Control
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

// Blur Animation Configuration
const MAX_BLUR = 60; // Intensitas blur maksimal (px)
const BLUR_LERP_SPEED = 0.22; // Kecepatan transisi: cepat, responsif & tetap halus (~200ms)
let currentBlur = 0;
let targetBlur = 0;

// Color Modes: 'swap' (RGB Swap Matrix), 'hue' (Hue 180°), 'normal' (No filter)
const COLOR_MODES = ['swap', 'hue', 'normal'];
const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let colorModeIndex = 0; // Default: 'swap' (Anti-Biru aktif di awal untuk mobile)

const savedColorMode = localStorage.getItem('camera_color_mode');
if (savedColorMode && COLOR_MODES.includes(savedColorMode)) {
  colorModeIndex = COLOR_MODES.indexOf(savedColorMode);
} else if (!isMobileDevice) {
  colorModeIndex = COLOR_MODES.indexOf('normal');
}

let isPeaceSignDetected = false;
let isAudioPausedManually = false;
let isHandsProcessing = false;
let latestHandLandmarks = [];
let toastTimeout = null;

// ---------------------------------------------------------------------------
// 1. Animasi Blur Halus (Cinematic Linear Interpolation Loop)
// ---------------------------------------------------------------------------

function updateBlurAnimation() {
  targetBlur = isPeaceSignDetected ? MAX_BLUR : 0;

  // LERP: Transisi bertahap antara blur saat ini dan target
  const diff = targetBlur - currentBlur;
  if (Math.abs(diff) > 0.05) {
    currentBlur += diff * BLUR_LERP_SPEED;
  } else {
    currentBlur = targetBlur;
  }

  // Rakit filter gabungan (Color Mode + Nilai Blur Bertahap)
  const mode = COLOR_MODES[colorModeIndex];
  let filterStr = '';

  if (mode === 'swap') {
    filterStr = 'url(#swap-rb)';
  } else if (mode === 'hue') {
    filterStr = 'hue-rotate(180deg)';
  }

  if (currentBlur > 0.2) {
    const blurPart = `blur(${currentBlur.toFixed(1)}px)`;
    filterStr = filterStr ? `${filterStr} ${blurPart}` : blurPart;
  }

  videoElement.style.filter = filterStr || 'none';

  // Render Skeleton dengan efek memudar (crossfade) lembut
  renderSkeletonWithFade();

  requestAnimationFrame(updateBlurAnimation);
}

function renderSkeletonWithFade() {
  skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);

  // Skeleton memudar halus saat blur naik (0 - 15px), dan muncul halus saat blur turun
  const fadeAlpha = Math.max(0, Math.min(1, 1 - (currentBlur / 15)));

  if (fadeAlpha > 0.01 && latestHandLandmarks.length > 0 && window.drawConnectors && window.HAND_CONNECTIONS) {
    skeletonCtx.save();
    skeletonCtx.globalAlpha = fadeAlpha;

    for (const landmarks of latestHandLandmarks) {
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

    skeletonCtx.restore();
  }
}

// ---------------------------------------------------------------------------
// 2. Tombol & Notifikasi Warna Kamera
// ---------------------------------------------------------------------------

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

colorToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  colorModeIndex = (colorModeIndex + 1) % COLOR_MODES.length;
  const currentMode = COLOR_MODES[colorModeIndex];
  localStorage.setItem('camera_color_mode', currentMode);

  if (currentMode === 'swap') {
    showColorToast('🎨 Mode: Anti-Biru (RGB Swap)');
  } else if (currentMode === 'hue') {
    showColorToast('🎨 Mode: Anti-Biru (Hue 180°)');
  } else {
    showColorToast('🎨 Mode: Kamera Asli (Normal)');
  }
});

// ---------------------------------------------------------------------------
// 3. Audio Controls & 2-Second Loop Delay
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

// Event saat lagu selesai: jeda 2 detik lalu putar ulang JIKA tidak dijeda manual
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
// 4. Tombol Panduan (Ikon ?)
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
// 5. Logika Deteksi Peace Sign
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
// 6. Callback MediaPipe Hands
// ---------------------------------------------------------------------------

function onHandResults(results) {
  if (videoElement.videoWidth > 0) {
    if (skeletonCanvas.width !== videoElement.videoWidth || skeletonCanvas.height !== videoElement.videoHeight) {
      skeletonCanvas.width = videoElement.videoWidth;
      skeletonCanvas.height = videoElement.videoHeight;
    }
  }

  const hasHands = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
  latestHandLandmarks = results.multiHandLandmarks || [];

  let peaceDetected = false;
  if (hasHands) {
    for (const landmarks of results.multiHandLandmarks) {
      if (isPeaceSign(landmarks)) {
        peaceDetected = true;
        break;
      }
    }
  }

  // Set state peace sign (Animasi blur akan ditransisikan secara halus di updateBlurAnimation loop)
  isPeaceSignDetected = peaceDetected;
}

// ---------------------------------------------------------------------------
// 7. Inisialisasi Aplikasi (Native Video + Background Detection)
// ---------------------------------------------------------------------------

async function initApp() {
  tryPlayAudio();

  // Buka kamera hardware langsung
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

    // Mulai loop animasi blur bertahap (60 FPS LERP)
    requestAnimationFrame(updateBlurAnimation);
  } catch (err) {
    console.error('Kamera gagal dimulai:', err);
    alert('Mohon izinkan akses kamera pada browser Anda.');
    return;
  }

  // Inisialisasi MediaPipe Hands
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
          console.warn('Hands process frame error:', e);
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
