import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Rank from '../src/routes/Rank.svelte';
import { RANK_PAYLOAD } from './fixtures/rank-payload';
import { app } from '../src/lib/data/store.svelte';
import { parseHash, router } from '../src/lib/router.svelte';
import { clearFx, fx } from '../src/lib/fx.svelte';

const table = () => screen.getByRole('table', { name: /리더보드/ });
const bodyRows = () => [...table().querySelectorAll('tbody tr')] as HTMLTableRowElement[];
const cellTexts = (tr: HTMLTableRowElement) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());
const heads = () => [...table().querySelectorAll('thead th[scope="col"] .h')].map((h) => h.textContent);
const pressed = () => screen.getByRole('group', { name: '리더보드 보기' }).querySelector('button[aria-pressed="true"]')?.textContent?.replace(/\s+/g, ' ').trim();

function renderBoard(params: Record<string, string> = {}) {
  const r = render(Rank, { sub: 'board', params });
  const sync = async () => {
    const route = parseHash(location.hash);
    await r.rerender({ sub: route.sub, params: route.params });
  };
  return { ...r, sync };
}

describe('Rank — 승률 리더보드', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    clearFx();
    app.data = RANK_PAYLOAD;
    app.status = 'ready';
    router.start();
  });
  afterEach(() => { router.stop(); });

  it('기본은 라인별: 멤버 × 라인(라인 3판 이상), 신뢰성 순위·메달, 라인 띠, 판당 CS·시야 열', () => {
    renderBoard();
    expect(pressed()).toBe('라인별');
    expect(table().getAttribute('aria-label')).toBe('승률 리더보드 · 라인별');
    expect(heads()).toEqual(['멤버', '순위', '라인', '판', '승', '패', '승률', '신뢰성', 'KDA', '킬 관여', '분당 딜', '판당 CS', '시야 점수']);
    const rows = bodyRows();
    expect(rows.map(cellTexts)).toEqual([
      ['앙앙맹', '1', '탑', '6', '6', '0', '100%', '61%', '3', '50%', '1,296', '247', '33'],
      ['Faker', '2', '미드', '20', '14', '6', '70%', '48%', '3', '50%', '900', '220', '25'],
      ['Faker', '3', '탑', '4', '3', '1', '75%', '30%', '3', '50%', '650', '180', '25'],
      ['맹구', '4', '정글', '12', '6', '6', '50%', '25%', '3', '50%', '640', '150', '25'],
      ['앙리~2', '5', '서폿', '5', '3', '2', '60%', '23%', '3', '50%', '300', '40', '60'],
      ['앙앙맹', '6', '미드', '3', '1', '2', '33%', '6%', '3', '50%', '800', '180', '25'],
    ]);
    expect(rows[0]!.querySelector('td.medal.m1')?.textContent?.trim()).toBe('1');
    expect(rows[2]!.querySelector('td.medal.m3')?.textContent?.trim()).toBe('3');
    expect(rows[3]!.querySelector('td.medal')).toBeNull();
    expect(rows[0]!.querySelector('td.lane-top')).toBeTruthy();
    expect(rows[3]!.querySelector('td.lane-jg')).toBeTruthy();
    // 승률 채움: 높음 win · 낮음 loss · 중간 없음. 라인별 문턱(3판) 이상이라 색을 단정한다
    expect(rows[0]!.querySelector('td.win')?.textContent?.trim()).toBe('100%');
    expect(rows[5]!.querySelector('td.loss')?.textContent?.trim()).toBe('33%');
    expect(rows[3]!.querySelector('td.win, td.loss')).toBeNull();
    // 분당 딜 열은 막대, 신뢰성 열 머리에 물음표
    expect(rows[0]!.querySelectorAll('td.bar')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '신뢰성 설명' })).toBeTruthy();
    // 라인 버튼 숫자 = 그 라인 행 수 · 안내 두 문장
    const nums = ['탑', '정글', '미드', '원딜', '서폿'].map((l) => screen.getByRole('button', { name: new RegExp(`^${l} \\d`) }).textContent?.replace(/\s+/g, ' ').trim());
    expect(nums).toEqual(['탑 2', '정글 1', '미드 2', '원딜 0', '서폿 1']);
    const notes = [...document.querySelectorAll('p.note')].map((p) => p.textContent?.replace(/\s+/g, ' ').trim());
    expect(notes[0]).toBe('멤버 × 라인 6줄 · 라인 3판 이상. 순위는 신뢰성(승률의 Wilson 하한) 기준입니다. 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.');
    expect(notes[1]).toContain('5판 이상 참여한 멤버만 집계합니다 (라인별 지표는 3판) · 1명은 판수 미달로 제외.');
  });

  it('통합: leaderboard 한 줄씩, 패 = 판 − 승, 라인·판당 CS·시야 열 없음, 주소는 #/rank/board/all', async () => {
    const { sync } = renderBoard();
    await fireEvent.click(screen.getByRole('button', { name: '통합' }));
    expect(location.hash).toBe('#/rank/board/all');
    await sync();
    expect(pressed()).toBe('통합');
    expect(table().getAttribute('aria-label')).toBe('승률 리더보드 · 통합');
    expect(heads()).toEqual(['멤버', '순위', '판', '승', '패', '승률', '신뢰성', 'KDA', '킬 관여', '분당 딜']);
    expect(bodyRows().map(cellTexts)).toEqual([
      ['앙앙맹', '1', '6', '6', '0', '100%', '61%', '4.67', '48%', '1,296'],
      ['Faker', '2', '20', '14', '6', '70%', '48%', '5.1', '60%', '900'],
      ['맹구', '3', '12', '6', '6', '50%', '25%', '2.2', '55%', '640'],
      ['앙리~2', '4', '5', '3', '2', '60%', '23%', '1.8', '70%', '300'],
    ]);
    const notes = [...document.querySelectorAll('p.note')].map((p) => p.textContent?.replace(/\s+/g, ' ').trim());
    expect(notes[0]).toContain('4명 · 전체 경기 기준.');
    expect(notes[1]).not.toContain('라인별 지표는');
  });

  it('라인 하나: 그 라인 행만 그 안에서 순위, 라인 열 없음, 주소는 #/rank/board/TOP · 주소로 열어도 같다', async () => {
    const { sync } = renderBoard();
    await fireEvent.click(screen.getByRole('button', { name: /^탑/ }));
    expect(location.hash).toBe('#/rank/board/TOP');
    await sync();
    expect(pressed()).toBe('탑 2');
    expect(table().getAttribute('aria-label')).toBe('승률 리더보드 · 탑');
    expect(heads()[2]).toBe('판');
    expect(bodyRows().map((r) => cellTexts(r).slice(0, 4))).toEqual([['앙앙맹', '1', '6', '6'], ['Faker', '2', '4', '3']]);
    expect(document.querySelector('p.note')?.textContent).toContain('탑 3판 이상 출전한 2명 · 탑 경기만 집계.');
    cleanup();
    renderBoard({ lane: 'BOTTOM' });
    expect(pressed()).toBe('원딜 0');
    expect(document.body.textContent).toContain('아직 표시할 데이터가 없습니다.');
  });

  it('행 선택 → 수식 줄에 승률 근거, 같은 행 다시 → 멤버 화면(표시명) · 보기 전환은 수식 줄을 비운다', async () => {
    const { sync } = renderBoard();
    expect(fx.text).toBe('');
    await fireEvent.click(bodyRows()[0]!);
    expect(fx.text).toBe('=승률(탑 6/6) → 100% · 신뢰성 61%');
    expect(bodyRows()[0]!.getAttribute('aria-selected')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: '통합' }));
    await sync();
    expect(fx.text).toBe('');
    await fireEvent.keyDown(bodyRows()[3]!, { key: 'Enter' });
    expect(fx.text).toBe('=승률(3/5) → 60% · 신뢰성 23%');
    await fireEvent.keyDown(bodyRows()[3]!, { key: 'Enter' });
    expect(location.hash).toBe('#/m/%EC%95%99%EB%A6%AC~2');
  });

  it('머리 정렬을 바꿔도 순위·메달은 그대로(기본 순서 기준)', async () => {
    renderBoard({ lane: 'all' });
    await fireEvent.click(screen.getByRole('columnheader', { name: /^판/ }));
    const rows = bodyRows();
    expect(rows.map((r) => cellTexts(r)[0])).toEqual(['Faker', '맹구', '앙앙맹', '앙리~2']);
    expect(rows.map((r) => cellTexts(r)[1])).toEqual(['2', '3', '1', '4']);
    expect(rows[2]!.querySelector('td.medal.m1')).toBeTruthy();
  });
});
