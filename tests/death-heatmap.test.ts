import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import DeathHeatmap from '../src/components/charts/DeathHeatmap.svelte';
import * as a11y from '../src/lib/a11y';
import type { DeathsFile } from '../src/lib/data/types';

// tests/setup.ts 의 IO 목 — 인스턴스를 붙잡아 trigger() 로 "보인다" 신호를 낸다
type IOMock = IntersectionObserver & { trigger: (es: Partial<IntersectionObserverEntry>[]) => void };
let ios: IOMock[] = [];
const RealIO = globalThis.IntersectionObserver;

const FILE: DeathsFile = {
  games: 42, total: 2765, capped: true,
  points: [
    { x: 7435, y: 7435, m: 3, lane: 'JUNGLE' }, { x: 1000, y: 1000, m: 20, lane: 'TOP' },
    { x: 13000, y: 13000, m: 9, lane: 'TOP' }, { x: 5000, y: 9000, m: 12, lane: 'UTILITY' },
  ],
};

/** 호출을 세고 신호를 붙잡는 로더. 처음 `fails` 번은 던진다 */
function loader(fails = 0, file: DeathsFile = FILE) {
  const calls: AbortSignal[] = [];
  const load = vi.fn(async (signal: AbortSignal) => {
    calls.push(signal);
    if (calls.length <= fails) throw new Error('HTTP 500');
    return file;
  });
  return { load, calls };
}
const flush = async () => { await tick(); await new Promise((r) => setTimeout(r, 0)); await tick(); };

let spoken: string[] = [];

beforeEach(() => {
  cleanup();
  ios = [];
  spoken = [];
  vi.spyOn(a11y, 'announce').mockImplementation((msg: string) => { spoken.push(msg); });
  // setup.ts 의 목(writable)을 감싸 인스턴스를 모은다
  globalThis.IntersectionObserver = class extends (RealIO as unknown as new (cb: IntersectionObserverCallback, o?: IntersectionObserverInit) => IOMock) {
    constructor(cb: IntersectionObserverCallback, o?: IntersectionObserverInit) { super(cb, o); ios.push(this); }
  } as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  vi.restoreAllMocks();
  globalThis.IntersectionObserver = RealIO;
});

describe('DeathHeatmap — 볼 때 받는다', () => {
  it('신호 전에는 받지 않는다(스켈레톤) · 눈에 들어오면(IO) 받아서 점·캡션·라인 버튼을 그린다', async () => {
    const { load } = loader();
    const { container } = render(DeathHeatmap, { load, entered: false });
    expect(load).not.toHaveBeenCalled();
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(ios).toHaveLength(1);
    ios[0]!.trigger([{ isIntersecting: true }]);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    const svg = container.querySelector('svg.map')!;
    expect(svg.querySelectorAll('circle.dot')).toHaveLength(4);
    expect(svg.getAttribute('aria-label')).toContain('최근 42경기 · 데스 4건 · 표본 상한(전체 2,765건 중)');
    // 가운데 점은 (130, 130), 왼쪽 아래 점은 y 가 뒤집혀 아래쪽
    const dots = [...svg.querySelectorAll('circle.dot')].map((c) => [c.getAttribute('cx'), c.getAttribute('cy')]);
    expect(dots[0]).toEqual(['130', '130']);
    expect(Number(dots[1]![1])).toBeGreaterThan(200);
    // SVG 속성에 색이 없다 — 클래스만
    expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(svg.outerHTML).not.toMatch(/fill="|stroke="/);
    expect(container.querySelector('.note')?.textContent).toContain('최근 42경기 · 데스 4건');
    expect(spoken).toEqual(['데스 4건 표시']);
    // 라인 버튼 줄 — 전체 + 다섯 라인, 숫자는 그 라인 데스 수
    const btns = screen.getAllByRole('button', { pressed: false }).concat(screen.getAllByRole('button', { pressed: true }));
    expect(btns.map((b) => b.textContent?.replace(/\s+/g, ' ').trim()).sort()).toEqual(
      ['미드 0', '서폿 1', '원딜 0', '전체 4', '정글 1', '탑 2'].sort());
  });

  it('하위 화면 진입(entered) 신호만으로도 받는다 · 두 신호가 다 와도 한 번만 받는다', async () => {
    const { load } = loader();
    const { container } = render(DeathHeatmap, { load, entered: true });
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    ios[0]?.trigger([{ isIntersecting: true }]);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('circle.dot')).toHaveLength(4);
  });

  it('라인 버튼: aria-pressed 하나 · 그 라인 점만 · 캡션에 라인 건수', async () => {
    const { load } = loader();
    const { container } = render(DeathHeatmap, { load, entered: true });
    await flush();
    await fireEvent.click(screen.getByRole('button', { name: /^탑/ }));
    expect(container.querySelectorAll('circle.dot')).toHaveLength(2);
    expect(screen.getAllByRole('button', { pressed: true }).map((b) => b.textContent?.trim())).toEqual(['탑 2']);
    expect(container.querySelector('.note')?.textContent).toContain('탑 2건');
    await fireEvent.click(screen.getByRole('button', { name: /^전체/ }));
    expect(container.querySelectorAll('circle.dot')).toHaveLength(4);
  });

  it('언마운트하면 받던 것을 끊는다(abort) · 끊긴 결과는 알리지 않는다', async () => {
    let resolve!: (f: DeathsFile) => void;
    const calls: AbortSignal[] = [];
    const load = vi.fn((signal: AbortSignal) => { calls.push(signal); return new Promise<DeathsFile>((r) => { resolve = r; }); });
    const { unmount } = render(DeathHeatmap, { load, entered: true });
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.aborted).toBe(false);
    unmount();
    expect(calls[0]!.aborted).toBe(true);
    resolve(FILE);
    await flush();
    expect(spoken).toEqual([]);
  });

  it('실패 → 문제와 "다시 시도" 단추 + 알림, 다시 시도 → 다시 받고 성공 알림(알림 2회)', async () => {
    const { load } = loader(1);
    const { container } = render(DeathHeatmap, { load, entered: true });
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.problem')?.textContent).toContain('데스 좌표를 받지 못했습니다.');
    expect(container.querySelector('svg')).toBeNull();
    const retry = screen.getByRole('button', { name: '다시 시도' });
    await fireEvent.click(retry);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(container.querySelector('svg.map')).toBeTruthy();
    expect(container.querySelector('.problem')).toBeNull();
    expect(spoken).toEqual(['데스 좌표를 받지 못했습니다. 다시 시도 단추를 눌러 주세요.', '데스 4건 표시']);
  });

  it('점이 없으면 빈 상태 문장, 라인 버튼 없음', async () => {
    const { load } = loader(0, { games: 0, total: 0, capped: false, points: [] });
    const { container } = render(DeathHeatmap, { load, entered: true });
    await flush();
    expect(container.querySelector('.empty')?.textContent).toBe('아직 데스 기록이 없습니다.');
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('group', { name: '라인 선택' })).toBeNull();
  });
});
