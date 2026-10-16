import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import WinGauge from '../src/components/WinGauge.svelte';
import WinRate from '../src/components/WinRate.svelte';

afterEach(() => cleanup());

const root = (c: HTMLElement) => c.querySelector('.wg') as HTMLElement;
const segs = (c: HTMLElement) =>
  [...c.querySelectorAll('.seg')].map((s) => [s.classList.contains('w') ? 'w' : 'l', (s as HTMLElement).style.flexGrow]);

describe('WinGauge', () => {
  it('row(기본): role=img 하나에 숫자를 다 담은 이름 · 승률 글자 + 두 조각 막대 + n승 n패', () => {
    const { container, getByRole } = render(WinGauge, { w: 46 / 86, n: 86, minGames: 5 });
    const g = getByRole('img');
    expect(g.getAttribute('aria-label')).toBe('승률 53%, 46승 40패, 86판');
    expect(root(container).classList.contains('v-row')).toBe(true);
    expect(container.querySelector('.pc')?.textContent).toBe('53%');
    expect(container.querySelector('.wl')?.textContent).toBe('46승 40패');
    expect(segs(container)).toEqual([['w', '46'], ['l', '40']]);
    expect(container.querySelector('.mid')).not.toBeNull();
  });
  it('구간 기준 단계 — 하한 60% 이상이면 st-up2 + ▲▲, 이름에 그 뜻(기호는 이름에 넣지 않는다)', () => {
    const { container, getByRole } = render(WinGauge, { w: 1, n: 7, minGames: 5 });
    expect(container.querySelector('.pc')?.classList.contains('st-up2')).toBe(true);
    expect(container.querySelector('.mk')?.textContent).toBe('▲▲');
    expect(getByRole('img').getAttribute('aria-label')).toBe('승률 100%, 60% 이상으로 높음, 7승 0패, 7판');
    expect(segs(container)).toEqual([['w', '7']]);   // 패 0 이면 패 조각이 없다
  });
  it('점추정이 높아도 구간이 50% 를 품으면 무채색(st-even)·기호 없음', () => {
    const { container } = render(WinGauge, { w: 0.8, n: 5, minGames: 5 });
    expect(container.querySelector('.pc')?.classList.contains('st-even')).toBe(true);
    expect(container.querySelector('.mk')?.textContent).toBe('');
    expect(root(container).classList.contains('few')).toBe(false);
  });
  it('문턱 미만: st-few · 기호 없음 · 표본 적음(row 는 그 말만, full 은 승패 뒤에) · 이름에도', () => {
    const { container, getByRole } = render(WinGauge, { w: 0, n: 2, minGames: 5 });
    expect(container.querySelector('.pc')?.classList.contains('st-few')).toBe(true);
    expect(container.querySelector('.mk')?.textContent).toBe('');
    expect(container.querySelector('.wl')?.textContent).toBe('표본 적음');   // row: 칸 폭을 같게 — 승패는 이름에
    // 쌓인 꼴(≤1100px)은 이 클래스로 막대 대신 '표본 적음'을 보인다 — 숨기면 옅은 색만 남는다
    expect(root(container).classList.contains('few')).toBe(true);
    expect(getByRole('img').getAttribute('aria-label')).toBe('승률 0%, 표본 적음, 0승 2패, 2판');
    expect(segs(container)).toEqual([['l', '2']]);
    const full = render(WinGauge, { w: 0, n: 2, minGames: 5, variant: 'full' }).container;
    expect(full.querySelector('.wl')?.textContent).toBe('0승 2패 · 2판 · 표본 적음');
  });
  it('full: 승패 뒤에 판수까지 · bar: 막대만(글자 없음)', () => {
    const full = render(WinGauge, { w: 0.5, n: 10, minGames: 5, variant: 'full' }).container;
    expect(root(full).classList.contains('v-full')).toBe(true);
    expect(full.querySelector('.wl')?.textContent).toBe('5승 5패 · 10판');
    const bar = render(WinGauge, { w: 0.5, n: 10, minGames: 5, variant: 'bar' }).container;
    expect(root(bar).classList.contains('v-bar')).toBe(true);
    expect(bar.querySelector('.pc')).toBeNull();
    expect(bar.querySelector('.wl')).toBeNull();
    expect(segs(bar)).toEqual([['w', '5'], ['l', '5']]);
  });
  it('0판: 조각 없음 · 승률 자리는 — · 이름은 기록 없음', () => {
    const { container, getByRole } = render(WinGauge, { w: 0, n: 0, minGames: 5 });
    expect(segs(container)).toEqual([]);
    expect(container.querySelector('.pc')?.textContent).toBe('—');
    expect(container.querySelector('.wl')).toBeNull();
    expect(getByRole('img').getAttribute('aria-label')).toBe('승률 기록 없음');
  });
  it('승수는 승률 × 판수 반올림(발행 승률이 소수 3자리여도 판수가 맞는다)', () => {
    const { container } = render(WinGauge, { w: 0.538, n: 13, minGames: 5 });
    expect(container.querySelector('.wl')?.textContent).toBe('7승 6패');
  });
});

describe('WinRate', () => {
  it('퍼센트 + 단계 색 클래스 + 기호(aria-hidden) + 보조기술 문구', () => {
    const { container } = render(WinRate, { w: 37 / 55, n: 55, minGames: 5 });
    const s = container.querySelector('.wr')!;
    expect(s.classList.contains('st-up')).toBe(true);
    expect(s.querySelector('.mk')?.textContent).toBe('▲');
    expect(s.querySelector('.mk')?.getAttribute('aria-hidden')).toBe('true');
    expect(s.querySelector('.sr-only')?.textContent).toBe(', 50%보다 높음');
    expect(s.textContent).toBe('67%▲, 50%보다 높음');
  });
  it('무채색은 기호·문구 없이 퍼센트만', () => {
    const { container } = render(WinRate, { w: 0.5, n: 20, minGames: 5 });
    expect(container.querySelector('.wr')?.textContent).toBe('50%');
    expect(container.querySelector('.wr')?.classList.contains('st-even')).toBe(true);
  });
  it('문턱 미만은 옅은 글자 + 보이는 표본 적음', () => {
    const { container } = render(WinRate, { w: 0, n: 1, minGames: 5 });
    const s = container.querySelector('.wr')!;
    expect(s.classList.contains('st-few')).toBe(true);
    expect(s.querySelector('.few')?.textContent).toBe('표본 적음');
    expect(s.querySelector('.mk')).toBeNull();
  });
});
