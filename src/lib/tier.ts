/**
 * 티어·승률·메달·최소 판수 안내 — 화면이 색과 문구를 정할 때 쓰는 순수 함수.
 *
 * ⚠️ 티어 컷·문턱 상수는 **하나도 여기 적지 않는다.** 전부 payload(`cp_constants`·`min_games`)에서
 *    받는다. 화면과 발행 양쪽에 상수를 적으면 반드시 어긋난다(라인 최소 판수에서 겪었다).
 *    옛 코드가 DATA 전역을 읽던 자리는 전부 인자다 — 그래서 테스트가 payload 없이 돈다.
 */
import type { GuildPayload, TierCut } from '$lib/data/types';

// ── 승률 색 ───────────────────────────────────────────────────────────
export type WrClass = 'wr-h' | 'wr-m' | 'wr-l' | 'wr-dim';

// 55% 넘으면 높음, 45% 밑이면 낮음. 그 사이는 중립 — 내전은 균형을 맞춰 짜므로 대부분 여기 온다.
const WR_HIGH = 0.55;
const WR_LOW = 0.45;

/**
 * 승률 → 색 클래스. n(판수)과 문턱을 주면 문턱 미만은 색으로 단정하지 않는다.
 *
 * ⚠️ 1판 0% 를 빨강 ▼ 로 칠하면 "이 사람은 짧은 판에 약하다"로 읽힌다 — 한 판인데.
 *    판수는 "(1)" 로 적히지만 **색이 그걸 무시**하고 있었다(실측 20셀).
 *    판수를 모르는 호출부는 n 없이 부른다. n 을 주면 문턱도 같이 줘야 한다(전역을 안 읽으므로).
 */
export function wrClass(w: number): WrClass;
export function wrClass(w: number, n: number | null | undefined, minGames: number): WrClass;
export function wrClass(w: number, n?: number | null, minGames?: number): WrClass {
  if (n != null && minGames != null && n < minGames) return 'wr-dim';
  return w > WR_HIGH ? 'wr-h' : w < WR_LOW ? 'wr-l' : 'wr-m';
}

// ── 티어 ─────────────────────────────────────────────────────────────
/** 티어 컷의 출처 — payload 전체를 넘겨도 되고, 테스트는 `cp_constants` 만 든 객체를 넘긴다. */
export type TierSource = { cp_constants?: { tiers?: readonly TierCut[] | null } | null } | null | undefined;

/** 티어 컷 목록(위에서 아래로). payload 가 없거나 컷이 없으면 빈 목록 — 티어는 어디에도 안 보인다. */
export function cpTiers(data: TierSource): readonly TierCut[] {
  return data?.cp_constants?.tiers ?? [];
}

/**
 * 티어 이름 → CSS 클래스(`t-1티어`). 이름 자체를 클래스로 쓰되 컷 목록으로 거른다 —
 * payload 는 sanitize 를 거치지만, 클래스명에 값을 그대로 넣는 건 따로 막는다.
 */
export function tierCls(name: string, data: TierSource): string {
  return cpTiers(data).some((t) => t.name === name) ? 't-' + name : '';
}

export interface TierBadgeData { label: string; cls: string }

/** 배지 하나의 글자와 클래스. 렌더는 컴포넌트 몫 — 여기서는 HTML 을 만들지 않는다. */
export function tierBadge(name: string, data: TierSource): TierBadgeData {
  const t = tierCls(name, data);
  return { label: name, cls: t ? `tierbadge ${t}` : 'tierbadge' };
}

// ── 메달 ─────────────────────────────────────────────────────────────
export interface Medal { rank: 1 | 2 | 3; cls: string; label: string }

/** 1·2·3위 — 색은 CSS 의 `.medal.m1~m3`(티어 금색·중립·동색 토큰). 보조기술에는 '1위' 로 읽힌다. */
export const MEDAL: readonly Medal[] = ([1, 2, 3] as const).map((n) => ({
  rank: n,
  cls: `medal m${n}`,
  label: `${n}위`,
}));

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
    tip: `순위·티어 모두 ${n}판 이상부터입니다.\n그 전에는 표본이 작아 한 판이 순위를 크게 흔듭니다.`,
    tipLabel: '최소 판수 설명',
  };
}
