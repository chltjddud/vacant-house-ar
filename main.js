import QRCode from 'qrcode';

document.addEventListener('DOMContentLoaded', () => {
  const arViewer = document.getElementById('ar-viewer');
  const exhibitCards = document.querySelectorAll('.exhibit-card');
  const docentTitle = document.getElementById('docent-title');
  const docentDesc = document.getElementById('docent-desc');
  const btnCollectClue = document.getElementById('btn-collect-clue');
  const btnPlayDocent = document.getElementById('btn-play-docent');
  const clueProgressText = document.getElementById('clue-progress-text');
  
  const escapeModal = document.getElementById('escape-modal');
  const btnCloseEscape = document.getElementById('btn-close-escape');

  const btnQrModal = document.getElementById('btn-qr-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const qrModal = document.getElementById('qr-modal');
  const qrTarget = document.getElementById('qrcode-target');
  const currentUrlDisplay = document.getElementById('current-url-display');
  const customUrlInput = document.getElementById('custom-url-input');
  const btnDownloadQr = document.getElementById('btn-download-qr');

  let activeClueId = '1';
  const collectedClues = new Set();
  let isSpeechPlaying = false;

  // Set initial 3D Ghost GLB Model to real_ghost.glb
  arViewer.src = '/real_ghost.glb';

  // 1. Exhibit & 3D Ghost Selector
  exhibitCards.forEach(card => {
    card.addEventListener('click', () => {
      exhibitCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      activeClueId = card.dataset.clueId;
      const modelUrl = card.dataset.model;
      const title = card.dataset.title;
      const desc = card.dataset.desc;

      if (modelUrl) {
        arViewer.src = modelUrl;
      }

      docentTitle.textContent = title;
      docentDesc.textContent = desc;

      stopAudioDocent();
    });
  });

  // 2. Clue Collection Logic
  btnCollectClue.addEventListener('click', () => {
    if (!collectedClues.has(activeClueId)) {
      collectedClues.add(activeClueId);
      
      const slotEl = document.getElementById(`slot-${activeClueId}`);
      if (slotEl) {
        slotEl.classList.add('collected');
      }

      const count = collectedClues.size;
      clueProgressText.textContent = `${count} / 3 수집 완료`;

      if (count === 3) {
        setTimeout(() => {
          escapeModal.classList.remove('hidden');
        }, 400);
      } else {
        alert(`단서 #${activeClueId} 획득 성공!\n폐교 곳곳을 계속 탐험하여 남은 단서를 찾으세요.`);
      }
    } else {
      alert(`이미 수집한 단서입니다. (단서 #${activeClueId})`);
    }
  });

  btnCloseEscape.addEventListener('click', () => {
    escapeModal.classList.add('hidden');
  });

  // 3. Audio Voice Hints
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
      const textToSpeak = `폐교의 안내음... ${title}. ${text}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.88;
      utterance.pitch = 0.85;

      utterance.onstart = () => { isSpeechPlaying = true; };
      utterance.onend = () => { isSpeechPlaying = false; };
      utterance.onerror = () => { isSpeechPlaying = false; };

      window.speechSynthesis.speak(utterance);
    }
  }

  function stopAudioDocent() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeechPlaying = false;
  }

  // 4. QR Poster Modal Logic
  btnQrModal.addEventListener('click', () => {
    qrModal.classList.remove('hidden');
    const currentUrl = window.location.href;
    customUrlInput.value = currentUrl;
    renderQrCode(currentUrl);
  });

  btnCloseModal.addEventListener('click', () => {
    qrModal.classList.add('hidden');
  });

  customUrlInput.addEventListener('input', (e) => {
    const targetUrl = e.target.value.trim() || window.location.href;
    renderQrCode(targetUrl);
  });

  function renderQrCode(url) {
    currentUrlDisplay.textContent = url;
    qrTarget.innerHTML = '';
    QRCode.toCanvas(url, { width: 170, margin: 2, color: { dark: '#0b0f19', light: '#ffffff' } }, (err, canvas) => {
      if (!err) qrTarget.appendChild(canvas);
    });
  }

  // 5. Download QR Image
  btnDownloadQr.addEventListener('click', () => {
    const canvas = qrTarget.querySelector('canvas');
    if (canvas) {
      const imageUri = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'haunted-school-ar-qr.png';
      link.href = imageUri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  });
});
