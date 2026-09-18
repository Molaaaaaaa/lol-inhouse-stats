import '@testing-library/svelte/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/svelte';
import { tipOpenFor } from '../src/lib/tip';
import { helpText } from '../src/lib/help';
import type { Component, ComponentProps } from 'svelte';
import Generic from '../src/components/DataTable.svelte';
import type { Col } from '../src/lib/table';
import { app } from '../src/lib/data/store.svelte';
import type { GuildPayload } from '../src/lib/data/types';

interface Row { id: string; name: string; games: number; wr: number; deaths: number | null; champ?: string; win?: boolean }
// render() 는 제네릭 T 를 추론하지 못한다 — Row 로 고정한 별칭
const DataTable = Generic as unknown as Component<ComponentProps<typeof Generic<Row>>>;

const ROWS: Row[] = [
  { id: 'a', name: '앙앙맹', games: 12, wr: 0.5, deaths: 4, win: true },
  { id: 'b', name: 'Faker', games: 20, wr: 0.75, deaths: 2, win: true },
  { id: 'c', name: '맹구', games: 3, wr: 0.33, deaths: null, win: false },
];
const COLS: Col<Row>[] = [
  { k: 'name', h: '멤버' },
  { k: 'games', h: '판수', num: true, lo: true },
  { k: 'wr', h: '승률', num: true, bar: true, fmt: (v) => `${Math.round(Number(v) * 100)}%` },
  { k: 'deaths', h: '데스', num: true, nullLast: true, bar: true },
];

// 셀 텍스트 — 첫 데이터 열(.c0)의 글자만
const firstCol = (el: HTMLElement) => [...el.querySelectorAll('tbody td.c0')].map((td) => td.textContent?.trim());
const rn = (el: HTMLElement) => [...el.querySelectorAll('tbody td.rn')].map((td) => td.textContent?.trim());
const th = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll('thead th')].find((h) => h.querySelector('.h')?.textContent === label) as HTMLElement;

const many = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `멤버${String(i).padStart(2, '0')}`, games: n - i, wr: (i % 10) / 10, deaths: i }));

describe('DataTable — 렌더', () => {
  it('캡션·aria-label·열 머리(scope=col)·행·행 번호 홈통', () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: '리더보드' });
    expect(container.querySelector('.cap')?.textContent).toBe('리더보드');
    const table = container.querySelector('table')!;
    expect(table.getAttribute('aria-label')).toBe('리더보드');
    const heads = [...table.querySelectorAll('thead th[scope="col"]')].map((h) => h.querySelector('.h')?.textContent);
    expect(heads).toEqual(['멤버', '판수', '승률', '데스']);
    expect(table.querySelector('thead th.rn')?.getAttribute('aria-hidden')).toBe('true');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(rn(container)).toEqual(['1', '2', '3']);
    // 정렬 키가 없으면 들어온 순서
    expect(firstCol(container)).toEqual(['앙앙맹', 'Faker', '맹구']);
    // fmt 결과가 셀에 보인다
    expect(container.querySelector('tbody tr td:nth-child(4)')?.textContent?.trim()).toBe('50%');
  });
  it('빈 rows → 빈 상태 문구, 표 없음', () => {
    const { container } = render(DataTable, { rows: [] as Row[], cols: COLS, caption: '빈 표' });
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('.cap')?.textContent).toBe('빈 표');
    expect(container.querySelector('.empty')?.textContent).toBe('아직 표시할 데이터가 없습니다.');
  });
  it('rowNumbers=false 면 홈통이 없다', () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't', rowNumbers: false });
    expect(container.querySelector('.rn')).toBeNull();
    expect(container.querySelector('.sheet')?.classList.contains('norn')).toBe(true);
  });
  it('sortKey 로 처음부터 정렬(내림차순 기본)·행 번호는 정렬 뒤에도 1..n', () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't', sortKey: 'games' });
    expect(firstCol(container)).toEqual(['Faker', '앙앙맹', '맹구']);
    expect(rn(container)).toEqual(['1', '2', '3']);
    expect(th(container, '판수').getAttribute('aria-sort')).toBe('descending');
    expect(th(container, '멤버').getAttribute('aria-sort')).toBe('none');
  });
});

describe('DataTable — 정렬', () => {
  it('머리 클릭 → 그 열 내림차순, 다시 클릭 → 반전, aria-sort 가 따라온다', async () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't' });
    const h = th(container, '승률');
    await fireEvent.click(h);
    expect(firstCol(container)).toEqual(['Faker', '앙앙맹', '맹구']);
    expect(h.getAttribute('aria-sort')).toBe('descending');
    await fireEvent.click(h);
    expect(firstCol(container)).toEqual(['맹구', '앙앙맹', 'Faker']);
    expect(h.getAttribute('aria-sort')).toBe('ascending');
    expect(th(container, '멤버').getAttribute('aria-sort')).toBe('none');
  });
  it('키보드 Enter·Space 로 정렬, 머리는 tabindex=0', async () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't' });
    const h = th(container, '판수');
    expect(h.getAttribute('tabindex')).toBe('0');
    await fireEvent.keyDown(h, { key: 'Enter' });
    expect(firstCol(container)).toEqual(['Faker', '앙앙맹', '맹구']);
    await fireEvent.keyDown(h, { key: ' ' });
    expect(firstCol(container)).toEqual(['맹구', '앙앙맹', 'Faker']);
  });
  it('nullLast: 빈 값은 방향과 상관없이 맨 아래', async () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't', sortKey: 'deaths', sortDir: 1 });
    expect(firstCol(container)).toEqual(['Faker', '앙앙맹', '맹구']);
    await fireEvent.click(th(container, '데스'));
    expect(firstCol(container)).toEqual(['앙앙맹', 'Faker', '맹구']);
  });
  it('lowerBetterKeys 열은 처음 누르면 오름차순, 막대 없음', async () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't', lowerBetterKeys: ['deaths'] });
    const h = th(container, '데스');
    await fireEvent.click(h);
    expect(h.getAttribute('aria-sort')).toBe('ascending');
    expect(firstCol(container)).toEqual(['Faker', '앙앙맹', '맹구']);
    const deathCells = [...container.querySelectorAll('tbody tr td:nth-child(5)')];
    expect(deathCells.every((td) => !td.classList.contains('bar') && !td.getAttribute('style'))).toBe(true);
  });
  it('sortable=false 열은 누를 수 없다', async () => {
    const cols: Col<Row>[] = [{ k: 'name', h: '멤버', sortable: false }, { k: 'games', h: '판수', num: true }];
    const { container } = render(DataTable, { rows: ROWS, cols, caption: 't' });
    const h = th(container, '멤버');
    expect(h.getAttribute('tabindex')).toBeNull();
    expect(h.getAttribute('aria-sort')).toBeNull();
    await fireEvent.click(h);
    expect(firstCol(container)).toEqual(['앙앙맹', 'Faker', '맹구']);
  });
  it('호출부가 sortKey 를 바꾸면(지표 전환) 사용자가 누른 정렬은 버린다', async () => {
    const { container, rerender } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't', sortKey: 'games' });
    await fireEvent.click(th(container, '승률'));
    await fireEvent.click(th(container, '승률'));   // 승률 오름차순
    expect(firstCol(container)).toEqual(['맹구', '앙앙맹', 'Faker']);
    await rerender({ rows: ROWS, cols: COLS, caption: 't', sortKey: 'deaths', sortDir: 1 });
    expect(firstCol(container)).toEqual(['Faker', '앙앙맹', '맹구']);
    expect(th(container, '데스').getAttribute('aria-sort')).toBe('ascending');
  });
});

describe('DataTable — 접기·거르기', () => {
  it('17행 이상이면 10줄 + "더 보기 (n)", 누르면 전부 + "접기"', async () => {
    const rows = many(18);
    const { container, getByRole } = render(DataTable, { rows, cols: COLS, caption: 't' });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
    const btn = getByRole('button', { name: '더 보기 (8)' });
    await fireEvent.click(btn);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(18);
    expect(btn.textContent).toBe('접기');
    await fireEvent.click(btn);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
  });
  it('16행이면 접지 않는다 · fold=true 로 강제, fold=false 로 해제', () => {
    expect(render(DataTable, { rows: many(16), cols: COLS, caption: 'a' }).container.querySelectorAll('tbody tr')).toHaveLength(16);
    expect(render(DataTable, { rows: many(12), cols: COLS, caption: 'b', fold: true }).container.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(render(DataTable, { rows: many(30), cols: COLS, caption: 'c', fold: false }).container.querySelectorAll('tbody tr')).toHaveLength(30);
  });
  it('21행 이상이면 거르기 칸, 입력하면 걸린 행만·건수, 거르는 동안은 접지 않는다', async () => {
    const rows = many(25);
    const { container, getByLabelText } = render(DataTable, { rows, cols: COLS, caption: '리더보드' });
    const inp = getByLabelText('리더보드 검색') as HTMLInputElement;
    expect(inp.getAttribute('placeholder')).toBe('멤버 검색');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
    await fireEvent.input(inp, { target: { value: '멤버1' } });
    // 멤버10..멤버19 — 10줄이지만 거르는 중이라 '더 보기' 없음
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(container.querySelector('.tfhit')?.textContent).toBe('10건');
    expect(container.querySelector('.more')).toBeNull();
    await fireEvent.input(inp, { target: { value: '멤버2' } });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(rn(container)).toEqual(['1', '2', '3', '4', '5']);
    await fireEvent.input(inp, { target: { value: '' } });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(container.querySelector('.more')).not.toBeNull();
  });
  it('20행이면 거르기 칸이 없다 · filter=true 로 강제', () => {
    expect(render(DataTable, { rows: many(20), cols: COLS, caption: 'a' }).container.querySelector('input')).toBeNull();
    expect(render(DataTable, { rows: ROWS, cols: COLS, caption: 'b', filter: true }).container.querySelector('input')).not.toBeNull();
  });
});

describe('DataTable — 선택', () => {
  it('rowKey 가 있으면 행이 tabindex=0·aria-selected, 클릭·Enter → onselect(r, key)', async () => {
    const onselect = vi.fn();
    const { container } = render(DataTable, {
      rows: ROWS, cols: COLS, caption: 't', rowKey: (r: Row) => r.id, selectedKey: 'b', onselect,
    });
    const trs = [...container.querySelectorAll('tbody tr')];
    expect(trs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '0', '0']);
    expect(trs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(trs[1]!.classList.contains('sel')).toBe(true);
    await fireEvent.click(trs[0]!);
    expect(onselect).toHaveBeenCalledWith(ROWS[0], 'a');
    await fireEvent.keyDown(trs[2]!, { key: 'Enter' });
    expect(onselect).toHaveBeenLastCalledWith(ROWS[2], 'c');
    expect(onselect).toHaveBeenCalledTimes(2);
  });
  it('rowKey 가 없으면 행은 초점을 받지 않는다', () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't' });
    const tr = container.querySelector('tbody tr')!;
    expect(tr.getAttribute('tabindex')).toBeNull();
    expect(tr.getAttribute('aria-selected')).toBeNull();
  });
});

describe('DataTable — 셀 서식', () => {
  it('lo 열은 머리·셀에 class, 정렬 기준이면 lo 를 받지 않는다', async () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't' });
    expect(th(container, '판수').classList.contains('lo')).toBe(true);
    expect(container.querySelector('tbody tr td:nth-child(3)')?.classList.contains('lo')).toBe(true);
    await fireEvent.click(th(container, '판수'));
    expect(th(container, '판수').classList.contains('lo')).toBe(false);
    expect(container.querySelector('tbody tr td:nth-child(3)')?.classList.contains('lo')).toBe(false);
  });
  it('bar 셀은 .bar + style 의 --bar 너비(그라디언트는 스타일시트) — 열 최대값이 100%', () => {
    const { container } = render(DataTable, { rows: ROWS, cols: COLS, caption: 't', sortKey: 'wr' });
    const cells = [...container.querySelectorAll('tbody tr td:nth-child(4)')] as HTMLElement[];
    expect(cells.every((td) => td.classList.contains('bar'))).toBe(true);
    expect(cells.map((td) => td.style.getPropertyValue('--bar'))).toEqual(['100%', '66.7%', '44%']);
    expect(cells[0]!.getAttribute('style')).toContain('--bar');
    // 막대가 아닌 열에는 --bar 도 .bar 도 없다
    const name = container.querySelector('tbody tr td.c0') as HTMLElement;
    expect(name.classList.contains('bar')).toBe(false);
    expect(name.style.getPropertyValue('--bar')).toBe('');
  });
  it('num 열은 .num, cls 와 rowClass 가 붙는다, code 판·물음표 버튼', () => {
    const cols: Col<Row>[] = [
      { k: 'name', h: '멤버', cls: (r) => (r.win ? 'win' : 'loss') },
      { k: 'games', h: '판수', num: true, code: 'GP', hlp: 'MMR' },
    ];
    const { container, getByRole } = render(DataTable, {
      rows: ROWS, cols, caption: 't', rowClass: (r: Row) => (r.games < 5 ? 'few' : ''),
    });
    const tds = [...container.querySelectorAll('tbody tr:first-child td')];
    expect(tds[1]!.classList.contains('win')).toBe(true);
    expect(tds[2]!.classList.contains('num')).toBe(true);
    expect(container.querySelector('tbody tr:nth-child(3)')?.classList.contains('few')).toBe(true);
    expect(container.querySelector('tbody tr:nth-child(3) td.c0')?.classList.contains('loss')).toBe(true);
    expect(th(container, '판수').querySelector('.code.plate')?.textContent).toBe('GP');
    const q = getByRole('button', { name: '판수 설명' });
    expect(document.getElementById(q.getAttribute('aria-describedby') ?? '')?.textContent).toBe(helpText('MMR'));
    expect(th(container, '멤버').querySelector('.qmark')).toBeNull();
  });
  it('물음표 클릭·Enter 는 툴팁만 열고 정렬은 일어나지 않는다', async () => {
    const cols: Col<Row>[] = [{ k: 'name', h: '멤버' }, { k: 'games', h: '판수', num: true, hlp: 'MMR' }];
    const { container, getByRole } = render(DataTable, { rows: ROWS, cols, caption: 't' });
    const q = getByRole('button', { name: '판수 설명' });
    await fireEvent.click(q);
    expect(tipOpenFor(q)).toBe(true);
    expect(th(container, '판수').getAttribute('aria-sort')).toBe('none');
    expect(firstCol(container)).toEqual(['앙앙맹', 'Faker', '맹구']);
    await fireEvent.keyDown(q, { key: 'Enter' });
    expect(th(container, '판수').getAttribute('aria-sort')).toBe('none');
    // 머리 자체의 Enter 는 정렬
    await fireEvent.keyDown(th(container, '판수'), { key: 'Enter' });
    expect(th(container, '판수').getAttribute('aria-sort')).toBe('descending');
  });
  it('img 열: 패치를 모르면(스토어 비어 있음) 이미지를 그리지 않는다', () => {
    const cols: Col<Row>[] = [{ k: 'name', h: '챔피언', img: (r) => r.champ ?? null }];
    const rows: Row[] = [{ ...ROWS[0]!, champ: 'Ahri' }];
    const { container } = render(DataTable, { rows, cols, caption: 't' });
    expect(container.querySelector('img')).toBeNull();
    expect(within(container.querySelector('tbody')!).getByText('앙앙맹')).toBeTruthy();
  });
  it('img 열: 스토어에 패치가 있으면 ddragon 초상, id 가 없거나 이상하면 생략', () => {
    app.data = { patch: '15.18.1' } as unknown as GuildPayload;
    try {
      const cols: Col<Row>[] = [{ k: 'name', h: '챔피언', img: (r) => r.champ ?? null }];
      const rows: Row[] = [{ ...ROWS[0]!, champ: 'Ahri' }, { ...ROWS[1]! }, { ...ROWS[2]!, champ: '../x' }];
      const { container } = render(DataTable, { rows, cols, caption: 't' });
      const imgs = [...container.querySelectorAll('tbody td.c0 img.champ')] as HTMLImageElement[];
      expect(imgs).toHaveLength(1);
      expect(imgs[0]!.getAttribute('src')).toBe('https://ddragon.leagueoflegends.com/cdn/15.18.1/img/champion/Ahri.png');
      expect(imgs[0]!.getAttribute('alt')).toBe('');
    } finally {
      app.data = null;
    }
  });
});
