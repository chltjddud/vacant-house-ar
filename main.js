import QRCode from 'qrcode';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quest State & LocalStorage
  const STORAGE_KEY = 'seungpyeong_ar_quest_state_v2';
  let state = {
    currentStage: 1,
    companion: '가족 (어린이 포함)',
    theme: '모험·추리',
    time: '90분 코스',
    collectedLetters: 0,
    hasStamp: false,
    branchChoice: 'market',
    userVote: null,
    ghostAffinity: 0,
    footstepProgress: 0
  };

  let cameraStream = null;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state = { ...state, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to load saved quest state', e);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateUI();
  }

  // 2. Stage Elements
  const stages = document.querySelectorAll('.quest-stage');
  const stepDots = document.querySelectorAll('.step-dot');
  const stepperLabel = document.getElementById('stepper-label');
  const inventorySummary = document.getElementById('inventory-summary');

  const stageTitles = {
    1: '1단계 / 마을 입구',
    2: '2단계 / 첫 번째 빈집 (카메라 AR)',
    3: '3단계 / 마을 골목길 (바닥 AR 발자국)',
    4: '4단계 / 두 번째 빈집',
    5: '5단계 / 지역 상권 연계',
    6: '6단계 / 마지막 빈집',
    7: '7단계 / 에필로그 & 미래'
  };

  function updateUI() {
    stages.forEach(s => s.classList.remove('active'));
    const currentSection = document.getElementById(`stage-${state.currentStage}`);
    if (currentSection) {
      currentSection.classList.add('active');
    }

    stepDots.forEach(dot => {
      const stepNum = parseInt(dot.dataset.step, 10);
      dot.classList.remove('active', 'completed');
      if (stepNum === state.currentStage) {
        dot.classList.add('active');
      } else if (stepNum < state.currentStage) {
        dot.classList.add('completed');
      }
    });

    stepperLabel.textContent = stageTitles[state.currentStage] || `${state.currentStage}단계`;
    inventorySummary.textContent = `수집 편지 ${state.collectedLetters}/3 · 스탬프 ${state.hasStamp ? '1개' : '0개'}`;

    // Stage 2 Affinity HUD
    const camAffinityText = document.getElementById('cam-affinity-text');
    const camAffinityFill = document.getElementById('cam-affinity-fill');
    const btnNextStage2 = document.getElementById('btn-next-stage-2');
    const stage2Reward = document.getElementById('stage-2-reward');
    const camSpeechTextEl = document.getElementById('cam-speech-text');

    if (camAffinityText && camAffinityFill) {
      camAffinityText.textContent = `${state.ghostAffinity}%`;
      camAffinityFill.style.width = `${state.ghostAffinity}%`;
    }

    if (btnNextStage2) {
      if (state.ghostAffinity >= 100) {
        btnNextStage2.removeAttribute('disabled');
        btnNextStage2.querySelector('span').textContent = '골목길로 이동하여 단서 찾기';
        if (stage2Reward) stage2Reward.classList.remove('hidden');
      } else {
        btnNextStage2.setAttribute('disabled', 'true');
        btnNextStage2.querySelector('span').textContent = `유령과 친해져서 퀘스트 받기 (${state.ghostAffinity}%)`;
        if (stage2Reward) stage2Reward.classList.add('hidden');
        if (camSpeechTextEl && state.ghostAffinity === 0) {
          camSpeechTextEl.textContent = '"안녕! 카메라 속 나를 톡톡 만져보거나 아래 버튼으로 놀아줘!"';
        }
      }
    }

    // Stage 3 Footstep Progress HUD & Elements
    const footstepCountText = document.getElementById('footstep-count-text');
    const footstepFillBar = document.getElementById('footstep-fill-bar');
    const btnNextStage3 = document.getElementById('btn-next-stage-3');
    const stage3Reward = document.getElementById('stage-3-reward');
    const footprintLauncherCard = document.getElementById('footprint-launcher-card');
    const cameraArBox3 = document.getElementById('camera-ar-box-3');

    if (footstepCountText && footstepFillBar) {
      const pct = Math.round((state.footstepProgress / 3) * 100);
      footstepCountText.textContent = `${state.footstepProgress} / 3 걸음`;
      footstepFillBar.style.width = `${pct}%`;
    }

    if (btnNextStage3) {
      if (state.footstepProgress >= 3) {
        btnNextStage3.removeAttribute('disabled');
        btnNextStage3.querySelector('span').textContent = '두 번째 빈집으로 진입';
        if (stage3Reward) stage3Reward.classList.remove('hidden');
      } else {
        btnNextStage3.setAttribute('disabled', 'true');
        btnNextStage3.querySelector('span').textContent = `발자국을 모두 따라가고 다음으로 이동 (${state.footstepProgress}/3)`;
      }
    }

    // Update Footprint nodes visual state
    for (let i = 1; i <= 3; i++) {
      const node = document.getElementById(`footprint-${i}`);
      if (node) {
        if (i <= state.footstepProgress) {
          node.classList.remove('locked');
          node.classList.add('stepped');
        } else if (i === state.footstepProgress + 1) {
          node.classList.remove('locked');
        } else {
          node.classList.add('locked');
        }
      }
    }
    const destNode = document.getElementById('footprint-4');
    if (destNode) {
      if (state.footstepProgress >= 3) {
        destNode.classList.remove('locked');
        destNode.classList.add('stepped');
      } else {
        destNode.classList.add('locked');
      }
    }

    // Camera Management
    if (state.currentStage === 2) {
      startLiveCamera('live-camera-video-2');
    } else if (state.currentStage === 3) {
      // In Stage 3, if camera viewport is already revealed, keep camera alive
      if (cameraArBox3 && !cameraArBox3.classList.contains('hidden')) {
        startLiveCamera('live-camera-video-3');
      }
    } else {
      stopLiveCamera();
    }

    // Dynamic Branch Content for Stage 5
    const stage5Title = document.getElementById('stage-5-title');
    const stage5Desc = document.getElementById('stage-5-desc');
    const couponStoreName = document.getElementById('coupon-store-name');

    if (state.branchChoice === 'market') {
      if (stage5Title) stage5Title.textContent = '승평 전통 오일장 사랑방 카페';
      if (stage5Desc) stage5Desc.textContent = '시장 어귀에 위치한 마을 카페에 방문했습니다. 카운터에서 스탬프를 확인하고 실물 할인 혜택을 이용하세요!';
      if (couponStoreName) couponStoreName.textContent = '승평 사랑방 카페 음료 1,000원 할인권';
    } else {
      if (stage5Title) stage5Title.textContent = '옛 분교 추억의 베이커리 쉼터';
      if (stage5Desc) stage5Desc.textContent = '아이들 웃음소리가 머물던 분교 쉼터에 방문했습니다. 카운터에서 스탬프를 확인하고 따뜻한 간식 혜택을 이용하세요!';
      if (couponStoreName) couponStoreName.textContent = '옛 분교 베이커리 쉼터 음료 1,000원 할인권';
    }

    // Dynamic Letter Body for Stage 6
    const finalLetterBody = document.getElementById('final-letter-body');
    if (finalLetterBody) {
      if (state.branchChoice === 'market') {
        finalLetterBody.innerHTML = `
          "친애하는 영희에게.<br><br>
          승평마을의 가을은 유난히 따뜻했단다. 북적이는 오일장 시장 골목마다 서로의 안부를 묻던 이웃들의 정, 마당에서 함께 음식을 나누던 이 집에서 우리는 참 행복했지. 비록 세월이 흘러 집은 잠시 비워지겠지만, 언젠가 우리 마을을 찾아올 따뜻한 여행자들의 발걸음으로 이 자리가 다시 빛날 것이라 믿는다."
        `;
      } else {
        finalLetterBody.innerHTML = `
          "친애하는 영희에게.<br><br>
          승평마을의 가을은 유난히 따뜻했단다. 학교 종소리에 맞춰 골목을 뛰어가던 아이들의 발자국 소리, 마을 사람들이 배움을 나누던 이 집에서 우리는 참 행복했지. 비록 세월이 흘러 집은 잠시 비워지겠지만, 언젠가 우리 마을을 찾아올 따뜻한 여행자들의 발걸음으로 이 자리가 다시 빛날 것이라 믿는다."
        `;
      }
    }
  }

  // 3. Stage 1 Logic (Onboarding)
  const onboardingForm = document.getElementById('onboarding-form');
  const chipContainers = document.querySelectorAll('.choice-chips');
  const aiMissionText = document.getElementById('ai-mission-text');

  chipContainers.forEach(container => {
    const chips = container.querySelectorAll('.chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const choiceType = container.dataset.choice;
        state[choiceType] = chip.dataset.value;
        updateMissionPreview();
      });
    });
  });

  function updateMissionPreview() {
    if (state.companion.includes('어린이')) {
      aiMissionText.textContent = `"${state.companion}과 함께하는 ${state.theme} 탐험 코스(${state.time})가 생성되었습니다. 첫 번째 빈집으로 이동하여 카메라 속 공중 유령을 만나보세요."`;
    } else {
      aiMissionText.textContent = `"${state.companion}을 위한 ${state.theme} 탐험 코스(${state.time})가 생성되었습니다. 첫 번째 빈집으로 이동하여 카메라 속 공중 유령과 대화를 나누어 보세요."`;
    }
  }

  if (onboardingForm) {
    onboardingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.ghostAffinity = 0;
      state.footstepProgress = 0;
      state.collectedLetters = 0;
      state.currentStage = 2;
      saveState();
      playDocent("첫 번째 빈집에 도착했습니다. 카메라 화면 속 유령과 교감하여 첫 퀘스트를 받아보세요.");
    });
  }

  // 4. Camera Stream Utility
  async function startLiveCamera(videoId) {
    const vid = document.getElementById(videoId);
    if (!vid) return;

    if (cameraStream && vid.srcObject === cameraStream) {
      try { await vid.play(); } catch (e) {}
      return;
    }

    stopLiveCamera();

    try {
      const constraints = {
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      vid.srcObject = cameraStream;
      vid.setAttribute('playsinline', '');
      vid.setAttribute('autoplay', '');
      vid.setAttribute('muted', '');
      await vid.play();
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
    }
  }

  function stopLiveCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
  }

  // 5. Stage 2 Logic (LIVE CAMERA AR + ON-CAMERA AFFINITY INTERACTION)
  const viewerStage2 = document.getElementById('viewer-stage-2');
  const camSpeechText = document.getElementById('cam-speech-text');
  const particleContainer2 = document.getElementById('particle-container-2');
  const btnCamPet = document.getElementById('btn-cam-pet');
  const btnCamFeed = document.getElementById('btn-cam-feed');
  const btnCamVoice = document.getElementById('btn-cam-voice');
  const btnNextStage2 = document.getElementById('btn-next-stage-2');

  function spawnParticle(container, emoji) {
    if (!container) return;
    const particle = document.createElement('div');
    particle.className = 'floating-particle';
    particle.textContent = emoji;
    const x = 40 + Math.random() * 20;
    const y = 45 + Math.random() * 15;
    particle.style.left = `${x}%`;
    particle.style.top = `${y}%`;
    container.appendChild(particle);
    setTimeout(() => {
      if (particle.parentNode) particle.parentNode.removeChild(particle);
    }, 1200);
  }

  function addAffinity(amount = 25, emoji = '❤️') {
    if (state.ghostAffinity >= 100) return;

    state.ghostAffinity = Math.min(100, state.ghostAffinity + amount);

    let currentDialog = '';
    if (state.ghostAffinity >= 100) {
      currentDialog = `"와아! 친밀도 100% 달성! 우체부 아저씨의 첫 번째 편지 조각을 드릴게요. 골목길로 가보세요!"`;
    } else if (state.ghostAffinity === 75) {
      currentDialog = `"이제 거의 다 친해졌어요! 조금만 더 교감해 주세요!"`;
    } else if (state.ghostAffinity === 50) {
      currentDialog = `"따뜻한 마음이 전해져요! 점점 기운이 솟아나고 있어요!"`;
    } else {
      currentDialog = `"헤헤, 간지러워요! 여러분이 절 알아봐 줘서 정말 기뻐요!"`;
    }

    if (camSpeechText) camSpeechText.textContent = currentDialog;
    playDocent(currentDialog);

    spawnParticle(particleContainer2, emoji);
    spawnParticle(particleContainer2, emoji);

    if (viewerStage2) {
      viewerStage2.cameraOrbit = `${Math.random() * 50 - 25}deg 75deg 2.5m`;
    }

    if (state.ghostAffinity >= 100) {
      state.collectedLetters = Math.max(1, state.collectedLetters);
      spawnParticle(particleContainer2, '🎉');
      spawnParticle(particleContainer2, '✉️');
    }
    saveState();
  }

  if (viewerStage2) {
    viewerStage2.addEventListener('click', () => {
      addAffinity(25, '✨');
    });
  }

  if (btnCamPet) {
    btnCamPet.addEventListener('click', (e) => {
      e.stopPropagation();
      addAffinity(25, '❤️');
    });
  }

  if (btnCamFeed) {
    btnCamFeed.addEventListener('click', (e) => {
      e.stopPropagation();
      addAffinity(25, '⭐');
    });
  }

  if (btnCamVoice) {
    btnCamVoice.addEventListener('click', (e) => {
      e.stopPropagation();
      addAffinity(25, '🗣️');
    });
  }

  if (btnNextStage2) {
    btnNextStage2.addEventListener('click', () => {
      stopLiveCamera();
      state.currentStage = 3;
      saveState();
      playDocent("골목길에 도착했습니다. 발자국 찾기 버튼을 눌러 바닥의 옛 흔적을 찾아보세요.");
    });
  }

  // 6. Stage 3 Logic (FLOOR AR FOOTPRINTS & CLUE DISCOVERY)
  const floorHintText = document.getElementById('floor-hint-text');
  const btnStepForward = document.getElementById('btn-step-forward');
  const btnNextStage3 = document.getElementById('btn-next-stage-3');
  const btnStartFootprintCam = document.getElementById('btn-start-footprint-cam');
  const footprintLauncherCard = document.getElementById('footprint-launcher-card');
  const cameraArBox3 = document.getElementById('camera-ar-box-3');

  // "발자국 찾기" (카메라 켜기) 버튼 클릭 핸들러
  if (btnStartFootprintCam) {
    btnStartFootprintCam.addEventListener('click', async () => {
      if (footprintLauncherCard) footprintLauncherCard.classList.add('hidden');
      if (cameraArBox3) cameraArBox3.classList.remove('hidden');
      await startLiveCamera('live-camera-video-3');
      playDocent("카메라로 바닥을 비추며 황금빛 우체부 발자국을 따라가세요.");
    });
  }

  const footprintClues = [
    "바닥 단서 1: 1978년 승평우체국 소인이 찍힌 낡은 우표 조각 발견!",
    "바닥 단서 2: '빨간 대문 앞 돌담 틈새를 확인하라'는 우체부의 옛 메모 발견!",
    "목적지 도착! 빨간 대문 우편함에서 두 번째 편지 조각을 찾았습니다!"
  ];

  let isAutoTransitioning = false;

  function stepFootprint(stepNum) {
    if (stepNum > state.footstepProgress + 1) return;
    if (state.footstepProgress >= 3) return;

    state.footstepProgress = Math.min(3, state.footstepProgress + 1);
    const clueText = footprintClues[state.footstepProgress - 1];

    if (floorHintText) floorHintText.textContent = clueText;
    playDocent(clueText);

    if (state.footstepProgress >= 3) {
      state.collectedLetters = Math.max(2, state.collectedLetters);
      saveState();

      if (floorHintText) {
        floorHintText.textContent = `"모든 발자국을 찾았습니다! 두 번째 빈집으로 이동합니다..."`;
      }
      playDocent("우체부의 발자국을 모두 따라왔습니다! 두 번째 빈집으로 이동합니다.");

      // Automatically move to Stage 4 after following all footprints
      if (!isAutoTransitioning) {
        isAutoTransitioning = true;
        setTimeout(() => {
          if (state.currentStage === 3) {
            stopLiveCamera();
            state.currentStage = 4;
            saveState();
            playDocent("두 번째 빈집에 도착했습니다. 우체부가 향했던 길을 선택해 주세요.");
          }
          isAutoTransitioning = false;
        }, 2000);
      }
    } else {
      saveState();
    }
  }

  // Click on footprint nodes
  for (let i = 1; i <= 3; i++) {
    const node = document.getElementById(`footprint-${i}`);
    if (node) {
      node.addEventListener('click', () => stepFootprint(i));
    }
  }

  if (btnStepForward) {
    btnStepForward.addEventListener('click', () => {
      stepFootprint(state.footstepProgress + 1);
    });
  }

  if (btnNextStage3) {
    btnNextStage3.addEventListener('click', () => {
      stopLiveCamera();
      state.currentStage = 4;
      saveState();
      playDocent("두 번째 빈집에 도착했습니다. 우체부가 향했던 길을 선택해 주세요.");
    });
  }

  // 7. Stage 4 Logic (Branch Selection)
  const btnChoiceMarket = document.getElementById('btn-choice-market');
  const btnChoiceSchool = document.getElementById('btn-choice-school');

  if (btnChoiceMarket) {
    btnChoiceMarket.addEventListener('click', () => {
      state.branchChoice = 'market';
      state.currentStage = 5;
      state.hasStamp = true;
      state.collectedLetters = 3;
      saveState();
      playDocent("활기찬 전통 오일장 시장 코스로 이동합니다. 제휴 상점 쿠폰이 발급되었습니다.");
    });
  }

  if (btnChoiceSchool) {
    btnChoiceSchool.addEventListener('click', () => {
      state.branchChoice = 'school';
      state.currentStage = 5;
      state.hasStamp = true;
      state.collectedLetters = 3;
      saveState();
      playDocent("추억의 옛 분교 학교 코스로 이동합니다. 제휴 상점 쿠폰이 발급되었습니다.");
    });
  }

  // 8. Stage 5 Logic (Shop & Discount Coupon)
  const btnNextStage5 = document.getElementById('btn-next-stage-5');
  if (btnNextStage5) {
    btnNextStage5.addEventListener('click', () => {
      state.currentStage = 6;
      saveState();
      playDocent("마지막 빈집에 도착했습니다. 세 조각의 편지가 하나로 완성됩니다.");
    });
  }

  // 9. Stage 6 Logic (Restored Letter Climax)
  const btnNextStage6 = document.getElementById('btn-next-stage-6');
  if (btnNextStage6) {
    btnNextStage6.addEventListener('click', () => {
      state.currentStage = 7;
      saveState();
      playDocent("축하합니다! 이 빈집의 미래를 위한 시민 투표에 참여해 주세요.");
    });
  }

  // 10. Stage 7 Logic (Voting & Realtime Charts)
  const voteOptionBtns = document.querySelectorAll('.vote-option-btn');
  const btnSubmitVote = document.getElementById('btn-submit-vote');
  const votingContainer = document.getElementById('voting-container');
  const voteResultBox = document.getElementById('vote-result-box');
  const btnShareFinish = document.getElementById('btn-share-finish');

  voteOptionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      voteOptionBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.userVote = btn.dataset.vote;
      btnSubmitVote.removeAttribute('disabled');
    });
  });

  if (btnSubmitVote) {
    btnSubmitVote.addEventListener('click', () => {
      if (!state.userVote) return;
      saveState();

      votingContainer.classList.add('hidden');
      voteResultBox.classList.remove('hidden');

      setTimeout(() => {
        const fills = {
          garden: document.getElementById('fill-garden'),
          workshop: document.getElementById('fill-workshop'),
          cafe: document.getElementById('fill-cafe'),
          preserve: document.getElementById('fill-preserve')
        };
        if (fills.garden) fills.garden.style.width = '39%';
        if (fills.workshop) fills.workshop.style.width = '32%';
        if (fills.cafe) fills.cafe.style.width = '21%';
        if (fills.preserve) fills.preserve.style.width = '8%';
      }, 100);
    });
  }

  if (btnShareFinish) {
    btnShareFinish.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: '승평마을 빈집 AR 탐험 퀘스트 완주!',
          text: '승평마을 빈집에서 잃어버린 편지를 찾고 미래 빈집 재생 투표에 참여했습니다.',
          url: window.location.href
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(window.location.href);
        alert('완주 링크가 클립보드에 복사되었습니다. SNS에 공유해 보세요!');
      }
    });
  }

  // 11. Restart Quest Button
  const btnRestartQuest = document.getElementById('btn-restart-quest');
  if (btnRestartQuest) {
    btnRestartQuest.addEventListener('click', () => {
      if (confirm('퀘스트를 처음부터 다시 시작하시겠습니까? (수집한 편지와 스탬프가 초기화됩니다)')) {
        stopLiveCamera();
        localStorage.removeItem(STORAGE_KEY);
        state = {
          currentStage: 1,
          companion: '가족 (어린이 포함)',
          theme: '모험·추리',
          time: '90분 코스',
          collectedLetters: 0,
          hasStamp: false,
          branchChoice: 'market',
          userVote: null,
          ghostAffinity: 0,
          footstepProgress: 0
        };
        saveState();
      }
    });
  }

  // 12. Speech Synthesis
  function playDocent(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }

  // 13. Host QR Poster Modal
  const btnQrPoster = document.getElementById('btn-qr-poster');
  const qrModal = document.getElementById('qr-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const qrTarget = document.getElementById('qrcode-target');
  const currentUrlDisplay = document.getElementById('current-url-display');
  const customUrlInput = document.getElementById('custom-url-input');
  const btnDownloadQr = document.getElementById('btn-download-qr');

  if (btnQrPoster) {
    btnQrPoster.addEventListener('click', () => {
      qrModal.classList.remove('hidden');
      const currentUrl = window.location.href;
      customUrlInput.value = currentUrl;
      renderQr(currentUrl);
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => qrModal.classList.add('hidden'));
  }

  if (qrModal) {
    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) qrModal.classList.add('hidden');
    });
  }

  if (customUrlInput) {
    customUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim() || window.location.href;
      renderQr(url);
    });
  }

  function renderQr(url) {
    if (!qrTarget) return;
    currentUrlDisplay.textContent = url;
    qrTarget.innerHTML = '';
    QRCode.toCanvas(url, { width: 170, margin: 2, color: { dark: '#0c1017', light: '#ffffff' } }, (err, canvas) => {
      if (!err) qrTarget.appendChild(canvas);
    });
  }

  if (btnDownloadQr) {
    btnDownloadQr.addEventListener('click', () => {
      const canvas = qrTarget.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = 'seungpyeong-village-ar-qr.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    });
  }

  // Initial Load
  updateUI();
});
