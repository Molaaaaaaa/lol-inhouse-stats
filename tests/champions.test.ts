import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Champions from '../src/routes/Champions.svelte';
import Meta from '../src/routes/champions/Meta.svelte';
import Matchup from '../src/routes/champions/Matchup.svelte';
import Ban from '../src/routes/champions/Ban.svelte';
import { banRows, champKo, fxPool, matchupRows, metaRows, poolRows, type ChampSource } from '../src/lib/champions';
import { app } from '../src/lib/data/store.svelte';
import { router } from '../src/lib/router.svelte';
import { clearFx, fx } from '../src/lib/fx.svelte';
import type { GuildPayload, PlayerPub } from '../src/lib/data/types';

// 작은 픽스처 — 챔피언 화면은 champion_meta*·champion_matchups·ban_*·champ_ko·fun.champ_pool·players·metric_meta 만 읽는다
const player = (name: string, tag?: string): PlayerPub => ({ name, ...(tag ? { tag } : {}), record: { games: 0 } } as unknown as PlayerPub);

const DATA = {
  champion_meta: [
    { champion_name: 'Sylas', games: 19, winrate: 0.316, kda: 2.37, dpm: 739.1 },
    { champion_name: 'Lucian', games: 16, winrate: 0.625, kda: 2.65, dpm: 995.7 },
    { champion_name: 'KSante', games: 18, winrate: 0.444, kda: 2.15, dpm: 692.5 },
    { champion_name: 'Zaahen', games: 2, winrate: 1, kda: 9, dpm: 1200 },
  ],
  champion_meta_lane: [
    { champion_name: 'KSante', lane: 'TOP', games: 18, winrate: 0.444, kda: 2.15, dpm: 692.5 },
    { champion_name: 'Sylas', lane: 'TOP', games: 5, winrate: 0.6, kda: 3.1, dpm: 700 },
    { champion_name: 'Sylas', lane: 'MIDDLE', games: 14, winrate: 0.214, kda: 2.1, dpm: 750 },
    { champion_name: 'Lucian', lane: 'BOTTOM', games: 16, winrate: 0.625, kda: 2.65, dpm: 995.7 },
  ],
  champion_matchups: [
    { lane: 'BOTTOM', champ: 'Kaisa', vs_champ: 'Jhin', games: 4, winrate: 0.75 },
    { lane: 'JUNGLE', champ: 'RekSai', vs_champ: 'XinZhao', games: 4, winrate: 1 },
    { lane: 'MIDDLE', champ: 'Sylas', vs_champ: 'Ahri', games: 6, winrate: 0.333 },
  ],
  ban_meta: [
    { champion_id: 84, champion_name: 'Akali', champion_kr: '아칼리', bans: 28 },
    { champion_id: 893, champion_name: 'Aurora', champion_kr: '오로라', bans: 24 },
    { champion_id: 999, champion_name: 'Newbie', champion_kr: '신참', bans: 30 },
  ],
  ban_available: true,
  champ_ko: { Sylas: '사일러스', Lucian: '루시안', KSante: '크산테', Kaisa: '카이사', Jhin: '진', Akali: '아칼리', Aurora: '오로라', Ahri: '아리' },
  fun: {
    champ_pool: [
      { discord_name: '앙앙맹', lane: 'TOP', games: 6, champs: 6, variety: 1 },
      { discord_name: '맹구', lane: 'JUNGLE', games: 12, champs: 3, variety: 0.25 },
      { discord_name: '앙앙맹', lane: 'MIDDLE', games: 3, champs: 2, variety: 0.667 },
      { discord_name: '지수', lane: 'TOP', games: 6, champs: 4, variety: 0.667 },
    ],
  },
  players: { p1: player('앙앙맹'), p2: player('맹구'), p3: player('지수', '2'), p4: player('지수', '3') },
  metric_meta: {
    winrate: { label: '승률', lane: false, fmt: 'pct', desc: '' },
    kda: { label: 'KDA', lane: false, fmt: '', desc: '' },
    dpm: { label: '분당 딜', lane: false, fmt: '', desc: '' },
  },
  min_games: 5, min_games_lane: 3, patch: '16.18.1',
} as unknown as GuildPayload;

describe('champions — 순수 함수', () => {
  it('metaRows: 라인이 없으면 전체(판수 내림차순), 라인이면 그 라인 행만·키에 라인·한글 이름', () => {
    const all = metaRows(DATA, '');
    expect(all.map((r) => [r.key, r.name, r.games, r.lane])).toEqual([
      ['Sylas', '사일러스', 19, null], ['KSante', '크산테', 18, null], ['Lucian', '루시안', 16, null], ['Zaahen', 'Zaahen', 2, null],
    ]);
    const top = metaRows(DATA, 'TOP');
    expect(top.map((r) => [r.key, r.name, r.games, r.lane, r.laneOrd])).toEqual([
      ['KSante:TOP', '크산테', 18, 'TOP', 0], ['Sylas:TOP', '사일러스', 5, 'TOP', 0],
    ]);
    // 모르는 라인 문자열은 전체로
    expect(metaRows(DATA, 'nope').length).toBe(4);
    expect(metaRows(null, 'TOP')).toEqual([]);
  });

  it('poolRows: 멤버×라인, 판수 내림차순(같으면 라인 순·이름순), 라인 거르기, 동명이인은 표시명을 못 정하면 이름 그대로', () => {
    const rows = poolRows(DATA.fun, null, DATA.players);
    expect(rows.map((r) => [r.key, r.games, r.champs])).toEqual([
      ['맹구:JUNGLE', 12, 3], ['앙앙맹:TOP', 6, 6], ['지수:TOP', 6, 4], ['앙앙맹:MIDDLE', 3, 2],
    ]);
    expect(poolRows(DATA.fun, 'TOP').map((r) => r.name)).toEqual(['앙앙맹', '지수']);
    // 같은 이름이 하나뿐이고 tag 가 있으면 표시명(이름~순번)
    const one = poolRows({ champ_pool: [{ discord_name: '지수', lane: 'TOP', games: 1, champs: 1, variety: 1 }] }, null, { p3: player('지수', '2') });
    expect(one[0]!.name).toBe('지수~2');
    expect(poolRows(null)).toEqual([]);
  });

  it('fxPool: 수식 줄 근거 = 종 ÷ 판', () => {
    expect(fxPool({ name: '앙앙맹', lane: 'TOP', champs: 6, games: 6, variety: 1 })).toBe('=챔피언 폭(앙앙맹 · 탑) 6종 ÷ 6판 = 100%');
    expect(fxPool({ name: '맹구', lane: 'JUNGLE', champs: 3, games: 12, variety: 0.25 })).toBe('=챔피언 폭(맹구 · 정글) 3종 ÷ 12판 = 25%');
  });

  it('matchupRows: 판수 내림차순, 같으면 승률 내림차순·라인 순, 양쪽 한글 이름', () => {
    const rows = matchupRows(DATA);
    expect(rows.map((r) => [r.key, r.name, r.vsName, r.games])).toEqual([
      ['MIDDLE:Sylas:Ahri', '사일러스', '아리', 6],
      ['JUNGLE:RekSai:XinZhao', 'RekSai', 'XinZhao', 4],
      ['BOTTOM:Kaisa:Jhin', '카이사', '진', 4],
    ]);
    expect(matchupRows(null)).toEqual([]);
  });

  it('banRows: ban_available 이 거짓이면 빈 목록, 참이면 밴 수 내림차순·이름은 champ_ko → champion_kr → id', () => {
    expect(banRows({ ...DATA, ban_available: false } as ChampSource)).toEqual([]);
    expect(banRows(DATA).map((r) => [r.name, r.bans])).toEqual([['신참', 30], ['아칼리', 28], ['오로라', 24]]);
    expect(champKo(DATA, 'Sylas')).toBe('사일러스');
    expect(champKo(DATA, 'Nope')).toBe('Nope');
    expect(champKo(DATA, null)).toBe('');
  });
});

const tableOf = (name: RegExp | string) => screen.getByRole('table', { name });
const bodyRows = (t: HTMLElement) => [...t.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
const cellTexts = (tr: HTMLTableRowElement) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());
const heads = (t: HTMLElement) => [...t.querySelectorAll('thead th[scope="col"] .h')].map((h) => h.textContent);

describe('Meta — 챔피언 메타 + 챔피언 폭', () => {
  beforeEach(() => { cleanup(); location.hash = ''; clearFx(); app.data = DATA; app.status = 'ready'; router.start(); });
  afterEach(() => { router.stop(); });

  it('전체: 라인 링크 줄(현재 = 전체, 라인마다 챔피언 수) · 메타 표(판수순·초상·승률 채움) · 챔피언 폭 표', () => {
    render(Meta, { data: DATA, lane: '', minGames: 5 });
    const nav = screen.getByRole('navigation', { name: '라인 선택' });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((a) => a.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['전체', '탑 2', '정글 0', '미드 1', '원딜 1', '서폿 0']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '#/champions/meta', '#/champions/meta/TOP', '#/champions/meta/JUNGLE', '#/champions/meta/MIDDLE', '#/champions/meta/BOTTOM', '#/champions/meta/UTILITY',
    ]);
    expect(links[0]!.getAttribute('aria-current')).toBe('page');
    expect(links[1]!.getAttribute('aria-current')).toBeNull();

    const t = tableOf('챔피언 메타 · 전체');
    expect(heads(t)).toEqual(['챔피언', '판', '승률', 'KDA', '분당 딜']);
    const rows = bodyRows(t);
    expect(rows.map(cellTexts)).toEqual([
      ['사일러스', '19', '32%', '2.37', '739.1'], ['크산테', '18', '44%', '2.15', '692.5'],
      ['루시안', '16', '63%', '2.65', '995.7'], ['Zaahen', '2', '100%', '9', '1,200'],
    ]);
    expect(rows[0]!.querySelector('td.c0 img.champ')?.getAttribute('src')).toBe('https://ddragon.leagueoflegends.com/cdn/16.18.1/img/champion/Sylas.png');
    // 승률 채움: 32% 는 loss, 63% 는 win, 2판 100% 는 문턱 미만이라 채움 없음
    expect(rows[0]!.querySelector('td.loss')?.textContent?.trim()).toBe('32%');
    expect(rows[2]!.querySelector('td.win')?.textContent?.trim()).toBe('63%');
    expect(rows[3]!.querySelector('td.win, td.loss')).toBeNull();
    expect(rows[0]!.querySelector('td.bar')?.textContent?.trim()).toBe('19');

    const pool = tableOf('챔피언 폭 · 전체');
    expect(heads(pool)).toEqual(['멤버', '라인', '판', '챔피언', '챔피언 폭']);
    expect(bodyRows(pool).map(cellTexts)).toEqual([
      ['맹구', '정글', '12', '3종', '25%'], ['앙앙맹', '탑', '6', '6종', '100%'], ['지수', '탑', '6', '4종', '67%'], ['앙앙맹', '미드', '3', '2종', '67%'],
    ]);
    expect(bodyRows(pool)[1]!.querySelector('td.lane-top')?.textContent?.trim()).toBe('탑');
    expect(screen.getByRole('button', { name: '챔피언 폭 설명' })).toBeTruthy();
  });

  it('라인 하나: 두 표가 그 라인만 · 라인 열이 붙는다 · 현재 링크', () => {
    render(Meta, { data: DATA, lane: 'TOP', minGames: 5 });
    const t = tableOf('챔피언 메타 · 탑');
    expect(heads(t)).toEqual(['챔피언', '라인', '판', '승률', 'KDA', '분당 딜']);
    expect(bodyRows(t).map(cellTexts)).toEqual([['크산테', '탑', '18', '44%', '2.15', '692.5'], ['사일러스', '탑', '5', '60%', '3.1', '700']]);
    expect(bodyRows(t)[0]!.querySelector('td.lane-top')).toBeTruthy();
    expect(bodyRows(tableOf('챔피언 폭 · 탑')).map((r) => cellTexts(r)[0])).toEqual(['앙앙맹', '지수']);
    const nav = screen.getByRole('navigation', { name: '라인 선택' });
    expect(nav.querySelector('a[aria-current="page"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('탑 2');
  });

  it('챔피언 폭 행 선택 → 수식 줄, 같은 행 다시 → 멤버 화면(Enter 도) · 메타 표는 선택 없음', async () => {
    render(Meta, { data: DATA, lane: '', minGames: 5 });
    expect(fx.text).toBe('');
    const rows = bodyRows(tableOf('챔피언 폭 · 전체'));
    await fireEvent.click(rows[1]!);   // 앙앙맹 탑
    expect(fx.text).toBe('=챔피언 폭(앙앙맹 · 탑) 6종 ÷ 6판 = 100%');
    expect(rows[1]!.getAttribute('aria-selected')).toBe('true');
    await fireEvent.click(rows[0]!);
    expect(fx.text).toBe('=챔피언 폭(맹구 · 정글) 3종 ÷ 12판 = 25%');
    await fireEvent.keyDown(rows[0]!, { key: 'Enter' });
    expect(location.hash).toBe('#/m/%EB%A7%B9%EA%B5%AC');
    // 메타 표 행은 선택 대상이 아니다
    expect(bodyRows(tableOf('챔피언 메타 · 전체'))[0]!.getAttribute('aria-selected')).toBeNull();
  });
});

describe('Matchup · Ban', () => {
  beforeEach(() => { cleanup(); app.data = DATA; app.status = 'ready'; });

  it('매치업: 양쪽 초상·한글 이름·라인 띠·판수 내림차순·승률 채움', () => {
    render(Matchup, { data: DATA });
    const t = tableOf('라인 매치업');
    expect(heads(t)).toEqual(['챔피언', '상대 챔피언', '라인', '판', '승률']);
    const rows = bodyRows(t);
    expect(rows.map(cellTexts)).toEqual([
      ['사일러스', '아리', '미드', '6', '33%'], ['RekSai', 'XinZhao', '정글', '4', '100%'], ['카이사', '진', '원딜', '4', '75%'],
    ]);
    expect(rows[0]!.querySelectorAll('img.champ').length).toBe(2);
    expect(rows[0]!.querySelector('td.lane-mid')).toBeTruthy();
    expect(rows[0]!.querySelector('td.loss')?.textContent?.trim()).toBe('33%');
    // 4판은 문턱(5) 미만 — 100% 라도 채움 없음
    expect(rows[1]!.querySelector('td.win')).toBeNull();
  });

  it('밴: 표(밴 수 내림차순·초상) / ban_available 거짓이면 빈 상태 문장', () => {
    render(Ban, { data: DATA });
    const rows = bodyRows(tableOf('밴'));
    expect(rows.map(cellTexts)).toEqual([['신참', '30'], ['아칼리', '28'], ['오로라', '24']]);
    expect(rows[1]!.querySelector('img.champ')?.getAttribute('src')).toContain('/Akali.png');
    cleanup();
    const { container } = render(Ban, { data: { ...DATA, ban_available: false } as GuildPayload });
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('.empty')?.textContent).toBe('이 서버의 기록 방식에는 밴 정보가 없습니다.');
  });
});

describe('Champions — 하위 화면', () => {
  beforeEach(() => { cleanup(); location.hash = ''; clearFx(); app.data = DATA; app.status = 'ready'; router.start(); });
  afterEach(() => { router.stop(); });

  it("sub 'matchup'·'ban' 은 그 탭, 'pool'·모르는 값·빈 값은 메타", () => {
    render(Champions, { sub: 'matchup', params: {} });
    expect(screen.getByRole('tab', { name: '매치업', selected: true })).toBeTruthy();
    expect(screen.getByRole('tabpanel').id).toBe('ch-panel-matchup');
    expect(tableOf('라인 매치업')).toBeTruthy();
    cleanup();
    render(Champions, { sub: 'ban', params: {} });
    expect(screen.getByRole('tab', { name: '밴', selected: true })).toBeTruthy();
    expect(tableOf('밴')).toBeTruthy();
    cleanup();
    render(Champions, { sub: 'pool', params: {} });
    expect(screen.getByRole('tab', { name: '메타', selected: true })).toBeTruthy();
    expect(screen.getByRole('tabpanel').id).toBe('ch-panel-meta');
    expect(tableOf('챔피언 메타 · 전체')).toBeTruthy();
    expect(tableOf('챔피언 폭 · 전체')).toBeTruthy();
    cleanup();
    render(Champions, { sub: 'meta', params: { lane: 'MIDDLE' } });
    expect(tableOf('챔피언 메타 · 미드')).toBeTruthy();
  });

  it('탭을 누르면 라우트가 바뀐다(#/champions/ban) · 탭 셋이 ch- 접두로 패널과 연결된다', async () => {
    render(Champions, { sub: 'meta', params: {} });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.id)).toEqual(['ch-tab-meta', 'ch-tab-matchup', 'ch-tab-ban']);
    expect(tabs.map((t) => t.getAttribute('aria-controls'))).toEqual(['ch-panel-meta', 'ch-panel-matchup', 'ch-panel-ban']);
    screen.getByRole('tab', { name: '밴' }).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(location.hash).toBe('#/champions/ban');
  });

  it('데이터가 없으면 스켈레톤', () => {
    app.data = null;
    const { container } = render(Champions, { sub: 'meta', params: {} });
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
  });
});
