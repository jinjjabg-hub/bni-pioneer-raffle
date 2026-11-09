/** 추첨 방식. slot(슬롯머신)은 Slot 클래스가 직접 연출하고, 나머지는 아래 Presenter가 연출합니다. */
export type DrawMode = 'slot' | 'roulette' | 'cards' | 'shuffle';

export const DRAW_MODES: DrawMode[] = ['slot', 'roulette', 'cards', 'shuffle'];

export const isDrawMode = (value: unknown): value is DrawMode => (
  typeof value === 'string' && (DRAW_MODES as string[]).includes(value)
);

/**
 * 당첨자는 Slot이 먼저 정해서 넘겨주고, Presenter는 그 결과를 보여주는 연출만 담당한다.
 * (연출이 결과에 영향을 주지 않으므로 어떤 방식이든 당첨 확률은 같다)
 */
export interface Presenter {
  /** 아직 추첨 전일 때 보여줄 화면을 그린다 */
  preview(pool: string[]): void;
  /** 연출을 재생하고 끝나면 resolve */
  play(winner: string, pool: string[], pickedIndex?: number): Promise<void>;
}

interface TicketGroup {
  name: string;
  tickets: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

const randomInt = (max: number) => Math.floor(Math.random() * max);

/** 추첨 풀(추첨권 1장 = 이름 1개)을 이름별 추첨권 수로 묶는다 */
const groupTickets = (pool: string[]): TicketGroup[] => {
  const groups = new Map<string, number>();
  pool.forEach((name) => groups.set(name, (groups.get(name) || 0) + 1));
  return Array.from(groups, ([name, tickets]) => ({ name, tickets }));
};

const shuffled = <T>(items: T[]): T[] => {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const createWinnerLabel = (): HTMLDivElement => {
  const el = document.createElement('div');
  el.className = 'stage__winner';
  return el;
};

const showWinner = (el: HTMLElement, winner: string | null) => {
  el.textContent = '';
  if (winner === null) {
    el.classList.remove('stage__winner--show');
    return;
  }
  const tag = document.createElement('span');
  tag.className = 'stage__winner-tag';
  tag.textContent = '당첨';
  el.appendChild(tag);
  el.appendChild(document.createTextNode(winner));
  el.classList.add('stage__winner--show');
};

/* -------------------------------------------------------------------------- */
/* 룰렛                                                                       */
/* -------------------------------------------------------------------------- */

const WHEEL_COLORS = ['#ff5e7e', '#ffa62d', '#fcd53f', '#5ad17a', '#33b5e5', '#a25afd', '#ff7bd0'];
const WHEEL_SIZE = 760;
const WHEEL_DURATION_MS = 4200;

export class RoulettePresenter implements Presenter {
  private canvas: HTMLCanvasElement;

  private winnerLabel: HTMLDivElement;

  private slices: { name: string; startDeg: number; endDeg: number }[] = [];

  constructor(container: HTMLElement) {
    const wrapper = document.createElement('div');
    wrapper.className = 'roulette';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'roulette__wheel';
    this.canvas.width = WHEEL_SIZE;
    this.canvas.height = WHEEL_SIZE;

    const pointer = document.createElement('div');
    pointer.className = 'roulette__pointer';
    const hub = document.createElement('div');
    hub.className = 'roulette__hub';

    wrapper.appendChild(this.canvas);
    wrapper.appendChild(pointer);
    wrapper.appendChild(hub);

    this.winnerLabel = createWinnerLabel();
    container.appendChild(wrapper);
    container.appendChild(this.winnerLabel);
  }

  private resetRotation() {
    this.canvas.style.transition = 'none';
    this.canvas.style.transform = 'rotate(0deg)';
    // 강제 리플로우: transition 없이 0도로 되돌린 상태를 확정
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.canvas.offsetWidth;
  }

  private draw(pool: string[]) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const groups = groupTickets(pool);
    const total = pool.length;
    const center = WHEEL_SIZE / 2;
    const radius = center - 8;

    ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE);
    this.slices = [];

    if (!total) {
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    let cursorDeg = 0;
    groups.forEach((group, i) => {
      const sweepDeg = (group.tickets / total) * 360;
      const startDeg = cursorDeg;
      const endDeg = cursorDeg + sweepDeg;
      cursorDeg = endDeg;
      this.slices.push({ name: group.name, startDeg, endDeg });

      // 룰렛 12시 방향이 0도, 시계 방향으로 진행
      const startRad = ((startDeg - 90) * Math.PI) / 180;
      const endRad = ((endDeg - 90) * Math.PI) / 180;

      let colorIndex = i % WHEEL_COLORS.length;
      // 마지막 조각이 첫 조각과 같은 색이 되지 않도록 한 칸 건너뜀
      if (i === groups.length - 1 && groups.length > 1 && colorIndex === 0) {
        colorIndex = 3;
      }

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startRad, endRad);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[colorIndex];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();

      // 이름 (조각 가운데 방향으로 바깥쪽에서 안쪽으로)
      const midRad = (startRad + endRad) / 2;
      const arcLength = ((sweepDeg * Math.PI) / 180) * radius * 0.72;
      const fontSize = Math.max(11, Math.min(30, arcLength * 0.7));
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(midRad);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${fontSize}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
      ctx.fillStyle = '#1b1b1b';
      ctx.fillText(group.name, radius - 22, 0, radius * 0.7);
      ctx.restore();
    });

    // 바깥 테두리
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffbf1f';
    ctx.stroke();
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    this.resetRotation();
    this.draw(pool);
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    this.resetRotation();
    this.draw(pool);

    const slice = this.slices.find((s) => s.name === winner);
    if (!slice) {
      showWinner(this.winnerLabel, winner);
      return;
    }

    // 당첨 조각 안의 임의 지점이 12시 방향 화살표에 오도록 회전각을 계산
    const span = slice.endDeg - slice.startDeg;
    const targetDeg = slice.startDeg + span * (0.12 + Math.random() * 0.76);
    const rotation = 360 * 6 + (360 - targetDeg);

    this.canvas.style.transition = `transform ${WHEEL_DURATION_MS}ms cubic-bezier(0.12, 0.6, 0.1, 1)`;
    this.canvas.style.transform = `rotate(${rotation}deg)`;

    await sleep(WHEEL_DURATION_MS + 150);
    showWinner(this.winnerLabel, winner);
  }
}

/* -------------------------------------------------------------------------- */
/* 카드 뒤집기                                                                */
/* -------------------------------------------------------------------------- */

export class CardsPresenter implements Presenter {
  private grid: HTMLDivElement;

  private winnerLabel: HTMLDivElement;

  private cards: HTMLButtonElement[] = [];

  /** 카드를 직접 눌렀을 때 호출 (추첨권 카드 번호) */
  public onPick?: (index: number) => void;

  constructor(container: HTMLElement) {
    this.grid = document.createElement('div');
    this.grid.className = 'cards';
    this.winnerLabel = createWinnerLabel();
    container.appendChild(this.grid);
    container.appendChild(this.winnerLabel);
  }

  private setCardName(card: HTMLButtonElement, name: string) {
    // eslint-disable-next-line no-param-reassign
    card.dataset.name = name;
    const back = card.querySelector('.card__back');
    if (back) back.textContent = name;
  }

  private render(pool: string[]) {
    this.grid.textContent = '';
    this.cards = shuffled(pool).map((name, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.setAttribute('aria-label', '추첨권 카드 뒤집기');

      const inner = document.createElement('span');
      inner.className = 'card__inner';
      const front = document.createElement('span');
      front.className = 'card__front';
      front.textContent = '?';
      const back = document.createElement('span');
      back.className = 'card__back';
      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);

      this.setCardName(card, name);
      card.addEventListener('click', () => {
        if (this.onPick) this.onPick(index);
      });
      this.grid.appendChild(card);
      return card;
    });
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    this.render(pool);
  }

  async play(winner: string, pool: string[], pickedIndex?: number) {
    showWinner(this.winnerLabel, null);
    this.render(pool);
    if (!this.cards.length) return;

    // 당첨자 이름이 적힌 카드 중 하나를 고르고, 직접 고른 카드가 있으면 그 카드와 이름을 맞바꾼다.
    // (뒷면은 가려져 있으므로 어느 카드를 골라도 결과는 같은 확률이다)
    const winnerIndexes = this.cards
      .map((card, i) => (card.dataset.name === winner ? i : -1))
      .filter((i) => i >= 0);
    let targetIndex = winnerIndexes[randomInt(winnerIndexes.length)];

    if (pickedIndex !== undefined && this.cards[pickedIndex]) {
      const other = this.cards[pickedIndex];
      const winnerCard = this.cards[targetIndex];
      const otherName = other.dataset.name || '';
      this.setCardName(winnerCard, otherName);
      this.setCardName(other, winner);
      targetIndex = pickedIndex;
    }

    // 1) 카드 섞는 연출
    this.grid.classList.add('cards--shuffling');
    this.cards.forEach((card) => {
      card.style.animationDelay = `${randomInt(400)}ms`;
    });
    await sleep(1300);
    this.grid.classList.remove('cards--shuffling');

    // 2) 직접 고르지 않았으면 표시가 카드 사이를 돌다가 점점 느려지며 멈춘다
    if (pickedIndex === undefined) {
      let delay = 55;
      let hot = -1;
      const steps = Math.min(18, Math.max(8, this.cards.length));
      for (let step = 0; step < steps; step += 1) {
        const isLast = step === steps - 1;
        let next = isLast ? targetIndex : randomInt(this.cards.length);
        while (!isLast && this.cards.length > 1 && next === hot) {
          next = randomInt(this.cards.length);
        }
        if (hot >= 0) this.cards[hot].classList.remove('card--hot');
        hot = next;
        this.cards[hot].classList.add('card--hot');
        // eslint-disable-next-line no-await-in-loop
        await sleep(delay);
        delay *= 1.18;
      }
      await sleep(250);
    }

    // 3) 카드 뒤집기
    const target = this.cards[targetIndex];
    target.classList.add('card--hot', 'card--flipped');
    await sleep(900);
    showWinner(this.winnerLabel, winner);
  }
}

/* -------------------------------------------------------------------------- */
/* 이름 섞이다 멈추기                                                         */
/* -------------------------------------------------------------------------- */

export class ShufflePresenter implements Presenter {
  private nameEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    const panel = document.createElement('div');
    panel.className = 'shuffle';
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'shuffle__name';
    panel.appendChild(this.nameEl);
    container.appendChild(panel);
  }

  private setName(text: string, state?: 'idle' | 'spinning' | 'done') {
    this.nameEl.textContent = text;
    this.nameEl.classList.remove('shuffle__name--idle', 'shuffle__name--done');
    if (state === 'idle') this.nameEl.classList.add('shuffle__name--idle');
    if (state === 'done') this.nameEl.classList.add('shuffle__name--done');
  }

  preview() {
    this.setName('추첨을 시작하세요', 'idle');
  }

  async play(winner: string, pool: string[]) {
    const names = Array.from(new Set(pool));
    let delay = 45;
    let elapsed = 0;
    let last = '';

    while (elapsed < 3700) {
      let next = names[randomInt(names.length)];
      for (let tries = 0; names.length > 1 && next === last && tries < 5; tries += 1) {
        next = names[randomInt(names.length)];
      }
      last = next;
      this.setName(next);
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay);
      elapsed += delay;
      delay *= 1.1;
    }

    this.setName(winner, 'done');
    await sleep(400);
  }
}
