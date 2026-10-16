/**
 * 멤버 화면의 파생값 — 히어로 숫자 타일·승률 셀 글자·라인별 성적 표·능력치 축·맞대결. 전부 순수 함수다.
 *
 * 전역 store 를 읽지 않는다. 컴포넌트가 payload 조각(`data`)·멤버(`p`)·키를 넘기고, 테스트는
 * 작은 픽스처를 넘긴다. 옛 renderPlayerBody·renderCompare(legacy/index.html)의
 * 계산 규칙만 옮겼고 문구 조립은 여기서, 마크업은 컴포넌트에서 한다.
 *
 * ⚠️ h2h 키 `pA|pB` 의 순서는 발행마다 다를 수 있다(실측: `p2|p10` 과 `p17|p10` 이 같이 있다).
 *    두 방향을 다 찾고, 뒤집힌 키면 승패·챔피언을 바꿔 읽는다.
 */
import type { H2HEntry, LaneId, MvpRow, PlayerPub, ProfileAxis } from './data/types';
import { displayName } from './data/store.svelte';
import { pct } from './fmt';
import { isLaneId, laneIdx } from './lanes';
import { mLabel, type MetricMetaMap } from './metrics';
import { wrText } from './tier';

// ── 셀 조건부 서식 클래스(DataTable 이 그린다) ─────────────────────────

// 라인 띠 토큰의 짧은 이름(--lane-top … --lane-sup) — LANE_SEQ(탑→서폿) 순서. 라인 이름 표는 lanes.ts 하나다.
const LANE_BAND = ['top', 'jg', 'mid', 'bot', 'sup'] as const;
/** 라인 띠 이름 'top'·'jg'·… — 모르는 라인은 ''. 차트가 class 로 쓴다. */
export function laneBand(lane: string | null | undefined): string {
  return isLaneId(lane) ? (LANE_BAND[laneIdx(lane)] ?? '') : '';
}
/** 라인 띠 클래스('lane-top') — 딜량 막대(DmgBars) 이름 칸의 왼쪽 3px 띠. 표의 라인 열은 LaneChip 이다. 모르는 라인은 띠 없음. */
export function laneCls(lane: string | null | undefined): string {
  const b = laneBand(lane);
  return b ? `lane-${b}` : '';
}

// ── 승률 셀 글자(셀 스니펫 열의 fmt) ───────────────────────────────────
// 승률 열을 WinRate·WinGauge 스니펫으로 그리면 DataTable 은 스니펫을 aria-hidden 으로 감싸고 fmt 글자를 대신 읽힌다.
// 그래서 fmt 는 그 그림이 말하는 것을 다 적는다: 퍼센트 · 단계 문구($lib/tier 의 wrText) · 승패.

/** 게이지 셀 — wrText 에 'n승 n패'. 승수는 WinGauge 와 같은 반올림(승률 × 판). 값이 없으면 '' */
export function gaugeText(w: number | null | undefined, n: number | null | undefined, minGames: number): string {
  if (w == null) return '';
  const games = Math.max(0, Math.round(Number(n) || 0));
  const wins = Math.min(games, Math.max(0, Math.round(w * games)));
  return `${wrText(w, games, minGames)}, ${wins}승 ${games - wins}패`;
}

// ── 히어로 숫자 타일 ───────────────────────────────────────────────────

export interface HeaderStat {
  k: 'kda' | 'kp' | 'dpm' | 'form';
  label: string;
  text: string;
}

/**
 * 멤버 히어로의 숫자 타일 — KDA · 킬 관여 · 분당 딜 · 최근(최근 판 'w-l'). 지표 이름은 mLabel 만 쓴다(리터럴 라벨 금지).
 * 승률·판·승·패는 히어로의 승률 게이지가, 연속('2연승')은 연승 알약이 그린다 — 여기서 겹쳐 적지 않는다.
 * 최근 흐름이 없으면 그 타일은 없다.
 */
export function headerStats(p: Pick<PlayerPub, 'record' | 'form'>, meta: MetricMetaMap | null | undefined): HeaderStat[] {
  const r = p.record;
  const out: HeaderStat[] = [
    { k: 'kda', label: mLabel(meta, 'kda'), text: r.kda == null ? '-' : String(r.kda) },
    { k: 'kp', label: mLabel(meta, 'kp'), text: pct(r.kp) },
    { k: 'dpm', label: mLabel(meta, 'dpm'), text: r.dpm == null ? '-' : Math.round(r.dpm).toLocaleString('ko-KR') },
  ];
  if (p.form?.form) out.push({ k: 'form', label: '최근', text: p.form.form });
  return out;
}

/**
 * 누적 MVP 횟수 — payload `mvp` 목록(판수 문턱 이상이고 한 번 이상 뽑힌 멤버만 실린다)에서 이름으로 찾는다.
 * 목록은 원래 이름으로 실려 동명이인을 가릴 수 없다 — 그래서 표시명(동명이인은 '이름~순번')으로 대조해,
 * 가릴 수 없는 사람에게는 붙이지 않는다(틀린 배지보다 없는 배지가 낫다). 없으면 0.
 */
export function mvpCount(mvp: readonly MvpRow[] | null | undefined, p: PlayerPub): number {
  const name = displayName(p);
  return Number(mvp?.find((r) => r.name === name)?.mvp) || 0;
}

// ── 라인별 성적 표 ───────────────────────────────────────────────────────

export interface LaneRow {
  lane: LaneId | string;
  games: number;
  winrate: number | null;
  kda: number | null;
  dpm: number | null;
  kp: number | null;
}

/**
 * 라인별 성적 표의 행 — players[key].lanes 의 라인별 승률·KDA·분당 딜·킬 관여. 출전 0판인 라인은 뺀다.
 * 정렬은 판수 내림차순(활동량), 같으면 화면 라인 순서(탑→서폿).
 */
export function laneRows(p: Pick<PlayerPub, 'lanes'> | null | undefined): LaneRow[] {
  const rows: LaneRow[] = [];
  for (const s of p?.lanes ?? []) {
    if (!(s.games > 0)) continue;
    rows.push({ lane: s.lane, games: s.games, winrate: s.winrate ?? null, kda: s.kda ?? null, dpm: s.dpm ?? null, kp: s.kp ?? null });
  }
  return rows.sort((a, b) => b.games - a.games || laneIdx(a.lane) - laneIdx(b.lane));
}

/** 주 라인 — 가장 많이 뛴 라인(role_dist). 동률이면 화면 라인 순서(탑→서폿)에서 앞선 쪽. 뛴 판이 없으면 ''. */
export function mainLaneOf(p: Pick<PlayerPub, 'role_dist'> | null | undefined): LaneId | '' {
  let best: LaneId | '' = '';
  let most = 0;
  for (const r of p?.role_dist ?? []) {
    if (!isLaneId(r.lane) || !(r.games > 0)) continue;
    if (r.games > most || (r.games === most && best !== '' && laneIdx(r.lane) < laneIdx(best))) { best = r.lane; most = r.games; }
  }
  return best;
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

// ── 수식 줄(멤버 머리) ────────────────────────────────────────────────

/** 멤버 화면을 열 때 수식 줄에 두는 근거 — `=승률(승 13 · 패 16) → 45% · 29판`. 지표 이름은 mLabel 만 쓴다. */
export function fxMember(r: Pick<PlayerPub['record'], 'games' | 'wins' | 'losses' | 'winrate'>, meta: MetricMetaMap | null | undefined): string {
  return `=${mLabel(meta, 'winrate')}(승 ${r.wins} · 패 ${r.losses}) → ${pct(r.winrate)} · ${r.games}판`;
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
