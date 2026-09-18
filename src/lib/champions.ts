/**
 * 챔피언 화면의 행 — payload 의 `champion_meta`·`champion_meta_lane`·`champion_matchups`·`ban_meta`·
 * `fun.champ_pool` 을 표 한 줄씩으로 만드는 순수 함수. 옛 renderChamp·renderFun(챔피언 폭) 의 규칙만 옮겼다.
 *
 * - 메타: 라인이 없으면 전체 합계(`champion_meta`), 있으면 그 라인 행만(`champion_meta_lane`). 판수 내림차순.
 * - 챔피언 폭: 멤버 × 라인. 라인을 주면 그 라인만 — 위 메타 표와 같은 라인 버튼 하나가 두 표를 함께 거른다.
 *   `discord_name` 은 표시명이 아니다 — players 에서 같은 이름을 찾아 표시명(동명이인 `이름~2`)으로 바꾼다.
 * - 매치업·밴: 판수·밴 수 내림차순. 밴은 `ban_available` 이 거짓이면 빈 목록(화면이 빈 상태 문장을 둔다).
 * - 한글 이름은 `champ_ko[id] ?? id`. 밴 행은 발행물이 `champion_kr` 을 따로 실으므로 그것을 두 번째로 본다.
 *
 * 전역 store 를 읽지 않는다. 화면이 `app.data` 조각을 넘기고, 테스트는 작은 픽스처를 넘긴다.
 */
import type { BanRow, ChampionMatchupRow, ChampionMetaRow, FunStats, GuildPayload, LaneId, PlayerPub } from './data/types';
import { displayName } from './data/store.svelte';
import { pct } from './fmt';
import { isLaneId, laneIdx, laneKo } from './lanes';

/** 챔피언 화면이 읽는 payload 조각. GuildPayload 전체를 그대로 넘겨도 된다. */
export type ChampSource = Partial<Pick<GuildPayload,
  'champion_meta' | 'champion_meta_lane' | 'champion_matchups' | 'ban_meta' | 'ban_available' | 'champ_ko' | 'players'
>> | null | undefined;

/** 챔피언 한글 이름 — 사전에 없으면 id 그대로(숨기면 데이터 문제를 못 본다). */
export function champKo(data: { champ_ko?: Record<string, string> | null } | null | undefined, id: string | null | undefined): string {
  if (!id) return '';
  return data?.champ_ko?.[id] ?? id;
}

const byGamesDesc = <T extends { games: number }>(a: T, b: T) => b.games - a.games;

// ── 메타 ─────────────────────────────────────────────────────────────

export interface MetaRow {
  /** 행 키 — 전체는 챔피언 id, 라인별은 `id:라인` */
  key: string;
  champ: string;
  /** 한글 이름(거르기·정렬은 이 글자) */
  name: string;
  /** 라인별 표에서만 값. 전체 표는 null */
  lane: LaneId | null;
  laneOrd: number;
  games: number;
  winrate: number;
  kda: number;
  dpm: number;
}

/**
 * 챔피언 메타 표의 행. lane 이 비면(''·null) 전체 합계, 라인이면 그 라인의 행만. 판수 내림차순.
 * 모르는 라인 문자열은 전체로 본다(라우트 매개변수가 그대로 들어온다).
 */
export function metaRows(data: ChampSource, lane: string | null | undefined): MetaRow[] {
  const L = isLaneId(lane) ? lane : null;
  const src: readonly ChampionMetaRow[] = L
    ? (data?.champion_meta_lane ?? []).filter((r) => r.lane === L)
    : (data?.champion_meta ?? []);
  return src
    .map((r): MetaRow => ({
      key: L ? `${r.champion_name}:${L}` : r.champion_name,
      champ: r.champion_name,
      name: champKo(data, r.champion_name),
      lane: L, laneOrd: L ? laneIdx(L) : 9,
      games: r.games, winrate: r.winrate, kda: r.kda, dpm: r.dpm,
    }))
    .sort(byGamesDesc);
}

// ── 챔피언 폭 ────────────────────────────────────────────────────────

export interface PoolRow {
  /** 행 키 — `표시명:라인` */
  key: string;
  /** 표시명(동명이인은 `이름~순번`) — 멤버 링크·검색과 같은 이름 */
  name: string;
  lane: LaneId | string;
  laneOrd: number;
  games: number;
  /** 챔피언 종류 수 */
  champs: number;
  /** 다양성 0~1 = champs ÷ games */
  variety: number;
}

export type PoolSource = { champ_pool?: FunStats['champ_pool'] | null } | null | undefined;

/** discord_name → 표시명. 같은 이름의 멤버가 하나면 그 표시명, 없거나 여럿이면 이름 그대로. */
function displayOf(players: Record<string, PlayerPub> | null | undefined, name: string): string {
  const hits = Object.values(players ?? {}).filter((p) => p.name === name);
  return hits.length === 1 ? displayName(hits[0]!) : name;
}

/**
 * 챔피언 폭 표의 행 — 멤버 × 라인. lane 을 주면 그 라인만. 판수 내림차순, 같으면 라인 순.
 * `players` 를 주면 이름을 표시명으로 바꾼다(멤버 화면 링크가 표시명을 쓴다).
 */
export function poolRows(
  fun: PoolSource,
  lane: string | null | undefined = null,
  players: Record<string, PlayerPub> | null | undefined = null,
): PoolRow[] {
  const L = isLaneId(lane) ? lane : null;
  return (fun?.champ_pool ?? [])
    .filter((r) => !L || r.lane === L)
    .map((r): PoolRow => {
      const name = displayOf(players, r.discord_name);
      return {
        key: `${name}:${r.lane}`, name,
        lane: r.lane, laneOrd: laneIdx(r.lane),
        games: r.games, champs: r.champs, variety: r.variety,
      };
    })
    .sort((a, b) => b.games - a.games || a.laneOrd - b.laneOrd || a.name.localeCompare(b.name, 'ko'));
}

/** 수식 줄 — 챔피언 폭 행의 근거: `=챔피언 폭(앙앙맹 · 탑) 6종 ÷ 6판 = 100%` */
export function fxPool(r: Pick<PoolRow, 'name' | 'lane' | 'champs' | 'games' | 'variety'>): string {
  return `=챔피언 폭(${r.name} · ${laneKo(r.lane)}) ${r.champs}종 ÷ ${r.games}판 = ${pct(r.variety)}`;
}

// ── 매치업 ───────────────────────────────────────────────────────────

export interface MatchupRow {
  /** 행 키 — `라인:챔피언:상대` */
  key: string;
  lane: LaneId;
  laneOrd: number;
  champ: string;
  name: string;
  vs: string;
  vsName: string;
  games: number;
  winrate: number;
}

/** 라인 매치업 행 — 판수 내림차순, 같으면 승률 내림차순·라인 순. */
export function matchupRows(data: ChampSource): MatchupRow[] {
  return (data?.champion_matchups ?? [])
    .map((r: ChampionMatchupRow): MatchupRow => ({
      key: `${r.lane}:${r.champ}:${r.vs_champ}`,
      lane: r.lane, laneOrd: laneIdx(r.lane),
      champ: r.champ, name: champKo(data, r.champ),
      vs: r.vs_champ, vsName: champKo(data, r.vs_champ),
      games: r.games, winrate: r.winrate,
    }))
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate || a.laneOrd - b.laneOrd);
}

// ── 밴 ───────────────────────────────────────────────────────────────

export interface BanTableRow {
  key: string;
  champ: string;
  name: string;
  bans: number;
}

/** 밴 표 행 — `ban_available` 이 거짓이면 빈 목록(빈 표가 "아무도 밴을 안 했다" 로 읽히지 않게). 밴 수 내림차순. */
export function banRows(data: ChampSource): BanTableRow[] {
  if (!data?.ban_available) return [];
  return (data.ban_meta ?? [])
    .map((r: BanRow): BanTableRow => ({
      key: r.champion_name,
      champ: r.champion_name,
      name: data.champ_ko?.[r.champion_name] ?? r.champion_kr ?? r.champion_name,
      bans: r.bans,
    }))
    .sort((a, b) => b.bans - a.bans || a.name.localeCompare(b.name, 'ko'));
}
