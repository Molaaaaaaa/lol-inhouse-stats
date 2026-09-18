import { describe, expect, it } from 'vitest';
import { sanitize, safeId, safeChamp, cleanString } from '../src/lib/data/sanitize';

describe('sanitize', () => {
  it('마크업 글자를 제거하고 엔티티로 바꾸지 않는다 (Svelte 가 escape 하므로 이중 escape 금지)', () => {
    expect(cleanString('<img onerror=x>')).toBe('img onerror=x');
    expect(cleanString("a&b 'c' \"d\"")).toBe("a&b 'c' \"d\"");
    expect(cleanString('`x`')).toBe('x');
  });
  it('중첩 구조를 재귀로 소독하고 숫자·불리언·null 은 그대로', () => {
    const v = sanitize({ a: '<b>', n: 1, t: true, z: null, l: ['<i>', { k: '>' }] });
    expect(v).toEqual({ a: 'b', n: 1, t: true, z: null, l: ['i', { k: '' }] });
  });
  it('safeId / safeChamp', () => {
    expect(safeId('g02d21130')).toBe(true);
    expect(safeId('../x')).toBe(false);
    expect(safeId('')).toBe(false);
    expect(safeChamp('LeeSin')).toBe(true);
    expect(safeChamp('Lee Sin')).toBe(false);
    expect(safeChamp(3)).toBe(false);
  });
});
