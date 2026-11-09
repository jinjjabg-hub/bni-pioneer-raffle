import { DrawMode, isDrawMode } from '@js/presenters';

/** 고정 멤버 명단. 처음 접속하는 모든 기기에서 기본 전체 명단으로 사용됩니다. */
export const DEFAULT_MEMBER_NAMES: string[] = [
  '송승훈', '이소연', '심학봉', '박진성', '이화춘', '이상호', '조현우', '정명수',
  '박선영', '김지현', '김경태', '박미성', '이도현', '김근우', '김여련', '마루이',
  '문성우', '박병준', '박지형', '오예준', '윤민수', '이수민', '이은성', '이채홍',
  '이해경', '이훈', '임춘식', '정상현', '조은영', '조진성', '최소은', '홍정택',
  '송이', '이다경'
];

/** 한 사람이 가질 수 있는 최대 추첨권 수 */
export const MAX_TICKETS = 10;

export interface Member {
  name: string;
  /** 오늘 추첨 대상으로 선택됨 */
  active: boolean;
  /** 오늘 추첨권 수 (1장 이상) */
  tickets: number;
  /** 오늘 이미 당첨됨 (당첨자 제외 옵션이 켜진 경우에만 사용) */
  won: boolean;
}

export interface RaffleState {
  /** 오늘 설정을 저장한 날짜 (YYYY-MM-DD). 날짜가 바뀌면 오늘 선택/추첨권/당첨 기록은 초기화됩니다. */
  date: string;
  /** 전체 멤버 (영구 저장) */
  members: Member[];
  removeWinner: boolean;
  sound: boolean;
  /** 마지막으로 선택한 추첨 방식 */
  mode: DrawMode;
}

const STORAGE_KEY = 'bni-pioneer-raffle-v1';

const getToday = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const createMember = (name: string, active = false): Member => ({
  name, active, tickets: 1, won: false
});

const createDefaultState = (): RaffleState => ({
  date: getToday(),
  members: DEFAULT_MEMBER_NAMES.map((name) => createMember(name)),
  removeWinner: true,
  sound: true,
  mode: 'slot'
});

const clampTickets = (value: unknown): number => {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_TICKETS);
};

/** 이름 입력 텍스트(줄바꿈/쉼표 구분)를 이름 배열로 변환 */
export const parseNames = (text: string): string[] => text
  .split(/[\n,]/)
  .map((name) => name.trim())
  .filter(Boolean);

/** 오늘 추첨 풀 생성: 선택된 사람만, 추첨권 수만큼 이름을 넣는다 */
export const buildPool = (members: Member[], removeWinner: boolean): string[] => members
  .filter((m) => m.active && !(removeWinner && m.won))
  .flatMap((m) => Array<string>(m.tickets).fill(m.name));

interface StoredMember {
  name?: unknown;
  active?: unknown;
  tickets?: unknown;
  won?: unknown;
  /** 이전 버전 호환 */
  excluded?: unknown;
  double?: unknown;
}

export const loadState = (): RaffleState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const saved = JSON.parse(raw) as Partial<Omit<RaffleState, 'members'>> & {
      members?: StoredMember[];
    };
    const isNewDay = saved.date !== getToday();
    const seen = new Set<string>();
    const members: Member[] = [];

    (Array.isArray(saved.members) ? saved.members : []).forEach((m) => {
      const name = typeof m?.name === 'string' ? m.name.trim() : '';
      if (!name || seen.has(name)) return;
      seen.add(name);

      // 이전 버전(제외/2장 체크)에서 저장된 데이터는 선택/추첨권 수로 변환
      const legacy = m.active === undefined;
      const active = legacy ? !m.excluded : Boolean(m.active);
      const tickets = legacy ? (m.double ? 2 : 1) : clampTickets(m.tickets);

      members.push(isNewDay
        ? createMember(name)
        : { name, active, tickets, won: Boolean(m.won) });
    });

    return {
      date: getToday(),
      members,
      removeWinner: saved.removeWinner !== false,
      sound: saved.sound !== false,
      mode: isDrawMode(saved.mode) ? saved.mode : 'slot'
    };
  } catch (e) {
    return createDefaultState();
  }
};

export const saveState = (state: RaffleState): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, date: getToday() }));
  } catch (e) {
    // 저장소를 쓸 수 없는 환경(시크릿 모드 등)에서는 저장 없이 계속 동작
  }
};
