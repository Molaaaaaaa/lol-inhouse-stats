import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import FormulaBar from '../src/components/FormulaBar.svelte';
import { fx, setFx, clearFx } from '../src/lib/fx.svelte';

const HINT = '행을 선택하면 계산 근거가 여기에 보입니다.';
const LONG = '=티어(CP 1135) → 2티어 85점 · 탑 MMR 1185 · 탑 6판 (라인 배치 3/5) · 아주 긴 계산 근거가 두 줄을 넘는 경우';

/** jsdom 은 배치를 안 하므로 넘침을 흉내 낸다 — 글이 길면 접힌 두 줄(40px)보다 높다 */
function fakeLayout(over: (el: HTMLElement) => boolean) {
  const KEYS = ['clientHeight', 'scrollHeight'] as const;
  const saved = KEYS.map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)] as const);
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 40; } });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return over(this as HTMLElement) ? 60 : 40; } });
  return () => {
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(HTMLElement.prototype, k, d);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
    }
  };
}
const flush = async () => { await tick(); await Promise.resolve(); await tick(); };

describe('FormulaBar', () => {
  let restore: (() => void) | null = null;
  beforeEach(() => { cleanup(); clearFx(); });
  afterEach(() => { restore?.(); restore = null; });

  it('비어 있으면 안내문, role=status + aria-live', () => {
    render(FormulaBar);
    const bar = screen.getByRole('status', { name: '수식 줄' });
    expect(bar.getAttribute('aria-live')).toBe('polite');
    expect(bar.textContent).toContain(HINT);
    expect(bar.querySelector('.glyph')?.textContent).toBe('fx');
    expect(bar.querySelector('.glyph')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('setFx 가 바로 반영된다 · 글은 title 이 아니라 본문에, 두 줄 접힘(clamp) 으로 — 말줄임 없음', async () => {
    render(FormulaBar);
    setFx('=티어(CP 1135) → 2티어 85점 · MMR 1185 · 6판');
    await flush();
    const bar = screen.getByRole('status', { name: '수식 줄' });
    expect(bar.textContent).not.toContain(HINT);
    const body = bar.querySelector('.body')!;
    expect(body.textContent).toBe('=티어(CP 1135) → 2티어 85점 · MMR 1185 · 6판');
    expect(body.getAttribute('title')).toBeNull();
    expect(body.querySelector('.txt')?.classList.contains('clamp')).toBe(true);
    // 두 줄에 들어가면 버튼이 아니다(누를 것이 없다)
    expect(bar.querySelector('button')).toBeNull();
  });

  it('두 줄을 넘으면 줄이 버튼이 되어 탭하면 펼친다(aria-expanded) · 글이 바뀌면 다시 접힌다', async () => {
    restore = fakeLayout((el) => (el.textContent?.length ?? 0) > 60);
    render(FormulaBar);
    setFx(LONG);
    await flush();
    const bar = screen.getByRole('status', { name: '수식 줄' });
    const btn = bar.querySelector('button.body')!;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.querySelector('.txt')?.classList.contains('clamp')).toBe(true);
    await fireEvent.click(btn);
    await flush();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.querySelector('.txt')?.classList.contains('clamp')).toBe(false);
    expect(btn.textContent).toBe(LONG);
    // 다시 탭 → 접힘, 버튼은 그대로(넘침은 접힌 상태에서 잰다)
    await fireEvent.click(btn);
    await flush();
    expect(bar.querySelector('button.body')?.getAttribute('aria-expanded')).toBe('false');
    expect(bar.querySelector('.txt')?.classList.contains('clamp')).toBe(true);
    // 짧은 글로 바뀌면 버튼이 사라진다
    setFx('=SUM(d_mmr) 1000 + 185 = 1185');
    await flush();
    expect(bar.querySelector('button')).toBeNull();
    expect(bar.querySelector('.body')?.textContent).toBe('=SUM(d_mmr) 1000 + 185 = 1185');
  });

  it('clearFx 로 안내문으로 돌아온다 · fx.text 가 곧 상태다', async () => {
    render(FormulaBar);
    setFx('=SUM(d_mmr) 1000 + 185 = 1185');
    await tick();
    expect(fx.text).toBe('=SUM(d_mmr) 1000 + 185 = 1185');
    clearFx();
    await tick();
    expect(fx.text).toBe('');
    expect(screen.getByRole('status', { name: '수식 줄' }).textContent).toContain(HINT);
  });
});
