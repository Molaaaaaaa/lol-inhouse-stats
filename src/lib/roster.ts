/**
 * 멤버 시트 행 — payload 의 `players` 로 표 한 줄씩을 만드는 순수 함수.
 *
 * 홈은 경기에 나온 멤버 전원을 한 장에 늘어놓는다. 줄 세우는 기준은 판수(활동량) 하나다 —
 * 실력을 말하는 값으로 기본 순서를 두지 않는다. 동률은 이름 오름차순.
 * 주 라인은 그 멤버가 가장 많이 뛴 라인(같으면 탑→서폿 순서가 앞선 쪽).
 *
 * 전역 store 를 읽지 않는다. 화면이 `app.data` 를 넘기고, 테스트는 조각을 넘긴다.
 */
import type { GuildPayload, LaneId, PlayerPub } from './data/types';
import { displayName } from './data/store.svelte';
import { laneIdx } from './lanes';

/** 멤버 시트가 읽는 payload 조각. GuildPayload 전체를 그대로 넘겨도 된다. */
export type RosterSource = Pick<GuildPayload, 'players'>;

export interface RosterRow {
  /** 행 키 — 멤버 키(p1…). 발행마다 바뀌므로 링크에는 이름을 쓴다 */
  key: string;
  /** 표시명(동명이인은 `이름~순번`) — 링크·검색과 같은 이름 */
  name: string;
  /** 주 라인 — 라인 기록이 없으면 null */
  lane: LaneId | null;
  /** 라인 정렬용 순번(탑 0 … 서폿 4). 문자열 정렬은 알파벳순이라 따로 둔다 */
  laneOrd: number;
  games: number;
  wins: number;
  losses: number;
  /** 승률 0~1. 없으면 null */
  winrate: number | null;
  kda: number | null;
  /** 분당 딜 */
  dpm: number | null;
  /** 킬 관여 0~1 */
  kp: number | null;
}

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 가장 많이 뛴 라인. 판수가 같으면 탑→서폿 순서가 앞선 쪽. 기록이 없으면 null */
export function mainLaneOf(p: Pick<PlayerPub, 'lanes'>): LaneId | null {
  let best: { lane: LaneId; games: number } | null = null;
  for (const l of p.lanes ?? []) {
    if (!(l.games > 0)) continue;
    if (!best || l.games > best.games || (l.games === best.games && laneIdx(l.lane) < laneIdx(best.lane))) {
      best = { lane: l.lane, games: l.games };
    }
  }
  return best ? best.lane : null;
}

/** 판수 내림차순, 같으면 이름 오름차순(한국어 사전순) */
function byGamesThenName(a: RosterRow, b: RosterRow): number {
  return b.games - a.games || a.name.localeCompare(b.name, 'ko');
}

/** 멤버 시트의 행 — 판수 순. 데이터가 없으면 빈 목록 */
export function rosterRows(data: RosterSource | null | undefined): RosterRow[] {
  const rows: RosterRow[] = [];
  for (const [key, p] of Object.entries(data?.players ?? {})) {
    const r = p.record;
    const lane = mainLaneOf(p);
    rows.push({
      key,
      name: displayName(p),
      lane,
      laneOrd: laneIdx(lane),
      games: r?.games ?? 0,
      wins: r?.wins ?? 0,
      losses: r?.losses ?? 0,
      winrate: numOrNull(r?.winrate),
      kda: numOrNull(r?.kda),
      dpm: numOrNull(r?.dpm),
      kp: numOrNull(r?.kp),
    });
  }
  return rows.sort(byGamesThenName);
}
