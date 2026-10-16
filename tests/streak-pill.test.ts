import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import StreakPill from '../src/components/StreakPill.svelte';

afterEach(() => cleanup());

const pill = (c: HTMLElement) => c.querySelector('.sp') as HTMLElement | null;
const form = (dir: string, streak: number, f: string) => ({ dir, streak, form: f });

describe('StreakPill', () => {
  it('1~2연승: 승 틴트(win) · 글자 n연승 · 도형 없음', () => {
    const { container } = render(StreakPill, { form: form('W', 2, '3-2'), games: 40 });
    expect(pill(container)?.textContent).toBe('2연승');
    expect(pill(container)?.classList.contains('win')).toBe(true);
    expect(container.querySelector('svg')).toBeNull();
  });
  it('3연승 이상: hot(약한 글로우) + 겹친 갈매기 도형(장식)', () => {
    const { container } = render(StreakPill, { form: form('W', 3, '4-1'), games: 40 });
    expect(pill(container)?.classList.contains('hot')).toBe(true);
    expect(pill(container)?.textContent).toBe('3연승');
    expect(container.querySelector('svg.glyph')?.getAttribute('aria-hidden')).toBe('true');
  });
  it('연패: 패 틴트(loss) · 글자 n연패 — 3 이상이어도 빛나지 않는다', () => {
    const { container } = render(StreakPill, { form: form('L', 3, '1-4'), games: 40 });
    expect(pill(container)?.textContent).toBe('3연패');
    expect(pill(container)?.classList.contains('loss')).toBe(true);
    expect(container.querySelector('svg')).toBeNull();
  });
  it('연속이 최근 창(form 합 5판)을 다 채웠고 그보다 많이 뛰었으면 5연승+ (보조기술은 "이상")', () => {
    const { container } = render(StreakPill, { form: form('W', 5, '5-0'), games: 40 });
    expect(pill(container)?.textContent).toBe('5연승+ 이상');
    expect(pill(container)?.querySelector('[aria-hidden="true"]:not(svg)')?.textContent).toBe('+');
    expect(pill(container)?.querySelector('.sr-only')?.textContent).toBe(' 이상');
    const lose = render(StreakPill, { form: form('L', 5, '0-5'), games: 12 }).container;
    expect(pill(lose)?.textContent).toBe('5연패+ 이상');
  });
  it('전체 판수가 창과 같으면(5판 5연승) 실제 연속도 5 — + 없음 · 창보다 적게 뛰었어도 없음', () => {
    expect(pill(render(StreakPill, { form: form('W', 5, '5-0'), games: 5 }).container)?.textContent).toBe('5연승');
    expect(pill(render(StreakPill, { form: form('W', 3, '3-0'), games: 3 }).container)?.textContent).toBe('3연승');
  });
  it('0·form 없음·방향 모름이면 그리지 않는다', () => {
    expect(pill(render(StreakPill, { form: form('W', 0, ''), games: 0 }).container)).toBeNull();
    expect(pill(render(StreakPill, { form: null, games: 10 }).container)).toBeNull();
    expect(pill(render(StreakPill, { form: undefined, games: 10 }).container)).toBeNull();
    expect(pill(render(StreakPill, { form: form('', 2, '2-0'), games: 10 }).container)).toBeNull();
  });
});
