import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import FormulaBar from '../src/components/FormulaBar.svelte';
import { fx, setFx, clearFx } from '../src/lib/fx.svelte';

const HINT = '행을 선택하면 계산 근거가 여기에 보입니다.';

describe('FormulaBar', () => {
  beforeEach(() => { cleanup(); clearFx(); });

  it('비어 있으면 안내문, role=status + aria-live', () => {
    render(FormulaBar);
    const bar = screen.getByRole('status', { name: '수식 줄' });
    expect(bar.getAttribute('aria-live')).toBe('polite');
    expect(bar.textContent).toContain(HINT);
    expect(bar.querySelector('.glyph')?.textContent).toBe('fx');
    expect(bar.querySelector('.glyph')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('setFx 가 바로 반영되고 title 에도 같은 글이 있다(말줄임 대비)', async () => {
    render(FormulaBar);
    setFx('=티어(CP 1135) → 2티어 85점 · MMR 1185 · 6판');
    await tick();
    const bar = screen.getByRole('status', { name: '수식 줄' });
    expect(bar.textContent).not.toContain(HINT);
    const body = bar.querySelector('.body')!;
    expect(body.textContent).toBe('=티어(CP 1135) → 2티어 85점 · MMR 1185 · 6판');
    expect(body.getAttribute('title')).toBe('=티어(CP 1135) → 2티어 85점 · MMR 1185 · 6판');
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
