import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Synergy from '../src/routes/Synergy.svelte';
import { app } from '../src/lib/data/store.svelte';
import { router } from '../src/lib/router.svelte';
import { clearFx, fx } from '../src/lib/fx.svelte';
import {
  duoRows, fxDuo, fxTrio, heatMatrix, heatNames, heatSign, heatT, heatText, heatTip, synCls, trioRows,
} from '../src/lib/synergy';
import type { GuildPayload, SynergyRow, TrioRow } from '../src/lib/data/types';

// 실데이터(2026-09-18) 모양 그대로 — 시너지 = 리프트 × n/(n+κ) 라 lift 와 synergy 가 다르다
const SYN: SynergyRow[] = [
  { na: '도야짬뽕누룽지탕', nb: '우체국집배원', games: 14, winrate: 0.714, expected: 0.47, lift: 0.245, synergy: 0.07 },
  { na: 'Lotze', nb: '용기사', games: 10, winrate: 0.8, expected: 0.519, lift: 0.281, synergy: 0.063 },
  { na: '말듣쓰', nb: '빛나는 마빡', games: 4, winrate: 1, expected: 0.45, lift: 0.55, synergy: 0.057 },
  { na: '외 걸', nb: '우체국집배원', games: 13, winrate: 0.308, expected: 0.5, lift: -0.192, synergy: -0.065 },
  { na: '용기사', nb: '우체국집배원', games: 6, winrate: 0.5, expected: 0.5, lift: 0, synergy: 0 },
  { na: '신입', nb: 'Lotze', games: 2, winrate: 0, expected: 0.48, lift: -0.48, synergy: -0.03 },
];
const TRIOS: TrioRow[] = [
  { a: 'Lotze', b: '용기사', c: '코 파', games: 4, synergy: 0.039, winrate: 1 },
  { a: '외 걸', b: '도야짬뽕누룽지탕', c: '우체국집배원', games: 12, synergy: 0.035, winrate: 0.667 },
  { a: '신입', b: '말듣쓰', c: '빛나는 마빡', games: 2, synergy: -0.02, winrate: 0 },
];
const PAYLOAD = {
  min_games: 5, min_games_lane: 3, patch: '16.18.1',
  synergy: SYN, trios: TRIOS,
  metric_meta: { winrate: { label: '승률', lane: false, fmt: 'pct', desc: '' } },
  players: {},
} as unknown as GuildPayload;

describe('synergy.ts — 순수 함수', () => {
  it('duoRows: 키 na|nb · 첫 열 글자 A ＋ B · 발행 값은 그대로', () => {
    const rows = duoRows(SYN);
    expect(rows).toHaveLength(6);
    expect(rows[0]!.key).toBe('도야짬뽕누룽지탕|우체국집배원');
    expect(rows[0]!.pair).toBe('도야짬뽕누룽지탕 ＋ 우체국집배원');
    expect(rows[0]!.synergy).toBe(0.07);
    expect(duoRows(null)).toEqual([]);
  });
  it('trioRows: 키 a|b|c · 글자 A ＋ B ＋ C', () => {
    const rows = trioRows(TRIOS);
    expect(rows[0]!.key).toBe('Lotze|용기사|코 파');
    expect(rows[0]!.trio).toBe('Lotze ＋ 용기사 ＋ 코 파');
    expect(trioRows(undefined)).toEqual([]);
  });
  it('synCls: 양수 win · 음수 loss · 0·빈 값은 없음', () => {
    expect(synCls(0.07)).toBe('win');
    expect(synCls(-0.065)).toBe('loss');
    expect(synCls(0)).toBe('');
    expect(synCls(null)).toBe('');
  });
  it('fxDuo: 리프트(그대로 뺀 값)와 판수 보정값을 나눠 적는다 — 둘을 같다고 적지 않는다', () => {
    expect(fxDuo(SYN[0]!)).toBe('=시너지 71% − 기대 47% = +0.245 → 14판 보정 +0.070');
    expect(fxDuo(SYN[3]!)).toBe('=시너지 31% − 기대 50% = -0.192 → 13판 보정 -0.065');
  });
  it('fxTrio: 기대 승률이 없으니 승률·판수·보정값만', () => {
    expect(fxTrio(TRIOS[0]!)).toBe('=시너지(트리오) 승률 100% · 4판 보정 = +0.039');
  });

  describe('heatMatrix', () => {
    it('이름은 문턱 이상 조합에 든 사람만, 한국어 사전순(한글 먼저, 로마자 뒤) — 문턱이 0 이면 전부', () => {
      expect(heatNames(SYN, 5)).toEqual(['도야짬뽕누룽지탕', '외 걸', '용기사', '우체국집배원', 'Lotze']);
      expect(heatNames(SYN, 0)).toHaveLength(8);
      expect(heatNames(SYN, 0)).toContain('신입');
    });
    it('대칭이다: cells[i][j] 와 cells[j][i] 는 같은 조합(키·판·시너지), a·b 만 자리를 바꾼다', () => {
      const m = heatMatrix(SYN, null, 0);
      const n = m.names.length;
      expect(m.cells).toHaveLength(n);
      for (let i = 0; i < n; i++) {
        expect(m.cells[i]).toHaveLength(n);
        expect(m.cells[i]![i]).toBeNull();   // 같은 사람
        for (let j = 0; j < n; j++) {
          const x = m.cells[i]![j], y = m.cells[j]![i];
          if (!x || !y) { expect(x).toBe(y); continue; }
          expect(x.key).toBe(y.key);
          expect(x.games).toBe(y.games);
          expect(x.synergy).toBe(y.synergy);
          expect(x.a).toBe(m.names[i]);
          expect(x.b).toBe(m.names[j]);
          expect(y.a).toBe(m.names[j]);
        }
      }
    });
    it('peak 는 보이는 칸 시너지 절댓값의 실값 최대 — 고정 눈금이 아니다', () => {
      expect(heatMatrix(SYN, null, 0).peak).toBe(0.07);
      const small = SYN.filter((r) => Math.abs(r.synergy) < 0.065);
      expect(heatMatrix(small, null, 0).peak).toBe(0.063);
      expect(heatMatrix([], null, 0).peak).toBe(0);
    });
    it('문턱 미만 조합은 synergy null(빈 칸)이되 판수는 남고, peak 에도 들지 않는다', () => {
      const names = heatNames(SYN, 0);
      const m = heatMatrix(SYN, names, 5);
      const i = names.indexOf('신입'), j = names.indexOf('Lotze');
      const c = m.cells[i]![j]!;
      expect(c.synergy).toBeNull();
      expect(c.games).toBe(2);
      // 4판짜리 +0.057 도 빈 칸 — peak 는 문턱 이상만
      expect(m.peak).toBe(0.07);
      const k = names.indexOf('말듣쓰'), l = names.indexOf('빛나는 마빡');
      expect(m.cells[k]![l]!.synergy).toBeNull();
    });
    it('names 를 주면 그 순서 그대로, 모르는 이름은 빈 행·열', () => {
      const m = heatMatrix(SYN, ['용기사', 'Lotze', '없는사람'], 0);
      expect(m.names).toEqual(['용기사', 'Lotze', '없는사람']);
      expect(m.cells[0]![1]!.synergy).toBe(0.063);
      expect(m.cells[1]![0]!.a).toBe('Lotze');
      expect(m.cells[2]!.every((c) => c === null)).toBe(true);
    });
    it('heatT: 절댓값 ÷ peak, 0~1 로 자름 · peak 0 이면 0', () => {
      expect(heatT(0.035, 0.07)).toBeCloseTo(0.5);
      expect(heatT(-0.07, 0.07)).toBe(1);
      expect(heatT(0.09, 0.07)).toBe(1);
      expect(heatT(0.05, 0)).toBe(0);
      expect(heatT(null, 0.07)).toBe(0);
    });
    it('heatText·heatSign: 두 자리 글자, 두 자리에서 0 이 되면 부호 없이 0.00 이고 채움도 없다', () => {
      expect(heatText(0.07)).toBe('+0.07');
      expect(heatText(-0.065)).toBe('-0.07');
      expect(heatText(-0.004)).toBe('0.00');
      expect(heatText(0.004)).toBe('0.00');
      expect(heatSign(-0.004)).toBe(0);
      expect(heatSign(0.005)).toBe(1);
      expect(heatSign(-0.03)).toBe(-1);
    });
    it('heatTip: 이름 · 시너지 · 함께 판 · 승률. 빈 칸은 왜 비었는지', () => {
      const m = heatMatrix(SYN, null, 5);
      const c = m.cells[m.names.indexOf('도야짬뽕누룽지탕')]![m.names.indexOf('우체국집배원')]!;
      expect(heatTip(c, 5)).toBe('도야짬뽕누룽지탕 ＋ 우체국집배원\n시너지 +0.070 · 함께 14판 · 승률 71%');
      expect(heatTip({ a: 'A', b: 'B', games: 2, winrate: 0, synergy: null }, 5)).toBe('A ＋ B\n함께 2판 · 5판 미만이라 표시하지 않습니다');
    });
  });
});

// ── 화면 ──────────────────────────────────────────────────────────────
const tableOf = (name: string) => screen.getByRole('table', { name });
const heads = (t: Element) => [...t.querySelectorAll('thead th[scope="col"] .h')].map((h) => h.textContent);
const bodyRows = (t: Element) => [...t.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
const cells = (tr: Element) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());
const tab = (name: string) => screen.getByRole('tab', { name });

describe('Synergy 화면', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    clearFx();
    app.data = PAYLOAD;
    app.status = 'ready';
    router.start();
  });
  afterEach(() => { router.stop(); });

  it('탭 셋(듀오·트리오·히트맵), 기본은 듀오 · 시너지 내림차순 · 열 이름', () => {
    render(Synergy, { sub: 'duo', params: {} });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['듀오', '트리오', '히트맵']);
    expect(tab('듀오').getAttribute('aria-selected')).toBe('true');
    expect(tab('듀오').id).toBe('syn-tab-duo');
    expect(screen.getByRole('tabpanel').id).toBe('syn-panel-duo');
    const t = tableOf('듀오 시너지');
    expect(heads(t)).toEqual(['듀오', '함께 판', '함께 승률', '기대 승률', '시너지', '리프트']);
    const rows = bodyRows(t);
    expect(rows).toHaveLength(6);
    expect(cells(rows[0]!)).toEqual(['도야짬뽕누룽지탕 ＋ 우체국집배원', '14', '71%', '47%', '+0.070', '+0.245']);
    expect(cells(rows[5]!)).toEqual(['외 걸 ＋ 우체국집배원', '13', '31%', '50%', '-0.065', '-0.192']);
    // 모르는 sub 도 듀오
    cleanup();
    render(Synergy, { sub: 'whatever', params: {} });
    expect(tab('듀오').getAttribute('aria-selected')).toBe('true');
  });

  it('조건부 서식: 시너지 부호 → win/loss 채움, 승률 채움은 문턱(5판) 이상만, 0 은 채움 없음', () => {
    render(Synergy, { sub: 'duo', params: {} });
    const rows = bodyRows(tableOf('듀오 시너지'));
    const tds = (i: number) => rows[i]!.querySelectorAll('td:not(.rn)');
    expect(tds(0)[4]!.classList.contains('win')).toBe(true);     // +0.070
    expect(tds(0)[2]!.classList.contains('win')).toBe(true);     // 14판 71%
    expect(tds(5)[4]!.classList.contains('loss')).toBe(true);    // −0.065
    expect(tds(5)[2]!.classList.contains('loss')).toBe(true);    // 13판 31%
    // 4판 100% — 문턱 미만이라 승률 채움 없음, 시너지 +0.057 은 채움
    const r4 = rows.find((r) => r.textContent?.includes('말듣쓰'))!;
    const t4 = r4.querySelectorAll('td:not(.rn)');
    expect(t4[2]!.classList.contains('win')).toBe(false);
    expect(t4[4]!.classList.contains('win')).toBe(true);
    // 정확히 0 은 어느 쪽도 아니다
    const r0 = rows.find((r) => r.textContent?.includes('용기사 ＋ 우체국집배원'))!;
    const t0 = r0.querySelectorAll('td:not(.rn)');
    expect(t0[4]!.className).not.toMatch(/\b(win|loss)\b/);
    // 물음표(HELP 시너지)
    expect(screen.getByRole('button', { name: '시너지 설명' })).toBeTruthy();
  });

  it('행 선택 → 수식 줄에 리프트·보정값, 같은 행 다시 선택 → 첫 멤버 화면', async () => {
    render(Synergy, { sub: 'duo', params: {} });
    const row = bodyRows(tableOf('듀오 시너지'))[0]!;
    expect(fx.text).toBe('');
    await fireEvent.click(row);
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(fx.text).toBe('=시너지 71% − 기대 47% = +0.245 → 14판 보정 +0.070');
    await fireEvent.keyDown(row, { key: 'Enter' });
    expect(location.hash).toBe('#/m/' + encodeURIComponent('도야짬뽕누룽지탕'));
  });

  it('트리오: 열 · 정렬 · 선택 → 수식 줄 · 다시 선택 → 첫 멤버', async () => {
    render(Synergy, { sub: 'trio', params: {} });
    expect(tab('트리오').getAttribute('aria-selected')).toBe('true');
    const t = tableOf('트리오 시너지');
    expect(heads(t)).toEqual(['트리오', '함께 판', '승률', '시너지']);
    const rows = bodyRows(t);
    expect(cells(rows[0]!)).toEqual(['Lotze ＋ 용기사 ＋ 코 파', '4', '100%', '+0.039']);
    expect(rows[0]!.querySelectorAll('td:not(.rn)')[2]!.classList.contains('win')).toBe(false);   // 4판 — 문턱 미만
    expect(cells(rows[1]!)).toEqual(['외 걸 ＋ 도야짬뽕누룽지탕 ＋ 우체국집배원', '12', '67%', '+0.035']);
    expect(rows[1]!.querySelectorAll('td:not(.rn)')[2]!.classList.contains('win')).toBe(true);
    await fireEvent.click(rows[1]!);
    expect(fx.text).toBe('=시너지(트리오) 승률 67% · 12판 보정 = +0.035');
    await fireEvent.click(rows[1]!);
    expect(location.hash).toBe('#/m/' + encodeURIComponent('외 걸'));
  });

  it('탭 전환은 주소를 바꾸고 수식 줄을 비운다 · 옛 주소 ties 는 기록 화면으로', async () => {
    render(Synergy, { sub: 'duo', params: {} });
    await fireEvent.click(bodyRows(tableOf('듀오 시너지'))[0]!);
    expect(fx.text).not.toBe('');
    await fireEvent.click(tab('히트맵'));
    expect(location.hash).toBe('#/synergy/heat');
    expect(fx.text).toBe('');
    cleanup();
    render(Synergy, { sub: 'ties', params: {} });
    await Promise.resolve();
    expect(location.hash).toBe('#/records/ties');
  });

  it('히트맵 탭: 격자 · 칸 선택 → 수식 줄 · 다시 선택 → 행 멤버 화면', async () => {
    render(Synergy, { sub: 'heat', params: {} });
    const grid = screen.getByRole('grid', { name: '시너지 히트맵' });
    // 문턱 5판: 5명, 대각선 제외 값 칸은 조합 4개 × 2
    expect(grid.querySelectorAll('thead th.col')).toHaveLength(5);
    expect(grid.querySelectorAll('td[tabindex]')).toHaveLength(8);
    const cell = grid.querySelector<HTMLElement>('td[data-i="0"][data-j="3"]')!;   // 도야짬뽕누룽지탕 × 우체국집배원
    await fireEvent.click(cell);
    expect(cell.getAttribute('aria-selected')).toBe('true');
    expect(fx.text).toBe('=시너지 71% − 기대 47% = +0.245 → 14판 보정 +0.070');
    await fireEvent.click(cell);
    expect(location.hash).toBe('#/m/' + encodeURIComponent('도야짬뽕누룽지탕'));
  });

  it('payload 가 없으면 스켈레톤', () => {
    app.data = null;
    const { container } = render(Synergy, { sub: 'duo', params: {} });
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
