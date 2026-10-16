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

// 승률 단계(Wilson 95% 구간): Faker 17/20 → 하한 .64(▲▲) · 하하 2/12 → 상한 .45(▼) · 맹구 6/12 → 50% 걸침(무채색)
// · 앙앙맹 5/6(83%) → 하한 .44 라 무채색(점추정이 높아도 구간이 50% 를 못 벗어난다) · 신입 2판 → 문턱 미만 '표본 적음'
const PAYLOAD = {
  name: '테스트 방', patch: '15.18.1', timestamp: '2026-09-17T11:31:54+00:00',
  summary: { total_games: 57, player_count: 5, avg_winrate: 0.5, avg_duration_sec: 1686 },
  min_games: 5, min_games_excluded: 1, min_games_lane: 3, min_days: 1, min_days_excluded: 0,
  players: {
    p1: player('앙앙맹', 6, 5, 'TOP', { record: { games: 6, wins: 5, losses: 1, winrate: 5 / 6, ci_lower: 0, kda: 4.67, kp: 0.484, dpm: 1296 } } as Partial<PlayerPub>),
    p2: player('맹구', 12, 6, 'JUNGLE', { form: { form: '3-2', dir: 'W', winrate: 0.6, streak: 1 } } as Partial<PlayerPub>),
    p3: player('신입', 2, 0, 'BOTTOM'),
    p4: player('Faker', 20, 17, 'MIDDLE', { form: { form: '4-1', dir: 'W', winrate: 0.8, streak: 3 } } as Partial<PlayerPub>),
    p5: player('하하', 12, 2, 'UTILITY', { form: { form: '0-5', dir: 'L', winrate: 0, streak: 5 } } as Partial<PlayerPub>),
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
/** 셀이 읽히는 글자 — 그림 셀(스니펫)은 보조기술 전용 fmt 글자, 그 밖은 셀 글자 */
const said = (td: Element) => (td.querySelector(':scope > .cs') ? td.querySelector(':scope > .sr-only')?.textContent : td.textContent)?.trim();
const cellTexts = (tr: HTMLTableRowElement) => [...tr.querySelectorAll('td:not(.rn)')].map(said);
const nameOf = (tr: HTMLTableRowElement) => tr.querySelector('td.c0')?.textContent?.trim();
const heads = () => [...table().querySelectorAll('thead th[scope="col"] .h')].map((h) => h.textContent);
const head = (label: string) => [...table().querySelectorAll('thead th')].find((h) => h.querySelector('.h')?.textContent === label) as HTMLElement;
/** n 번째(0부터) 데이터 셀 */
const cellOf = (tr: HTMLTableRowElement, i: number) => tr.querySelectorAll('td:not(.rn)')[i] as HTMLElement;
/** 보조기술 전용 글자를 뺀 보이는 글자 */
const visible = (el: Element | null | undefined) => {
  if (!el) return '';
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll('.sr-only').forEach((x) => x.remove());
  return c.textContent?.replace(/\s+/g, ' ').trim() ?? '';
};

describe('Home — 멤버 화면', () => {
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

  it('요약 띠(데스크톱): 타일 네 칸 — 경기·멤버·평균 경기 시간·최근 갱신 · 옛 한 줄 메타는 없다', () => {
    const { container } = render(Home, { sub: '', params: {} });
    const strip = container.querySelector('dl.strip')!;
    expect([...strip.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['경기', '멤버', '평균 경기 시간', '최근 갱신']);
    const dds = [...strip.querySelectorAll('dd')].map((d) => d.textContent);
    expect(dds.slice(0, 3)).toEqual(['57판', '5명', '28:06']);
    expect(dds[3]).toMatch(/^9\/17 \d\d:\d\d$/);
    expect(strip.querySelector('time')?.getAttribute('datetime')).toBe(PAYLOAD.timestamp);
    expect(container.querySelector('.meta')).toBeNull();
  });

  it('요약 띠(폰): 한 줄 글로 접힌다 — 타일 없음', () => {
    media.phone = true;
    const { container } = render(Home, { sub: '', params: {} });
    expect(container.querySelector('dl.strip')).toBeNull();
    expect(visible(container.querySelector('p.line'))).toMatch(/^57판 · 5명 · 평균 28:06 · 갱신 9\/17 \d\d:\d\d$/);
  });

  it('멤버 카드: 카드 제목이 표 이름 · 멤버 전원이 판수 내림차순(동률은 이름 순)', () => {
    render(Home, { sub: '', params: {} });
    const card = screen.getByRole('region', { name: '멤버 · 판수 순' });
    expect(card.contains(table())).toBe(true);
    const rows = bodyRows();
    expect(rows.map(nameOf)).toEqual(['Faker', '맹구', '하하', '앙앙맹', '신입']);
    expect(heads()).toEqual(['멤버', '주 라인', '판', '승률', 'KDA', '분당 딜', '킬 관여', '최근']);
    expect(head('판').getAttribute('aria-sort')).toBe('descending');
    expect(head('승률').getAttribute('aria-sort')).toBe('none');
    expect(head('최근').getAttribute('aria-sort')).toBeNull();   // 연속은 정렬하지 않는다
    // 문턱(5판) 미만 멤버도 행에 든다
    expect(rows.map(nameOf)).toContain('신입');
  });

  it('셀이 읽히는 글자: 라인 이름 · 값 서식 · 승률은 단계 문구와 승패까지 · 최근은 n연승/n연패', () => {
    render(Home, { sub: '', params: {} });
    const rows = bodyRows();
    expect(cellTexts(rows[0]!)).toEqual(['Faker', '미드', '20', '85%, 60% 이상으로 높음, 17승 3패', '3.5', '812', '50%', '3연승']);
    expect(cellTexts(rows[2]!)).toEqual(['하하', '서폿', '12', '17%, 50%보다 낮음, 2승 10패', '3.5', '812', '50%', '5연패 이상']);
    expect(cellTexts(rows[3]!)).toEqual(['앙앙맹', '탑', '6', '83%, 5승 1패', '4.67', '1,296', '48%', '']);
    expect(cellTexts(rows[4]!)[3]).toBe('0%, 표본 적음, 0승 2패');
  });

  it('승률 게이지: Wilson 구간 단계 색·기호 — 점추정이 높아도 구간이 50% 를 걸치면 무채색 · 문턱 미만은 표본 적음', () => {
    render(Home, { sub: '', params: {} });
    const rows = bodyRows();
    const pc = (i: number) => cellOf(rows[i]!, 3).querySelector('.wg .pc')!;
    expect(pc(0).classList.contains('st-up2')).toBe(true);
    expect(pc(0).textContent).toBe('85%▲▲');
    expect(pc(2).classList.contains('st-down')).toBe(true);
    expect(pc(2).textContent).toBe('17%▼');
    expect(pc(3).classList.contains('st-even')).toBe(true);   // 앙앙맹 83% · 6판
    expect(pc(3).textContent).toBe('83%');
    expect(pc(4).classList.contains('st-few')).toBe(true);    // 신입 2판
    expect(cellOf(rows[4]!, 3).querySelector('.wl')?.textContent).toBe('표본 적음');
    expect(cellOf(rows[0]!, 3).querySelector('.wl')?.textContent).toBe('17승 3패');
    // 그림은 보조기술에서 숨고(스니펫 감싸개) 승률 칸에 채움 클래스는 없다
    expect(cellOf(rows[0]!, 3).querySelector('.cs')?.getAttribute('aria-hidden')).toBe('true');
    expect(table().querySelector('td.win, td.loss')).toBeNull();
  });

  it('주 라인은 라인 점 + 이름 · 최근 열은 연승·연패 알약(연속이 없으면 비어 있다)', () => {
    render(Home, { sub: '', params: {} });
    const rows = bodyRows();
    expect(cellOf(rows[0]!, 1).querySelector('.lane.mid')?.textContent).toBe('미드');
    expect(cellOf(rows[3]!, 1).querySelector('.lane.top')?.textContent).toBe('탑');
    const hot = cellOf(rows[0]!, 7).querySelector('.sp')!;
    expect(hot.classList.contains('hot')).toBe(true);
    expect(visible(hot)).toBe('3연승');
    expect(visible(cellOf(rows[2]!, 7).querySelector('.sp.loss'))).toBe('5연패+');
    expect(visible(cellOf(rows[1]!, 7).querySelector('.sp.win'))).toBe('1연승');
    expect(cellOf(rows[3]!, 7).querySelector('.sp')).toBeNull();   // form 없음
  });

  it('머리를 누르면 그 열로 정렬한다(DataTable 기본 기능)', async () => {
    render(Home, { sub: '', params: {} });
    await fireEvent.click(head('승률'));
    expect(bodyRows().map(nameOf)).toEqual(['Faker', '앙앙맹', '맹구', '하하', '신입']);
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
    expect(fx.text).toBe('=승률(승 17 · 패 3) → 85% · 20판 · 미드');
    await fireEvent.keyDown(row, { key: 'Enter' });
    expect(location.hash).toBe('#/m/Faker');
  });

  it('안내는 한 줄 — 문턱 미만 승률 표시와 재선택 이동만', () => {
    const { container } = render(Home, { sub: '', params: {} });
    const notes = [...container.querySelectorAll('p.note')].map((p) => p.textContent?.replace(/\s+/g, ' ').trim());
    expect(notes).toEqual(["5판 미만의 승률은 옅게 '표본 적음'으로 적고, 색과 ▲▼는 판수를 감안해도 50%와 차이가 날 때만 붙습니다. 같은 행을 다시 선택하면 멤버 화면으로 이동합니다."]);
  });

  it('보기 전환·라인 선택·계산식 링크가 없다', () => {
    const { container } = render(Home, { sub: '', params: {} });
    expect(screen.queryByRole('button', { name: /라인별|통합/ })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('.views, select')).toBeNull();
  });

  it('티어·CP·MMR·배치·점수·사다리 글자가 화면에 없다 — 표·요약 띠·수식 줄·안내·접근성 이름까지', async () => {
    const { container } = render(Home, { sub: '', params: {} });
    await fireEvent.click(bodyRows()[3]!);
    const all = [container.textContent ?? '', fx.text, ...[...container.querySelectorAll('[aria-label],[title]')].map((e) => `${e.getAttribute('aria-label')} ${e.getAttribute('title')}`)].join(' ');
    expect(all).not.toMatch(LADDER_WORDS);
    expect(container.querySelector('[class*="tier"], td.pend, td.unp, tr.unp, td.medal')).toBeNull();
    expect(container.querySelector('td[class*="t1"], td[class*="t2"], td[class*="t3"], td[class*="t4"], td[class*="t5"]')).toBeNull();
  });

  it('폰(≤640px): 보조 열(분당 딜·킬 관여·최근)은 .lo 로 숨고 정렬 기준 열(판)은 남는다 · 순서는 그대로', () => {
    media.phone = true;
    const { container } = render(Home, { sub: '', params: {} });
    expect(bodyRows().map(nameOf)).toEqual(['Faker', '맹구', '하하', '앙앙맹', '신입']);
    const lo = [...table().querySelectorAll('thead th.lo .h')].map((h) => h.textContent);
    expect(lo).toEqual(['분당 딜', '킬 관여', '최근']);
    expect(head('판').classList.contains('lo')).toBe(false);
    expect(container.querySelector('.sheet')?.classList.contains('rows2')).toBe(false);
    expect(container.textContent).not.toMatch(LADDER_WORDS);
  });
});
