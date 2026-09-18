/**
 * 멤버 화면의 나머지 패널 — 상대별 전적·최근 경기·시간대·세부 지표 — 가 쓰는 순수 함수.
 * 전역 DATA 를 읽지 않는다. 컴포넌트가 payload 조각을 넘기고, 테스트는 작은 객체를 넘긴다.
 *
 * ── '나 기준' 상대별 전적 (옛 renderPlayerVs) ──
 * h2h 는 쌍마다 **한 번**만 실린다. 키 `a|b` 의 순서는 발행 쪽 discord_id 정렬이라 화면의 멤버 키
 * 순서와 무관하다(실데이터: `p17|p10` 같은 키가 108개). 그래서 `me|opp` 와 `opp|me` 를 둘 다 찾고,
 * 내가 b 쪽이면 a_wins/b_wins 를 **뒤집는다**(`$lib/member` 의 h2hFor 가 그 규칙 하나를 갖는다).
 * with_wins 는 뒤집지 않는다 — 같은 팀이면 둘이 같이 이기고 같이 진다.
 * 옛 사이트는 이 주어 뒤집힘을 카드 두 장이 서로 반대로 적어 12쌍 중 3쌍이 서로를 반박했다.
 * 여기서는 왼쪽이 항상 '나' 라 그 모순이 구조적으로 불가능하다.
 *
 * 킬 관계(fun.kill_matrix)는 **이름**으로 실린다(h2h 는 키). 표시명이 겹치는 두 사람(tag)이 있으면
 * 어느 쪽 킬인지 알 수 없으므로 그 쌍은 null(비움)로 둔다 — 틀린 숫자보다 빈 칸이 낫다.
 */
import type { GuildPayload, LaneId, MetricCell, MetricGroup, MetricMeta, PlayerPub } from './data/types';
import { displayName } from './data/store.svelte';
import { fmtMetric, hourKo } from './fmt';
import { isLaneId, laneIdx } from './lanes';
import { h2hFor } from './member';
import { mDesc, mLabel, lowerBetter } from './metrics';
import { metricCode } from './metric-code';

// ── 상대별 전적 ──────────────────────────────────────────────────────

export interface VsRow {
  /** 상대의 멤버 키 — 행 키 */
  key: string;
  /** 상대 표시명 — 링크는 memberHref(opp) */
  opp: string;
  withGames: number;
  withWins: number;
  withWr: number | null;
  vsGames: number;
  /** 맞대결에서 **내가** 이긴 수 */
  myWins: number;
  oppWins: number;
  vsWr: number | null;
  /** 맞대결 판에서 내가 상대를 잡은 수. 맞대결이 없거나 이름이 겹쳐 못 가리면 null */
  kills: number | null;
  /** 상대가 나를 잡은 수 */
  deaths: number | null;
}

export type VsSource = Pick<GuildPayload, 'players' | 'h2h'> & { fun?: Pick<GuildPayload['fun'], 'kill_matrix'> | null };

/** killer 이름 → victim 이름 → 킬 수. 이름 안에 어떤 글자가 와도 되게 문자열 조립 대신 중첩 Map. */
function killIndex(rows: readonly { killer: string; victim: string; kills: number }[]): Map<string, Map<string, number>> {
  const m = new Map<string, Map<string, number>>();
  for (const r of rows) {
    let inner = m.get(r.killer);
    if (!inner) { inner = new Map(); m.set(r.killer, inner); }
    inner.set(r.victim, (inner.get(r.victim) ?? 0) + (Number(r.kills) || 0));
  }
  return m;
}

/** 원래 이름(tag 없이)이 두 사람 이상에게 쓰이면 그 이름은 kill_matrix 에서 가릴 수 없다 */
function ambiguousNames(players: Record<string, PlayerPub>): Set<string> {
  const seen = new Map<string, number>();
  for (const p of Object.values(players)) seen.set(p.name, (seen.get(p.name) ?? 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([nm]) => nm));
}

function ratio(w: number, n: number): number | null {
  return n > 0 ? w / n : null;
}

/**
 * 이 멤버(me = 멤버 키)가 든 h2h 쌍 전부를 '나 기준' 행으로. h2h 에 없는 사람은 행이 없다.
 * 정렬: 함께 판 ↓ · 맞대결 판 ↓ · 이름 ↑ — 표의 기본 정렬(함께 판)과 같아 동점이 안정적이다.
 */
export function vsRows(data: VsSource, me: string): VsRow[] {
  const players = data.players ?? {};
  const meP = players[me];
  if (!meP) return [];
  const h2h = data.h2h ?? {};
  const K = killIndex(data.fun?.kill_matrix ?? []);
  const amb = ambiguousNames(players);
  const out: VsRow[] = [];
  for (const [ok, op] of Object.entries(players)) {
    if (ok === me) continue;
    if (!(`${me}|${ok}` in h2h) && !(`${ok}|${me}` in h2h)) continue;   // 한 번도 안 만난 사람은 행이 없다
    const v = h2hFor(h2h, me, ok);        // 나를 a(왼쪽)로 정규화 — 뒤집힌 키면 승패를 바꿔 읽는다
    const vsGames = Number(v.vs) || 0;
    const myWins = Number(v.aWins) || 0;
    const oppWins = Number(v.bWins) || 0;
    const withGames = Number(v.withGames) || 0;
    const withWins = Number(v.withWins) || 0;
    let kills: number | null = null;
    let deaths: number | null = null;
    if (vsGames > 0 && !amb.has(meP.name) && !amb.has(op.name)) {
      kills = K.get(meP.name)?.get(op.name) ?? 0;
      deaths = K.get(op.name)?.get(meP.name) ?? 0;
    }
    out.push({
      key: ok, opp: displayName(op),
      withGames, withWins, withWr: ratio(withWins, withGames),
      vsGames, myWins, oppWins, vsWr: ratio(myWins, vsGames),
      kills, deaths,
    });
  }
  out.sort((a, b) =>
    b.withGames - a.withGames || b.vsGames - a.vsGames || a.opp.localeCompare(b.opp, 'ko'));
  return out;
}

// ── 시간대 ───────────────────────────────────────────────────────────

export interface HourRow { hour: number; games: number; label: string }

/**
 * 시간대별 판수 — 시각 오름차순, 같은 시각은 합산, 판수 0 이하는 뺀다.
 * 승률은 싣지 않는다: 표본이 시각당 한두 판이라 색을 입히는 순간 없는 패턴("새벽에 약하다")을 읽게 된다.
 */
export function hourRows(byHour: readonly { hour: number; games: number }[] | null | undefined): HourRow[] {
  const acc = new Map<number, number>();
  for (const h of byHour ?? []) {
    const hour = Number(h.hour), games = Number(h.games) || 0;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || games <= 0) continue;
    acc.set(hour, (acc.get(hour) ?? 0) + games);
  }
  return [...acc].sort((a, b) => a[0] - b[0]).map(([hour, games]) => ({ hour, games, label: hourKo(hour) }));
}

// ── 세부 지표 ────────────────────────────────────────────────────────

export interface MetricRow {
  key: string;
  label: string;
  /** 대회식 코드(GD10) — 설명에 실제로 있을 때만, 없으면 '' */
  code: string;
  value: number;
  /** 서식 적용된 값 글자 */
  text: string;
  games: number;
  rank: number;
  n: number;
  /** '4/25' */
  rankText: string;
  /** 백분위 0~1 (나보다 못한 사람 비율 — 낮을수록 좋은 지표도 발행 쪽이 이미 방향을 맞춰 준다) */
  pct: number;
  /** 막대 너비 0~100. 낮을수록 좋은 지표는 null(막대 없음) */
  bar: number | null;
  /** 통합 보기에서 라인별 지표의 대표 라인. 통합 지표는 null */
  lane: LaneId | null;
  lower: boolean;
  /** 판수 문턱 미만 — 흐리게 그리되 판수는 항상 적는다 */
  thin: boolean;
}

export interface MetricGroupRows {
  group: string;
  rows: MetricRow[];
  /** 그룹 안에 코드 있는 지표가 하나라도 있는가 — 없으면 코드 열을 빼도 된다 */
  hasCode: boolean;
}

export interface MetricRowOpts {
  /** payload.lower_better */
  lower?: readonly string[];
  /** 통합 지표 문턱(app.minGames) */
  minGames?: number;
  /** 라인별 지표 문턱(app.minGamesLane) */
  minGamesLane?: number;
}

/** metrics_lane 의 라인들 — 화면 순서(탑→서폿). 라인이 2개 이상일 때만 라인 선택이 뜬다 */
export function metricLanes(p: Pick<PlayerPub, 'metrics_lane'>): LaneId[] {
  return Object.keys(p.metrics_lane ?? {}).filter(isLaneId).sort((a, b) => laneIdx(a) - laneIdx(b));
}

/**
 * metric_groups 순서대로 그룹 → 행. lane 이 ''(통합)이면 p.metrics, 아니면 p.metrics_lane[lane].
 * 셀이 없는 지표는 행이 없고, 행이 없는 그룹은 빠진다(빈 표를 늘어놓지 않는다).
 */
export function metricRows(
  p: Pick<PlayerPub, 'metrics' | 'metrics_lane'>,
  meta: Record<string, MetricMeta> | null | undefined,
  groups: readonly MetricGroup[] | null | undefined,
  lane = '',
  opts: MetricRowOpts = {},
): MetricGroupRows[] {
  const cells: Record<string, MetricCell> = (lane ? p.metrics_lane?.[lane] : p.metrics) ?? {};
  const lower = opts.lower ?? [];
  const need = opts.minGames ?? 5;
  const needLane = opts.minGamesLane ?? 3;
  const out: MetricGroupRows[] = [];
  for (const g of groups ?? []) {
    const rows: MetricRow[] = [];
    for (const key of g.metrics ?? []) {
      const c = cells[key];
      if (!c) continue;
      const isLower = lowerBetter(lower, key);
      const pct = Number(c.pct) || 0;
      const games = Number(c.games) || 0;
      const laneMetric = !!meta?.[key]?.lane;
      const label = mLabel(meta, key);
      // 라벨과 같은 코드(KDA 의 설명에 'KDA' 가 있다)는 판이 라벨을 되풀이할 뿐이라 붙이지 않는다
      const found = metricCode(mDesc(meta, key));
      rows.push({
        key,
        label,
        code: found === label ? '' : found,
        value: c.value,
        text: fmtMetric(key, c.value, meta),
        games,
        rank: c.rank,
        n: c.n,
        rankText: `${c.rank}/${c.n}`,
        pct,
        bar: isLower ? null : Math.round(Math.max(0, Math.min(1, pct)) * 1000) / 10,
        lane: !lane && isLaneId(c.lane) ? c.lane : null,
        lower: isLower,
        thin: games < (laneMetric ? needLane : need),
      });
    }
    if (rows.length) out.push({ group: g.group, rows, hasCode: rows.some((r) => r.code !== '') });
  }
  return out;
}
