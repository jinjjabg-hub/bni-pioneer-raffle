import confetti from 'canvas-confetti';
import Slot from '@js/Slot';
import SoundEffects from '@js/SoundEffects';
import {
  Member, buildPool, loadState, parseNames, saveState
} from '@js/members';

// Initialize slot machine
(() => {
  const drawButton = document.getElementById('draw-button') as HTMLButtonElement | null;
  const fullscreenButton = document.getElementById('fullscreen-button') as HTMLButtonElement | null;
  const settingsButton = document.getElementById('settings-button') as HTMLButtonElement | null;
  const settingsWrapper = document.getElementById('settings') as HTMLDivElement | null;
  const settingsContent = document.getElementById('settings-panel') as HTMLDivElement | null;
  const settingsSaveButton = document.getElementById('settings-save') as HTMLButtonElement | null;
  const settingsCloseButton = document.getElementById('settings-close') as HTMLButtonElement | null;
  const sunburstSvg = document.getElementById('sunburst') as HTMLImageElement | null;
  const confettiCanvas = document.getElementById('confetti-canvas') as HTMLCanvasElement | null;
  const memberSummary = document.getElementById('member-summary') as HTMLParagraphElement | null;
  const memberListEl = document.getElementById('member-list') as HTMLUListElement | null;
  const memberAddInput = document.getElementById('member-add-input') as HTMLTextAreaElement | null;
  const memberAddButton = document.getElementById('member-add-button') as HTMLButtonElement | null;
  const memberMessage = document.getElementById('member-message') as HTMLParagraphElement | null;
  const memberResetTodayButton = document.getElementById('member-reset-today') as HTMLButtonElement | null;
  const memberResetWonButton = document.getElementById('member-reset-won') as HTMLButtonElement | null;
  const removeNameFromListCheckbox = document.getElementById('remove-from-list') as HTMLInputElement | null;
  const enableSoundCheckbox = document.getElementById('enable-sound') as HTMLInputElement | null;

  // Graceful exit if necessary elements are not found
  if (!(
    drawButton
    && fullscreenButton
    && settingsButton
    && settingsWrapper
    && settingsContent
    && settingsSaveButton
    && settingsCloseButton
    && sunburstSvg
    && confettiCanvas
    && memberSummary
    && memberListEl
    && memberAddInput
    && memberAddButton
    && memberMessage
    && memberResetTodayButton
    && memberResetWonButton
    && removeNameFromListCheckbox
    && enableSoundCheckbox
  )) {
    console.error('One or more Element ID is invalid. This is possibly a bug.');
    return;
  }

  if (!(confettiCanvas instanceof HTMLCanvasElement)) {
    console.error('Confetti canvas is not an instance of Canvas. This is possibly a bug.');
    return;
  }

  const soundEffects = new SoundEffects();
  const MAX_REEL_ITEMS = 40;
  const CONFETTI_COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];
  let confettiAnimationId;

  /** Confeetti animation instance */
  const customConfetti = confetti.create(confettiCanvas, {
    resize: true,
    useWorker: true
  });

  /** Triggers cconfeetti animation until animation is canceled */
  const confettiAnimation = () => {
    const windowWidth = window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName('body')[0].clientWidth;
    const confettiScale = Math.max(0.5, Math.min(1, windowWidth / 1100));

    customConfetti({
      particleCount: 1,
      gravity: 0.8,
      spread: 90,
      origin: { y: 0.6 },
      colors: [CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]],
      scalar: confettiScale
    });

    confettiAnimationId = window.requestAnimationFrame(confettiAnimation);
  };

  /** Function to stop the winning animation */
  const stopWinningAnimation = () => {
    if (confettiAnimationId) {
      window.cancelAnimationFrame(confettiAnimationId);
    }
    sunburstSvg.style.display = 'none';
  };

  /**  Function to be trigger before spinning */
  const onSpinStart = () => {
    stopWinningAnimation();
    drawButton.disabled = true;
    settingsButton.disabled = true;
    soundEffects.spin((MAX_REEL_ITEMS - 1) / 10);
  };

  /** 저장된 명단과 오늘 설정 */
  const state = loadState();

  /**  Functions to be trigger after spinning */
  const onSpinEnd = async (winner: string) => {
    if (state.removeWinner) {
      const member = state.members.find((m) => m.name === winner);
      if (member) {
        member.won = true;
        saveState(state);
      }
    }

    confettiAnimation();
    sunburstSvg.style.display = 'block';
    await soundEffects.win();
    drawButton.disabled = false;
    settingsButton.disabled = false;
  };

  /** Slot instance */
  const slot = new Slot({
    reelContainerSelector: '#reel',
    maxReelItems: MAX_REEL_ITEMS,
    onSpinStart,
    onSpinEnd,
    onNameListChanged: stopWinningAnimation
  });

  slot.shouldRemoveWinnerFromNameList = state.removeWinner;
  soundEffects.mute = !state.sound;
  slot.names = buildPool(state.members, state.removeWinner);

  /** 설정 화면에서 편집 중인 멤버 (저장 전까지는 원본에 반영되지 않음) */
  let draft: Member[] = [];

  const showMessage = (text: string) => {
    memberMessage.textContent = text;
  };

  const renderMembers = () => {
    const active = draft.filter((m) => !m.excluded);
    const tickets = active.reduce((sum, m) => sum + (m.double ? 2 : 1), 0);
    memberSummary.textContent = `전체 ${draft.length}명 · 오늘 추첨 대상 ${active.length}명 · 추첨권 ${tickets}장`;

    memberListEl.textContent = '';

    if (!draft.length) {
      const empty = document.createElement('li');
      empty.className = 'member-empty';
      empty.textContent = '등록된 멤버가 없습니다. 아래에서 이름을 추가하세요.';
      memberListEl.appendChild(empty);
      return;
    }

    draft.forEach((member, index) => {
      const row = document.createElement('li');
      row.className = `member${member.excluded ? ' member--excluded' : ''}`;

      const name = document.createElement('span');
      name.className = 'member__name';
      name.textContent = member.name;
      row.appendChild(name);

      if (member.won && removeNameFromListCheckbox.checked) {
        const badge = document.createElement('span');
        badge.className = 'member__badge';
        badge.textContent = '당첨';
        row.appendChild(badge);
      }

      const addFlag = (label: string, key: 'excluded' | 'double') => {
        const wrapper = document.createElement('label');
        wrapper.className = 'member__flag';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = member[key];
        input.addEventListener('change', () => {
          draft[index][key] = input.checked;
          renderMembers();
        });
        wrapper.appendChild(input);
        wrapper.appendChild(document.createTextNode(label));
        row.appendChild(wrapper);
      };

      addFlag('오늘 제외', 'excluded');
      addFlag('2장', 'double');

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'member__remove';
      remove.setAttribute('aria-label', `${member.name} 삭제`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        draft.splice(index, 1);
        showMessage(`${member.name} 님을 명단에서 삭제했습니다. (저장해야 반영됩니다)`);
        renderMembers();
      });
      row.appendChild(remove);

      memberListEl.appendChild(row);
    });
  };

  /** To open the setting page */
  const onSettingsOpen = () => {
    draft = state.members.map((m) => ({ ...m }));
    removeNameFromListCheckbox.checked = state.removeWinner;
    enableSoundCheckbox.checked = !soundEffects.mute;
    memberAddInput.value = '';
    showMessage('');
    renderMembers();
    settingsWrapper.style.display = 'block';
  };

  /** To close the setting page */
  const onSettingsClose = () => {
    settingsContent.scrollTop = 0;
    settingsWrapper.style.display = 'none';
  };

  // Click handler for "Draw" button
  drawButton.addEventListener('click', () => {
    if (!slot.names.length) {
      onSettingsOpen();
      return;
    }

    slot.spin();
  });

  // Hide fullscreen button when it is not supported
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - for older browsers support
  if (!(document.documentElement.requestFullscreen && document.exitFullscreen)) {
    fullscreenButton.remove();
  }

  // Click handler for "Fullscreen" button
  fullscreenButton.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      return;
    }

    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  });

  // Click handler for "Settings" button
  settingsButton.addEventListener('click', onSettingsOpen);

  // 멤버 추가
  memberAddButton.addEventListener('click', () => {
    const existing = new Set(draft.map((m) => m.name));
    const added: string[] = [];
    const duplicated: string[] = [];

    parseNames(memberAddInput.value).forEach((name) => {
      if (existing.has(name)) {
        duplicated.push(name);
        return;
      }
      existing.add(name);
      added.push(name);
      draft.push({
        name, excluded: false, double: false, won: false
      });
    });

    memberAddInput.value = '';
    const parts: string[] = [];
    if (added.length) parts.push(`${added.length}명 추가했습니다.`);
    if (duplicated.length) parts.push(`이미 있는 이름 건너뜀: ${duplicated.join(', ')}`);
    showMessage(parts.join(' '));
    renderMembers();
  });

  memberResetTodayButton.addEventListener('click', () => {
    draft = draft.map((m) => ({
      ...m, excluded: false, double: false, won: false
    }));
    showMessage('오늘 제외 / 2장 / 당첨 설정을 모두 초기화했습니다. (저장해야 반영됩니다)');
    renderMembers();
  });

  memberResetWonButton.addEventListener('click', () => {
    draft = draft.map((m) => ({ ...m, won: false }));
    showMessage('당첨 기록을 초기화했습니다. (저장해야 반영됩니다)');
    renderMembers();
  });

  // 당첨자 제외 옵션을 바꾸면 당첨 배지 표시도 즉시 갱신
  removeNameFromListCheckbox.addEventListener('change', renderMembers);

  // Click handler for "Save" button for setting page
  settingsSaveButton.addEventListener('click', () => {
    state.members = draft;
    state.removeWinner = removeNameFromListCheckbox.checked;
    state.sound = enableSoundCheckbox.checked;
    slot.shouldRemoveWinnerFromNameList = state.removeWinner;
    soundEffects.mute = !state.sound;
    slot.names = buildPool(state.members, state.removeWinner);
    saveState(state);
    onSettingsClose();
  });

  // Click handler for "Discard and close" button for setting page
  settingsCloseButton.addEventListener('click', onSettingsClose);
})();
