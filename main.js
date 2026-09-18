import QRCode from 'qrcode';

document.addEventListener('DOMContentLoaded', () => {
  const arViewer = document.getElementById('ar-viewer');
  const exhibitCards = document.querySelectorAll('.exhibit-card');
  const docentTitle = document.getElementById('docent-title');
  const docentDesc = document.getElementById('docent-desc');
  const btnPlayDocent = document.getElementById('btn-play-docent');
  const docentBtnText = document.getElementById('docent-btn-text');
  const audioWave = document.getElementById('audio-wave');
  const playIcon = document.getElementById('play-icon');

  const btnQrModal = document.getElementById('btn-qr-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const qrModal = document.getElementById('qr-modal');
  const qrTarget = document.getElementById('qrcode-target');
  const currentUrlDisplay = document.getElementById('current-url-display');
  const customUrlInput = document.getElementById('custom-url-input');
  const btnDownloadQr = document.getElementById('btn-download-qr');
  const compatibilityText = document.getElementById('compatibility-text');

  let isSpeechPlaying = false;
  let synthUtterance = null;

  // 1. WebXR AR Capability Check
  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
      if (supported) {
        compatibilityText.textContent = 'WebXR AR 호환 가능 (스마트폰 즉시 체험)';
      } else {
        compatibilityText.textContent = '3D 뷰어 모드 (AR 지원 기기 연결 권장)';
      }
    }).catch(() => {
      compatibilityText.textContent = '3D & AR QuickLook 스캐너 준비됨';
    });
  } else {
    compatibilityText.textContent = 'AR QuickLook / Model-Viewer 호환 모드';
  }

  // 2. Exhibit Switcher
  exhibitCards.forEach(card => {
    card.addEventListener('click', () => {
      exhibitCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const modelUrl = card.dataset.model;
      const title = card.dataset.title;
      const desc = card.dataset.desc;

      // Update 3D Model
      arViewer.src = modelUrl;

      // Update Docent Info
      docentTitle.textContent = title;
      docentDesc.textContent = desc;

      // Reset Audio if playing
      stopAudioDocent();
    });
  });

  // 3. Audio Docent (Text-to-Speech API)
  btnPlayDocent.addEventListener('click', () => {
    if (isSpeechPlaying) {
      stopAudioDocent();
    } else {
      playAudioDocent(docentTitle.textContent, docentDesc.textContent);
    }
  });

  function playAudioDocent(title, text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToSpeak = `전시 작품 안내입니다. ${title}. ${text}`;
      synthUtterance = new SpeechSynthesisUtterance(textToSpeak);
      synthUtterance.lang = 'ko-KR';
      synthUtterance.rate = 0.95;

      synthUtterance.onstart = () => {
        isSpeechPlaying = true;
        docentBtnText.textContent = '음성 정지';
        audioWave.classList.remove('hidden');
        playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
      };

      synthUtterance.onend = () => {
        stopAudioDocent();
      };

      synthUtterance.onerror = () => {
        stopAudioDocent();
      };

      window.speechSynthesis.speak(synthUtterance);
    } else {
      alert('이 브라우저는 오디오 음성 합성을 지원하지 않습니다.');
    }
  }

  function stopAudioDocent() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeechPlaying = false;
    docentBtnText.textContent = '오디오 도슨트 듣기';
    audioWave.classList.add('hidden');
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
  }

  // 4. QR Code Generator & Modal Logic
  btnQrModal.addEventListener('click', () => {
    qrModal.classList.remove('hidden');
    const currentUrl = window.location.href;
    customUrlInput.value = currentUrl;
    renderQrCode(currentUrl);
  });

  btnCloseModal.addEventListener('click', () => {
    qrModal.classList.add('hidden');
  });

  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) {
      qrModal.classList.add('hidden');
    }
  });

  customUrlInput.addEventListener('input', (e) => {
    const targetUrl = e.target.value.trim() || window.location.href;
    renderQrCode(targetUrl);
  });

  function renderQrCode(url) {
    currentUrlDisplay.textContent = url;
    qrTarget.innerHTML = '';

    QRCode.toCanvas(url, { width: 180, margin: 2, color: { dark: '#040914', light: '#ffffff' } }, (err, canvas) => {
      if (err) console.error(err);
      else qrTarget.appendChild(canvas);
    });
  }

  // 5. Download QR Image
  btnDownloadQr.addEventListener('click', () => {
    const canvas = qrTarget.querySelector('canvas');
    if (canvas) {
      const imageUri = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'vacant-house-ar-qr.png';
      link.href = imageUri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  });
});
