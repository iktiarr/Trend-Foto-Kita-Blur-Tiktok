/**
 * TikTok Blur Cam – Direct Hardware Video Rendering
 * Solves mobile blue tint completely by using native <video> with CSS blur filter.
 */

const videoElement = document.getElementById('webcam-video');
const skeletonCanvas = document.getElementById('skeleton-canvas');
const skeletonCtx = skeletonCanvas.getContext('2d');
const audio = document.getElementById('bg-audio');
const audioHint = document.getElementById('audio-hint');
const musicToggleBtn = document.getElementById('music-toggle-btn');
const musicIcon = document.getElementById('music-icon');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const btnCloseHelp = document.getElementById('btn-close-help');

const BLUR_STRENGTH = 60; // Intensitas Blur CSS

let isAudioPausedManually = false;
let isHandsProcessing = false;

// ---------------------------------------------------------------------------
// 1. Audio Playback & Tombol Play / Pause (Loop Jeda 2 Detik)
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
        // Jika browser membatasi autoplay otomatis sebelum ada interaksi
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
// 3. Logika Deteksi Peace Sign
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
// 4. Deteksi Tangan MediaPipe & Penerapan Efek Blur pada Video Asli
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

  // Bersihkan kanvas garis skeleton
  skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);

  if (peaceDetected) {
    // Terapkan efek Blur langsung pada elemen video asli
    // (Bebas dari bug penukaran warna merah-biru kanvas WebGL Android!)
    videoElement.style.filter = `blur(${BLUR_STRENGTH}px)`;
  } else {
    // Kembalikan video ke jernih (tanpa filter sama sekali)
    videoElement.style.filter = 'none';

    // Gambar garis bantuan rangka (skeleton) pada kanvas transparan
    if (hasHands && window.drawConnectors && window.HAND_CONNECTIONS) {
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
}

// ---------------------------------------------------------------------------
// 5. Inisialisasi Kamera Native (Langsung Muncul, Nol Layar Putih)
// ---------------------------------------------------------------------------

async function initApp() {
  // 1. Putar audio otomatis
  tryPlayAudio();

  // 2. Hubungkan kamera langsung via getUserMedia hardware video
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

    // Pastikan ukuran skeleton canvas sinkron saat video mulai berjalan
    videoElement.addEventListener('loadedmetadata', () => {
      skeletonCanvas.width = videoElement.videoWidth;
      skeletonCanvas.height = videoElement.videoHeight;
    });
  } catch (err) {
    console.error('Kamera gagal dimulai:', err);
    alert('Mohon izinkan akses kamera pada browser Anda.');
    return;
  }

  // 3. Inisialisasi MediaPipe Hands
  try {
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

    // Loop pemrosesan deteksi tangan berkelanjutan
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

// Jalankan otomatis saat halaman dimuat
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
