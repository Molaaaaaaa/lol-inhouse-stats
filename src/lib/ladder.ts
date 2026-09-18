/**
 * 사다리 행 — payload 의 `cp`(사람) 와 `players`(표시명·승률) 로 표 한 줄씩을 만드는 순수 함수.
 *
 * 옛 renderCp(통합)·renderCpLanes(라인별, legacy/index.html) 의 규칙을 옮겼다:
 * - 배치 미완(사람 `placed=false`, 라인별은 라인 `placed=false` 도)은 **선 아래 밴드**(`unp`) 에 모은다.
 *   CP 순서에 그대로 끼우면 정렬 위치가 티어를 누설하고, 표 맨 윗줄이 4판짜리가 된다(실측).
 *   밴드 안에서는 판수가 많은 순 — 배치가 곧 끝날 사람이 위.
 * - 순위·메달은 **기본 순서 기준**으로 미리 박는다. 표를 다른 열로 정렬해도 1위는 1위다
 *   (판수로 정렬하면 판수 1등이 금메달을 달던 함정). 배치 미완은 순위·메달 없음.
 * - 라인별은 사람 × 라인. 그 라인 판수가 라인 문턱(`min_games_lane`) 이상인 칸만 — 라인 하나를
 *   선택하면 그 라인을 실제로 뛴 사람만 든다(탑 화면에 탑 0판이 섞이던 실측 결함).
 *   라인 MMR 은 `lanes[lane].mmr`, CP·티어는 사람 것(라인별 CP 는 계약(types.ts)에 없다).
 * - 티어·CP·MMR·점수는 사람 배치 완료 뒤에만 값이 있다(그 전엔 null — 화면은 '—'·'배치 n/5').
 *
 * 전역 store 를 읽지 않는다. 화면이 `app.data`·`app.minGamesLane` 을 넘기고, 테스트는 조각을 넘긴다.
 */
import type { CpEntry, GuildPayload, LaneId, PlayerPub } from './data/types';
import { displayName } from './data/store.svelte';
import { LANE_SEQ, laneIdx } from './lanes';
import { cpTiers, medalAt, type Medal } from './tier';

/** 사다리가 읽는 payload 조각. GuildPayload 전체를 그대로 넘겨도 된다. */
export type LadderSource = Pick<GuildPayload, 'cp'> & Partial<Pick<GuildPayload, 'players' | 'cp_constants'>>;

export interface LadderRow {
  /** 행 키 — 통합은 멤버 키, 라인별은 `멤버키:라인` */
  key: string;
  /** 멤버 키(p1…). 멤버 화면 링크는 이름으로 간다 — 키는 발행마다 바뀐다 */
  pkey: string;
  /** 표시명(동명이인은 `이름~순번`) — 링크·검색과 같은 이름 */
  name: string;
  /** 통합: 주 라인 · 라인별: 그 행의 라인 */
  lane: LaneId | null;
  /** 라인 정렬용 순번(탑 0 … 서폿 4). 문자열 정렬은 알파벳순이라 따로 둔다 */
  laneOrd: number;
  /** 라인별 행이 그 사람의 주 라인인가 */
  main: boolean;
  /** 기본 순서의 순위(1부터). 배치 미완은 null */
  rank: number | null;
  medal: Medal | null;
  /** 사람 배치 완료 뒤에만 값 */
  tier: string;
  /** 티어 순번(1티어 = 1). 정렬용 — 이름 문자열은 '5티어' 가 가장 크다. 배치 전엔 null */
  tierIdx: number | null;
  cp: number | null;
  points: number | null;
  toNext: number | null;
  /** 통합: 사람 MMR · 라인별: 라인 MMR. 사람 배치 전엔 null */
  mmr: number | null;
  /** 통합: 사람 판수 · 라인별: 그 라인 판수 */
  games: number;
  /** 승률 0~1. 통합은 record, 라인별은 그 라인의 것. 없으면 null */
  winrate: number | null;
  /** 사람 배치 완료 */
  placed: boolean;
  /** 라인 배치 완료(통합 행은 placed 와 같다) */
  lanePlaced: boolean;
  /** 선 아래 밴드 — placed=false 또는 lanePlaced=false */
  unp: boolean;
}

function tierIdxOf(data: LadderSource, name: string): number | null {
  const i = cpTiers(data).findIndex((t) => t.name === name);
  return i < 0 ? null : i + 1;
}

function playerOf(data: LadderSource, key: string, e: CpEntry): { name: string; p: PlayerPub | null } {
  const p = data.players?.[key] ?? null;
  return { name: p ? displayName(p) : e.name, p };
}

function laneWinrate(p: PlayerPub | null, lane: LaneId): number | null {
  const s = p?.lanes?.find((l) => l.lane === lane);
  return s && typeof s.winrate === 'number' ? s.winrate : null;
}

/** 배치 완료 행은 기준값 내림차순 → 1..n 순위·메달. 미완 행은 판수 내림차순으로 뒤에 붙인다. */
function order(rows: LadderRow[], scoreOf: (r: LadderRow) => number): LadderRow[] {
  const placed = rows.filter((r) => !r.unp).sort((a, b) => scoreOf(b) - scoreOf(a));
  const pending = rows.filter((r) => r.unp).sort((a, b) => b.games - a.games);
  placed.forEach((r, i) => { r.rank = i + 1; r.medal = medalAt(i); });
  return placed.concat(pending);
}

/** 통합 사다리 — 사람당 한 줄, CP 내림차순. */
export function unifiedRows(data: LadderSource): LadderRow[] {
  const rows: LadderRow[] = [];
  for (const [key, e] of Object.entries(data.cp ?? {})) {
    const { name, p } = playerOf(data, key, e);
    const placed = !!e.placed;
    rows.push({
      key, pkey: key, name,
      lane: e.main_lane ?? null, laneOrd: laneIdx(e.main_lane), main: true,
      rank: null, medal: null,
      tier: placed ? e.tier : '',
      tierIdx: placed ? tierIdxOf(data, e.tier) : null,
      cp: placed ? e.cp : null,
      points: placed ? e.points : null,
      toNext: placed ? (e.to_next ?? null) : null,
      mmr: placed ? e.mmr : null,
      games: e.games,
      winrate: typeof p?.record?.winrate === 'number' ? p.record.winrate : null,
      placed, lanePlaced: placed, unp: !placed,
    });
  }
  return order(rows, (r) => r.cp ?? 0);
}

/**
 * 라인별 사다리 — 사람 × 라인(그 라인 판수 ≥ minGamesLane). lane 을 주면 그 라인만.
 * 기본 순서는 라인 MMR 내림차순. 사람 배치 미완이면 라인 MMR 도 비운다(사람 MMR 과 같은 규칙).
 */
export function laneRows(data: LadderSource, minGamesLane: number, lane: LaneId | null = null): LadderRow[] {
  const rows: LadderRow[] = [];
  const lanes = lane ? [lane] : LANE_SEQ;
  for (const [key, e] of Object.entries(data.cp ?? {})) {
    const { name, p } = playerOf(data, key, e);
    const placed = !!e.placed;
    for (const l of lanes) {
      const c = e.lanes?.[l];
      const games = c?.games ?? 0;
      if (!c || games < Math.max(1, minGamesLane)) continue;
      const lanePlaced = !!c.placed;
      rows.push({
        key: `${key}:${l}`, pkey: key, name,
        lane: l, laneOrd: laneIdx(l), main: l === e.main_lane,
        rank: null, medal: null,
        tier: placed ? e.tier : '',
        tierIdx: placed ? tierIdxOf(data, e.tier) : null,
        cp: placed ? e.cp : null,
        points: placed ? e.points : null,
        toNext: placed ? (e.to_next ?? null) : null,
        mmr: placed ? c.mmr : null,
        games,
        winrate: laneWinrate(p, l),
        placed, lanePlaced, unp: !placed || !lanePlaced,
      });
    }
  }
  return order(rows, (r) => r.mmr ?? 0);
}

/** 라인 버튼에 붙는 숫자 — 그 라인 표의 행 수와 같아야 한다(버튼 8 · 표 18 로 어긋나던 실측). */
export function laneCounts(data: LadderSource, minGamesLane: number): Record<LaneId, number> {
  const out = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0 } as Record<LaneId, number>;
  for (const l of LANE_SEQ) out[l] = laneRows(data, minGamesLane, l).length;
  return out;
}
