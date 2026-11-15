/**
 * 팀한판(game 저장소)의 경품 추첨 연출을 옮겨 온 것: 달리기 경주, 사다리, 풍선 서바이벌, 스포트라이트, 공 추첨기.
 * 다른 방식과 마찬가지로 당첨자는 Slot이 먼저 정하고, 여기서는 그 결과를 보여주는 연출만 한다.
 */
import {
  Presenter, createWinnerLabel, randomInt, showWinner, shuffled, sleep
} from '@js/presenters';

const COLORS = ['#cf2030', '#1f6feb', '#17a589', '#f2a900', '#8e44ad', '#e67e22', '#0e9aa7', '#d63384'];
const FONT = '"Noto Sans KR", "Malgun Gothic", sans-serif';

/**
 * 화면에 함께 등장할 사람들을 고른다 (최대 max명, 순서는 무작위).
 * 추첨권이 여러 장이어도 한 사람은 한 번만 등장하고, 당첨자는 반드시 포함된다.
 */
const pickCast = (pool: string[], max: number, winner?: string): string[] => {
  const others = shuffled(Array.from(new Set(pool)).filter((name) => name !== winner));
  if (winner === undefined) {
    return others.slice(0, max);
  }
  const list = others.slice(0, max - 1);
  list.splice(randomInt(list.length + 1), 0, winner);
  return list;
};

type Frame = (elapsed: number) => void;

/** duration 동안 매 프레임 frame(경과 ms)을 호출하고 끝나면 resolve */
const animate = (duration: number, frame: Frame) => new Promise<void>((resolve) => {
  const start = performance.now();
  const tick = (now: number) => {
    const elapsed = Math.min(duration, Math.max(0, now - start));
    frame(elapsed);
    if (elapsed < duration) {
      window.requestAnimationFrame(tick);
    } else {
      resolve();
    }
  };
  window.requestAnimationFrame(tick);
});

const createEmpty = (text: string): HTMLParagraphElement => {
  const el = document.createElement('p');
  el.className = 'stage__empty';
  el.textContent = text;
  return el;
};

const EMPTY_TEXT = '설정에서 오늘 추첨 대상을 선택하세요';

/** 한 화면에 함께 보여 주는 최대 인원. 이보다 많으면 당첨자를 포함해 무작위로 이만큼만 등장한다. */
export const MAX_ON_STAGE = 100;

/* -------------------------------------------------------------------------- */
/* 달리기 경주: 결승선에 먼저 닿는 사람이 당첨                                */
/* -------------------------------------------------------------------------- */

const RACE_ICONS = ['🏃', '🚴', '🏇', '🛼', '🏄', '🚣', '⛷️', '🏊'];
const RACE_WINNER_MS = 5200;
const RACE_LANE_PX = 44;

export class RacePresenter implements Presenter {
  private track: HTMLDivElement;

  private winnerLabel: HTMLDivElement;

  private runners: HTMLSpanElement[] = [];

  /** 출발선에서 각자 서 있는 가로 위치(px). 인원이 많으면 여러 줄로 나눠 선다 */
  private startOffsets: number[] = [];

  constructor(container: HTMLElement) {
    this.track = document.createElement('div');
    this.track.className = 'race';
    this.winnerLabel = createWinnerLabel();
    container.appendChild(this.track);
    container.appendChild(this.winnerLabel);
  }

  private render(names: string[]) {
    this.track.textContent = '';
    this.track.style.height = '';
    this.runners = [];
    this.startOffsets = [];
    if (!names.length) {
      this.track.appendChild(createEmpty(EMPTY_TEXT));
      return;
    }

    // 레인 간격: 인원이 적으면 넉넉하게, 많으면 무대 높이 안에 모두 들어가도록 좁힌다
    const maxHeight = Math.max(240, window.innerHeight * 0.5);
    const spacing = Math.min(RACE_LANE_PX, maxHeight / names.length);
    const fontSize = Math.max(12, Math.min(22, spacing * 0.55));
    const lineHeight = fontSize * 1.5;
    // 맨 위·맨 아래 이름이 잘리지 않도록 글자 높이만큼 여유를 둔다
    const padding = Math.max(0, (lineHeight - spacing) / 2) + 4;
    this.track.style.height = `${spacing * names.length + padding * 2}px`;

    this.runners = names.map((name, i) => {
      const runner = document.createElement('span');
      runner.className = 'race__runner';
      runner.textContent = `${RACE_ICONS[i % RACE_ICONS.length]} ${name}`;
      runner.style.fontSize = `${fontSize}px`;
      runner.style.top = `${padding + spacing * (i + 0.5)}px`;
      this.track.appendChild(runner);
      return runner;
    });

    // 레인이 글자 높이보다 좁으면 이름이 겹치므로, 출발선에서 옆으로 여러 줄을 지어 서게 한다
    const columns = Math.max(1, Math.ceil(lineHeight / spacing));
    const columnWidth = Math.max(...this.runners.map((runner) => runner.offsetWidth)) + 8;
    this.startOffsets = names.map((_, i) => (columns - 1 - (i % columns)) * columnWidth);
    this.place(names.map(() => 0));
  }

  /** 각 주자를 진행률(0~1) 위치에 놓는다 */
  private place(progress: number[]) {
    const width = this.track.clientWidth;
    this.runners.forEach((runner, i) => {
      const start = this.startOffsets[i];
      const distance = Math.max(0, width - runner.offsetWidth - start);
      // eslint-disable-next-line no-param-reassign
      runner.style.transform = `translate(${start + progress[i] * distance}px, -50%)`;
    });
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    this.render(pickCast(pool, MAX_ON_STAGE));
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, MAX_ON_STAGE, winner);
    this.render(names);

    // 사람마다 가속 곡선(power)이 달라서 중간 순위가 계속 뒤바뀐다. 당첨자만 가장 먼저 도착한다.
    const plans = names.map((name) => ({
      time: name === winner ? RACE_WINNER_MS : RACE_WINNER_MS + 400 + randomInt(1800),
      power: 0.6 + Math.random() * 0.9
    }));

    const progressAt = (elapsed: number) => plans.map(
      (plan) => Math.min(1, (elapsed / plan.time) ** plan.power)
    );
    await animate(RACE_WINNER_MS, (elapsed) => this.place(progressAt(elapsed)));

    this.runners[names.indexOf(winner)].classList.add('race__runner--win');
    // 당첨자 이름이 커진 만큼 다시 배치해서 결승선 밖으로 잘리지 않게 한다
    this.place(progressAt(RACE_WINNER_MS));
    await sleep(500);
    showWinner(this.winnerLabel, winner);
  }
}

/* -------------------------------------------------------------------------- */
/* 사다리: 🎁 칸에 도착하는 사람이 당첨                                        */
/* -------------------------------------------------------------------------- */

const LADDER_ROWS = 12;
const CANVAS_SCALE = 2;

type Point = [number, number];

interface LadderPath {
  points: Point[];
  end: number;
  length: number;
}

interface LadderLayout {
  width: number;
  height: number;
  top: number;
  bottom: number;
  /** 세로줄 간격이 좁으면 이름을 세로로 눕혀 쓴다 */
  vertical: boolean;
  fontSize: number;
  x: (column: number) => number;
  y: (row: number) => number;
}

export class LadderPresenter implements Presenter {
  private canvas: HTMLCanvasElement;

  private winnerLabel: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ladder';
    this.winnerLabel = createWinnerLabel();
    container.appendChild(this.canvas);
    container.appendChild(this.winnerLabel);
  }

  /** 가로줄을 무작위로 놓는다 (바로 옆 칸과 붙은 가로줄은 만들지 않는다) */
  private static buildRungs(count: number): boolean[][] {
    return Array.from({ length: LADDER_ROWS }, () => {
      const row: boolean[] = [];
      for (let i = 0; i < count - 1; i += 1) {
        row.push(!row[i - 1] && randomInt(2) === 1);
      }
      return row;
    });
  }

  /** 화면에 보이는 크기에 맞춰 캔버스 해상도와 배치를 정한다 (인원이 많을수록 세로줄이 촘촘해진다) */
  private layout(names: string[]): LadderLayout {
    const width = this.canvas.clientWidth || 900;
    const height = this.canvas.clientHeight || 460;
    this.canvas.width = width * CANVAS_SCALE;
    this.canvas.height = height * CANVAS_SCALE;

    const count = Math.max(1, names.length);
    const columnWidth = width / count;
    const longest = names.reduce((max, name) => Math.max(max, name.length), 1);
    const vertical = columnWidth < longest * 20;
    const fontSize = vertical
      ? Math.max(8, Math.min(18, columnWidth * 0.85))
      : Math.max(14, Math.min(22, columnWidth / (longest + 1)));
    const top = vertical ? Math.min(height * 0.3, fontSize * (longest + 0.5) + 12) : 52;
    const bottomSpace = Math.max(22, Math.min(46, columnWidth * 1.4));
    const bottom = height - bottomSpace;
    return {
      width,
      height,
      top,
      bottom,
      vertical,
      fontSize,
      x: (column) => columnWidth * (column + 0.5),
      y: (row) => top + ((bottom - top) * (row + 1)) / (LADDER_ROWS + 1)
    };
  }

  private static buildPaths(count: number, rungs: boolean[][], l: LadderLayout): LadderPath[] {
    return Array.from({ length: count }, (_, start) => {
      const points: Point[] = [[l.x(start), l.top]];
      let col = start;
      for (let r = 0; r < LADDER_ROWS; r += 1) {
        points.push([l.x(col), l.y(r)]);
        if (col < count - 1 && rungs[r][col]) {
          col += 1;
        } else if (col > 0 && rungs[r][col - 1]) {
          col -= 1;
        }
        points.push([l.x(col), l.y(r)]);
      }
      points.push([l.x(col), l.bottom]);
      const length = points.reduce((sum, point, i) => (
        i ? sum + Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]) : 0
      ), 0);
      return { points, end: col, length };
    });
  }

  /**
   * @param done      내려온 정도 (0~1)
   * @param spotlight 강조할 사람의 번호. 지정하면 그 사람의 길만 진하게 보여 준다
   */
  private paint(
    names: string[],
    rungs: boolean[][],
    l: LadderLayout,
    paths: LadderPath[],
    goal: number,
    done: number,
    spotlight = -1
  ) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const count = names.length;
    const columnWidth = l.width / Math.max(1, count);
    const thin = columnWidth < 24;

    ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
    ctx.clearRect(0, 0, l.width, l.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;

    if (!count) {
      ctx.fillStyle = '#999999';
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText(EMPTY_TEXT, l.width / 2, l.height / 2);
      return;
    }

    // 사다리 뼈대
    ctx.strokeStyle = '#d9cfba';
    ctx.lineWidth = thin ? 1.5 : 4;
    ctx.beginPath();
    for (let i = 0; i < count; i += 1) {
      ctx.moveTo(l.x(i), l.top);
      ctx.lineTo(l.x(i), l.bottom);
    }
    rungs.forEach((row, r) => row.forEach((on, i) => {
      if (on) {
        ctx.moveTo(l.x(i), l.y(r));
        ctx.lineTo(l.x(i + 1), l.y(r));
      }
    }));
    ctx.stroke();

    // 이름
    names.forEach((name, i) => {
      const picked = i === spotlight;
      ctx.fillStyle = picked ? '#ff0c45' : '#1b1b1b';
      ctx.font = `${picked ? 900 : 700} ${l.fontSize}px ${FONT}`;
      if (l.vertical) {
        ctx.save();
        ctx.translate(l.x(i), l.top - 8);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, 0, 0, l.top - 12);
        ctx.restore();
      } else {
        ctx.fillText(name, l.x(i), l.top - 20, columnWidth - 8);
      }
    });

    // 도착 칸
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1b1b1b';
    const giftSize = Math.max(14, Math.min(32, columnWidth * 1.3));
    for (let i = 0; i < count; i += 1) {
      if (i === goal) {
        ctx.font = `${giftSize}px sans-serif`;
        ctx.fillText('🎁', l.x(i), l.bottom + (l.height - l.bottom) / 2);
      } else if (!thin) {
        ctx.font = '24px sans-serif';
        ctx.fillText('·', l.x(i), l.bottom + (l.height - l.bottom) / 2);
      }
    }

    // 각자 자기 색 선으로 조금씩 내려온다
    const order = paths.map((_, c) => c).filter((c) => c !== spotlight);
    if (spotlight >= 0) order.push(spotlight); // 강조할 길은 맨 위에 그린다
    order.forEach((c) => {
      const path = paths[c];
      let left = path.length * done;
      if (left <= 0) return;
      const picked = c === spotlight;
      ctx.globalAlpha = spotlight >= 0 && !picked ? 0.18 : 1;
      ctx.strokeStyle = COLORS[c % COLORS.length];
      ctx.lineWidth = (thin ? 2.5 : 6) * (picked ? 1.8 : 1);
      ctx.beginPath();
      ctx.moveTo(path.points[0][0], path.points[0][1]);
      for (let i = 1; i < path.points.length && left > 0; i += 1) {
        const [ax, ay] = path.points[i - 1];
        const [bx, by] = path.points[i];
        const distance = Math.hypot(bx - ax, by - ay);
        const ratio = distance ? Math.min(1, left / distance) : 1;
        ctx.lineTo(ax + (bx - ax) * ratio, ay + (by - ay) * ratio);
        left -= distance;
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, MAX_ON_STAGE);
    this.paint(names, LadderPresenter.buildRungs(names.length), this.layout(names), [], -1, 0);
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, MAX_ON_STAGE, winner);
    const rungs = LadderPresenter.buildRungs(names.length);
    const layout = this.layout(names);
    const paths = LadderPresenter.buildPaths(names.length, rungs, layout);

    // 당첨자가 도착하는 칸에 선물을 놓는다 (어느 칸이든 확률은 같다)
    const winnerIndex = names.indexOf(winner);
    const goal = paths[winnerIndex].end;
    await animate(5000, (elapsed) => this.paint(names, rungs, layout, paths, goal, elapsed / 5000));
    await sleep(400);
    // 선이 많으면 누가 선물에 닿았는지 알아보기 어려우므로 당첨자의 길만 진하게 남긴다
    this.paint(names, rungs, layout, paths, goal, 1, winnerIndex);
    await sleep(700);
    showWinner(this.winnerLabel, winner);
  }
}

/* -------------------------------------------------------------------------- */
/* 풍선 서바이벌: 하나씩 터지고 마지막까지 남은 풍선이 당첨                    */
/* -------------------------------------------------------------------------- */

export class BalloonPresenter implements Presenter {
  private grid: HTMLDivElement;

  private winnerLabel: HTMLDivElement;

  private balloons: HTMLDivElement[] = [];

  constructor(container: HTMLElement) {
    this.grid = document.createElement('div');
    this.grid.className = 'balloons';
    this.winnerLabel = createWinnerLabel();
    container.appendChild(this.grid);
    container.appendChild(this.winnerLabel);
  }

  private render(names: string[]) {
    this.grid.textContent = '';
    if (!names.length) {
      this.balloons = [];
      this.grid.appendChild(createEmpty(EMPTY_TEXT));
      return;
    }
    // 인원에 맞춰 칸 수를 정한다 (가로로 긴 화면에 맞게 열을 행보다 많이)
    const columns = Math.max(4, Math.min(16, Math.ceil(Math.sqrt(names.length * 2.4))));
    this.grid.style.setProperty('--columns', String(columns));
    this.grid.style.setProperty('--rows', String(Math.ceil(names.length / columns)));
    this.balloons = names.map((name) => {
      const balloon = document.createElement('div');
      balloon.className = 'balloon';
      const icon = document.createElement('span');
      icon.className = 'balloon__icon';
      icon.textContent = '🎈';
      const label = document.createElement('span');
      label.className = 'balloon__name';
      label.textContent = name;
      balloon.appendChild(icon);
      balloon.appendChild(label);
      this.grid.appendChild(balloon);
      return balloon;
    });
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    this.render(pickCast(pool, MAX_ON_STAGE));
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, MAX_ON_STAGE, winner);
    this.render(names);
    const winnerIndex = names.indexOf(winner);
    const alive = shuffled(names.map((_, i) => i).filter((i) => i !== winnerIndex));

    const fast = Math.max(45, Math.min(330, 5000 / names.length));
    await sleep(600);
    while (alive.length) {
      const balloon = this.balloons[alive.pop() as number];
      balloon.classList.add('balloon--pop');
      (balloon.firstChild as HTMLElement).textContent = '💥';
      // 인원이 많아도 전체 시간이 비슷하도록 빠르게 터뜨리다가, 마지막 세 개는 천천히 터뜨려 긴장감을 준다
      // eslint-disable-next-line no-await-in-loop
      await sleep(alive.length > 2 ? fast : 950);
    }

    this.balloons[winnerIndex].classList.add('balloon--win');
    await sleep(700);
    showWinner(this.winnerLabel, winner);
  }
}

/* -------------------------------------------------------------------------- */
/* 스포트라이트: 조명이 이름 사이를 옮겨 다니다 당첨자에게 멈춘다              */
/* -------------------------------------------------------------------------- */

export class SpotlightPresenter implements Presenter {
  private board: HTMLDivElement;

  private winnerLabel: HTMLDivElement;

  private seats: HTMLDivElement[] = [];

  constructor(container: HTMLElement) {
    this.board = document.createElement('div');
    this.board.className = 'spotlight';
    this.winnerLabel = createWinnerLabel();
    container.appendChild(this.board);
    container.appendChild(this.winnerLabel);
  }

  private render(names: string[]) {
    this.board.textContent = '';
    if (!names.length) {
      this.seats = [];
      this.board.appendChild(createEmpty(EMPTY_TEXT));
      return;
    }
    const columns = Math.max(5, Math.min(10, Math.ceil(Math.sqrt(names.length))));
    this.board.style.setProperty('--columns', String(columns));
    this.board.style.setProperty('--rows', String(Math.ceil(names.length / columns)));
    this.seats = names.map((name) => {
      const seat = document.createElement('div');
      seat.className = 'spotlight__seat';
      seat.textContent = name;
      this.board.appendChild(seat);
      return seat;
    });
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    this.render(pickCast(pool, MAX_ON_STAGE));
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, MAX_ON_STAGE, winner);
    this.render(names);

    let current = -1;
    const light = (index: number) => {
      if (current >= 0) this.seats[current].classList.remove('spotlight__seat--lit');
      current = index;
      this.seats[index].classList.add('spotlight__seat--lit');
    };

    for (let delay = 70; delay < 520; delay *= 1.12) {
      let next = randomInt(names.length);
      while (names.length > 1 && next === current) {
        next = randomInt(names.length);
      }
      light(next);
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay);
    }

    light(names.indexOf(winner));
    await sleep(900);
    showWinner(this.winnerLabel, winner);
  }
}

/* -------------------------------------------------------------------------- */
/* 공 추첨기: 통 안에서 공이 튀다가 당첨 공 하나가 가운데로 나와 커진다        */
/* -------------------------------------------------------------------------- */

const LOTTO_SIZE = 460;
const LOTTO_RADIUS = LOTTO_SIZE / 2 - 8;
const LOTTO_BALL_MAX = 30;
const LOTTO_BALL_MIN = 14;
const LOTTO_CENTER = LOTTO_SIZE / 2;

interface Ball {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  /** 당첨되어 가운데로 나온 공 */
  picked?: boolean;
}

export class LottoPresenter implements Presenter {
  private canvas: HTMLCanvasElement;

  private winnerLabel: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'lotto';
    this.canvas.width = LOTTO_SIZE * CANVAS_SCALE;
    this.canvas.height = LOTTO_SIZE * CANVAS_SCALE;
    this.winnerLabel = createWinnerLabel();
    container.appendChild(this.canvas);
    container.appendChild(this.winnerLabel);
  }

  /** 공 크기: 인원이 많을수록 작게 해서 통 안에 모두 들어가게 한다 */
  private static ballRadius(count: number): number {
    const fit = LOTTO_RADIUS * Math.sqrt(0.55 / Math.max(1, count));
    return Math.max(LOTTO_BALL_MIN, Math.min(LOTTO_BALL_MAX, fit));
  }

  private static createBalls(names: string[]): Ball[] {
    const radius = LottoPresenter.ballRadius(names.length);
    return names.map((name, i) => ({
      name,
      x: LOTTO_CENTER + randomInt(240) - 120,
      y: LOTTO_CENTER + randomInt(240) - 120,
      vx: (randomInt(100) - 50) / 8,
      vy: (randomInt(100) - 50) / 8,
      radius,
      color: COLORS[i % COLORS.length]
    }));
  }

  /** 공을 조금씩 움직이고 통 벽에 닿으면 튕겨 낸다 */
  private static move(ball: Ball) {
    const limit = LOTTO_RADIUS - ball.radius;
    /* eslint-disable no-param-reassign */
    ball.vx += (Math.random() - 0.5) * 0.9;
    ball.vy += (Math.random() - 0.5) * 0.9;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 7) {
      ball.vx *= 7 / speed;
      ball.vy *= 7 / speed;
    }
    ball.x += ball.vx;
    ball.y += ball.vy;

    const dx = ball.x - LOTTO_CENTER;
    const dy = ball.y - LOTTO_CENTER;
    const distance = Math.hypot(dx, dy);
    if (distance > limit) {
      const nx = dx / distance;
      const ny = dy / distance;
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
      ball.x = LOTTO_CENTER + nx * limit;
      ball.y = LOTTO_CENTER + ny * limit;
    }
    /* eslint-enable no-param-reassign */
  }

  private paint(balls: Ball[]) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
    ctx.clearRect(0, 0, LOTTO_SIZE, LOTTO_SIZE);

    ctx.beginPath();
    ctx.arc(LOTTO_CENTER, LOTTO_CENTER, LOTTO_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8ec';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffbf1f';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!balls.length) {
      ctx.fillStyle = '#999999';
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText(EMPTY_TEXT, LOTTO_CENTER, LOTTO_CENTER);
      return;
    }

    balls.forEach((ball) => {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = ball.color;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(ball.radius * (ball.picked ? 0.42 : 0.6))}px ${FONT}`;
      ctx.fillText(ball.name, ball.x, ball.y, ball.radius * 1.8);
    });
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    const balls = LottoPresenter.createBalls(pickCast(pool, MAX_ON_STAGE));
    // 통 안에 고르게 퍼진 모습으로 보여 준다
    for (let i = 0; i < 40; i += 1) balls.forEach(LottoPresenter.move);
    this.paint(balls);
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, MAX_ON_STAGE, winner);
    const balls = LottoPresenter.createBalls(names);
    const winnerBall = balls[names.indexOf(winner)];
    // 당첨 공을 맨 위에 그리도록 마지막 순서로 둔다
    const drawOrder = balls.filter((ball) => ball !== winnerBall).concat(winnerBall);
    const baseRadius = winnerBall.radius;
    const mixMs = 4000;
    const growMs = 1200;

    await animate(mixMs + growMs + 600, (elapsed) => {
      balls.forEach((ball) => {
        if (ball === winnerBall && elapsed > mixMs) {
          // 당첨 공은 가운데로 나오며 커진다
          winnerBall.x += (LOTTO_CENTER - winnerBall.x) * 0.12;
          winnerBall.y += (LOTTO_CENTER - winnerBall.y) * 0.12;
          const grow = Math.min(1, (elapsed - mixMs) / growMs);
          winnerBall.picked = true;
          winnerBall.radius = baseRadius + grow * (LOTTO_RADIUS * 0.55 - baseRadius);
          return;
        }
        LottoPresenter.move(ball);
      });
      this.paint(drawOrder);
    });

    showWinner(this.winnerLabel, winner);
  }
}
