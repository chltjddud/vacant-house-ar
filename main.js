import QRCode from 'qrcode';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

document.addEventListener('DOMContentLoaded', async () => {
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
  const ghostBlobUrls = {};

  // 1. Generate 3D Ghost GLTF Blob Models in Browser (Cyan, Purple, Gold)
  async function createGhostGLTFBlob(primaryHex, emissiveHex) {
    const scene = new THREE.Scene();
    const ghostGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.SphereGeometry(1, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryHex,
      roughness: 0.15,
      metalness: 0.1,
      emissive: emissiveHex,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.92
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    ghostGroup.add(bodyMesh);

    // Wavy Skirt / Tail
    const tailGeo = new THREE.CylinderGeometry(0.98, 0.15, 1.2, 32, 1, true);
    const tailMesh = new THREE.Mesh(tailGeo, bodyMat);
    tailMesh.position.y = -0.6;
    ghostGroup.add(tailMesh);

    // Glossy Dark Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
    const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.scale.set(1, 1.35, 0.6);
    leftEye.position.set(-0.3, 0.15, 0.88);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.scale.set(1, 1.35, 0.6);
    rightEye.position.set(0.3, 0.15, 0.88);

    ghostGroup.add(leftEye);
    ghostGroup.add(rightEye);

    // Blushing Cheeks
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff77aa, transparent: true, opacity: 0.6 });
    const cheekGeo = new THREE.SphereGeometry(0.09, 16, 16);

    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.scale.set(1.4, 0.8, 0.4);
    leftCheek.position.set(-0.5, -0.05, 0.84);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.scale.set(1.4, 0.8, 0.4);
    rightCheek.position.set(0.5, -0.05, 0.84);

    ghostGroup.add(leftCheek);
    ghostGroup.add(rightCheek);

    scene.add(ghostGroup);

    return new Promise((resolve) => {
      const exporter = new GLTFExporter();
      exporter.parse(
        scene,
        (gltf) => {
          const blob = new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' });
          const url = URL.createObjectURL(blob);
          resolve(url);
        },
        (err) => console.error(err),
        { binary: false }
      );
    });
  }

  // Pre-generate 3D Ghost Models
  ghostBlobUrls['1'] = await createGhostGLTFBlob(0xffffff, 0x00ffcc); // Cyan Ghost
  ghostBlobUrls['2'] = await createGhostGLTFBlob(0xf8fafc, 0xb026ff); // Purple Ghost
  ghostBlobUrls['3'] = await createGhostGLTFBlob(0xffffff, 0xffbb00); // Gold Key Ghost

  // Set default model
  arViewer.src = ghostBlobUrls['1'];

  // 2. Exhibit & Clue Selector
  exhibitCards.forEach(card => {
    card.addEventListener('click', () => {
      exhibitCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      activeClueId = card.dataset.clueId;
      const title = card.dataset.title;
      const desc = card.dataset.desc;

      if (ghostBlobUrls[activeClueId]) {
        arViewer.src = ghostBlobUrls[activeClueId];
      }

      docentTitle.textContent = title;
      docentDesc.textContent = desc;

      stopAudioDocent();
    });
  });

  // 3. Clue Collection Logic
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

  // 4. Audio Voice Hints
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

  // 5. QR Poster Modal Logic
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

  // 6. Download QR Image
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
