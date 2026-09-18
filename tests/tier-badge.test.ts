import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import TierBadge, { tierNameOf } from '../src/components/TierBadge.svelte';
import type { TierCut } from '../src/lib/data/types';

// 실데이터 컷과 같은 모양 — 위에서 아래로, 마지막은 바닥 없음
const TIERS: TierCut[] = [
  { name: '1티어', cp: 1400, open_top: true },
  { name: '2티어', cp: 1300, open_top: false },
  { name: '3티어', cp: 1200, open_top: false },
  { name: '4티어', cp: 1100, open_top: false },
  { name: '5티어', cp: null, open_top: false },
];
const DATA = { cp_constants: { tiers: TIERS, placement_games: 5 } };
const TIER_WORD = /[1-5]티어/;

describe('tierNameOf — cp 를 컷으로 자른다(cp.py:tier_index 와 같은 규칙)', () => {
  it('경계는 그 티어의 바닥이다', () => {
    expect(tierNameOf(DATA, 1400)).toBe('1티어');
    expect(tierNameOf(DATA, 1399.9)).toBe('2티어');
    expect(tierNameOf(DATA, 1300)).toBe('2티어');
    expect(tierNameOf(DATA, 1100)).toBe('4티어');
    expect(tierNameOf(DATA, 1099)).toBe('5티어');
    expect(tierNameOf(DATA, -500)).toBe('5티어');
    expect(tierNameOf(DATA, 9999)).toBe('1티어');
  });
  it('컷이 없으면 티어도 없다', () => {
    expect(tierNameOf(null, 1300)).toBe('');
    expect(tierNameOf({ cp_constants: { tiers: [] } }, 1300)).toBe('');
  });
});

describe('TierBadge', () => {
  it('배치 전에는 티어 이름도 --t 클래스도 없다 — 배치 n/5 글자만', () => {
    const { container } = render(TierBadge, { cp: 1450, placed: false, games: 3, placementGames: 5, data: DATA });
    const el = container.querySelector('span');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('배치 3/5');
    expect(container.textContent).not.toMatch(TIER_WORD);
    expect([...el!.classList].some((c) => /^t[1-5]$/.test(c) || c.startsWith('t-'))).toBe(false);
    expect(el!.classList.contains('placing')).toBe(true);
  });
  it('배치 판수는 호출부가 안 주면 payload 의 placement_games 를 본다', () => {
    const { container } = render(TierBadge, { cp: 1000, placed: false, games: 1, data: DATA });
    expect(container.textContent).toBe('배치 1/5');
  });
  it('배치 판수를 아무도 모르면 분모 없이 판수만', () => {
    const { container } = render(TierBadge, { cp: 1000, placed: false, games: 2, data: { cp_constants: { tiers: TIERS } } });
    expect(container.textContent).toBe('배치 중 2판');
    expect(container.textContent).not.toMatch(TIER_WORD);
  });
  it('배치 후에는 tierBadge 의 label 과 cls — 이름 글자가 항상 있다', () => {
    const { container } = render(TierBadge, { cp: 1335, placed: true, games: 12, data: DATA });
    const el = container.querySelector('span')!;
    expect(el.textContent).toBe('2티어');
    expect(el.classList.contains('tierbadge')).toBe(true);
    expect(el.classList.contains('t-2티어')).toBe(true);
    expect(el.classList.contains('t2')).toBe(true);
    expect(el.classList.contains('placing')).toBe(false);
  });
  it('payload 가 준 tier 이름을 주면 cp 로 다시 계산하지 않는다', () => {
    const { container } = render(TierBadge, { cp: 1000, placed: true, tier: '1티어', data: DATA });
    expect(container.querySelector('span')!.textContent).toBe('1티어');
    expect(container.querySelector('span')!.classList.contains('t1')).toBe(true);
  });
  it('컷이 없는 payload 에서는 배치 후에도 아무것도 그리지 않는다', () => {
    const { container } = render(TierBadge, { cp: 1300, placed: true, data: null });
    expect(container.querySelector('span')).toBeNull();
    expect(container.textContent).toBe('');
  });
});
