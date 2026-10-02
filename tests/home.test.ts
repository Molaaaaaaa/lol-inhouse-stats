import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Home from '../src/routes/Home.svelte';
import { app } from '../src/lib/data/store.svelte';
import { router } from '../src/lib/router.svelte';
import { clearFx, fx } from '../src/lib/fx.svelte';
import { media } from '../src/lib/media.svelte';
import type { GuildPayload, LaneId, PlayerPub } from '../src/lib/data/types';

// 작은 payload — 홈은 summary·timestamp·players·metric_meta·min_games 만 읽는다.
// 사다리 필드(cp·cp_constants)를 일부러 채워 둔다: 있어도 화면에 나오지 않는다는 것을 단언하려고.
function player(name: string, games: number, wins: number, lane: LaneId, extra: Partial<PlayerPub> = {}): PlayerPub {
  return {
    name,
    record: { games, wins, losses: games - wins, winrate: games ? wins / games : 0, ci_lower: 0, kda: 3.5, kp: 0.5, dpm: 812.4 },
    lanes: [{ lane, games }],
    ...extra,
  } as unknown as PlayerPub;
}

const PAYLOAD = {
  name: '테스트 방', patch: '15.18.1', timestamp: '2026-09-17T11:31:54+00:00',
  summary: { total_games: 57, player_count: 5, avg_winrate: 0.5, avg_duration_sec: 1686 },
  min_games: 5, min_games_excluded: 1, min_games_lane: 3, min_days: 1, min_days_excluded: 0,
  players: {
    p1: player('앙앙맹', 6, 5, 'TOP', { record: { games: 6, wins: 5, losses: 1, winrate: 5 / 6, ci_lower: 0, kda: 4.67, kp: 0.484, dpm: 1296 } } as Partial<PlayerPub>),
    p2: player('맹구', 12, 6, 'JUNGLE'),
    p3: player('신입', 2, 0, 'BOTTOM'),
    p4: player('Faker', 20, 14, 'MIDDLE'),
    p5: player('하하', 12, 6, 'UTILITY'),
  },
  cp: {
    p1: { name: '앙앙맹', games: 6, main_lane: 'TOP', mmr: 1185, cp: 1135, tier: '2티어', points: 35, to_next: 65, placed: true, lanes: {}, replay: [] },
  },
  cp_constants: { placement_games: 5, tiers: [{ name: '2티어', cp: 1050, open_top: false }], lane_prior_k: 5 },
  metric_meta: {
    winrate: { label: '승률', lane: false, fmt: 'pct', desc: '' },
    kda: { label: 'KDA', lane: false, fmt: '', desc: '' },
    dpm: { label: '분당 딜', lane: false, fmt: '', desc: '' },
    kp: { label: '킬 관여', lane: false, fmt: 'pct', desc: '' },
  },
  metric_groups: [], lower_better: [], baseline: null,
} as unknown as GuildPayload;

const LADDER_WORDS = /티어|CP|MMR|배치|점수|승급|사다리|레이팅|등급|계산식/;
const table = () => screen.getByRole('table', { name: '멤버 · 판수 순' });
const bodyRows = () => [...table().querySelectorAll('tbody tr')] as HTMLTableRowElement[];
const cellTexts = (tr: HTMLTableRowElement) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());
const nameOf = (tr: HTMLTableRowElement) => tr.querySelector('td.c0')?.textContent?.trim();
const heads = () => [...table().querySelectorAll('thead th[scope="col"] .h')].map((h) => h.textContent);
const head = (label: string) => [...table().querySelectorAll('thead th')].find((h) => h.querySelector('.h')?.textContent === label) as HTMLElement;

describe('Home — 멤버 시트', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    clearFx();
    app.data = PAYLOAD;
    app.status = 'ready';
    media.phone = false;
    router.start();
  });
  afterEach(() => { router.stop(); media.phone = false; });

  it('한 줄 메타: 평균 시간·갱신 시각만 — 경기·멤버 수는 헤더 메타에 있다', () => {
    const { container } = render(Home, { sub: '', params: {} });
    const meta = container.querySelector('.meta')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(meta).toMatch(/^평균 28분 06초 · 갱신 9\/17 \d\d:\d\d$/);
    expect(meta).not.toContain('경기');
    expect(meta).not.toContain('명');
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(PAYLOAD.timestamp);
  });

  it('멤버 전원이 판수 내림차순(동률은 이름 순)으로 — 판수가 정렬 기준이다', () => {
    render(Home, { sub: '', params: {} });
    const rows = bodyRows();
    expect(rows.map(nameOf)).toEqual(['Faker', '맹구', '하하', '앙앙맹', '신입']);
    expect(heads()).toEqual(['멤버', '주 라인', '판', '승률', 'KDA', '분당 딜', '킬 관여']);
    expect(head('판').getAttribute('aria-sort')).toBe('descending');
    expect(head('승률').getAttribute('aria-sort')).toBe('none');
    // 문턱(5판) 미만 멤버도 행에 든다
    expect(rows.map(nameOf)).toContain('신입');
  });

  it('셀: 주 라인 띠 · 값 서식 · 승률은 높음 ▲ 채움 / 문턱 미만은 옅게(채움 없음)', () => {
    render(Home, { sub: '', params: {} });
    const rows = bodyRows();
    expect(cellTexts(rows[3]!)).toEqual(['앙앙맹', '탑', '6', '83%', '4.67', '1,296', '48%']);
    expect(rows[3]!.querySelector('td.lane-top')).toBeTruthy();
    expect(rows[3]!.querySelector('td.win.wr-h')?.textContent?.trim()).toBe('83%');
    expect(rows[0]!.querySelector('td.lane-mid')).toBeTruthy();   // Faker 미드, 승률 70% 도 높음
    expect(rows[1]!.querySelector('td.wr-h, td.wr-l')).toBeNull();   // 맹구 50% 는 중립
    // 신입: 2판 0% — 문턱 미만이라 빨갛게 칠하지 않고 옅은 글자
    const low = rows[4]!.querySelector('td.wr-dim');
    expect(low?.textContent?.trim()).toBe('0%');
    expect(rows[4]!.querySelector('td.loss, td.wr-l')).toBeNull();
  });

  it('머리를 누르면 그 열로 정렬한다(DataTable 기본 기능)', async () => {
    render(Home, { sub: '', params: {} });
    await fireEvent.click(head('승률'));
    expect(bodyRows().map(nameOf)).toEqual(['앙앙맹', 'Faker', '맹구', '하하', '신입']);
    expect(head('승률').getAttribute('aria-sort')).toBe('descending');
  });

  it('행 선택 → 수식 줄에 승률 근거, 문턱 미만이면 그 사실도 · 같은 행 다시 선택 → 멤버 화면', async () => {
    render(Home, { sub: '', params: {} });
    expect(fx.text).toBe('');
    const row = bodyRows()[3]!;   // 앙앙맹
    await fireEvent.click(row);
    expect(fx.text).toBe('=승률(승 5 · 패 1) → 83% · 6판 · 탑');
    expect(row.getAttribute('aria-selected')).toBe('true');
    await fireEvent.click(bodyRows()[4]!);   // 신입 2판
    expect(fx.text).toBe('=승률(승 0 · 패 2) → 0% · 2판 · 5판 미만 · 원딜');
    expect(location.hash).toBe('');
    await fireEvent.click(bodyRows()[4]!);
    expect(location.hash).toBe('#/m/%EC%8B%A0%EC%9E%85');
  });

  it('Enter 로도 선택·이동한다', async () => {
    render(Home, { sub: '', params: {} });
    const row = bodyRows()[0]!;
    await fireEvent.keyDown(row, { key: 'Enter' });
    expect(fx.text).toBe('=승률(승 14 · 패 6) → 70% · 20판 · 미드');
    await fireEvent.keyDown(row, { key: 'Enter' });
    expect(location.hash).toBe('#/m/Faker');
  });

  it('안내는 한 줄 — 문턱 미만 승률 표시와 재선택 이동만', () => {
    const { container } = render(Home, { sub: '', params: {} });
    const notes = [...container.querySelectorAll('p.note')].map((p) => p.textContent?.replace(/\s+/g, ' ').trim());
    expect(notes).toEqual(['5판 미만은 승률을 옅게 표시합니다. 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.']);
  });

  it('보기 전환·라인 선택·계산식 링크가 없다', () => {
    const { container } = render(Home, { sub: '', params: {} });
    expect(screen.queryByRole('button', { name: /라인별|통합/ })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('.views, select')).toBeNull();
  });

  it('티어·CP·MMR·배치·점수·사다리 글자가 화면에 없다 — 표·수식 줄·안내·접근성 이름까지', async () => {
    const { container } = render(Home, { sub: '', params: {} });
    await fireEvent.click(bodyRows()[3]!);
    const all = [container.textContent ?? '', fx.text, ...[...container.querySelectorAll('[aria-label],[title]')].map((e) => `${e.getAttribute('aria-label')} ${e.getAttribute('title')}`)].join(' ');
    expect(all).not.toMatch(LADDER_WORDS);
    expect(container.querySelector('[class*="tier"], td.pend, td.unp, tr.unp, td.medal')).toBeNull();
    expect(container.querySelector('td[class*="t1"], td[class*="t2"], td[class*="t3"], td[class*="t4"], td[class*="t5"]')).toBeNull();
  });

  it('폰(≤640px): 보조 열(분당 딜·킬 관여)은 .lo 로 숨고 정렬 기준 열(판)은 남는다 · 순서는 그대로', () => {
    media.phone = true;
    const { container } = render(Home, { sub: '', params: {} });
    expect(bodyRows().map(nameOf)).toEqual(['Faker', '맹구', '하하', '앙앙맹', '신입']);
    const lo = [...table().querySelectorAll('thead th.lo .h')].map((h) => h.textContent);
    expect(lo).toEqual(['분당 딜', '킬 관여']);
    expect(head('판').classList.contains('lo')).toBe(false);
    expect(container.querySelector('.sheet')?.classList.contains('rows2')).toBe(false);
    expect(container.textContent).not.toMatch(LADDER_WORDS);
  });
});
