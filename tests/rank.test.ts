import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
  boardLaneCounts, boardRows, boardViewOf, metricByLane, metricGroupOf, metricGroupsAvail, metricKeyOf,
  metricRows, metricSearch, wilsonLower,
} from '../src/lib/rank';
import { RANK_META, RANK_PAYLOAD } from './fixtures/rank-payload';
import { app } from '../src/lib/data/store.svelte';
import { parseHash, router } from '../src/lib/router.svelte';
import { clearFx, fx } from '../src/lib/fx.svelte';
import Rank, { memo } from '../src/routes/Rank.svelte';

const GROUPS = metricGroupsAvail(RANK_PAYLOAD);
const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe('rank.ts — 공통', () => {
  it('boardViewOf: 없음·모르는 값은 라인별, all 은 통합, 라인 키는 그 라인', () => {
    expect(boardViewOf(undefined)).toBe('lanes');
    expect(boardViewOf('')).toBe('lanes');
    expect(boardViewOf('all')).toBe('all');
    expect(boardViewOf('TOP')).toBe('TOP');
    expect(boardViewOf('bottom')).toBe('lanes');
  });
  it('wilsonLower: 발행 쪽 _wilson_lower 와 같은 값(소수 3자리), 0판은 0', () => {
    expect(wilsonLower(6, 6)).toBe(0.61);
    expect(wilsonLower(14, 20)).toBe(0.481);
    expect(wilsonLower(6, 12)).toBe(0.254);
    expect(wilsonLower(3, 5)).toBe(0.231);
    expect(wilsonLower(0, 0)).toBe(0);
    expect(wilsonLower(0, 3)).toBe(0);
  });
});

describe('boardRows — 승률 리더보드', () => {
  it('통합: leaderboard 한 줄씩, 신뢰성 순위·메달, 패 = 판 − 승, 표시명(동명이인 ~순번)·멤버 키', () => {
    const rows = boardRows(RANK_PAYLOAD, 'all', 3);
    expect(names(rows)).toEqual(['앙앙맹', 'Faker', '맹구', '앙리~2']);
    expect(rows.map((r) => r.key)).toEqual(['p1', 'p4', 'p2', 'p5']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.medal?.rank ?? null)).toEqual([1, 2, 3, null]);
    expect(rows[1]).toMatchObject({ games: 20, wins: 14, losses: 6, winrate: 0.7, ci: 0.481, kda: 5.1, kp: 0.6, dpm: 900, lane: null, cs: null, vision: null });
  });
  it('통합: 순위는 표의 정렬이 아니라 신뢰성 기준 — 서버 순서가 섞여 와도 같다', () => {
    const shuffled = { ...RANK_PAYLOAD, leaderboard: RANK_PAYLOAD.leaderboard.slice().reverse() };
    expect(names(boardRows(shuffled, 'all', 3))).toEqual(['앙앙맹', 'Faker', '맹구', '앙리~2']);
  });
  it('라인별: 멤버 × 라인(라인 3판 이상), 신뢰성은 Wilson 하한으로 여기서 내고 그 순서로 순위', () => {
    const rows = boardRows(RANK_PAYLOAD, 'lanes', 3);
    expect(rows.map((r) => `${r.name}:${r.lane}`)).toEqual([
      '앙앙맹:TOP', 'Faker:MIDDLE', 'Faker:TOP', '맹구:JUNGLE', '앙리~2:UTILITY', '앙앙맹:MIDDLE',
    ]);
    expect(rows.map((r) => r.ci)).toEqual([0.61, 0.481, 0.301, 0.254, 0.231, 0.061]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.map((r) => r.key)).toContain('p1:TOP');
    // 승수는 승률 × 판 반올림, 판당 CS·시야는 라인 전적에서
    expect(rows[5]).toMatchObject({ games: 3, wins: 1, losses: 2, cs: 180, vision: 25, dpm: 800 });
    // 신입(원딜 2판)은 라인 문턱 미만이라 없다
    expect(names(rows)).not.toContain('신입');
  });
  it('라인 하나: 그 라인 행만, 순위도 그 안에서', () => {
    const rows = boardRows(RANK_PAYLOAD, 'TOP', 3);
    expect(names(rows)).toEqual(['앙앙맹', 'Faker']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(boardRows(RANK_PAYLOAD, 'BOTTOM', 3)).toEqual([]);
    // 문턱 1 이면 신입도 든다
    expect(names(boardRows(RANK_PAYLOAD, 'BOTTOM', 1))).toEqual(['신입']);
  });
  it('boardLaneCounts = 그 라인 표의 행 수', () => {
    expect(boardLaneCounts(RANK_PAYLOAD, 3)).toEqual({ TOP: 2, JUNGLE: 1, MIDDLE: 2, BOTTOM: 0, UTILITY: 1 });
  });
  it('빈 payload 는 빈 표', () => {
    expect(boardRows({}, 'all', 3)).toEqual([]);
    expect(boardRows({}, 'lanes', 3)).toEqual([]);
  });
});

describe('metricRows — 지표 순위', () => {
  it('값 내림차순 경쟁 순위(공동 2위 다음은 4위)·메달, 표시명', () => {
    const rows = metricRows(RANK_PAYLOAD, 'dpm');
    expect(names(rows)).toEqual(['앙앙맹', 'Faker', '맹구', '앙리~2']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
    expect(rows.map((r) => r.medal?.rank ?? null)).toEqual([1, 2, 2, null]);
    expect(rows[0]).toMatchObject({ key: 'p1', games: 6, value: 1295.97, lane: null });
  });
  it('낮을수록 좋은 지표는 오름차순이 1위', () => {
    const rows = metricRows(RANK_PAYLOAD, 'deaths_per_game');
    expect(names(rows)).toEqual(['앙앙맹', '맹구', 'Faker']);
    expect(rows.map((r) => r.value)).toEqual([2.5, 3, 4]);
  });
  it('라인별 지표: 라인이 붙고 키가 `멤버키:라인`, lane 을 주면 그 라인 안에서 다시 순위', () => {
    const all = metricRows(RANK_PAYLOAD, 'cs10');
    expect(all.map((r) => r.key)).toEqual(['p1:TOP', 'p4:MIDDLE', 'p4:TOP', 'p2:JUNGLE']);
    expect(all.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    const top = metricRows(RANK_PAYLOAD, 'cs10', 'TOP');
    expect(top.map((r) => `${r.name}:${r.rank}`)).toEqual(['앙앙맹:1', 'Faker:2']);
    // 통합 지표에 lane 을 줘도 전부(행에 라인이 없다)
    expect(metricRows(RANK_PAYLOAD, 'dpm', 'TOP')).toHaveLength(4);
  });
  it('모르는 키·빈 payload 는 빈 목록', () => {
    expect(metricRows(RANK_PAYLOAD, 'nope')).toEqual([]);
    expect(metricRows({}, 'dpm')).toEqual([]);
  });
  it('metricByLane: meta 가 우선, 없으면 행 모양으로', () => {
    expect(metricByLane(RANK_PAYLOAD, 'cs10')).toBe(true);
    expect(metricByLane(RANK_PAYLOAD, 'dpm')).toBe(false);
    expect(metricByLane({ rankings: RANK_PAYLOAD.rankings }, 'cs10')).toBe(true);
    expect(metricByLane({ rankings: RANK_PAYLOAD.rankings }, 'dpm')).toBe(false);
  });
});

describe('metricGroupsAvail · metricGroupOf · metricKeyOf · metricSearch', () => {
  it('값이 있는 지표만 든 분류(빈 분류는 빠진다), 분류가 없으면 평평한 목록 하나', () => {
    expect(GROUPS).toEqual([
      { group: '종합', metrics: ['dpm', 'deaths_per_game'] },
      { group: '라인전', metrics: ['gold_diff_10', 'cs10'] },
    ]);
    expect(metricGroupsAvail({ rankings: { dpm: [] } })).toEqual([{ group: '지표', metrics: ['dpm'] }]);
    expect(metricGroupsAvail({})).toEqual([]);
  });
  it('metricGroupOf: 지표의 분류, 없으면 첫 분류', () => {
    expect(metricGroupOf(GROUPS, 'cs10')).toBe('라인전');
    expect(metricGroupOf(GROUPS, 'nope')).toBe('종합');
    expect(metricGroupOf([], 'dpm')).toBe('');
  });
  it('metricKeyOf: URL 키 > dpm > 첫 지표 > 빈 문자열', () => {
    expect(metricKeyOf(GROUPS, 'cs10')).toBe('cs10');
    expect(metricKeyOf(GROUPS, 'kda')).toBe('dpm');
    expect(metricKeyOf(GROUPS, undefined)).toBe('dpm');
    expect(metricKeyOf([{ group: 'g', metrics: ['cs10'] }], 'nope')).toBe('cs10');
    expect(metricKeyOf([], 'dpm')).toBe('');
  });
  it('metricSearch: 라벨·키·설명(대회식 코드) 전체에서, 초성도, 분류 순서, 빈 질의는 빈 목록', () => {
    expect(metricSearch('분당', RANK_META, GROUPS)).toEqual(['dpm']);
    expect(metricSearch('deaths', RANK_META, GROUPS)).toEqual(['deaths_per_game']);
    expect(metricSearch('gd10', RANK_META, GROUPS)).toEqual(['gold_diff_10']);
    expect(metricSearch('ㅍㄷ', RANK_META, GROUPS)).toEqual(['deaths_per_game']);
    expect(metricSearch('cs', RANK_META, GROUPS)).toEqual(['cs10']);
    expect(metricSearch('10', RANK_META, GROUPS)).toEqual(['gold_diff_10', 'cs10']);
    expect(metricSearch('', RANK_META, GROUPS)).toEqual([]);
    expect(metricSearch('없는말', RANK_META, GROUPS)).toEqual([]);
  });
});

// ── 화면 ─────────────────────────────────────────────────────────────
const table = () => screen.getByRole('table', { name: /순위/ });
const bodyRows = () => [...table().querySelectorAll('tbody tr')] as HTMLTableRowElement[];
const cellTexts = (tr: HTMLTableRowElement) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());
const heads = () => [...table().querySelectorAll('thead th[scope="col"] .h')].map((h) => h.textContent);
const pressedIn = (group: string) =>
  [...screen.getByRole('group', { name: group }).querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim());

function renderRank(sub: string, params: Record<string, string> = {}) {
  const r = render(Rank, { sub, params });
  /** 주소가 바뀐 뒤 화면을 그 주소로 — App 이 라우터에서 props 로 흘리는 것을 테스트가 대신한다 */
  const sync = async () => {
    const route = parseHash(location.hash);
    await r.rerender({ sub: route.sub, params: route.params });
  };
  return { ...r, sync };
}

describe('Rank — 지표 순위 화면', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    clearFx();
    memo.key = ''; memo.lane = '';
    app.data = RANK_PAYLOAD;
    app.status = 'ready';
    router.start();
  });
  afterEach(() => { router.stop(); });

  it('탭 둘(승률·지표), 분류 칩(개수 병기)·지표 칩·설명 한 줄·표 — 기본 지표 dpm', () => {
    renderRank('metric', { key: 'dpm' });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['승률', '지표']);
    expect(screen.getByRole('tab', { name: '지표' }).getAttribute('aria-selected')).toBe('true');
    const groups = [...screen.getByRole('group', { name: '지표 분류' }).querySelectorAll('button')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim());
    expect(groups).toEqual(['종합 2', '라인전 2']);
    expect(pressedIn('지표 분류')).toEqual(['종합 2']);
    const chips = [...screen.getByRole('group', { name: '종합 지표' }).querySelectorAll('button')].map((b) => b.textContent);
    expect(chips).toEqual(['분당 딜', '판당 데스']);
    expect(pressedIn('종합 지표')).toEqual(['분당 딜']);
    // 설명 한 줄 — **강조** 표식은 글자에서 빠진다, 코드 판은 설명에 코드가 없으니 없다
    const desc = document.querySelector('p.desc')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(desc).toBe('분당 딜 — 1분당 챔피언에게 넣은 피해. 판별 값의 평균입니다.');
    expect(document.querySelector('p.desc .plate')).toBeNull();
    expect(document.querySelector('p.desc .dir')).toBeNull();
    // 표: 멤버·순위·판·값(라벨은 metric_meta)
    expect(table().getAttribute('aria-label')).toBe('분당 딜 순위');
    expect(heads()).toEqual(['멤버', '순위', '판', '분당 딜']);
    const rows = bodyRows();
    expect(rows.map(cellTexts)).toEqual([
      ['앙앙맹', '1', '6', '1,295.97'], ['Faker', '2', '20', '900'], ['맹구', '2', '12', '900'], ['앙리~2', '4', '5', '300'],
    ]);
    expect(rows[0]!.querySelector('td.medal.m1')).toBeTruthy();
    expect(rows[2]!.querySelector('td.medal.m2')).toBeTruthy();
    expect(rows[0]!.querySelector('td.bar')).toBeTruthy();
    // 라인 버튼은 통합 지표에 없다 · 기록 없는 지표 안내 · 문턱 안내
    expect(screen.queryByRole('group', { name: '라인 선택' })).toBeNull();
    expect(document.body.textContent).toContain('기록 없는 지표 1개');
    expect(screen.getByRole('button', { name: '분당 시야 사유' })).toBeTruthy();
    expect(document.body.textContent).toContain('5판 이상 참여한 멤버만 집계합니다 · 1명은 판수 미달로 제외.');
  });

  it('지표 칩 → 주소가 바뀐다 · 낮을수록 좋은 지표는 오름차순·막대 없음·표시', async () => {
    const { sync } = renderRank('metric', { key: 'dpm' });
    await fireEvent.click(screen.getByRole('button', { name: '판당 데스' }));
    expect(location.hash).toBe('#/rank/metric/deaths_per_game');
    await sync();
    expect(pressedIn('종합 지표')).toEqual(['판당 데스']);
    expect(document.querySelector('p.desc .dir')?.textContent).toBe('낮을수록 좋음');
    expect(bodyRows().map(cellTexts)).toEqual([['앙앙맹', '1', '6', '2.5'], ['맹구', '2', '12', '3'], ['Faker', '3', '20', '4']]);
    expect(table().querySelector('td.bar')).toBeNull();
    expect(document.body.textContent).toContain('낮을수록 좋은 지표라 오름차순이 1위이고 막대를 그리지 않습니다.');
  });

  it('분류 칩 → 그 분류의 첫 지표로 · 라인별 지표는 라인 열·라인 버튼·코드 판·차이 채움', async () => {
    const { sync } = renderRank('metric', { key: 'dpm' });
    await fireEvent.click(screen.getByRole('button', { name: /^라인전/ }));
    expect(location.hash).toBe('#/rank/metric/gold_diff_10');
    await sync();
    expect(pressedIn('지표 분류')).toEqual(['라인전 2']);
    expect(pressedIn('라인전 지표')).toEqual(['골드차@10']);
    expect(document.querySelector('p.desc .plate')?.textContent).toBe('GD10');
    expect(table().getAttribute('aria-label')).toBe('골드차@10 순위 · 멤버 × 라인');
    expect(heads()).toEqual(['멤버', '순위', '라인', '판', '골드차@10']);
    const rows = bodyRows();
    expect(rows.map(cellTexts)).toEqual([['앙앙맹', '1', '탑', '6', '150'], ['Faker', '2', '탑', '4', '0'], ['Faker', '3', '미드', '20', '-30']]);
    expect(rows[0]!.querySelector('td.lane-top')).toBeTruthy();
    expect(rows[0]!.querySelector('td.win')).toBeTruthy();
    expect(rows[2]!.querySelector('td.loss')).toBeTruthy();
    expect(rows[1]!.querySelector('td.win, td.loss')).toBeNull();
    // 라인 하나 → 주소에 라인, 라인 열 없음, 그 라인 안에서 순위
    expect(pressedIn('라인 선택')).toEqual(['전체']);
    await fireEvent.click(screen.getByRole('button', { name: '탑' }));
    expect(location.hash).toBe('#/rank/metric/gold_diff_10/TOP');
    await sync();
    expect(pressedIn('라인 선택')).toEqual(['탑']);
    expect(table().getAttribute('aria-label')).toBe('골드차@10 순위 · 탑');
    expect(heads()).toEqual(['멤버', '순위', '판', '골드차@10']);
    expect(bodyRows().map(cellTexts)).toEqual([['앙앙맹', '1', '6', '150'], ['Faker', '2', '4', '0']]);
    expect(document.body.textContent).toContain('(라인별 지표는 3판)');
  });

  it('검색: 분류를 무시하고 전체에서, 결과 칩 선택은 라인을 유지한다 · 결과 없음 문구', async () => {
    const { sync } = renderRank('metric', { key: 'gold_diff_10', lane: 'TOP' });
    const q = screen.getByRole('searchbox', { name: '지표 검색' });
    await fireEvent.input(q, { target: { value: 'cs' } });
    expect(document.body.textContent).toContain('검색 1개 / 전체 4개');
    const hits = [...screen.getByRole('group', { name: "'cs' 검색 결과" }).querySelectorAll('button')].map((b) => b.textContent);
    expect(hits).toEqual(['CS@10']);
    await fireEvent.click(screen.getByRole('button', { name: 'CS@10' }));
    expect(location.hash).toBe('#/rank/metric/cs10/TOP');
    await sync();
    expect(bodyRows().map(cellTexts)).toEqual([['앙앙맹', '1', '6', '90'], ['Faker', '2', '4', '80']]);
    await fireEvent.input(q, { target: { value: '없는말' } });
    expect(document.body.textContent).toContain("'없는말' 검색 결과가 없습니다.");
  });

  it('행 선택 → 수식 줄, 같은 행 다시 → 멤버 화면 · 지표가 바뀌면 수식 줄을 비운다', async () => {
    const { sync } = renderRank('metric', { key: 'cs10' });
    expect(fx.text).toBe('');
    await fireEvent.click(bodyRows()[0]!);
    expect(fx.text).toBe('=CS@10(탑 6판) → 90');
    expect(bodyRows()[0]!.getAttribute('aria-selected')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: '미드' }));
    await sync();
    expect(fx.text).toBe('');
    await fireEvent.keyDown(bodyRows()[0]!, { key: 'Enter' });
    expect(fx.text).toBe('=CS@10(미드 20판) → 85');
    await fireEvent.keyDown(bodyRows()[0]!, { key: 'Enter' });
    expect(location.hash).toBe('#/m/Faker');
  });

  it('값 없는 키·통합 지표의 라인은 주소를 바로잡는다 · play 는 기록 화면으로', async () => {
    renderRank('metric', { key: 'kda', lane: 'TOP' });
    expect(location.hash).toBe('#/rank/metric/dpm');
    cleanup();
    renderRank('metric', { key: 'dpm', lane: 'TOP' });
    expect(location.hash).toBe('#/rank/metric/dpm');
    cleanup();
    renderRank('play');
    expect(location.hash).toBe('#/records/play');
  });

  it('탭: 승률 ↔ 지표, 지표 탭은 마지막 지표·라인을 기억한다', async () => {
    const { sync } = renderRank('board');
    expect(screen.getByRole('tab', { name: '승률' }).getAttribute('aria-selected')).toBe('true');
    await fireEvent.click(screen.getByRole('tab', { name: '지표' }));
    expect(location.hash).toBe('#/rank/metric/dpm');
    await sync();
    await fireEvent.click(screen.getByRole('button', { name: /^라인전/ }));
    await sync();
    await fireEvent.click(screen.getByRole('button', { name: '미드' }));
    await sync();
    expect(location.hash).toBe('#/rank/metric/gold_diff_10/MIDDLE');
    await fireEvent.click(screen.getByRole('tab', { name: '승률' }));
    expect(location.hash).toBe('#/rank/board');
    await sync();
    expect(screen.getByRole('table', { name: /리더보드/ })).toBeTruthy();
    await fireEvent.click(screen.getByRole('tab', { name: '지표' }));
    expect(location.hash).toBe('#/rank/metric/gold_diff_10/MIDDLE');
  });

  it('지표가 하나도 없으면 빈 상태 한 문장', () => {
    app.data = { ...RANK_PAYLOAD, rankings: {}, metric_groups: [] };
    renderRank('metric', { key: 'dpm' });
    expect(document.body.textContent).toContain('아직 표시할 지표가 없습니다.');
  });
});
