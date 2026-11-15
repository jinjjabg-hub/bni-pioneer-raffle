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

/* -------------------------------------------------------------------------- */
/* 달리기 경주: 결승선에 먼저 닿는 사람이 당첨                                */
/* -------------------------------------------------------------------------- */

const RACE_ICONS = ['🏃', '🚴', '🏇', '🛼', '🏄', '🚣', '⛷️', '🏊'];
const RACE_WINNER_MS = 5200;

export class RacePresenter implements Presenter {
  private track: HTMLDivElement;

  private winnerLabel: HTMLDivElement;

  private runners: HTMLSpanElement[] = [];

  constructor(container: HTMLElement) {
    this.track = document.createElement('div');
    this.track.className = 'race';
    this.winnerLabel = createWinnerLabel();
    container.appendChild(this.track);
    container.appendChild(this.winnerLabel);
  }

  private render(names: string[]) {
    this.track.textContent = '';
    if (!names.length) {
      this.runners = [];
      this.track.appendChild(createEmpty(EMPTY_TEXT));
      return;
    }
    this.runners = names.map((name, i) => {
      const lane = document.createElement('div');
      lane.className = 'race__lane';
      const runner = document.createElement('span');
      runner.className = 'race__runner';
      runner.textContent = `${RACE_ICONS[i % RACE_ICONS.length]} ${name}`;
      lane.appendChild(runner);
      this.track.appendChild(lane);
      return runner;
    });
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    this.render(pickCast(pool, RACE_ICONS.length));
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, RACE_ICONS.length, winner);
    this.render(names);

    // 사람마다 가속 곡선(power)이 달라서 중간 순위가 계속 뒤바뀐다. 당첨자만 가장 먼저 도착한다.
    const plans = names.map((name, i) => {
      const lane = this.runners[i].parentElement as HTMLElement;
      return {
        distance: Math.max(0, lane.clientWidth - this.runners[i].offsetWidth),
        time: name === winner ? RACE_WINNER_MS : RACE_WINNER_MS + 400 + randomInt(1800),
        power: 0.6 + Math.random() * 0.9
      };
    });

    await animate(RACE_WINNER_MS, (elapsed) => {
      this.runners.forEach((runner, i) => {
        const progress = Math.min(1, (elapsed / plans[i].time) ** plans[i].power);
        // eslint-disable-next-line no-param-reassign
        runner.style.transform = `translateX(${progress * plans[i].distance}px)`;
      });
    });

    this.runners[names.indexOf(winner)].classList.add('race__runner--win');
    await sleep(500);
    showWinner(this.winnerLabel, winner);
  }
}

/* -------------------------------------------------------------------------- */
/* 사다리: 🎁 칸에 도착하는 사람이 당첨                                        */
/* -------------------------------------------------------------------------- */

const LADDER_MAX = 8;
const LADDER_ROWS = 12;
const LADDER_W = 900;
const LADDER_H = 460;
const LADDER_TOP = 60;
const LADDER_BOTTOM = LADDER_H - 60;
const LADDER_ROW_GAP = (LADDER_BOTTOM - LADDER_TOP) / (LADDER_ROWS + 1);
const CANVAS_SCALE = 2;

type Point = [number, number];

interface LadderPath {
  points: Point[];
  end: number;
  length: number;
}

export class LadderPresenter implements Presenter {
  private canvas: HTMLCanvasElement;

  private winnerLabel: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ladder';
    this.canvas.width = LADDER_W * CANVAS_SCALE;
    this.canvas.height = LADDER_H * CANVAS_SCALE;
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

  private paint(names: string[], rungs: boolean[][], paths: LadderPath[], goal: number, done = 0) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const count = names.length;
    const x = (i: number) => (LADDER_W * (i + 0.5)) / count;
    const y = (row: number) => LADDER_TOP + LADDER_ROW_GAP * (row + 1);

    ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
    ctx.clearRect(0, 0, LADDER_W, LADDER_H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';

    if (!count) {
      ctx.fillStyle = '#999999';
      ctx.font = `700 28px ${FONT}`;
      ctx.fillText(EMPTY_TEXT, LADDER_W / 2, LADDER_H / 2);
      return;
    }

    // 사다리 뼈대
    ctx.strokeStyle = '#d9cfba';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < count; i += 1) {
      ctx.moveTo(x(i), LADDER_TOP);
      ctx.lineTo(x(i), LADDER_BOTTOM);
    }
    rungs.forEach((row, r) => row.forEach((on, i) => {
      if (on) {
        ctx.moveTo(x(i), y(r));
        ctx.lineTo(x(i + 1), y(r));
      }
    }));
    ctx.stroke();

    // 이름과 도착 칸
    ctx.fillStyle = '#1b1b1b';
    ctx.font = `700 ${count > 6 ? 18 : 22}px ${FONT}`;
    names.forEach((name, i) => ctx.fillText(name, x(i), LADDER_TOP - 22, LADDER_W / count - 8));
    ctx.font = '32px sans-serif';
    for (let i = 0; i < count; i += 1) {
      ctx.fillText(i === goal ? '🎁' : '·', x(i), LADDER_BOTTOM + 42);
    }

    // 각자 자기 색 선으로 조금씩 내려온다
    paths.forEach((path, c) => {
      let left = path.length * done;
      if (left <= 0) return;
      ctx.strokeStyle = COLORS[c % COLORS.length];
      ctx.lineWidth = 6;
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
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, LADDER_MAX);
    this.paint(names, LadderPresenter.buildRungs(names.length), [], -1, 0);
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, LADDER_MAX, winner);
    const count = names.length;
    const rungs = LadderPresenter.buildRungs(count);
    const x = (i: number) => (LADDER_W * (i + 0.5)) / count;
    const y = (row: number) => LADDER_TOP + LADDER_ROW_GAP * (row + 1);

    const paths: LadderPath[] = names.map((_, start) => {
      const points: Point[] = [[x(start), LADDER_TOP]];
      let col = start;
      for (let r = 0; r < LADDER_ROWS; r += 1) {
        points.push([x(col), y(r)]);
        if (col < count - 1 && rungs[r][col]) {
          col += 1;
        } else if (col > 0 && rungs[r][col - 1]) {
          col -= 1;
        }
        points.push([x(col), y(r)]);
      }
      points.push([x(col), LADDER_BOTTOM]);
      const length = points.reduce((sum, point, i) => (
        i ? sum + Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]) : 0
      ), 0);
      return { points, end: col, length };
    });

    // 당첨자가 도착하는 칸에 선물을 놓는다 (어느 칸이든 확률은 같다)
    const goal = paths[names.indexOf(winner)].end;
    await animate(5000, (elapsed) => this.paint(names, rungs, paths, goal, elapsed / 5000));
    await sleep(700);
    showWinner(this.winnerLabel, winner);
  }
}

/* -------------------------------------------------------------------------- */
/* 풍선 서바이벌: 하나씩 터지고 마지막까지 남은 풍선이 당첨                    */
/* -------------------------------------------------------------------------- */

const BALLOON_MAX = 16;

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
    this.render(pickCast(pool, BALLOON_MAX));
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, BALLOON_MAX, winner);
    this.render(names);
    const winnerIndex = names.indexOf(winner);
    const alive = shuffled(names.map((_, i) => i).filter((i) => i !== winnerIndex));

    await sleep(600);
    while (alive.length) {
      const balloon = this.balloons[alive.pop() as number];
      balloon.classList.add('balloon--pop');
      (balloon.firstChild as HTMLElement).textContent = '💥';
      // 마지막 세 개는 천천히 터뜨려 긴장감을 준다
      // eslint-disable-next-line no-await-in-loop
      await sleep(alive.length > 2 ? 330 : 950);
    }

    this.balloons[winnerIndex].classList.add('balloon--win');
    await sleep(700);
    showWinner(this.winnerLabel, winner);
  }
}

/* -------------------------------------------------------------------------- */
/* 스포트라이트: 조명이 이름 사이를 옮겨 다니다 당첨자에게 멈춘다              */
/* -------------------------------------------------------------------------- */

const SPOTLIGHT_MAX = 20;

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
    this.render(pickCast(pool, SPOTLIGHT_MAX));
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, SPOTLIGHT_MAX, winner);
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

const LOTTO_MAX = 24;
const LOTTO_SIZE = 460;
const LOTTO_RADIUS = LOTTO_SIZE / 2 - 8;
const LOTTO_BALL = 30;
const LOTTO_CENTER = LOTTO_SIZE / 2;

interface Ball {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
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

  private static createBalls(names: string[]): Ball[] {
    return names.map((name, i) => ({
      name,
      x: LOTTO_CENTER + randomInt(240) - 120,
      y: LOTTO_CENTER + randomInt(240) - 120,
      vx: (randomInt(100) - 50) / 8,
      vy: (randomInt(100) - 50) / 8,
      radius: LOTTO_BALL,
      color: COLORS[i % COLORS.length]
    }));
  }

  /** 공을 조금씩 움직이고 통 벽에 닿으면 튕겨 낸다 */
  private static move(ball: Ball) {
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
    const limit = LOTTO_RADIUS - LOTTO_BALL;
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
      const big = ball.radius > LOTTO_BALL * 1.5;
      ctx.font = `700 ${Math.round(ball.radius * (big ? 0.42 : 0.5))}px ${FONT}`;
      ctx.fillText(ball.name, ball.x, ball.y, ball.radius * 1.75);
    });
  }

  preview(pool: string[]) {
    showWinner(this.winnerLabel, null);
    const balls = LottoPresenter.createBalls(pickCast(pool, LOTTO_MAX));
    balls.forEach(LottoPresenter.move);
    this.paint(balls);
  }

  async play(winner: string, pool: string[]) {
    showWinner(this.winnerLabel, null);
    const names = pickCast(pool, LOTTO_MAX, winner);
    const balls = LottoPresenter.createBalls(names);
    const winnerBall = balls[names.indexOf(winner)];
    // 당첨 공을 맨 위에 그리도록 마지막 순서로 둔다
    const drawOrder = balls.filter((ball) => ball !== winnerBall).concat(winnerBall);
    const mixMs = 4000;
    const growMs = 1200;

    await animate(mixMs + growMs + 600, (elapsed) => {
      balls.forEach((ball) => {
        if (ball === winnerBall && elapsed > mixMs) {
          // 당첨 공은 가운데로 나오며 커진다
          winnerBall.x += (LOTTO_CENTER - winnerBall.x) * 0.12;
          winnerBall.y += (LOTTO_CENTER - winnerBall.y) * 0.12;
          const grow = Math.min(1, (elapsed - mixMs) / growMs);
          winnerBall.radius = LOTTO_BALL + grow * (LOTTO_RADIUS * 0.55 - LOTTO_BALL);
          return;
        }
        LottoPresenter.move(ball);
      });
      this.paint(drawOrder);
    });

    showWinner(this.winnerLabel, winner);
  }
}
