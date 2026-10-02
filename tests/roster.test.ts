import { describe, expect, it } from 'vitest';
import { mainLaneOf, rosterRows, type RosterSource } from '../src/lib/roster';
import type { LaneId, PlayerPub } from '../src/lib/data/types';

function lane(l: LaneId, games: number) {
  return { lane: l, games };
}
function player(name: string, games: number, lanes: { lane: LaneId; games: number }[], extra: Record<string, unknown> = {}, tag?: string): PlayerPub {
  return {
    name, ...(tag ? { tag } : {}),
    record: { games, wins: Math.round(games / 2), losses: games - Math.round(games / 2), winrate: 0.5, kda: 3.2, kp: 0.5, dpm: 800, ...extra },
    lanes,
  } as unknown as PlayerPub;
}
const src = (players: Record<string, PlayerPub>) => ({ players }) as unknown as RosterSource;

describe('rosterRows — 멤버 시트 행', () => {
  it('판수 내림차순 · 동률은 이름 오름차순(한국어 사전순)', () => {
    const rows = rosterRows(src({
      p1: player('하나', 10, [lane('TOP', 10)]),
      p2: player('가나', 10, [lane('MIDDLE', 10)]),
      p3: player('다라', 30, [lane('JUNGLE', 30)]),
      p4: player('나다', 2, [lane('BOTTOM', 2)]),
    }));
    expect(rows.map((r) => r.name)).toEqual(['다라', '가나', '하나', '나다']);
  });

  it('실력 대리값(승률)으로 줄 세우지 않는다 — 승률이 높아도 판수가 적으면 아래', () => {
    const rows = rosterRows(src({
      a: player('낮은승률', 40, [lane('TOP', 40)], { winrate: 0.3 }),
      b: player('높은승률', 3, [lane('TOP', 3)], { winrate: 1 }),
    }));
    expect(rows.map((r) => r.name)).toEqual(['낮은승률', '높은승률']);
  });

  it('동명이인은 표시명(이름~순번) · 행 키는 멤버 키', () => {
    const rows = rosterRows(src({
      p1: player('앙리', 5, [lane('TOP', 5)]),
      p2: player('앙리', 5, [lane('TOP', 5)], {}, '2'),
    }));
    expect(rows.map((r) => [r.key, r.name])).toEqual([['p1', '앙리'], ['p2', '앙리~2']]);
  });

  it('주 라인 = 가장 많이 뛴 라인, 같으면 탑→서폿 순서가 앞선 쪽, 기록이 없으면 null', () => {
    expect(mainLaneOf({ lanes: [lane('MIDDLE', 3), lane('JUNGLE', 9), lane('TOP', 1)] } as Pick<PlayerPub, 'lanes'>)).toBe('JUNGLE');
    expect(mainLaneOf({ lanes: [lane('UTILITY', 4), lane('BOTTOM', 4)] } as Pick<PlayerPub, 'lanes'>)).toBe('BOTTOM');
    expect(mainLaneOf({ lanes: [] } as unknown as Pick<PlayerPub, 'lanes'>)).toBeNull();
    expect(mainLaneOf({} as Pick<PlayerPub, 'lanes'>)).toBeNull();
    const [r] = rosterRows(src({ p: player('무라인', 4, []) }));
    expect(r!.lane).toBeNull();
    expect(r!.laneOrd).toBe(9);
  });

  it('값은 record 그대로 · 결측(null·NaN·없음)은 null', () => {
    const [full] = rosterRows(src({ p: player('가', 12, [lane('TOP', 12)], { wins: 7, losses: 5, winrate: 0.58, kda: 4.1, kp: 0.61, dpm: 1234 }) }));
    expect(full).toMatchObject({ games: 12, wins: 7, losses: 5, winrate: 0.58, kda: 4.1, kp: 0.61, dpm: 1234, lane: 'TOP', laneOrd: 0 });
    const [miss] = rosterRows(src({ p: player('나', 1, [lane('TOP', 1)], { winrate: null, kda: undefined, kp: Number.NaN, dpm: null }) }));
    expect(miss).toMatchObject({ winrate: null, kda: null, kp: null, dpm: null });
  });

  it('문턱 미만 멤버도 행에 든다(걸러내지 않는다) · 데이터가 없으면 빈 목록', () => {
    const rows = rosterRows(src({ a: player('가', 1, [lane('TOP', 1)]), b: player('나', 50, [lane('TOP', 50)]) }));
    expect(rows).toHaveLength(2);
    expect(rosterRows(null)).toEqual([]);
    expect(rosterRows(undefined)).toEqual([]);
    expect(rosterRows({} as RosterSource)).toEqual([]);
  });
});
