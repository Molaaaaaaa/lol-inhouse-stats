/**
 * 시너지 화면의 파생값 — 듀오·트리오 표 행, 히트맵 격자, 수식 줄 문구. 전부 순수 함수다.
 *
 * payload 의 `synergy`(듀오)·`trios`(트리오)를 그대로 받고 전역 store 를 읽지 않는다.
 * 옛 renderSyn·renderSynHeat(legacy/index.html)의 규칙을 옮겼다:
 * - 시너지 = (함께 이긴 수 − 판수 × 기대 승률) ÷ (판수 + κ). 즉 리프트(함께 승률 − 기대 승률)를
 *   판수로 0 쪽에 당긴 값이다. κ 는 발행 쪽이 자료에서 추정하고 payload 에 없다 — 화면은 다시
 *   계산하지 않고 발행값(lift·synergy)을 그대로 보인다.
 * - 히트맵 색 눈금은 **실값 범위(peak)** 다. 옛 화면이 ±0.15 로 고정했을 때 실측 최대가 ±0.046 이라
 *   208칸이 사실상 같은 색이었다. 눈금이 자료에 따라 늘어나므로 범례에 양 끝값을 적는다.
 * - 판수 문턱(payload 의 min_games) 미만 조합은 히트맵에서 빈 칸이다 — 2판짜리 +0.03 이 9판짜리와
 *   같은 색으로 보이면 안 된다. 듀오 표에는 남긴다(판수가 옆에 적혀 있다).
 */
import type { SynergyRow, TrioRow } from './data/types';
import { pct, sgn } from './fmt';

/** 이름 두 개를 잇는 글자 — 표 셀·툴팁·수식 줄에서 같은 기호를 쓴다 */
export const JOIN = ' ＋ ';

// ── 듀오 ─────────────────────────────────────────────────────────────

export interface DuoRow extends SynergyRow {
  /** 행 키 `na|nb` — 선택·{#each} 키 */
  key: string;
  /** 표 첫 열 글자 `A ＋ B` */
  pair: string;
}

export function duoKey(a: string, b: string): string {
  return `${a}|${b}`;
}

/** 듀오 표 행 — 발행 순서 그대로(표가 시너지 순으로 정렬한다). */
export function duoRows(synergy: readonly SynergyRow[] | null | undefined): DuoRow[] {
  return (synergy ?? []).map((r) => ({ ...r, key: duoKey(r.na, r.nb), pair: r.na + JOIN + r.nb }));
}

/** 시너지 셀 채움 — 양수 'win' · 음수 'loss' · 0 은 없음(옛 pos/neg). */
export function synCls(v: number | null | undefined): string {
  if (v == null) return '';
  return v > 0 ? 'win' : v < 0 ? 'loss' : '';
}

/**
 * 듀오 한 행의 계산 근거 — `=시너지 71% − 기대 47% = +0.245 → 14판 보정 +0.070`.
 * 앞은 리프트(그대로 뺀 값), 뒤는 판수로 0 쪽에 당긴 발행값. 둘을 같다고 적지 않는다.
 */
export function fxDuo(r: Pick<SynergyRow, 'winrate' | 'expected' | 'lift' | 'synergy' | 'games'>): string {
  return `=시너지 ${pct(r.winrate)} − 기대 ${pct(r.expected)} = ${sgn(r.lift)} → ${r.games}판 보정 ${sgn(r.synergy)}`;
}

// ── 트리오 ───────────────────────────────────────────────────────────

export interface TrioTableRow extends TrioRow {
  key: string;
  trio: string;
}

/** 트리오 표 행. 기대 승률은 payload 에 없어 수식 줄이 승률·판수·보정값만 적는다. */
export function trioRows(trios: readonly TrioRow[] | null | undefined): TrioTableRow[] {
  return (trios ?? []).map((r) => ({ ...r, key: `${r.a}|${r.b}|${r.c}`, trio: [r.a, r.b, r.c].join(JOIN) }));
}

/** 트리오 한 행의 계산 근거 — `=시너지(트리오) 승률 100% · 4판 보정 = +0.039` */
export function fxTrio(r: Pick<TrioRow, 'winrate' | 'games' | 'synergy'>): string {
  return `=시너지(트리오) 승률 ${pct(r.winrate)} · ${r.games}판 보정 = ${sgn(r.synergy)}`;
}

// ── 히트맵 ───────────────────────────────────────────────────────────

export interface HeatCell {
  /** 행 멤버(a)·열 멤버(b) — 화면 위치 기준. key 는 발행 순서(na|nb)라 대칭 칸이 같은 키를 갖는다 */
  a: string;
  b: string;
  key: string;
  games: number;
  winrate: number;
  expected: number;
  lift: number;
  /** 시너지 — 문턱 미만이면 null(빈 칸). games 는 남겨 둔다(왜 비었는지 말할 수 있게) */
  synergy: number | null;
}

export interface HeatMatrix {
  names: string[];
  /** cells[i][j] — 같은 사람(i === j)이나 함께 출전 기록이 없으면 null */
  cells: (HeatCell | null)[][];
  /** 색 눈금 — 보이는 칸(문턱 이상) 시너지 절댓값의 최대. 보이는 칸이 없으면 0 */
  peak: number;
}

/**
 * 히트맵에 올릴 이름 — 문턱 이상인 조합에 한 번이라도 든 사람, 한국어 사전순.
 * 사전순인 이유: 격자에서 자기 이름을 찾는 것이 첫 동작이고, 첫 열은 고정돼 세로로 훑는다.
 */
export function heatNames(synergy: readonly SynergyRow[] | null | undefined, minGames = 0): string[] {
  const set = new Set<string>();
  for (const r of synergy ?? []) if (r.games >= minGames) { set.add(r.na); set.add(r.nb); }
  return [...set].sort((x, y) => x.localeCompare(y, 'ko'));
}

/**
 * 멤버 × 멤버 격자. 대칭이다(cells[i][j] 와 cells[j][i] 는 같은 조합). names 를 주면 그 순서대로,
 * 안 주면 heatNames(문턱 이상인 사람만, 사전순). peak 는 보이는 칸의 실값 최대 — 눈금을 여기 맞춘다.
 */
export function heatMatrix(
  synergy: readonly SynergyRow[] | null | undefined,
  names?: readonly string[] | null,
  minGames = 0,
): HeatMatrix {
  const list = names ? [...names] : heatNames(synergy, minGames);
  const idx = new Map(list.map((n, i) => [n, i]));
  const cells: (HeatCell | null)[][] = list.map(() => list.map(() => null));
  let peak = 0;
  for (const r of synergy ?? []) {
    const i = idx.get(r.na), j = idx.get(r.nb);
    if (i === undefined || j === undefined || i === j) continue;
    const shown = r.games >= minGames;
    const v = shown && Number.isFinite(r.synergy) ? r.synergy : null;
    if (v !== null) peak = Math.max(peak, Math.abs(v));
    const base = { key: duoKey(r.na, r.nb), games: r.games, winrate: r.winrate, expected: r.expected, lift: r.lift, synergy: v };
    cells[i]![j] = { a: r.na, b: r.nb, ...base };
    cells[j]![i] = { a: r.nb, b: r.na, ...base };
  }
  return { names: list, cells, peak };
}

/** 칸 글자 — 두 자리. 두 자리에서 0 이 되는 값은 부호 없이 '0.00'(‘-0.00’ 을 내지 않는다). */
export function heatText(v: number): string {
  return heatSign(v) === 0 ? '0.00' : sgn(v, 2);
}

/** 칸 부호 — 두 자리로 반올림한 뒤의 부호(-1·0·1). 색 채움(pos/neg)과 글자가 같은 기준을 쓴다. */
export function heatSign(v: number): -1 | 0 | 1 {
  const r = Math.round(v * 100);
  return r > 0 ? 1 : r < 0 ? -1 : 0;
}

/** 칸 색의 세기 0~1 — 시너지 절댓값을 peak 로 나눈 것. peak 0 이면 0. */
export function heatT(v: number | null | undefined, peak: number): number {
  if (v == null || !(peak > 0)) return 0;
  return Math.min(1, Math.abs(v) / peak);
}

/** 칸 툴팁·설명 문구 — `A ＋ B\n시너지 +0.070 · 함께 14판 · 승률 71%`. 빈 칸(문턱 미만)은 왜 비었는지. */
export function heatTip(c: Pick<HeatCell, 'a' | 'b' | 'games' | 'winrate' | 'synergy'>, minGames: number): string {
  const head = c.a + JOIN + c.b;
  if (c.synergy == null) return `${head}\n함께 ${c.games}판 · ${minGames}판 미만이라 표시하지 않습니다`;
  return `${head}\n시너지 ${sgn(c.synergy)} · 함께 ${c.games}판 · 승률 ${pct(c.winrate)}`;
}

/**
 * 폰 히트맵 머리의 약칭 — 이름 앞 2자(공백은 세지 않는다: '주 녁'·'주 암' 은 '주녁'·'주암'). 겹치면
 * 겹치는 것끼리 한 자씩 더 늘려 서로 달라질 때까지(3자, 4자…). 이름이 그 길이보다 짧으면 이름 그대로.
 * 이름이 서로 다르므로 반드시 끝난다. 약칭이 이름과 같은 사람은 약칭 표에 적을 필요가 없다.
 */
export function shortNames(names: readonly string[]): string[] {
  const compact = names.map((n) => n.replace(/\s+/g, ''));
  const out = compact.map((n) => n.slice(0, 2));
  for (let len = 3; ; len++) {
    const seen = new Map<string, number>();
    for (const s of out) seen.set(s, (seen.get(s) ?? 0) + 1);
    let grew = false;
    out.forEach((s, i) => {
      if ((seen.get(s) ?? 0) > 1 && compact[i]!.length >= len) { out[i] = compact[i]!.slice(0, len); grew = true; }
    });
    if (!grew) return out;
  }
}

/** 폰에서 칸을 골랐을 때의 수식 줄 — 머리가 약칭이라 전체 이름 둘을 값과 같이 적는다. */
export function fxHeat(c: Pick<HeatCell, 'a' | 'b' | 'games' | 'winrate' | 'synergy'>): string {
  return `=시너지(${c.a}${JOIN}${c.b}) ${sgn(c.synergy ?? 0)} · 함께 ${c.games}판 · 승률 ${pct(c.winrate)}`;
}
