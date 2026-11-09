/** 고정 멤버 명단. 여기에 이름을 넣으면 처음 접속하는 모든 기기에서 기본 명단으로 사용됩니다. */
export const DEFAULT_MEMBER_NAMES: string[] = [];

export interface Member {
  name: string;
  /** 오늘 추첨 대상에서 제외 */
  excluded: boolean;
  /** 오늘 추첨권 2장 */
  double: boolean;
  /** 오늘 이미 당첨됨 (당첨자 제외 옵션이 켜진 경우에만 사용) */
  won: boolean;
}

export interface RaffleState {
  /** 오늘 설정을 저장한 날짜 (YYYY-MM-DD). 날짜가 바뀌면 오늘 설정은 초기화됩니다. */
  date: string;
  members: Member[];
  removeWinner: boolean;
  sound: boolean;
}

const STORAGE_KEY = 'bni-pioneer-raffle-v1';

const getToday = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const createMember = (name: string): Member => ({
  name, excluded: false, double: false, won: false
});

const createDefaultState = (): RaffleState => ({
  date: getToday(),
  members: DEFAULT_MEMBER_NAMES.map(createMember),
  removeWinner: true,
  sound: true
});

/** 이름 입력 텍스트(줄바꿈/쉼표 구분)를 이름 배열로 변환 */
export const parseNames = (text: string): string[] => text
  .split(/[\n,]/)
  .map((name) => name.trim())
  .filter(Boolean);

/** 오늘 추첨 풀 생성: 제외자는 빼고, 추첨권 2장인 사람은 두 번 넣는다 */
export const buildPool = (members: Member[], removeWinner: boolean): string[] => members
  .filter((m) => !m.excluded && !(removeWinner && m.won))
  .flatMap((m) => (m.double ? [m.name, m.name] : [m.name]));

export const loadState = (): RaffleState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const saved = JSON.parse(raw) as Partial<RaffleState>;
    const isNewDay = saved.date !== getToday();
    const members = Array.isArray(saved.members) ? saved.members : [];

    return {
      date: getToday(),
      members: members
        .filter((m) => m && typeof m.name === 'string' && m.name.trim())
        .map((m) => ({
          name: m.name,
          excluded: isNewDay ? false : Boolean(m.excluded),
          double: isNewDay ? false : Boolean(m.double),
          won: isNewDay ? false : Boolean(m.won)
        })),
      removeWinner: saved.removeWinner !== false,
      sound: saved.sound !== false
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
