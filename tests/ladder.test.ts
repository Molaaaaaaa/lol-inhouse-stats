import { describe, expect, it } from 'vitest';
import { laneCounts, laneRows, unifiedRows, type LadderSource } from '../src/lib/ladder';
import type { CpEntry, CpLane, LaneId, PlayerPub } from '../src/lib/data/types';

// 작은 픽스처 — 사다리는 cp(사람·라인)·players(표시명·승률)만 본다
function lane(games: number, mmr: number, placed = games >= 5): CpLane {
  return { games, mmr, placed, dev: 0, strength: 0 };
}
function entry(name: string, cp: number, mmr: number, games: number, main: LaneId, lanes: Partial<Record<LaneId, CpLane>>, placed = games >= 5): CpEntry {
  return {
    name, games, main_lane: main, mmr, cp,
    tier: cp >= 1050 ? '2티어' : '3티어', points: cp % 100, to_next: 100 - (cp % 100),
    placed, lanes, replay: [],
  };
}
function player(name: string, winrate: number, lanes: { lane: LaneId; games: number; winrate: number }[], tag?: string): PlayerPub {
  return { name, ...(tag ? { tag } : {}), record: { games: 0, winrate }, lanes } as unknown as PlayerPub;
}

const DATA: LadderSource = {
  cp: {
    p1: entry('앙앙맹', 1135, 1185, 6, 'TOP', { TOP: lane(6, 1185), MIDDLE: lane(3, 1150) }),
    p2: entry('맹구', 980, 1010, 12, 'JUNGLE', { JUNGLE: lane(12, 1010) }),
    p3: entry('신입', 1090, 1120, 2, 'BOTTOM', { BOTTOM: lane(2, 1120) }),   // 배치 미완 — CP 는 높다
    p4: entry('Faker', 1210, 1260, 20, 'MIDDLE', { MIDDLE: lane(20, 1260), TOP: lane(4, 1230) }),
    p5: entry('앙리', 1000, 1000, 3, 'UTILITY', { UTILITY: lane(3, 1000) }),  // 배치 미완, 서폿 3판
  },
  players: {
    p1: player('앙앙맹', 1, [{ lane: 'TOP', games: 6, winrate: 1 }, { lane: 'MIDDLE', games: 3, winrate: 0.33 }]),
    p2: player('맹구', 0.5, [{ lane: 'JUNGLE', games: 12, winrate: 0.5 }]),
    p3: player('신입', 0, [{ lane: 'BOTTOM', games: 2, winrate: 0 }]),
    p4: player('Faker', 0.7, [{ lane: 'MIDDLE', games: 20, winrate: 0.7 }, { lane: 'TOP', games: 4, winrate: 0.75 }]),
    p5: player('앙리', 0.66, [{ lane: 'UTILITY', games: 3, winrate: 0.66 }], '2'),
  },
};
const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe('unifiedRows — 통합 사다리', () => {
  const rows = unifiedRows(DATA);

  it('배치 완료는 CP 내림차순, 배치 미완은 맨 아래(판수 순)·unp', () => {
    expect(names(rows)).toEqual(['Faker', '앙앙맹', '맹구', '앙리~2', '신입']);
    expect(rows.map((r) => r.unp)).toEqual([false, false, false, true, true]);
    // CP 1090 인 신입이 위에 끼지 않는다 — 정렬 위치가 티어를 누설하지 않게
    expect(rows.findIndex((r) => r.name === '신입')).toBe(4);
  });

  it('순위·메달은 배치 완료 행에만 1..n', () => {
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, null, null]);
    expect(rows.map((r) => r.medal?.rank ?? null)).toEqual([1, 2, 3, null, null]);
    expect(rows[0]!.medal?.label).toBe('1위');
  });

  it('배치 미완은 티어·CP·MMR·점수가 비고(null·빈 문자열), 판수·승률은 있다', () => {
    const r = rows.find((x) => x.name === '신입')!;
    expect(r.tier).toBe('');
    expect(r.cp).toBeNull();
    expect(r.mmr).toBeNull();
    expect(r.points).toBeNull();
    expect(r.toNext).toBeNull();
    expect(r.games).toBe(2);
    expect(r.winrate).toBe(0);
    expect(r.placed).toBe(false);
  });

  it('배치 완료 행은 payload 값 그대로 · 주 라인 · 승률은 players.record 에서', () => {
    const r = rows.find((x) => x.name === '앙앙맹')!;
    expect(r).toMatchObject({ key: 'p1', pkey: 'p1', lane: 'TOP', tier: '2티어', cp: 1135, mmr: 1185, points: 35, toNext: 65, games: 6, winrate: 1, placed: true, unp: false });
  });

  it('표시명은 동명이인 순번을 붙인다(링크·검색과 같은 이름) · players 가 없으면 cp 의 이름', () => {
    expect(rows.find((x) => x.pkey === 'p5')!.name).toBe('앙리~2');
    const bare = unifiedRows({ cp: DATA.cp });
    expect(bare.find((x) => x.pkey === 'p5')!.name).toBe('앙리');
    expect(bare[0]!.winrate).toBeNull();
  });

  it('cp 가 비면 빈 배열', () => {
    expect(unifiedRows({ cp: {} })).toEqual([]);
  });
});

describe('laneRows — 라인별 사다리', () => {
  const rows = laneRows(DATA, 3);

  it('사람 × 라인, 라인 판수 ≥ 문턱인 칸만 (신입 원딜 2판은 빠진다)', () => {
    expect(rows.map((r) => `${r.name}/${r.lane}`)).toEqual([
      'Faker/MIDDLE', '앙앙맹/TOP', '맹구/JUNGLE',           // 라인 배치 완료 — 라인 MMR 순
      'Faker/TOP', '앙앙맹/MIDDLE', '앙리~2/UTILITY',       // 선 아래 — 판수 순 4 · 3 · 3
    ]);
    expect(rows.map((r) => r.key)).toContain('p1:MIDDLE');
  });

  it('라인 배치 미완(판수 < 5)·사람 배치 미완은 unp, 순위·메달 없음', () => {
    expect(rows.map((r) => r.unp)).toEqual([false, false, false, true, true, true]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, null, null, null]);
    expect(rows.filter((r) => r.medal).map((r) => r.name)).toEqual(['Faker', '앙앙맹', '맹구']);
    // 라인만 미완인 행은 사람 티어·CP 는 그대로, 라인 MMR 도 보인다 — 밴드만 아래
    const ft = rows.find((r) => r.key === 'p4:TOP')!;
    expect(ft).toMatchObject({ tier: '2티어', cp: 1210, mmr: 1230, games: 4, placed: true, lanePlaced: false, main: false, winrate: 0.75 });
    // 사람 배치 미완은 라인 MMR 도 비운다
    const ang = rows.find((r) => r.key === 'p5:UTILITY')!;
    expect(ang).toMatchObject({ tier: '', cp: null, mmr: null, games: 3, placed: false, unp: true });
  });

  it('라인 MMR 은 lanes[lane].mmr, 주 라인 표시, 라인 승률은 players.lanes 에서', () => {
    const am = rows.find((r) => r.key === 'p1:MIDDLE')!;
    expect(am.mmr).toBe(1150);
    expect(am.main).toBe(false);
    expect(am.winrate).toBe(0.33);
    expect(rows.find((r) => r.key === 'p1:TOP')!.main).toBe(true);
  });

  it('라인 하나만: 그 라인을 뛴 사람만, 순위는 그 라인 안에서 다시', () => {
    const top = laneRows(DATA, 3, 'TOP');
    expect(top.map((r) => r.name)).toEqual(['앙앙맹', 'Faker']);
    expect(top.map((r) => r.rank)).toEqual([1, null]);
    expect(laneRows(DATA, 3, 'BOTTOM')).toEqual([]);
  });

  it('문턱을 올리면 3판짜리 칸이 빠진다 · 문턱 0 은 1 로 본다(0판 라인은 안 든다)', () => {
    expect(laneRows(DATA, 5).map((r) => r.key)).toEqual(['p4:MIDDLE', 'p1:TOP', 'p2:JUNGLE']);
    expect(laneRows(DATA, 0).some((r) => r.games === 0)).toBe(false);
  });

  it('laneCounts 는 라인 버튼 숫자 = 그 라인 표의 행 수', () => {
    expect(laneCounts(DATA, 3)).toEqual({ TOP: 2, JUNGLE: 1, MIDDLE: 2, BOTTOM: 0, UTILITY: 1 });
  });
});
