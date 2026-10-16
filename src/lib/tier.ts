/**
 * 승률 단계·승률 글·메달·최소 판수 안내 — 화면이 색과 문구를 정할 때 쓰는 순수 함수.
 *
 * ⚠️ 문턱 상수는 **하나도 여기 적지 않는다.** 전부 payload(`min_games`)에서 받는다. 화면과 발행 양쪽에
 *    상수를 적으면 반드시 어긋난다(라인 최소 판수에서 겪었다). 옛 코드가 DATA 전역을 읽던 자리는
 *    전부 인자다 — 그래서 테스트가 payload 없이 돈다.
 */
import type { GuildPayload } from '$lib/data/types';
import { pct } from './fmt';

// ── 승률 단계(구간 기준) ──────────────────────────────────────────────
/**
 * Wilson 95% 구간 [하한, 상한] — 발행 쪽 `inhouse/stats.py:_wilson_lower` 와 같은 식(z=1.96, 반올림 없음).
 * payload 의 record.ci_lower 는 이 하한을 소수 3자리로 반올림한 값이다. 0판이면 [0, 1].
 * (rank.ts 의 wilsonLower 는 같은 식에 소수 3자리 반올림 — 순위표 '신뢰성' 열의 표시값이다.)
 */
export function wilson(w: number, n: number, z = 1.96): [number, number] {
  if (!(n > 0)) return [0, 1];
  const p = Math.min(1, Math.max(0, w));
  const z2 = z * z;
  const c = p + z2 / (2 * n);
  const r = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const d = 1 + z2 / n;
  return [(c - r) / d, (c + r) / d];
}

/** 승률 단계 — 색(st-{단계})·기호(WR_MARK)·보조기술 문구(WR_WORD)가 이것 하나에서 나온다 */
export type WrStep = 'up2' | 'up' | 'even' | 'down' | 'down2' | 'few';

// 구간이 50% 를 벗어나야 색을 준다. 두 단 기호는 하한 60% 이상(상한 40% 이하)일 때만.
const STEP_MID = 0.5;
const STEP_FAR = 0.1;

/**
 * 승률 w(0~1)·판수 n → 단계. **점추정이 아니라 구간으로** 정한다 — 5판 80% 는 하한이 38% 라 무채색이다.
 * 실데이터(문턱 5판 이상 31명): 점추정 구간으로 칠하면 22명이 색을 받지만 구간이 50% 를 벗어나는 사람은 4명.
 * 판수가 문턱(min_games) 미만이면 'few' — 색·기호 없이 '표본 적음'.
 */
export function wrStep(w: number, n: number, minGames: number): WrStep {
  if (!(n > 0) || n < minGames) return 'few';
  const [lo, hi] = wilson(w, n);
  if (lo >= STEP_MID + STEP_FAR) return 'up2';
  if (lo > STEP_MID) return 'up';
  if (hi <= STEP_MID - STEP_FAR) return 'down2';
  if (hi < STEP_MID) return 'down';
  return 'even';
}

/** 단계 기호 — 색과 함께 둔다(색각 이상에서도 갈린다) */
export const WR_MARK: Readonly<Record<WrStep, string>> = { up2: '▲▲', up: '▲', even: '', down: '▼', down2: '▼▼', few: '' };

/** 보조기술 문구 — 기호(▲)는 읽히지 않게 숨기고 이것을 읽힌다. even 은 말하지 않는다 */
export const WR_WORD: Readonly<Record<WrStep, string>> = {
  up2: '60% 이상으로 높음', up: '50%보다 높음', even: '', down: '50%보다 낮음', down2: '40% 이하로 낮음', few: '표본 적음',
};

/**
 * 승률 칸의 글 — '54%' · '70%, 50%보다 높음' · 문턱 미만 '100%, 표본 적음'. 값이 없으면 ''.
 * 표 셀이 승률 게이지·승률 글자(스니펫, 보이는 층)를 그릴 때 같은 칸에 두는 글(DataTable 의 Col.fmt)이다 —
 * 보조기술은 이 글을 읽고, 거르기·폰 2줄 행의 빈 칸 판정도 이 글을 쓴다. 단계 문구는 위 WR_WORD 하나에서 온다.
 */
export function wrText(w: number | null | undefined, n: number | null | undefined, minGames: number): string {
  if (w == null) return '';
  const word = WR_WORD[wrStep(w, Number(n) || 0, minGames)];
  return word ? `${pct(w)}, ${word}` : pct(w);
}

// ── 메달 ─────────────────────────────────────────────────────────────
export interface Medal { rank: 1 | 2 | 3 }

/** 1·2·3위 — 지표 순위표가 숫자 칩(1위만 선택색 테두리)으로 그린다. 금·은·동 색은 쓰지 않는다. */
export const MEDAL: readonly Medal[] = ([1, 2, 3] as const).map((n) => ({ rank: n }));

/** 정렬된 표의 i 번째(0부터) 행에 붙는 메달. 4위부터는 없다. */
export function medalAt(i: number): Medal | null {
  return MEDAL[i] ?? null;
}

// ── 최소 판수 안내 ────────────────────────────────────────────────────
export type MinGamesSource = Partial<
  Pick<GuildPayload, 'min_games' | 'min_games_lane' | 'min_games_excluded' | 'min_days' | 'min_days_excluded'>
> | null | undefined;

export interface MinGamesNote {
  text: string;      // 안내 문장
  tip: string;       // 물음표 툴팁 본문 (줄바꿈 포함)
  tipLabel: string;  // 물음표의 aria-label
}

/**
 * "n판 이상 참여한 멤버만 집계합니다" 안내 — 1판만 뛰고 지표 1위가 되는 걸 막는 기준을 밝히고,
 * 왜 누가 안 보이는지도 함께 적는다. 문턱이 1 이하이고 일수 제외도 없으면 null(안내 없음).
 *
 * 참여 '일수' 문턱으로 빠진 사람은 판수 미달과 다른 이유다 — 합쳐서 세면 "제외 0명" 이라고
 * 적어 놓고 뒤로 여러 명이 사라지는 일이 생긴다. 그래서 둘을 따로 적는다.
 *
 * @param lane 라인별 지표 화면이면 true — 라인 문턱이 전체 문턱과 다를 때만 괄호로 덧붙인다.
 */
export function minGamesNote(data: MinGamesSource, lane = false): MinGamesNote | null {
  const n = data?.min_games || 1;
  const ex = data?.min_games_excluded || 0;
  const dx = data?.min_days_excluded || 0;
  if (n <= 1 && !dx) return null;
  const laneN = data?.min_games_lane;
  let text = `${n}판 이상 참여한 멤버만 집계합니다`;
  if (lane && laneN && laneN !== n) text += ` (라인별 지표는 ${laneN}판)`;
  if (ex) text += ` · ${ex}명은 판수 미달로 제외`;
  if (dx) text += ` · ${dx}명은 참여 일수 미달(${data?.min_days ?? 0}일)로 제외`;
  text += '.';
  return {
    text,
    tip: `순위는 ${n}판 이상부터입니다.\n그 전에는 표본이 작아 한 판이 순위를 크게 흔듭니다.`,
    tipLabel: '최소 판수 설명',
  };
}
