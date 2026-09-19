import QRCode from 'qrcode';

function initApp() {
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }

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

  // Theme Manager (Dark / Light)
  const THEME_STORAGE_KEY = 'seungpyeong_theme_mode';
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    if (themeIcon) {
      themeIcon.textContent = mode === 'light' ? '🌙' : '☀️';
    }
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
  applyTheme(savedTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
    });
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

  let previousStage = null;
  const speechBubbleTimers = {};

  function showSpeechBubble(bubbleId, textId, text, duration = 1500) {
    const bubble = document.getElementById(bubbleId);
    const textEl = textId ? document.getElementById(textId) : null;
    if (!bubble) return;

    if (textEl && text) {
      textEl.textContent = text;
    }

    if (speechBubbleTimers[bubbleId]) {
      clearTimeout(speechBubbleTimers[bubbleId]);
      delete speechBubbleTimers[bubbleId];
    }

    // 완전히 display 보장 후 트랜지션 실행
    bubble.classList.remove('hidden');
    bubble.style.display = 'block';

    requestAnimationFrame(() => {
      bubble.style.opacity = '1';
      bubble.style.transform = 'translateY(0)';
      bubble.style.pointerEvents = 'auto';
    });

    if (duration > 0) {
      speechBubbleTimers[bubbleId] = setTimeout(() => {
        hideSpeechBubble(bubbleId);
      }, duration);
    }
  }

  function hideSpeechBubble(bubbleId) {
    const bubble = document.getElementById(bubbleId);
    if (!bubble) return;

    if (speechBubbleTimers[bubbleId]) {
      clearTimeout(speechBubbleTimers[bubbleId]);
      delete speechBubbleTimers[bubbleId];
    }

    bubble.style.opacity = '0';
    bubble.style.transform = 'translateY(-8px)';
    bubble.style.pointerEvents = 'none';

    setTimeout(() => {
      bubble.classList.add('hidden');
      bubble.style.display = 'none';
    }, 260);
  }

  function showGhostSpeech(text, duration = 1500) {
    showSpeechBubble('cam-speech-bubble', 'cam-speech-text', text, duration);
  }

  function hideGhostSpeech() {
    hideSpeechBubble('cam-speech-bubble');
  }

  function showFloorHint(text, duration = 1500) {
    showSpeechBubble('floor-hint-bubble', 'floor-hint-text', text, duration);
  }

  function hideFloorHint() {
    hideSpeechBubble('floor-hint-bubble');
  }

  // 3. Retro Ghost Radar HUD Engine (Canvas 2D, 60fps)
  const activeRadars = {};

  function startRadarHUD(canvasId, targetName = '꼬마 유령', radarColor = '#10b981', onComplete = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (activeRadars[canvasId]) {
      stopRadarHUD(canvasId);
    }

    const ctx = canvas.getContext('2d');
    let animId = null;
    let scanAngle = 0;
    let totalRotated = 0;
    const rotationSpeed = 0.045; // 약 1.5초 동안 정확히 1회전 (360도)
    const targetRotation = Math.PI * 2;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = (rect.width || 380) * dpr;
      canvas.height = (rect.height || 480) * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    function render() {
      if (!canvas.offsetParent) {
        animId = requestAnimationFrame(render);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const w = rect.width || 380;
      const h = rect.height || 480;
      const cx = w / 2;
      const cy = h / 2;
      const radarRadius = Math.min(w, h) * 0.38;

      ctx.clearRect(0, 0, w, h);
      ctx.save();

      // 1. 코너 브래킷 (Viewfinder Reticle)
      ctx.strokeStyle = radarColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.65;
      const cornerSize = 20;
      const pad = 14;

      // 좌상
      ctx.beginPath();
      ctx.moveTo(pad, pad + cornerSize); ctx.lineTo(pad, pad); ctx.lineTo(pad + cornerSize, pad);
      ctx.stroke();
      // 우상
      ctx.beginPath();
      ctx.moveTo(w - pad - cornerSize, pad); ctx.lineTo(w - pad, pad); ctx.lineTo(w - pad, pad + cornerSize);
      ctx.stroke();
      // 좌하
      ctx.beginPath();
      ctx.moveTo(pad, h - pad - cornerSize); ctx.lineTo(pad, h - pad); ctx.lineTo(pad + cornerSize, h - pad);
      ctx.stroke();
      // 우하
      ctx.beginPath();
      ctx.moveTo(w - pad - cornerSize, h - pad); ctx.lineTo(w - pad, h - pad); ctx.lineTo(w - pad, h - pad - cornerSize);
      ctx.stroke();

      // 2. 레이더 동심원 및 가이드선
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(cx, cy, radarRadius * 0.35, 0, Math.PI * 2);
      ctx.arc(cx, cy, radarRadius * 0.7, 0, Math.PI * 2);
      ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - radarRadius, cy); ctx.lineTo(cx + radarRadius, cy);
      ctx.moveTo(cx, cy - radarRadius); ctx.lineTo(cx, cy + radarRadius);
      ctx.stroke();

      // 3. 360도 스위핑 빔
      scanAngle = (scanAngle + rotationSpeed) % (Math.PI * 2);
      totalRotated += rotationSpeed;

      ctx.globalAlpha = 0.3;
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radarRadius);
      sweepGrad.addColorStop(0, radarColor);
      sweepGrad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radarRadius, scanAngle - 0.45, scanAngle, false);
      ctx.closePath();
      ctx.fill();

      // 스위프 리딩 라인
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(scanAngle) * radarRadius, cy + Math.sin(scanAngle) * radarRadius);
      ctx.stroke();

      // 4. 중앙 타겟 포커스 & 펄스 링
      const pulse = Math.sin(performance.now() * 0.005) * 3 + 16;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4);
      ctx.stroke();

      // 5. 상단/하단 심령 HUD 데이터
      ctx.font = '10px "Outfit", monospace';
      ctx.fillStyle = radarColor;
      ctx.globalAlpha = 0.95;
      ctx.textAlign = 'left';
      const isFinishing = totalRotated >= targetRotation * 0.85;
      const statusText = isFinishing ? '[ENTITY LOCKED!]' : '[SCANNING SPECTRAL ENTITY...]';
      const emfVal = (4.2 + Math.sin(performance.now() * 0.004) * 0.5).toFixed(2);
      ctx.fillText(`EMF: ${emfVal} mG ${statusText}`, pad + 6, pad + 16);
      ctx.fillText(`FREQ: 432.8 MHz · RADAR SWEEP`, pad + 6, pad + 28);

      ctx.textAlign = 'right';
      ctx.fillText(`[DETECTING: ${targetName}]`, w - pad - 6, h - pad - 10);

      ctx.restore();

      // 1바퀴 회전 완료 검사
      if (totalRotated >= targetRotation) {
        stopRadarHUD(canvasId);
        if (onComplete) onComplete();
        return;
      }

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);
    activeRadars[canvasId] = { animId, resize };
    window.addEventListener('resize', resize);
  }

  function stopRadarHUD(canvasId) {
    if (activeRadars[canvasId]) {
      cancelAnimationFrame(activeRadars[canvasId].animId);
      window.removeEventListener('resize', activeRadars[canvasId].resize);
      delete activeRadars[canvasId];
    }
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // 4. Fire Burn Transition Engine for Stage 1
  function playFireBurnTransition(card, onComplete) {
    const canvas = document.getElementById('fire-burn-canvas');
    if (!canvas || !card) {
      if (onComplete) onComplete();
      return;
    }

    const rect = card.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.classList.remove('hidden');
    card.classList.add('burning-card');

    if ('vibrate' in navigator) {
      try { navigator.vibrate([60, 40, 80, 50, 120]); } catch(e) {}
    }

    const ctx = canvas.getContext('2d');
    const particles = [];
    const maxParticles = 200;
    const duration = 1250;
    const startTime = performance.now();
    let animId = null;

    class FireParticle {
      constructor() {
        this.reset(true);
      }
      reset(initial = false) {
        this.x = Math.random() * canvas.width;
        this.y = initial ? canvas.height - Math.random() * 60 : canvas.height + 5;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = -(Math.random() * 6 + 4);
        this.size = Math.random() * 22 + 10;
        this.life = 0;
        this.maxLife = Math.random() * 35 + 30;
        this.isEmber = Math.random() < 0.3;
        if (this.isEmber) {
          this.size = Math.random() * 3 + 1.5;
          this.vy = -(Math.random() * 9 + 5);
          this.vx = (Math.random() - 0.5) * 5;
          this.maxLife = Math.random() * 50 + 35;
        }
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.size *= 0.96;
        this.life++;
        if (this.life >= this.maxLife || this.size < 0.5) {
          this.reset();
        }
      }
      draw(ctx) {
        const progress = this.life / this.maxLife;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        if (this.isEmber) {
          ctx.fillStyle = progress < 0.4 ? '#ffffff' : (progress < 0.8 ? '#fbbf24' : '#ef4444');
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
          if (progress < 0.25) {
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            grad.addColorStop(0.3, 'rgba(251, 191, 36, 0.85)');
            grad.addColorStop(0.8, 'rgba(249, 115, 22, 0.4)');
            grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          } else if (progress < 0.6) {
            grad.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
            grad.addColorStop(0.5, 'rgba(239, 68, 68, 0.5)');
            grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
          } else {
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
            grad.addColorStop(0.6, 'rgba(75, 85, 99, 0.15)');
            grad.addColorStop(1, 'rgba(31, 41, 55, 0)');
          }
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new FireParticle());
    }

    function renderLoop(currentTime) {
      const elapsed = currentTime - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const baseGrad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - 120);
      const intensity = Math.min(1, elapsed / 300);
      baseGrad.addColorStop(0, `rgba(249, 115, 22, ${0.75 * intensity})`);
      baseGrad.addColorStop(0.5, `rgba(239, 68, 68, ${0.4 * intensity})`);
      baseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, canvas.height - 120, canvas.width, 120);

      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      if (elapsed < duration) {
        animId = requestAnimationFrame(renderLoop);
      } else {
        cancelAnimationFrame(animId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.classList.add('hidden');
        card.classList.remove('burning-card');
        if (onComplete) onComplete();
      }
    }

    animId = requestAnimationFrame(renderLoop);
  }

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

    // Camera Management & Stage 2 Ghost Discovery Radar
    if (state.currentStage === 2) {
      startLiveCamera('live-camera-video-2');
      if (previousStage !== 2) {
        const viewer2 = document.getElementById('viewer-stage-2');
        if (state.ghostAffinity === 0) {
          // 처음 진입: 유령 숨김 상태에서 심령 레이더가 1바퀴 스캔 후 유령 짠 등장!
          if (viewer2) viewer2.classList.add('ghost-hidden');
          startRadarHUD('camera-radar-canvas-2', '꼬마 유령', '#10b981', () => {
            if (viewer2) viewer2.classList.remove('ghost-hidden');
            spawnParticle(particleContainer2, '✨');
            spawnParticle(particleContainer2, '🎉');
            if ('vibrate' in navigator) {
              try { navigator.vibrate([40, 60, 40]); } catch (e) {}
            }
            showGhostSpeech('"안녕! 카메라 속 나를 톡톡 만져보거나 아래 버튼으로 놀아줘!"', 1600);
          });
        } else {
          // 이미 교감 중인 상태
          if (viewer2) viewer2.classList.remove('ghost-hidden');
          stopRadarHUD('camera-radar-canvas-2');
          const welcomeText = state.ghostAffinity >= 100
            ? '"우체부 아저씨의 편지 조각을 가지고 골목길로 가보세요!"'
            : '"안녕! 카메라 속 나를 톡톡 만져보거나 아래 버튼으로 놀아줘!"';
          showGhostSpeech(welcomeText, 1600);
        }
      }
    } else {
      hideGhostSpeech();
      stopRadarHUD('camera-radar-canvas-2');
    }

    if (state.currentStage === 3) {
      if (cameraArBox3 && !cameraArBox3.classList.contains('hidden')) {
        startLiveCamera('live-camera-video-3');
      }
    } else {
      hideFloorHint();
      if (state.currentStage !== 2) {
        stopLiveCamera();
      }
    }

    previousStage = state.currentStage;

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
      const stageCard = document.getElementById('stage-1-card');
      playFireBurnTransition(stageCard, () => {
        state.ghostAffinity = 0;
        state.footstepProgress = 0;
        state.collectedLetters = 0;
        state.currentStage = 2;
        saveState();
      });
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
    showGhostSpeech(currentDialog, 1400);

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

  const camSpeechBubble = document.getElementById('cam-speech-bubble');
  if (camSpeechBubble) {
    camSpeechBubble.addEventListener('click', () => {
      hideGhostSpeech();
    });
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
    });
  }

  // 6. Stage 3 Logic (FLOOR AR FOOTPRINTS & CLUE DISCOVERY)
  const floorHintText = document.getElementById('floor-hint-text');
  const btnStepForward = document.getElementById('btn-step-forward');
  const btnNextStage3 = document.getElementById('btn-next-stage-3');
  const btnStartFootprintCam = document.getElementById('btn-start-footprint-cam');
  const footprintLauncherCard = document.getElementById('footprint-launcher-card');
  const cameraArBox3 = document.getElementById('camera-ar-box-3');

  const floorHintBubble = document.getElementById('floor-hint-bubble');
  if (floorHintBubble) {
    floorHintBubble.addEventListener('click', () => {
      hideFloorHint();
    });
  }

  // "발자국 찾기" (카메라 켜기) 버튼 클릭 핸들러
  if (btnStartFootprintCam) {
    btnStartFootprintCam.addEventListener('click', async () => {
      if (footprintLauncherCard) footprintLauncherCard.classList.add('hidden');
      if (cameraArBox3) cameraArBox3.classList.remove('hidden');
      await startLiveCamera('live-camera-video-3');
      showFloorHint('"카메라로 바닥을 비추고, 황금빛 발자국을 탭하여 따라가세요!"', 1600);
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
    hideFloorHint();

    if (state.footstepProgress >= 3) {
      state.collectedLetters = Math.max(2, state.collectedLetters);
      saveState();

      // Automatically move to Stage 4 after following all footprints
      if (!isAutoTransitioning) {
        isAutoTransitioning = true;
        setTimeout(() => {
          if (state.currentStage === 3) {
            hideFloorHint();
            stopLiveCamera();
            state.currentStage = 4;
            saveState();
          }
          isAutoTransitioning = false;
        }, 1500);
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
    });
  }

  if (btnChoiceSchool) {
    btnChoiceSchool.addEventListener('click', () => {
      state.branchChoice = 'school';
      state.currentStage = 5;
      state.hasStamp = true;
      state.collectedLetters = 3;
      saveState();
    });
  }

  // 8. Stage 5 Logic (Shop & Discount Coupon)
  const btnNextStage5 = document.getElementById('btn-next-stage-5');
  if (btnNextStage5) {
    btnNextStage5.addEventListener('click', () => {
      state.currentStage = 6;
      saveState();
    });
  }

  // 9. Stage 6 Logic (Restored Letter Climax)
  const btnNextStage6 = document.getElementById('btn-next-stage-6');
  if (btnNextStage6) {
    btnNextStage6.addEventListener('click', () => {
      state.currentStage = 7;
      saveState();
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

  // 12. Voice synthesis removed (AI 음성 비활성화)
  function playDocent() {
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
