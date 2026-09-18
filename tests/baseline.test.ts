import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUANTILES, NO_BASELINE, baseSampleText, baselineGames, baselinePanel, baselinePlace, baselinePos,
} from '../src/lib/baseline';
import type { Baseline, GuildPayload, PlayerPub, ProfileAxis } from '../src/lib/data/types';

// 파이썬 검사(scripts/_inhouse_check.py: check_baseline)가 baseline.place 에 거는 사례 그대로
const Q7 = [1, 2, 3, 4, 5, 6, 7];

describe('baselinePlace — 파이썬 place() 와 같은 값', () => {
  it('검사 스위트의 수치 사례', () => {
    expect(baselinePlace(Q7, 4, false)).toBe(50);
    expect(baselinePlace(Q7, 9, false)).toBe(97.5);
    expect(baselinePlace(Q7, 0, false)).toBe(2.5);
    expect(baselinePlace(Q7, 4, true)).toBe(50);
    expect(baselinePlace(Q7, 0, true)).toBe(97.5);
  });
  it('양 끝 분위수 위에 정확히 놓이면 바깥 취급(5 → 2.5, 95 → 97.5)', () => {
    expect(baselinePlace(Q7, 1, false)).toBe(2.5);
    expect(baselinePlace(Q7, 7, false)).toBe(97.5);
  });
  it('분위수 사이는 선형 보간', () => {
    expect(baselinePlace(Q7, 1.5, false)).toBe(7.5);
    expect(baselinePlace(Q7, 6.5, false)).toBe(92.5);
    expect(baselinePlace(Q7, 2.5, true)).toBe(82.5);
  });
  it('실데이터 분위수(미드, 패치 16.10 이후) — 파이썬으로 계산한 값', () => {
    const dpm = [398.1, 472.4, 610.5, 793.5, 1006.225, 1224.8, 1369.2];
    expect(baselinePlace(dpm, 731, false)).toBeCloseTo(41.46174863387978, 10);
    expect(baselinePlace(dpm, 1100, false)).toBeCloseTo(81.43543406153495, 10);
    const deaths = [1, 2, 3, 5, 8, 10, 11];
    expect(baselinePlace(deaths, 4, true)).toBe(62.5);
    expect(baselinePlace(deaths, 6, true)).toBeCloseTo(41.66666666666667, 10);
    expect(baselinePlace(deaths, 12, true)).toBe(2.5);
    expect(baselinePlace(deaths, 0.5, true)).toBe(97.5);
    const kp = [0.182, 0.239, 0.333, 0.438, 0.538, 0.629, 0.681];
    expect(baselinePlace(kp, 0.6, false)).toBeCloseTo(85.21978021978022, 10);
  });
  it('quantiles 를 따로 주면 그 백분위로', () => {
    const P = [25, 50, 75];
    expect(baselinePlace([10, 20, 30], 20, false, P)).toBe(50);
    expect(baselinePlace([10, 20, 30], 5, false, P)).toBe(12.5);
    expect(baselinePlace([10, 20, 30], 40, false, P)).toBe(87.5);
    expect(DEFAULT_QUANTILES).toEqual([5, 10, 25, 50, 75, 90, 95]);
  });
  it('같은 값이 겹친 분위수는 첫 구간이 잡는다(파이썬과 같다)', () => {
    expect(baselinePlace([1, 2, 3, 3, 5, 6, 7], 3, false)).toBe(25);
    expect(baselinePlace([1, 2, 3, 3, 3, 6, 7], 3, false)).toBe(25);
  });
  it('분위수가 비면 NaN — 95 를 돌려주지 않는다', () => {
    expect(baselinePlace([], 4, false)).toBeNaN();
  });
});

describe('baselinePos', () => {
  const cell = { q: Q7 };
  it('상위 %·라벨·배지 색', () => {
    expect(baselinePos(cell, 4, false)).toEqual({ pos: 50, top: 50, label: '솔랭 상위 50%', cls: '' });
    expect(baselinePos(cell, 9, false)).toMatchObject({ pos: 97.5, top: 3, label: '솔랭 상위 3%', cls: 'good' });
    expect(baselinePos(cell, 0, false)).toMatchObject({ pos: 2.5, top: 98, label: '솔랭 상위 98%', cls: 'bad' });
  });
  it('경계: 75 는 good, 25 는 bad', () => {
    expect(baselinePos(cell, 5, false).cls).toBe('good');   // p75 위 → 75
    expect(baselinePos(cell, 3, false).cls).toBe('bad');    // p25 위 → 25
    expect(baselinePos(cell, 3.01, false).cls).toBe('');
  });
  it('lowerBetter 를 뒤집어 준다', () => {
    expect(baselinePos(cell, 0, true)).toMatchObject({ pos: 97.5, top: 3, cls: 'good' });
  });
});

const BASE: Baseline = {
  roles: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'],
  tiers: ['GOLD', 'EMERALD', 'DIAMOND', 'MASTER'],
  tier_ko: { GOLD: '골드', EMERALD: '에메랄드', DIAMOND: '다이아', MASTER: '마스터' },
  quantiles: [5, 10, 25, 50, 75, 90, 95],
  games: { DIAMOND: 16582, EMERALD: 6292, GOLD: 6220, MASTER: 20000 },
  patch_min: '16.10',
  metrics: {
    dpm: { label: '분당 딜', lower_better: false, by_role: {
      MIDDLE: { n: 98188, q: [398.1, 472.4, 610.5, 793.5, 1006.225, 1224.8, 1369.2], spread: -0.059, tier_med: {} },
    } },
    deaths_per_game: { label: '판당 데스', lower_better: true, by_role: {
      MIDDLE: { n: 98188, q: [1, 2, 3, 5, 8, 10, 11], spread: -0.2, tier_med: {} },
      TOP: { n: 98188, q: [1, 2, 3, 5, 7, 9, 10], spread: -0.2, tier_med: {} },
    } },
    kp: { label: '킬 관여', lower_better: false, by_role: {
      MIDDLE: { n: 98188, q: [0.182, 0.239, 0.333, 0.438, 0.538, 0.629, 0.681], spread: 0.195, tier_med: {} },
    } },
  },
};

describe('baselineGames · baseSampleText', () => {
  it('티어별 판수를 합쳐 payload 값으로 문구를 만든다 — 글에 박힌 상수가 없다', () => {
    expect(baselineGames(BASE)).toBe(49094);
    expect(baseSampleText(BASE)).toBe('49,094판, 패치 16.10 이후');
  });
  it('표본이 없으면 "솔랭 표본"', () => {
    expect(baselineGames(null)).toBe(0);
    expect(baseSampleText(null)).toBe('솔랭 표본');
    expect(baseSampleText({ games: {}, patch_min: '' })).toBe('솔랭 표본');
    expect(baseSampleText({ games: {}, patch_min: '16.10' })).toBe('솔랭 표본, 패치 16.10 이후');
  });
});

// 능력치 축 — parts 에 기준선이 있는 지표(dpm·kp·deaths_per_game)와 없는 지표(lane_cs_diff)를 섞는다
function axis(label: string, parts: { key: string; value: number }[], games = 12): ProfileAxis {
  return {
    key: label, label, desc: '', score: 3, pct: 50, rank: 3, n: 10, games,
    parts: parts.map((p) => ({ ...p, label: p.key, rank: 1, n: 10 })),
  };
}
const PROFILE_MID: ProfileAxis[] = [
  axis('공격', [{ key: 'dpm', value: 731 }, { key: 'kp', value: 0.6 }]),
  axis('생존', [{ key: 'deaths_per_game', value: 4 }]),
  axis('라인전', [{ key: 'lane_cs_diff', value: 5 }]),
];
const PROFILE_ALL: ProfileAxis[] = [axis('공격', [{ key: 'dpm', value: 900 }], 29)];

function data(over: Partial<Pick<GuildPayload, 'baseline' | 'ratings' | 'lower_better'>> = {}) {
  return {
    baseline: BASE,
    ratings: { p1: { main_lane: 'MIDDLE' } } as unknown as GuildPayload['ratings'],
    lower_better: ['deaths_per_game', 'time_dead'],
    ...over,
  };
}
const player: Pick<PlayerPub, 'profile' | 'profile_lane'> = {
  profile: PROFILE_ALL,
  profile_lane: { MIDDLE: PROFILE_MID },
};

describe('baselinePanel', () => {
  it('기준선이 없거나 비면 null', () => {
    expect(baselinePanel(data({ baseline: null }), player, 'p1')).toBeNull();
    expect(baselinePanel(data({ baseline: { ...BASE, metrics: {} } }), player, 'p1')).toBeNull();
  });
  it('라인을 정할 수 없으면 null — 주 라인이 없고 고른 라인도 없을 때', () => {
    expect(baselinePanel(data({ ratings: {} }), player, 'p1')).toBeNull();
    expect(baselinePanel(data({ ratings: {} }), player, 'p1', 'MIDDLE')).not.toBeNull();
  });
  it('프로필이 비면 null', () => {
    expect(baselinePanel(data(), { profile: [], profile_lane: {} }, 'p1')).toBeNull();
    expect(baselinePanel(data(), null, 'p1')).toBeNull();
  });
  it('주 라인의 라인별 프로필로 그린다 — 축을 만든 지표가 둘이면 셀도 둘, 내전 전용 지표는 빈 셀', () => {
    const panel = baselinePanel(data(), player, 'p1');
    expect(panel).not.toBeNull();
    expect(panel!.lane).toBe('MIDDLE');
    expect(panel!.games).toBe(49094);
    expect(panel!.patchMin).toBe('16.10');
    expect(panel!.sample).toBe('49,094판, 패치 16.10 이후');
    expect(panel!.rows.map((r) => r.label)).toEqual(['공격', '생존', '라인전']);
    const [atk, surv, lane] = panel!.rows;
    expect(atk!.cells.map((c) => c.key)).toEqual(['dpm', 'kp']);
    expect(atk!.cells[0]).toMatchObject({ value: 731, metricLabel: '분당 딜' });
    expect(atk!.cells[0]!.pos.pos).toBeCloseTo(41.46174863387978, 10);
    expect(atk!.cells[0]!.pos.label).toBe('솔랭 상위 59%');
    expect(atk!.cells[1]!.pos).toMatchObject({ top: 15, cls: 'good' });
    expect(atk!.games).toBe(12);
    // lower_better 는 payload 목록을 따른다(기준선 쪽 플래그가 아니라)
    expect(surv!.cells[0]).toMatchObject({ key: 'deaths_per_game', metricLabel: '판당 데스', pos: { pos: 62.5, top: 38 } });
    expect(lane!.cells).toEqual([]);
    expect(NO_BASELINE).toBe('솔랭 기준 없음 — 내전 전용 지표');
  });
  it('고른 라인이 주 라인보다 먼저 — 라인별 프로필이 없으면 통합 프로필로', () => {
    const panel = baselinePanel(data(), player, 'p1', 'TOP');
    expect(panel!.lane).toBe('TOP');
    expect(panel!.rows).toHaveLength(1);
    expect(panel!.rows[0]!.games).toBe(29);
    // 탑 칸이 없는 지표(dpm)는 빈 셀
    expect(panel!.rows[0]!.cells).toEqual([]);
  });
  it('분위수가 빈 칸은 기준 없음으로 비운다(NaN 배지를 내지 않는다)', () => {
    const b: Baseline = { ...BASE, metrics: { dpm: { label: '분당 딜', lower_better: false, by_role: { MIDDLE: { n: 0, q: [], spread: 0, tier_med: {} } } } } };
    const panel = baselinePanel(data({ baseline: b }), player, 'p1');
    expect(panel!.rows[0]!.cells).toEqual([]);
  });
});

describe('문구 규칙 — 티어 이름을 붙이지 않는다', () => {
  // 파이썬 검사(check_baseline_panel_on_site)가 옛 사이트에 걸던 규칙을 새 소스에도 건다
  it('소스에 티어 라벨·표본 상수가 없다', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/baseline.ts'), 'utf-8');
    for (const bad of ['수준', 'tier_ko', '솔랭 티어', '10만 판']) expect(src, bad).not.toContain(bad);
    for (const need of ['솔랭 기준 없음', '솔랭 상위 ', '100 - pct']) expect(src, need).toContain(need);
  });
});
