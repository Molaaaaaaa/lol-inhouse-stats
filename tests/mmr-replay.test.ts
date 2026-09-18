import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import MmrReplay from '../src/routes/member/MmrReplay.svelte';
import { CP_P1, PAYLOAD } from './fixtures/member-payload';
import { app } from '../src/lib/data/store.svelte';
import { fx } from '../src/lib/fx.svelte';
import type { GuildPayload } from '../src/lib/data/types';

const P1 = PAYLOAD.players.p1!;
const rowsOf = (table: HTMLElement) => [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
const cellsOf = (tr: HTMLTableRowElement) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());

describe('MmrReplay', () => {
  beforeEach(() => {
    cleanup();
    app.data = PAYLOAD;
    app.status = 'ready';
    fx.text = '';
  });

  it('경기 행 + 합계 행 — 합계는 base + Σ, 표시 값과 일치하면 경고 행 없음', () => {
    render(MmrReplay, { key: 'p1', p: P1, data: PAYLOAD });
    const table = screen.getByRole('table', { name: 'MMR 검산 · 앙앙맹 · 3판' });
    const rows = rowsOf(table);
    expect(rows).toHaveLength(4);
    // 첫 경기 행: 라인·결과·E·K·조정·ΔMMR·MMR·ΔCP·CP
    const c0 = cellsOf(rows[0]!);
    expect(c0[1]).toBe('미드');
    expect(c0[2]).toBe('패');
    expect(c0[5]).toBe('47%');
    expect(c0[6]).toBe('64');
    expect(c0[8]).toBe('+0.019');
    expect(c0[9]).toBe('-28.70');
    expect(c0[10]).toBe('971.3');
    expect(rows[0]!.querySelector('td.loss')).not.toBeNull();
    expect(rows[1]!.querySelector('td.win')).not.toBeNull();
    // 합계 행
    const tot = rows[3]!;
    expect(tot.classList.contains('total')).toBe(true);
    const ct = cellsOf(tot);
    expect(ct[0]).toBe('합계');
    expect(ct[9]).toBe('+32.10');
    expect(ct[10]).toBe('1032.1');
    expect(ct[11]).toBe('+20.11');
    expect(ct[12]).toBe('1020.1');
    expect(table.querySelector('tr.warn')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/합계가 표시 MMR 1032 · CP 1020 과 일치합니다/)).toBeTruthy();
  });

  it('열릴 때 수식 줄은 SUM 근거, 행을 선택하면 그 행의 근거와 경기 상세 링크', async () => {
    render(MmrReplay, { key: 'p1', p: P1, data: PAYLOAD });
    expect(fx.text).toBe('=SUM(ΔMMR) 1000 + 32.10 = 1032.10 → 1032');
    expect(screen.queryByRole('link', { name: '경기 상세' })).toBeNull();
    const rows = rowsOf(screen.getByRole('table'));
    await fireEvent.click(rows[0]!);
    expect(fx.text).toBe('=64 × ((0 − 0.467) + 0.019) = −28.70');
    expect(rows[0]!.getAttribute('aria-selected')).toBe('true');
    const link = screen.getByRole('link', { name: '경기 상세' });
    expect(link.getAttribute('href')).toBe('#/matches/m1');
    // 합계 행을 고르면 다시 SUM
    await fireEvent.keyDown(rows[3]!, { key: 'Enter' });
    expect(fx.text).toBe('=SUM(ΔMMR) 1000 + 32.10 = 1032.10 → 1032');
    expect(screen.queryByRole('link', { name: '경기 상세' })).toBeNull();
  });

  it('합계가 표시 MMR 과 어긋나면 "검산 불일치" 경고 행 + alert', () => {
    const bad = { ...PAYLOAD, cp: { ...PAYLOAD.cp, p1: { ...CP_P1, mmr: 1040 } } } as GuildPayload;
    render(MmrReplay, { key: 'p1', p: P1, data: bad });
    const table = screen.getByRole('table');
    const rows = rowsOf(table);
    expect(rows).toHaveLength(5);
    const warn = rows[4]!;
    expect(warn.classList.contains('warn')).toBe(true);
    expect(cellsOf(warn)[0]).toBe('검산 불일치 · 표시 MMR 1040 · CP 1020');
    expect(screen.getByRole('alert').textContent).toContain('검산 불일치');
    expect(fx.text).toBe('=SUM(ΔMMR) 1000 + 32.10 = 1032.10 → 1040');
  });

  it('경기 기록이 없으면 빈 상태 한 문장, 수식 줄은 건드리지 않는다', () => {
    fx.text = '이전 근거';
    render(MmrReplay, { key: 'p2', p: PAYLOAD.players.p2!, data: PAYLOAD });
    expect(screen.getByText('아직 경기 기록이 없습니다.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(fx.text).toBe('이전 근거');
  });

  it('소스에 옛 눈금·다른 모형 이름이 없다', () => {
    const { container } = render(MmrReplay, { key: 'p1', p: P1, data: PAYLOAD });
    expect(container.textContent).not.toMatch(/breakdown|1000\s*\+\s*250\s*\*|Bradley/);
  });
});
