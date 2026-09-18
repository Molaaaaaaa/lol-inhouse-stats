/**
 * 순위 화면의 행 — 승률 리더보드(boardRows)·지표 순위(metricRows)·지표 검색(metricSearch). 전부 순수 함수.
 *
 * 옛 renderBoard/renderBoardLane·buildRankControls/renderRank(legacy/index.html 1154–1383)의 규칙을 옮겼다:
 * - 순위·메달은 **기본 순서 기준**으로 미리 박는다. 표를 다른 열로 정렬해도 1위는 1위다(DPM 으로 정렬하면
 *   DPM 1등이 금메달을 달던 실측). 같은 값은 같은 순위(경쟁 순위 — 공동 1위 다음은 3위, MetricCell 과 같다).
 * - 통합 리더보드는 payload 의 `leaderboard`(발행 쪽 문턱 적용, Wilson 하한 ci_lower 로 정렬)를 그대로 쓴다.
 *   패는 서버가 안 보낸다 → 판 − 승 으로 만든다(fmt 로만 만들면 정렬이 죽는다).
 * - 라인별은 `players[*].lanes`(멤버 × 라인, 라인 판수 ≥ minGamesLane). 승수는 round(승률 × 판).
 *   신뢰성은 서버가 라인별로 안 보내므로 같은 식(Wilson 95% 하한, `inhouse/stats.py:_wilson_lower`)으로 여기서
 *   낸다 — 통합과 라인별이 같은 잣대로 줄을 서야 "승률 리더보드" 하나다. 라인 MMR 은 사다리(홈)의 몫이라 여기 없다.
 * - 지표 순위는 `rankings[key]`(라인별 지표는 행마다 lane). lane 을 주면 그 라인만, 순위도 그 안에서 다시 매긴다.
 *   낮을수록 좋은 지표는 오름차순이 1위다.
 * - 이름은 `discord_name` 이라 표시명(동명이인 `이름~순번`)으로 바꾼다. 이름이 둘 이상에게 쓰이면 가릴 수 없으므로
 *   그대로 둔다(틀린 사람으로 이동하는 것보다 낫다).
 *
 * 전역 store 를 읽지 않는다. 화면이 `app.data`·`app.minGamesLane` 을 넘기고, 테스트는 조각을 넘긴다.
 */
import type { GuildPayload, LaneId, MetricGroup, MetricMeta, PlayerPub } from './data/types';
import { displayName } from './data/store.svelte';
import { LANE_SEQ, isLaneId, laneIdx } from './lanes';
import { medalAt, type Medal } from './tier';
import { cho, norm } from './search';
import { lowerBetter, mDesc, mLabel } from './metrics';

// ── 공통 ─────────────────────────────────────────────────────────────

/** 리더보드 보기 — 'lanes' 멤버 × 라인(기본) · 'all' 통합 · 라인 하나 */
export type BoardView = 'lanes' | 'all' | LaneId;

/** URL 조각(`#/rank/board/:lane?`) → 보기. 없거나 모르는 값은 라인별. */
export function boardViewOf(param: string | null | undefined): BoardView {
  if (param === 'all') return 'all';
  return isLaneId(param) ? param : 'lanes';
}

interface Named { name: string; key: string }

/** discord_name → { 표시명, 멤버 키 }. 같은 이름이 둘 이상이면 가릴 수 없다 → 이름 그대로, 키 없음. */
function nameIndex(players: Record<string, PlayerPub> | null | undefined): (name: string) => Named {
  const seen = new Map<string, Named | null>();
  for (const [key, p] of Object.entries(players ?? {})) {
    seen.set(p.name, seen.has(p.name) ? null : { name: displayName(p), key });
  }
  return (name) => seen.get(name) ?? { name, key: '' };
}

/**
 * 경쟁 순위(1,1,3) 와 메달을 기본 순서대로 박는다. score 가 null 인 행은 순위 없이 맨 뒤(들어온 순서).
 * 정렬은 안정이라 같은 점수는 들어온 순서(서버 정렬)를 지킨다.
 */
function rankRows<T extends { rank: number | null; medal: Medal | null }>(
  rows: T[], score: (r: T) => number | null, asc = false,
): T[] {
  const scored = rows.filter((r) => score(r) != null);
  const rest = rows.filter((r) => score(r) == null);
  scored.sort((a, b) => (asc ? 1 : -1) * ((score(a) as number) - (score(b) as number)));
  let rank = 0;
  let prev: number | null = null;
  scored.forEach((r, i) => {
    const s = score(r) as number;
    if (prev === null || s !== prev) rank = i + 1;
    prev = s;
    r.rank = rank;
    r.medal = medalAt(rank - 1);
  });
  return scored.concat(rest);
}

/** Wilson 95% 하한 — `inhouse/stats.py:_wilson_lower` 와 같은 식(z=1.96, 소수 3자리). 0판이면 0. */
export function wilsonLower(wins: number, games: number, z = 1.96): number {
  if (!(games > 0)) return 0;
  const p = wins / games;
  const n = games;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, Math.round(((centre - margin) / denom) * 1000) / 1000);
}

// ── 승률 리더보드 ─────────────────────────────────────────────────────

export type BoardSource = Partial<Pick<GuildPayload, 'leaderboard' | 'players'>>;

export interface BoardRow {
  /** 행 키 — 통합은 멤버 키(없으면 이름), 라인별은 `키:라인` */
  key: string;
  /** 표시명 — 멤버 링크·검색과 같은 이름 */
  name: string;
  /** 통합 행은 null */
  lane: LaneId | null;
  /** 라인 정렬용 순번(탑 0 … 서폿 4) */
  laneOrd: number;
  /** 기본 순서(신뢰성 내림차순)의 경쟁 순위 */
  rank: number | null;
  medal: Medal | null;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  /** 신뢰성 — 통합은 서버 ci_lower, 라인별은 여기서 낸 Wilson 하한 */
  ci: number;
  kda: number | null;
  kp: number | null;
  dpm: number | null;
  /** 판당 CS — 라인별만 */
  cs: number | null;
  /** 시야 점수 — 라인별만 */
  vision: number | null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** 통합 리더보드 — payload 의 leaderboard 한 줄씩. 신뢰성(ci_lower) 내림차순으로 순위. */
function unifiedBoard(data: BoardSource): BoardRow[] {
  const who = nameIndex(data.players);
  const rows: BoardRow[] = (data.leaderboard ?? []).map((r) => {
    const { name, key } = who(r.discord_name);
    const games = Number(r.games) || 0;
    const wins = Number(r.wins) || 0;
    return {
      key: key || `n:${name}`, name, lane: null, laneOrd: 9, rank: null, medal: null,
      games, wins, losses: games - wins,
      winrate: Number(r.winrate) || 0, ci: Number(r.ci_lower) || 0,
      kda: numOrNull(r.kda), kp: numOrNull(r.kp), dpm: numOrNull(r.dpm), cs: null, vision: null,
    };
  });
  return rankRows(rows, (r) => r.ci);
}

/** 라인별 리더보드 — 멤버 × 라인(그 라인 판수 ≥ minGamesLane). lane 을 주면 그 라인만. */
function laneBoard(data: BoardSource, minGamesLane: number, lane: LaneId | null): BoardRow[] {
  const need = Math.max(1, minGamesLane);
  const rows: BoardRow[] = [];
  for (const [key, p] of Object.entries(data.players ?? {})) {
    const name = displayName(p);
    for (const L of p.lanes ?? []) {
      if (!isLaneId(L.lane) || (lane && L.lane !== lane)) continue;
      const games = Number(L.games) || 0;
      if (games < need) continue;
      const winrate = Number(L.winrate) || 0;
      const wins = Math.round(winrate * games);
      rows.push({
        key: `${key}:${L.lane}`, name, lane: L.lane, laneOrd: laneIdx(L.lane), rank: null, medal: null,
        games, wins, losses: games - wins, winrate, ci: wilsonLower(wins, games),
        kda: numOrNull(L.kda), kp: numOrNull(L.kp), dpm: numOrNull(L.dpm),
        cs: numOrNull(L.cs), vision: numOrNull(L.vision),
      });
    }
  }
  // 같은 신뢰성이면 판수 많은 쪽, 그다음 승률, 그다음 이름 — 서버의 통합 리더보드와 같은 동점 처리
  rows.sort((a, b) => b.ci - a.ci || b.games - a.games || b.winrate - a.winrate || a.name.localeCompare(b.name, 'ko'));
  return rankRows(rows, (r) => r.ci);
}

/** 리더보드 행 — view 에 따라 통합·라인별·라인 하나. */
export function boardRows(data: BoardSource, view: BoardView, minGamesLane: number): BoardRow[] {
  if (view === 'all') return unifiedBoard(data);
  return laneBoard(data, minGamesLane, view === 'lanes' ? null : view);
}

/** 라인 버튼에 붙는 숫자 — 그 라인 표의 행 수와 같다. */
export function boardLaneCounts(data: BoardSource, minGamesLane: number): Record<LaneId, number> {
  const out = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0 } as Record<LaneId, number>;
  for (const l of LANE_SEQ) out[l] = laneBoard(data, minGamesLane, l).length;
  return out;
}

// ── 지표 순위 ─────────────────────────────────────────────────────────

export type MetricSource = Partial<Pick<GuildPayload, 'rankings' | 'players' | 'lower_better' | 'metric_meta' | 'metric_groups'>>;

export interface MetricRankRow {
  /** 행 키 — 멤버 키(없으면 이름), 라인별 지표는 `키:라인` */
  key: string;
  name: string;
  lane: LaneId | null;
  laneOrd: number;
  games: number;
  value: number;
  /** 기본 순서(값 내림차순 · 낮을수록 좋은 지표는 오름차순)의 경쟁 순위 */
  rank: number | null;
  medal: Medal | null;
}

/** 지표 순위 행. 모르는 키는 빈 목록. lane 을 주면 그 라인 행만(통합 지표에는 lane 이 없어 전부). */
export function metricRows(data: MetricSource, key: string, lane: LaneId | '' | null = ''): MetricRankRow[] {
  const src = data.rankings?.[key];
  if (!Array.isArray(src)) return [];
  const who = nameIndex(data.players);
  const rows: MetricRankRow[] = [];
  for (const r of src) {
    const rl = isLaneId(r.lane) ? r.lane : null;
    if (lane && rl && rl !== lane) continue;
    const { name, key: pk } = who(r.discord_name);
    const base = pk || `n:${name}`;
    rows.push({
      key: rl ? `${base}:${rl}` : base, name, lane: rl, laneOrd: laneIdx(rl),
      games: Number(r.games) || 0, value: Number(r.value) || 0, rank: null, medal: null,
    });
  }
  return rankRows(rows, (r) => r.value, lowerBetter(data.lower_better, key));
}

/** 그 지표가 라인별 행을 갖는가 — metric_meta.lane 이 우선, 없으면 행에 lane 이 있는지로. */
export function metricByLane(data: MetricSource, key: string): boolean {
  const m = data.metric_meta?.[key];
  if (m) return !!m.lane;
  const first = data.rankings?.[key]?.[0];
  return !!first && 'lane' in first;
}

/**
 * 값이 있는 지표만 든 분류 목록 — "데이터 없음"만 뜨는 칩을 만들지 않는다.
 * metric_groups 가 없으면(옛 JSON) 평평한 목록 하나로 돌아간다.
 */
export function metricGroupsAvail(data: MetricSource): MetricGroup[] {
  const have = data.rankings ?? {};
  const gs = (data.metric_groups ?? [])
    .map((g) => ({ group: g.group, metrics: (g.metrics ?? []).filter((k) => Array.isArray(have[k])) }))
    .filter((g) => g.metrics.length > 0);
  if (!gs.length && Object.keys(have).length) return [{ group: '지표', metrics: Object.keys(have) }];
  return gs;
}

/** 지표가 든 분류 이름. 없으면 첫 분류, 그도 없으면 ''. */
export function metricGroupOf(groups: readonly MetricGroup[], key: string): string {
  return (groups.find((g) => g.metrics.includes(key)) ?? groups[0])?.group ?? '';
}

/**
 * 첫 화면의 지표 — URL 의 키가 값이 있으면 그것, 아니면 기본 'dpm', 그도 없으면 첫 분류의 첫 지표. 하나도 없으면 ''.
 */
export function metricKeyOf(groups: readonly MetricGroup[], wanted: string | null | undefined, fallback = 'dpm'): string {
  const flat = groups.flatMap((g) => g.metrics);
  if (wanted && flat.includes(wanted)) return wanted;
  if (flat.includes(fallback)) return fallback;
  return flat[0] ?? '';
}

const JAMO_ONLY = /^[ㄱ-ㅎ]+$/;

/**
 * 지표 검색 — 라벨·키·설명(대회식 코드 GD10·CSM 이 설명에 들어 있다)을 훑는다. 분류를 무시하고 전체에서
 * 찾는다(어느 분류인지 모르니까 검색하는 것이다). 자음만 치면 초성으로 견준다(소환사명 검색과 같은 규칙).
 * 빈 질의는 빈 목록. 순서는 분류 순 → 분류 안 순.
 */
export function metricSearch(
  q: string,
  meta: Record<string, MetricMeta> | null | undefined,
  groups: readonly MetricGroup[],
): string[] {
  const k = norm(q);
  if (!k) return [];
  const keyOf = JAMO_ONLY.test(k) ? cho : norm;
  const hay = (key: string) => keyOf(`${mLabel(meta, key)} ${key} ${mDesc(meta, key)}`);
  const out: string[] = [];
  for (const g of groups) for (const key of g.metrics) if (!out.includes(key) && hay(key).includes(k)) out.push(key);
  return out;
}
