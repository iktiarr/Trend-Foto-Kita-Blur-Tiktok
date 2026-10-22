/**
 * TikTok Blur Cam – Clean Real-Time Peace Sign Blur
 * Tailwind UI, 100% Native Camera Color (Fix Blue Tint), Zero White-Screen Lag
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

const BLUR_STRENGTH = 60; // Gaussian Blur intensity

// State
let isPeaceSignDetected = false;
let latestHandLandmarks = null;
let isAudioPausedManually = false;
let isHandsProcessing = false;

// ---------------------------------------------------------------------------
// 1. Audio Controls & 2-Second Loop Delay
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

// Event saat lagu selesai: jeda 2 detik lalu putar ulang jika tidak sedang dijeda manual
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

// Tombol Play / Pause
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
        // Jika browser membatasi autoplay otomatis sebelum ada klik, tampilkan petunjuk
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
// 2. Tombol Panduan (Ikon ?)
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
// 3. Logika Deteksi Peace Sign (Index & Middle Up, Ring & Pinky Down)
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
// 4. Render Loop Kanvas (Warna 100% Asli Kamera Hardware, Nol Layar Putih)
// ---------------------------------------------------------------------------

function startRenderLoop() {
  function renderFrame() {
    if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
      if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
      }

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      if (isPeaceSignDetected) {
        // Efek Blur saat peace sign terdeteksi
        canvasCtx.filter = `blur(${BLUR_STRENGTH}px)`;
        canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.filter = 'none';
      } else {
        // Gambar LANGSUNG dari videoElement (Warna Asli, bukan texture WebGL MediaPipe yang terbalik)
        canvasCtx.filter = 'none';
        canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // Gambar skeleton untuk 1 atau 2 tangan jika terdeteksi
        if (latestHandLandmarks && latestHandLandmarks.length > 0 && window.drawConnectors && window.HAND_CONNECTIONS) {
          for (const landmarks of latestHandLandmarks) {
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

    requestAnimationFrame(renderFrame);
  }

  requestAnimationFrame(renderFrame);
}

// ---------------------------------------------------------------------------
// 5. Inisialisasi MediaPipe Hands & Kamera Langsung (Auto-Start)
// ---------------------------------------------------------------------------

async function initApp() {
  // 1. Putar audio otomatis
  tryPlayAudio();

  // 2. Mulai kamera langsung via getUserMedia native
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

    // 3. Mulai loop render kanvas seketika (langsung menampilkan gambar, tidak akan putih)
    startRenderLoop();
  } catch (err) {
    console.error('Kamera gagal dibuka:', err);
    alert('Mohon izinkan akses kamera pada browser Anda.');
    return;
  }

  // 4. Inisialisasi MediaPipe Hands di latar belakang
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

    hands.onResults((results) => {
      latestHandLandmarks = results.multiHandLandmarks || [];
      isPeaceSignDetected = latestHandLandmarks.some((landmarks) => isPeaceSign(landmarks));
    });

    // Loop pengiriman frame ke MediaPipe secara kontinu
    async function handDetectionLoop() {
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
      requestAnimationFrame(handDetectionLoop);
    }

    requestAnimationFrame(handDetectionLoop);
  } catch (err) {
    console.error('MediaPipe Hands init error:', err);
  }
}

// Jalankan otomatis begitu halaman dimuat
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
