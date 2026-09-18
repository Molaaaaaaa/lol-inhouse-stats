import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import SynergyHeatmap from '../src/components/charts/SynergyHeatmap.svelte';
import { heatMatrix } from '../src/lib/synergy';
import type { SynergyRow } from '../src/lib/data/types';

const SYN: SynergyRow[] = [
  { na: '가람', nb: '나래', games: 14, winrate: 0.714, expected: 0.47, lift: 0.245, synergy: 0.07 },
  { na: '다솜', nb: '가람', games: 13, winrate: 0.308, expected: 0.5, lift: -0.192, synergy: -0.065 },
  { na: '나래', nb: '다솜', games: 6, winrate: 0.5, expected: 0.5, lift: 0, synergy: 0.035 },
  { na: '라온', nb: '가람', games: 2, winrate: 0, expected: 0.48, lift: -0.48, synergy: -0.03 },   // 문턱 미만
  { na: '다솜', nb: '라온', games: 7, winrate: 0.5, expected: 0.503, lift: -0.003, synergy: -0.001 },   // 두 자리에서 0
];
// 이름 사전순: 가람(0) 나래(1) 다솜(2) 라온(3)
const NAMES = ['가람', '나래', '다솜', '라온'];

const described = (el: Element): string =>
  document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? '';
const grid = (c: HTMLElement) => c.querySelector('table')!;
const td = (c: HTMLElement, i: number, j: number) => grid(c).querySelector<HTMLElement>(`tbody tr:nth-child(${i + 1}) td:nth-child(${j + 2})`)!;

afterEach(cleanup);

describe('SynergyHeatmap', () => {
  it('멤버 × 멤버 격자: 머리·첫 열 이름(사전순) · 대각선은 self · 값 칸은 부호·세기·글자', () => {
    const { container } = render(SynergyHeatmap, { synergy: SYN, minGames: 0 });
    const t = grid(container);
    expect(t.getAttribute('role')).toBe('grid');
    expect(t.getAttribute('aria-label')).toBe('시너지 히트맵');
    expect([...t.querySelectorAll('thead th.col .nm')].map((e) => e.textContent)).toEqual(NAMES);
    expect([...t.querySelectorAll('tbody th.row .nm')].map((e) => e.textContent)).toEqual(NAMES);
    // 가람×나래 +0.07 (peak) → 세기 1, 초록. 나래×가람도 같은 값(대칭)
    const c01 = td(container, 0, 1);
    expect(c01.textContent).toBe('+0.07');
    expect(c01.classList.contains('pos')).toBe(true);
    expect(c01.style.getPropertyValue('--t')).toBe('1');
    expect(td(container, 1, 0).textContent).toBe('+0.07');
    // 가람×다솜 −0.065 → 주황, 세기 0.93
    const c02 = td(container, 0, 2);
    expect(c02.textContent).toBe('-0.07');
    expect(c02.classList.contains('neg')).toBe(true);
    expect(Number(c02.style.getPropertyValue('--t'))).toBeCloseTo(0.929, 2);
    // 나래×다솜 +0.035 → 세기 0.5
    expect(Number(td(container, 1, 2).style.getPropertyValue('--t'))).toBeCloseTo(0.5);
    // 대각선
    expect(td(container, 0, 0).classList.contains('self')).toBe(true);
    expect(td(container, 0, 0).textContent).toBe('');
    // 기록 없는 조합(나래×라온)은 빈 칸, tabindex 없음
    const c13 = td(container, 1, 3);
    expect(c13.textContent).toBe('');
    expect(c13.hasAttribute('tabindex')).toBe(false);
    // 두 자리에서 0 인 값(다솜×라온 −0.001)은 '0.00' · 채움 없음(zero) · 값 칸이라 선택은 된다
    const c23 = td(container, 2, 3);
    expect(c23.textContent).toBe('0.00');
    expect(c23.classList.contains('zero')).toBe(true);
    expect(c23.classList.contains('neg')).toBe(false);
    expect(c23.hasAttribute('tabindex')).toBe(true);
  });

  it('칸 설명(툴팁·aria-describedby): 이름 ＋ 시너지 · 함께 n판 · 승률', () => {
    const { container } = render(SynergyHeatmap, { synergy: SYN, minGames: 0 });
    expect(described(td(container, 0, 1))).toBe('가람 ＋ 나래\n시너지 +0.070 · 함께 14판 · 승률 71%');
    expect(described(td(container, 2, 0))).toBe('다솜 ＋ 가람\n시너지 -0.065 · 함께 13판 · 승률 31%');
  });

  it('문턱 미만은 빈 칸(값·채움 없음)이되 설명은 왜 비었는지 말한다 · peak 는 보이는 칸 기준', () => {
    const { container } = render(SynergyHeatmap, { synergy: SYN, minGames: 5 });
    // 문턱 이상 조합이 하나도 없는 사람은 격자에서 빠진다
    const { container: c0 } = render(SynergyHeatmap, { synergy: SYN.filter((r) => r.na !== '다솜' || r.nb !== '라온'), minGames: 5 });
    expect([...grid(c0).querySelectorAll('thead th.col .nm')].map((e) => e.textContent)).toEqual(['가람', '나래', '다솜']);
    const c2 = container;
    const blank = td(c2, 0, 3);   // 가람×라온 2판
    expect(blank.textContent).toBe('');
    expect(blank.classList.contains('blank')).toBe(true);
    expect(blank.classList.contains('pos') || blank.classList.contains('neg')).toBe(false);
    expect(blank.hasAttribute('tabindex')).toBe(false);
    expect(described(blank)).toBe('가람 ＋ 라온\n함께 2판 · 5판 미만이라 표시하지 않습니다');
  });

  it('범례에 양 끝값(±peak 실값)·빈 칸 기준·인원과 조합 수', () => {
    const { container } = render(SynergyHeatmap, { synergy: SYN, minGames: 5 });
    const legend = container.querySelector('.legend')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(legend).toContain('−0.07 기대보다 덜 맞음');
    expect(legend).toContain('+0.07 기대보다 잘 맞음');
    expect(legend).toContain('실값 최대(±0.07)');
    expect(legend).toContain('빈 칸 = 함께 5판 미만');
    expect(legend).toContain('4명 · 4조합');
    expect(heatMatrix(SYN, null, 5).peak).toBe(0.07);
    // 눈금은 자료를 따른다 — 작은 값만 있으면 그 최대가 가장 진한 색
    const { container: c2 } = render(SynergyHeatmap, { synergy: [SYN[2]!], minGames: 0 });
    expect(c2.querySelector('.legend')!.textContent).toContain('±0.04');   // 0.035 → 두 자리
    expect(td(c2, 0, 1).style.getPropertyValue('--t')).toBe('1');
  });

  it('선택: 클릭·Enter → onselect(칸), 선택 칸은 aria-selected + sel, 그 행·열 머리가 밝아진다', async () => {
    const onselect = vi.fn();
    const { container, rerender } = render(SynergyHeatmap, { synergy: SYN, minGames: 0, onselect });
    const c = td(container, 0, 1);
    await fireEvent.click(c);
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(onselect.mock.calls[0]![0]).toMatchObject({ a: '가람', b: '나래', key: '가람|나래', games: 14, synergy: 0.07 });
    await fireEvent.keyDown(c, { key: 'Enter' });
    expect(onselect).toHaveBeenCalledTimes(2);
    await rerender({ synergy: SYN, minGames: 0, onselect, selectedKey: '가람|나래' });
    expect(td(container, 0, 1).getAttribute('aria-selected')).toBe('true');
    expect(td(container, 0, 1).classList.contains('sel')).toBe(true);
    expect(td(container, 1, 0).getAttribute('aria-selected')).toBe('true');   // 대칭 칸도 같은 키
    expect(td(container, 0, 2).getAttribute('aria-selected')).toBe('false');
    const cols = [...grid(container).querySelectorAll('thead th.col')];
    const rows = [...grid(container).querySelectorAll('tbody th.row')];
    expect(cols.map((h) => h.classList.contains('on'))).toEqual([true, true, false, false]);
    expect(rows.map((h) => h.classList.contains('on'))).toEqual([true, true, false, false]);
    // 빈 칸·대각선은 선택되지 않는다
    await fireEvent.click(td(container, 0, 0));
    await fireEvent.click(td(container, 1, 3));
    expect(onselect).toHaveBeenCalledTimes(2);
  });

  it('키보드: 값 칸 하나만 tabindex 0, 화살표는 같은 행·열의 다음 값 칸으로, Home/End 는 행의 양 끝', async () => {
    const { container } = render(SynergyHeatmap, { synergy: SYN, minGames: 0 });
    const t = grid(container);
    const stops = () => [...t.querySelectorAll('td[tabindex="0"]')];
    expect(stops()).toHaveLength(1);
    expect(stops()[0]).toBe(td(container, 0, 1));   // 첫 값 칸: 가람×나래
    await fireEvent.keyDown(td(container, 0, 1), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(td(container, 0, 2));
    expect(stops()[0]).toBe(td(container, 0, 2));
    // 오른쪽에 라온(2판, minGames 0 이라 값 칸) → 한 칸 더, 그 다음은 끝이라 그대로
    await fireEvent.keyDown(td(container, 0, 2), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(td(container, 0, 3));
    await fireEvent.keyDown(td(container, 0, 3), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(td(container, 0, 3));
    // 아래: 라온 열에서 나래(빈 칸)를 건너뛰어 다솜(2,3). 다시 아래는 끝(라온 self)이라 그대로. Home → 행의 첫 값 칸
    await fireEvent.keyDown(td(container, 0, 3), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(td(container, 2, 3));
    await fireEvent.keyDown(td(container, 2, 3), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(td(container, 2, 3));
    await fireEvent.keyDown(td(container, 2, 3), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(td(container, 0, 3));
    await fireEvent.keyDown(td(container, 0, 3), { key: 'Home' });
    expect(document.activeElement).toBe(td(container, 0, 1));
    await fireEvent.keyDown(td(container, 0, 1), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(td(container, 2, 1));   // 나래 열: 가람 → (나래 self 건너뜀) → 다솜
    await fireEvent.keyDown(td(container, 2, 1), { key: 'End' });
    expect(document.activeElement).toBe(td(container, 2, 3));   // 다솜 행의 마지막 값 칸은 라온(3)
    await fireEvent.keyDown(td(container, 2, 3), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(td(container, 2, 1));   // 다솜 self(2) 를 건너뛴다
    await fireEvent.keyDown(td(container, 2, 1), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(td(container, 2, 0));
  });

  it('둘 미만이면 빈 상태 문장', () => {
    const { container } = render(SynergyHeatmap, { synergy: [], minGames: 5 });
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).toContain('아직 함께 5판 이상 출전한 조합이 없습니다.');
  });
});
