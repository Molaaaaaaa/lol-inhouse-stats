import { describe, expect, it } from 'vitest';
import { MEDAL, cpTiers, medalAt, minGamesNote, tierBadge, tierCls, wrClass } from '../src/lib/tier';
import type { TierCut } from '../src/lib/data/types';

const TIERS: TierCut[] = [
  { name: '1티어', cp: 1400, open_top: true },
  { name: '2티어', cp: 1300, open_top: false },
  { name: '3티어', cp: 1200, open_top: false },
  { name: '4티어', cp: 1100, open_top: false },
  { name: '5티어', cp: null, open_top: false },
];
const DATA = { cp_constants: { tiers: TIERS } };

describe('wrClass', () => {
  it('문턱 0.55 / 0.45 — 경계값은 중립', () => {
    expect(wrClass(0.56)).toBe('wr-h');
    expect(wrClass(0.55)).toBe('wr-m');
    expect(wrClass(0.5)).toBe('wr-m');
    expect(wrClass(0.45)).toBe('wr-m');
    expect(wrClass(0.44)).toBe('wr-l');
    expect(wrClass(0)).toBe('wr-l');
    expect(wrClass(1)).toBe('wr-h');
  });
  it('판수가 문턱 미만이면 색으로 단정하지 않는다 — 1판 0% 는 빨강이 아니다', () => {
    expect(wrClass(0, 1, 5)).toBe('wr-dim');
    expect(wrClass(1, 4, 5)).toBe('wr-dim');
    expect(wrClass(1, 5, 5)).toBe('wr-h');
    expect(wrClass(0, 5, 5)).toBe('wr-l');
  });
  it('판수를 모르는 호출부(n 없음·null)는 예전 동작 그대로', () => {
    expect(wrClass(0, null, 5)).toBe('wr-l');
    expect(wrClass(0, undefined, 5)).toBe('wr-l');
  });
});

describe('cpTiers · tierCls · tierBadge', () => {
  it('컷은 payload 에서만 — 없으면 빈 목록', () => {
    expect(cpTiers(DATA)).toBe(TIERS);
    expect(cpTiers(null)).toEqual([]);
    expect(cpTiers(undefined)).toEqual([]);
    expect(cpTiers({ cp_constants: null })).toEqual([]);
    expect(cpTiers({ cp_constants: {} })).toEqual([]);
  });
  it('클래스는 컷 목록에 있는 이름만 — 이름을 클래스로 그대로 넣지 않는다', () => {
    expect(tierCls('1티어', DATA)).toBe('t-1티어');
    expect(tierCls('5티어', DATA)).toBe('t-5티어');
    expect(tierCls('6티어', DATA)).toBe('');
    expect(tierCls('x y', DATA)).toBe('');
    expect(tierCls('1티어', null)).toBe('');
  });
  it('배지 데이터 — 글자와 클래스만, HTML 은 만들지 않는다', () => {
    expect(tierBadge('2티어', DATA)).toEqual({ label: '2티어', cls: 'tierbadge t-2티어' });
    expect(tierBadge('없음', DATA)).toEqual({ label: '없음', cls: 'tierbadge' });
  });
});

describe('MEDAL', () => {
  it('1·2·3위 — 보조기술에는 n위 로 읽힌다', () => {
    expect(MEDAL).toHaveLength(3);
    expect(MEDAL.map((m) => m.label)).toEqual(['1위', '2위', '3위']);
    expect(MEDAL.map((m) => m.cls)).toEqual(['medal m1', 'medal m2', 'medal m3']);
    expect(MEDAL.map((m) => m.rank)).toEqual([1, 2, 3]);
  });
  it('medalAt — 0·1·2 행만, 그 뒤와 음수는 없다', () => {
    expect(medalAt(0)).toBe(MEDAL[0]);
    expect(medalAt(2)).toBe(MEDAL[2]);
    expect(medalAt(3)).toBeNull();
    expect(medalAt(-1)).toBeNull();
  });
});

describe('minGamesNote', () => {
  it('문턱 1 이하·일수 제외 없음 → 안내 없음', () => {
    expect(minGamesNote({ min_games: 1 })).toBeNull();
    expect(minGamesNote({ min_games: 0 })).toBeNull();
    expect(minGamesNote(null)).toBeNull();
  });
  it('기본 문장 — 숫자는 payload 에서', () => {
    const n = minGamesNote({ min_games: 5 });
    expect(n).not.toBeNull();
    expect(n?.text).toBe('5판 이상 참여한 멤버만 집계합니다.');
    expect(n?.tip).toContain('5판 이상부터');
    expect(n?.tip).toContain('\n');
    expect(n?.tipLabel).toBe('최소 판수 설명');
  });
  it('라인별 화면에서만, 라인 문턱이 다를 때만 괄호를 덧붙인다', () => {
    const p = { min_games: 5, min_games_lane: 3 };
    expect(minGamesNote(p, true)?.text).toBe('5판 이상 참여한 멤버만 집계합니다 (라인별 지표는 3판).');
    expect(minGamesNote(p, false)?.text).toBe('5판 이상 참여한 멤버만 집계합니다.');
    expect(minGamesNote({ min_games: 5, min_games_lane: 5 }, true)?.text).toBe('5판 이상 참여한 멤버만 집계합니다.');
  });
  it('판수 미달과 참여 일수 미달은 따로 센다', () => {
    const n = minGamesNote({ min_games: 5, min_games_excluded: 2, min_days: 3, min_days_excluded: 1 });
    expect(n?.text).toBe('5판 이상 참여한 멤버만 집계합니다 · 2명은 판수 미달로 제외 · 1명은 참여 일수 미달(3일)로 제외.');
  });
  it('일수 제외만 있어도 안내는 나온다(문턱 1 이라도)', () => {
    const n = minGamesNote({ min_games: 1, min_days: 2, min_days_excluded: 3 });
    expect(n?.text).toBe('1판 이상 참여한 멤버만 집계합니다 · 3명은 참여 일수 미달(2일)로 제외.');
  });
});
