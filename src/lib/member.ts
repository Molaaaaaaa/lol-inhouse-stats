/**
 * 멤버 화면의 파생값 — 머리 전적 셀·라인별 표·능력치 축·MMR 검산·맞대결. 전부 순수 함수다.
 *
 * 전역 store 를 읽지 않는다. 컴포넌트가 payload 조각(`data`)·멤버(`p`)·키를 넘기고, 테스트는
 * 작은 픽스처를 넘긴다. 옛 renderPlayerBody·renderMathMmr·renderCompare(legacy/index.html)의
 * 계산 규칙만 옮겼고 문구 조립은 여기서, 마크업은 컴포넌트에서 한다.
 *
 * ⚠️ 배치 전(placed=false)에는 티어 이름이 **어디에도** 안 나온다 — 수식 줄 문구도 마찬가지.
 * ⚠️ h2h 키 `pA|pB` 의 순서는 발행마다 다를 수 있다(실측: `p2|p10` 과 `p17|p10` 이 같이 있다).
 *    두 방향을 다 찾고, 뒤집힌 키면 승패·챔피언을 바꿔 읽는다.
 */
import type {
  CpEntry, CpReplayRow, GuildPayload, H2HEntry, LaneId, PlayerPub, ProfileAxis,
} from './data/types';
import { displayName } from './data/store.svelte';
import { pct } from './fmt';
import { isLaneId, laneIdx } from './lanes';
import { mLabel, type MetricMetaMap } from './metrics';
import { wrClass } from './tier';

// ── 셀 조건부 서식 클래스(DataTable 이 그린다) ─────────────────────────

// 라인 띠 토큰의 짧은 이름(--lane-top … --lane-sup) — LANE_SEQ(탑→서폿) 순서. 라인 이름 표는 lanes.ts 하나다.
const LANE_BAND = ['top', 'jg', 'mid', 'bot', 'sup'] as const;
/** 라인 띠 이름 'top'·'jg'·… — 모르는 라인은 ''. 차트가 class 로 쓴다. */
export function laneBand(lane: string | null | undefined): string {
  return isLaneId(lane) ? (LANE_BAND[laneIdx(lane)] ?? '') : '';
}
/** 라인 셀 — DataTable 의 왼쪽 3px 띠 클래스('lane-top'). 모르는 라인은 띠 없음. */
export function laneCls(lane: string | null | undefined): string {
  const b = laneBand(lane);
  return b ? `lane-${b}` : '';
}
/** 승률 셀 — 높음 'win'·낮음 'loss' 채움, 문턱 미만·중간은 채움 없음. */
export function wrCls(w: number | null | undefined, n: number | null | undefined, minGames: number): string {
  if (w == null) return '';
  const c = wrClass(w, n, minGames);
  return c === 'wr-h' ? 'win' : c === 'wr-l' ? 'loss' : '';
}

// ── 머리 전적 셀 ───────────────────────────────────────────────────────

export interface HeaderStat {
  /** 셀 종류 — 'winrate' 는 컴포넌트가 WinRate 셀로 그린다 */
  k: 'record' | 'winrate' | 'kda' | 'kp' | 'dpm' | 'form';
  label: string;
  text: string;
}

/** 최근 폼 — "3-2 · 2연승". 연속이 없으면 폼만, 폼도 없으면 ''. */
export function formText(f: PlayerPub['form'] | null | undefined): string {
  if (!f) return '';
  const run = f.streak > 0 ? `${f.streak}연${f.dir === 'W' ? '승' : '패'}` : '';
  return [f.form, run].filter(Boolean).join(' · ');
}

/**
 * 머리 한 줄의 전적 셀들. 지표 이름은 mLabel 만 쓴다(리터럴 라벨 금지).
 * 옛 화면은 판·승·패를 알약 하나에 붙였다 — 같은 순서로 한 셀에 둔다.
 */
export function headerStats(p: Pick<PlayerPub, 'record' | 'form'>, meta: MetricMetaMap | null | undefined): HeaderStat[] {
  const r = p.record;
  const out: HeaderStat[] = [
    { k: 'record', label: '전적', text: `${r.games}판 ${r.wins}승 ${r.losses}패` },
    { k: 'winrate', label: mLabel(meta, 'winrate'), text: pct(r.winrate) },
    { k: 'kda', label: mLabel(meta, 'kda'), text: r.kda == null ? '-' : String(r.kda) },
    { k: 'kp', label: mLabel(meta, 'kp'), text: pct(r.kp) },
    { k: 'dpm', label: mLabel(meta, 'dpm'), text: r.dpm == null ? '-' : Math.round(r.dpm).toLocaleString('ko-KR') },
  ];
  const f = formText(p.form);
  if (f) out.push({ k: 'form', label: '최근', text: f });
  return out;
}

// ── 라인별 표 ─────────────────────────────────────────────────────────

export interface LaneRow {
  lane: LaneId | string;
  games: number;
  mmr: number | null;
  dev: number | null;
  placed: boolean;
  /** 배치 셀 글자 — 미완이면 '배치 n/3', 완료면 '완료' */
  placement: string;
  winrate: number | null;
  kda: number | null;
  dpm: number | null;
  kp: number | null;
}

export type LaneRowsData = Pick<GuildPayload, 'cp' | 'ratings' | 'players' | 'min_games_lane'>;

/**
 * 라인별 티어·MMR 표의 행 — cp[key].lanes(라인 MMR·편차·배치)에 players[key].lanes(승률·KDA·…)를
 * 붙인다. 출전 0판인 라인은 뺀다(추정치뿐이라 표에 둘 게 없다). 정렬은 판수 내림차순, 배치 미완은 뒤.
 * 티어 이름은 여기 없다 — 라인 CP 는 계약(types.ts)에 없고, 미완 라인은 어디에도 티어를 안 보인다.
 */
export function laneRows(data: LaneRowsData, key: string): LaneRow[] {
  const lanes = data.cp?.[key]?.lanes ?? data.ratings?.[key]?.lanes ?? {};
  const stats = new Map((data.players?.[key]?.lanes ?? []).map((s) => [s.lane as string, s]));
  const need = data.min_games_lane || 3;
  const rows: LaneRow[] = [];
  for (const [lane, L] of Object.entries(lanes)) {
    if (!L || !(L.games > 0)) continue;
    const s = stats.get(lane);
    rows.push({
      lane, games: L.games, mmr: L.mmr ?? null, dev: L.dev ?? null, placed: !!L.placed,
      placement: L.placed ? '완료' : `배치 ${L.games}/${need}`,
      winrate: s?.winrate ?? null, kda: s?.kda ?? null, dpm: s?.dpm ?? null, kp: s?.kp ?? null,
    });
  }
  return rows.sort((a, b) => Number(b.placed) - Number(a.placed) || b.games - a.games || laneIdx(a.lane) - laneIdx(b.lane));
}

// ── 능력치 축 ─────────────────────────────────────────────────────────

/** profile_lane 의 라인들 — 화면 순서(탑→서폿). 없으면 빈 목록. */
export function axisLanes(p: Pick<PlayerPub, 'profile_lane'> | null | undefined): string[] {
  return Object.keys(p?.profile_lane ?? {}).sort((a, b) => laneIdx(a) - laneIdx(b));
}

/**
 * 지금 그릴 라인 — 사용자가 고른 것(''=전체)이 우선, 없으면 주 라인(그 라인 축이 있을 때), 그도
 * 없으면 전체. 옛 화면의 curAxisLane 규칙: 사람이 바뀌면 그 사람의 주 라인으로.
 */
export function axisLaneFor(picked: string | null, lanes: readonly string[], mainLane: string | null | undefined): string {
  if (picked === '') return '';
  if (picked && lanes.includes(picked)) return picked;
  return mainLane && lanes.includes(mainLane) ? mainLane : '';
}

/** 그 라인의 축(점수 있는 것만). lane='' 면 통합 profile. 라인 축이 없으면 통합으로 떨어진다. */
export function axisRows(p: Pick<PlayerPub, 'profile' | 'profile_lane'> | null | undefined, lane: string): ProfileAxis[] {
  const per = lane ? p?.profile_lane?.[lane] : undefined;
  return (per ?? p?.profile ?? []).filter((a) => a.score != null);
}

/** 축 점수 자리수 — 눈금 step 이 0.01 이면 두 자리, 0.1 이상이면 한 자리. 화면이 따로 정하지 않는다. */
export function axisDigits(step: number | null | undefined): number {
  const st = step || 0.01;
  return st >= 0.1 ? 1 : 2;
}

/** 지난 내전 대비 변화 글자 — "▲0.48"·"▼0.37". 발행 쪽이 문턱 미만은 아예 안 싣는다. */
export function deltaText(d: number | null | undefined): string {
  if (d == null || d === 0) return '';
  return (d > 0 ? '▲' : '▼') + Math.abs(d).toFixed(2);
}

// ── MMR 검산 ──────────────────────────────────────────────────────────

export interface ReplayRow extends CpReplayRow {
  n: number;
  res: '승' | '패';
}

/** 경기별 리플레이 행(1..n 번호와 승패 글자를 붙인다). 순서는 payload 그대로(시간순). */
export function replayRows(cp: Pick<CpEntry, 'replay'> | null | undefined): ReplayRow[] {
  return (cp?.replay ?? []).map((r, i) => ({ ...r, n: i + 1, res: r.win ? '승' : '패' }));
}

export interface ReplayCheck {
  sum: number;      // Σ 델타
  total: number;    // base + Σ
  shown: number;    // 화면에 보이는 값(mmr 또는 cp)
  ok: boolean;      // |total − shown| ≤ 허용 오차(행마다 소수 3자리 반올림)
}

/**
 * 합계 검산 — mmr_base + Σd_mmr 이 표시 MMR 과 같은가(cp 도 같은 식). 허용 오차는 반올림 표시
 * 0.5 에 행마다 소수 3자리 오차(0.0005)를 더한 것(옛 renderMathMmr 과 같다).
 */
export function replayCheck(
  cp: Pick<CpEntry, 'replay' | 'mmr' | 'cp'> | null | undefined,
  base: number,
  field: 'd_mmr' | 'd_cp' = 'd_mmr',
): ReplayCheck {
  const rows = cp?.replay ?? [];
  const sum = rows.reduce((t, r) => t + (Number(r[field]) || 0), 0);
  const total = base + sum;
  const shown = Number(field === 'd_mmr' ? cp?.mmr : cp?.cp) || 0;
  const tol = 0.5 + rows.length * 0.0005;
  return { sum, total, shown, ok: Math.abs(total - shown) <= tol };
}

/** 부호 붙은 수 — 수식 줄용. 음수는 유니코드 마이너스(−)로, 표의 sgn(하이픈)과는 다르다. */
function signed(x: number, digits: number): string {
  return (x < 0 ? '−' : '+') + Math.abs(x).toFixed(digits);
}

/** 검산 표 한 행의 근거 — `=64 × ((0 − 0.467) + 0.019) = −28.70` */
export function fxReplayRow(r: Pick<CpReplayRow, 'k' | 'win' | 'e' | 'adj' | 'd_mmr'>): string {
  const adj = `${r.adj < 0 ? '−' : '+'} ${Math.abs(r.adj).toFixed(3)}`;
  return `=${Math.round(r.k)} × ((${r.win ? 1 : 0} − ${r.e.toFixed(3)}) ${adj}) = ${signed(r.d_mmr, 2)}`;
}

/** 합계 행의 근거 — `=SUM(ΔMMR) 1000 + 185.35 = 1185.35 → 1185` */
export function fxReplaySum(c: ReplayCheck, base: number, name = 'ΔMMR'): string {
  const op = c.sum < 0 ? '−' : '+';
  return `=SUM(${name}) ${base} ${op} ${Math.abs(c.sum).toFixed(2)} = ${c.total.toFixed(2)} → ${c.shown}`;
}

// ── 수식 줄(멤버 머리) ────────────────────────────────────────────────

/**
 * 멤버 화면을 열 때 수식 줄에 두는 근거 — `=티어(CP 1135) → 2티어 85점 · MMR 1185 · 6판`.
 * 배치 전에는 티어 대신 `배치 n/5`(티어 이름은 어디에도 안 나온다).
 */
export function fxMember(c: Pick<CpEntry, 'cp' | 'tier' | 'points' | 'mmr' | 'games' | 'placed'> | null | undefined, placementGames: number): string {
  if (!c) return '';
  const head = c.placed
    ? `=티어(CP ${c.cp}) → ${c.tier} ${c.points}점`
    : `=티어(CP ${c.cp}) → 배치 ${c.games}/${placementGames}`;
  return `${head} · MMR ${c.mmr} · ${c.games}판`;
}

// ── 맞대결(h2h) ───────────────────────────────────────────────────────

export interface H2HLaneRow { lane: LaneId; sameLane: boolean; aChamp: string; bChamp: string; aWin: boolean; winner: 'a' | 'b' }
export interface H2H {
  vs: number; aWins: number; bWins: number;
  withGames: number; withWins: number; withWinrate: number | null;
  lanes: H2HLaneRow[];
}

/** a(왼쪽)·b(오른쪽) 기준으로 정규화한 맞대결. 키가 `b|a` 로만 있으면 뒤집어 읽는다. 없으면 0판. */
export function h2hFor(h2h: Record<string, H2HEntry> | null | undefined, a: string, b: string): H2H {
  const direct = h2h?.[`${a}|${b}`];
  const rev = direct ? undefined : h2h?.[`${b}|${a}`];
  const rec = direct ?? rev;
  const flip = !direct && !!rev;
  if (!rec) return { vs: 0, aWins: 0, bWins: 0, withGames: 0, withWins: 0, withWinrate: null, lanes: [] };
  const lanes: H2HLaneRow[] = (rec.lanes ?? []).map((L) => {
    const aWin = flip ? !L.a_win : L.a_win;
    return {
      lane: L.lane, sameLane: L.same_lane,
      aChamp: flip ? L.b_champ : L.a_champ, bChamp: flip ? L.a_champ : L.b_champ,
      aWin, winner: aWin ? 'a' : 'b',
    };
  });
  return {
    vs: rec.vs_games,
    aWins: flip ? rec.b_wins : rec.a_wins,
    bWins: flip ? rec.a_wins : rec.b_wins,
    withGames: rec.with_games, withWins: rec.with_wins, withWinrate: rec.with_winrate,
    lanes,
  };
}

/** 표시명으로 멤버 찾기 — 동명이인은 `이름~2` 표시명으로 갈린다. */
export function playerByName(players: Record<string, PlayerPub> | null | undefined, name: string): { key: string; p: PlayerPub } | null {
  for (const [key, p] of Object.entries(players ?? {})) if (displayName(p) === name) return { key, p };
  return null;
}
