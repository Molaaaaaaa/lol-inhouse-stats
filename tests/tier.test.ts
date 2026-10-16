import { describe, expect, it } from 'vitest';
import { MEDAL, WR_MARK, WR_WORD, medalAt, minGamesNote, wilson, wrStep, wrText } from '../src/lib/tier';
import { wilsonLower } from '../src/lib/rank';

describe('wilson', () => {
  it('하한은 발행 쪽 _wilson_lower(= rank.ts wilsonLower, 소수 3자리)와 같은 식', () => {
    for (const [w, n] of [[6, 6], [14, 20], [6, 12], [3, 5], [37, 55], [1, 8]] as const) {
      const [lo] = wilson(w / n, n);
      expect(Math.round(lo * 1000) / 1000).toBe(wilsonLower(w, n));
    }
  });
  it('상한은 패 쪽 하한의 거울(1 − 하한(패율)) · 하한 ≤ 승률 ≤ 상한', () => {
    const [lo, hi] = wilson(0.3, 20);
    expect(hi).toBeCloseTo(1 - wilson(0.7, 20)[0], 12);
    expect(lo).toBeLessThan(0.3);
    expect(hi).toBeGreaterThan(0.3);
  });
  it('0판은 [0, 1] — 아무것도 모른다', () => {
    expect(wilson(0, 0)).toEqual([0, 1]);
    expect(wilson(0.5, NaN)).toEqual([0, 1]);
  });
});

describe('wrStep — 구간 기준 승률 단계', () => {
  it('실데이터 네 사람(구간이 50% 를 벗어난 경우)이 색을 받는다', () => {
    expect(wrStep(1, 6, 5)).toBe('up2');          // 하한 .61
    expect(wrStep(1, 7, 5)).toBe('up2');          // 하한 .646
    expect(wrStep(37 / 55, 55, 5)).toBe('up');    // 하한 .541
    expect(wrStep(1 / 8, 8, 5)).toBe('down');     // 상한 .471
  });
  it('점추정이 높아도 구간이 50% 를 품으면 무채색 — 5판 80%, 20판 60%', () => {
    expect(wrStep(0.8, 5, 5)).toBe('even');
    expect(wrStep(0.6, 20, 5)).toBe('even');
    expect(wrStep(0.5, 100, 5)).toBe('even');
  });
  it('두 단 기호는 하한 60% 이상·상한 40% 이하만', () => {
    expect(wrStep(0.75, 100, 5)).toBe('up2');     // 하한 .657
    expect(wrStep(0.62, 100, 5)).toBe('up');      // 하한 .522
    expect(wrStep(0.25, 100, 5)).toBe('down2');   // 상한 .343
    expect(wrStep(0.4, 100, 5)).toBe('down');     // 상한 .497
  });
  it('판수가 문턱 미만이면 표본 적음(색·기호 없음) — 1판 0% 는 빨강이 아니다 · 0판도', () => {
    expect(wrStep(0, 1, 5)).toBe('few');
    expect(wrStep(1, 4, 5)).toBe('few');
    expect(wrStep(0, 0, 0)).toBe('few');
    expect(WR_MARK.few).toBe('');
    expect(WR_WORD.few).toBe('표본 적음');
  });
  it('기호·문구 표 — 무채색은 기호도 문구도 없다', () => {
    expect([WR_MARK.up2, WR_MARK.up, WR_MARK.even, WR_MARK.down, WR_MARK.down2]).toEqual(['▲▲', '▲', '', '▼', '▼▼']);
    expect(WR_WORD.even).toBe('');
    expect(WR_WORD.up).toContain('높음');
    expect(WR_WORD.down).toContain('낮음');
  });
});

describe('wrText — 승률 칸의 글(셀 스니펫 열의 fmt)', () => {
  it('퍼센트 + 구간 단계 문구 · 구간이 50% 를 품으면 퍼센트만 · 문턱 미만은 표본 적음 · 값 없음은 빈 문자열', () => {
    expect(wrText(17 / 20, 20, 5)).toBe('85%, 60% 이상으로 높음');
    expect(wrText(1, 7, 5)).toBe('100%, 60% 이상으로 높음');
    expect(wrText(0.9, 10, 5)).toBe('90%, 50%보다 높음');
    expect(wrText(0.5, 12, 5)).toBe('50%');
    expect(wrText(5 / 6, 6, 5)).toBe('83%');            // 점추정은 높아도 구간이 50% 를 걸친다
    expect(wrText(0.8, 5, 5)).toBe('80%');              // 5판 80% 도 무채색(하한 38%)
    expect(wrText(0.316, 19, 5)).toBe('32%');           // 구간 15~54%
    expect(wrText(2 / 12, 12, 5)).toBe('17%, 50%보다 낮음');
    expect(wrText(0, 13, 5)).toBe('0%, 40% 이하로 낮음');
    expect(wrText(1, 2, 5)).toBe('100%, 표본 적음');
    expect(wrText(null, 3, 5)).toBe('');
    expect(wrText(0.5, null, 5)).toBe('50%, 표본 적음');   // 판수를 모르면 단정하지 않는다
  });
});

describe('MEDAL', () => {
  it('1·2·3위만 — 숫자 칩의 순위', () => {
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
