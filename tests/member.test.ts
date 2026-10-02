import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
  axisLaneFor, axisLanes, axisRows, deltaText, formText, fxMember,
  h2hFor, headerStats, laneCls, laneRows, mainLaneOf, playerByName, wrCls,
} from '../src/lib/member';
import { META, PAYLOAD } from './fixtures/member-payload';
import { isSubId, SUBTABS } from '../src/routes/Member.svelte';
import { app } from '../src/lib/data/store.svelte';
import { router } from '../src/lib/router.svelte';
import { fx } from '../src/lib/fx.svelte';
import Member from '../src/routes/Member.svelte';

/** 화면에 나오면 안 되는 사다리 말 — 티어(n티어)·MMR·CP·배치·점수 */
const LADDER_WORD = /[1-5]티어|티어|MMR|CP|ΔCP|배치|승급|사다리|검산/;
const P1 = PAYLOAD.players.p1!;

describe('member.ts — 머리 전적 셀', () => {
  it('headerStats: 지표 이름은 metric_meta 에서, 판·승·패 한 셀, 최근 폼', () => {
    const s = headerStats(P1, META);
    expect(s.map((x) => x.k)).toEqual(['record', 'winrate', 'kda', 'kp', 'dpm', 'form']);
    expect(s[0]!.text).toBe('29판 13승 16패');
    expect(s[1]).toMatchObject({ label: '승률', text: '45%' });
    expect(s[2]).toMatchObject({ label: 'KDA', text: '2.98' });
    expect(s[3]).toMatchObject({ label: '킬 관여', text: '56%' });
    expect(s[4]).toMatchObject({ label: '분당 딜', text: '836' });
    expect(s[5]).toMatchObject({ label: '최근', text: '3-2 · 2연승' });
  });
  it('formText: 연속이 없으면 폼만, 폼이 없으면 빈 문자열', () => {
    expect(formText({ form: '2-3', dir: 'L', winrate: 0.4, streak: 0 })).toBe('2-3');
    expect(formText({ form: '1-2', dir: 'L', winrate: 0.3, streak: 2 })).toBe('1-2 · 2연패');
    expect(formText(null)).toBe('');
  });
});

describe('member.ts — 라인별 성적 표', () => {
  it('laneRows: 출전 0판 라인은 빠지고 판수 내림차순 · 지표만 있고 사다리 필드가 없다', () => {
    const rows = laneRows({ lanes: [...P1.lanes, { lane: 'TOP', games: 0, winrate: 0, kda: 0, dpm: 0, kp: 0, cs: 0, vision: 0, dmg_share: 0 }] });
    expect(rows.map((r) => r.lane)).toEqual(['BOTTOM', 'JUNGLE', 'MIDDLE']);
    expect(rows[0]).toEqual({ lane: 'BOTTOM', games: 19, winrate: 0.368, kda: 2.99, dpm: 883.1, kp: 0.554 });
    expect(JSON.stringify(rows)).not.toMatch(/mmr|dev|placed|placement|tier/);
  });
  it('laneRows: 판수가 같으면 탑→서폿 순서 · 없는 멤버는 빈 표', () => {
    const mk = (lane: 'BOTTOM' | 'TOP') => ({ lane, games: 3, winrate: 0.5, kda: 1, dpm: 1, kp: 1, cs: 1, vision: 1, dmg_share: 1 });
    expect(laneRows({ lanes: [mk('BOTTOM'), mk('TOP')] }).map((r) => r.lane)).toEqual(['TOP', 'BOTTOM']);
    expect(laneRows(null)).toEqual([]);
  });
  it('mainLaneOf: 가장 많이 뛴 라인 · 동률은 탑→서폿에서 앞선 쪽 · 뛴 판이 없으면 빈 문자열', () => {
    expect(mainLaneOf(P1)).toBe('BOTTOM');
    expect(mainLaneOf({ role_dist: [{ lane: 'BOTTOM', games: 3, pct: 0.5 }, { lane: 'JUNGLE', games: 3, pct: 0.5 }] })).toBe('JUNGLE');
    expect(mainLaneOf({ role_dist: [] })).toBe('');
    expect(mainLaneOf(null)).toBe('');
  });
  it('laneCls·wrCls: 셀 클래스는 DataTable 이 아는 이름만', () => {
    expect(laneCls('TOP')).toBe('lane-top');
    expect(laneCls('UTILITY')).toBe('lane-sup');
    expect(laneCls('??')).toBe('');
    expect(wrCls(0.7, 10, 5)).toBe('win wr-h');   // 채움 + ▲ 기호 클래스
    expect(wrCls(0.3, 10, 5)).toBe('loss wr-l');
    expect(wrCls(0.3, 2, 5)).toBe('');    // 문턱 미만은 색으로 단정하지 않는다
    expect(wrCls(0.5, 10, 5)).toBe('');
  });
});

describe('member.ts — 능력치 축', () => {
  it('axisLanes 는 화면 순서, axisLaneFor 는 고른 것 > 주 라인 > 전체', () => {
    expect(axisLanes(P1)).toEqual(['JUNGLE', 'BOTTOM']);
    const lanes = axisLanes(P1);
    expect(axisLaneFor(null, lanes, 'BOTTOM')).toBe('BOTTOM');
    expect(axisLaneFor(null, lanes, 'TOP')).toBe('');
    expect(axisLaneFor('', lanes, 'BOTTOM')).toBe('');
    expect(axisLaneFor('JUNGLE', lanes, 'BOTTOM')).toBe('JUNGLE');
    expect(axisLaneFor('TOP', lanes, 'BOTTOM')).toBe('BOTTOM');
  });
  it('axisRows: 라인 축이 있으면 그것, 없으면 통합', () => {
    expect(axisRows(P1, 'JUNGLE')).toHaveLength(4);
    expect(axisRows(P1, '')).toHaveLength(6);
    expect(axisRows(P1, 'TOP')).toHaveLength(6);
  });
  it('deltaText: ▲▼ 두 자리, 없으면 빈 문자열', () => {
    expect(deltaText(0.48)).toBe('▲0.48');
    expect(deltaText(-0.371)).toBe('▼0.37');
    expect(deltaText(null)).toBe('');
  });
});

describe('member.ts — 수식 줄·맞대결', () => {
  it('fxMember: 승·패와 승률·판수만 — 사다리 말이 없다', () => {
    const f = fxMember(P1.record, META);
    expect(f).toBe('=승률(승 13 · 패 16) → 45% · 29판');
    expect(f).not.toMatch(LADDER_WORD);
  });
  it('h2hFor: 키가 뒤집혀 있으면 승패·챔피언을 바꿔 읽는다', () => {
    const h = h2hFor(PAYLOAD.h2h, 'p1', 'p3');
    expect(h).toMatchObject({ vs: 4, aWins: 1, bWins: 3, withGames: 2, withWins: 2, withWinrate: 1 });
    expect(h.lanes[0]).toMatchObject({ lane: 'MIDDLE', aChamp: 'Zed', bChamp: 'Ahri', aWin: false, winner: 'b' });
    expect(h.lanes[1]).toMatchObject({ lane: 'BOTTOM', aChamp: 'Leona', bChamp: 'Kaisa', aWin: true, winner: 'a' });
    const d = h2hFor(PAYLOAD.h2h, 'p3', 'p1');
    expect(d).toMatchObject({ aWins: 3, bWins: 1 });
    expect(d.lanes[0]).toMatchObject({ aChamp: 'Ahri', bChamp: 'Zed', aWin: true });
    expect(h2hFor(PAYLOAD.h2h, 'p1', 'p2')).toMatchObject({ vs: 0, aWins: 0, bWins: 0, lanes: [] });
  });
  it('playerByName: 표시명으로 찾는다', () => {
    expect(playerByName(PAYLOAD.players, 'Faker')?.key).toBe('p3');
    expect(playerByName(PAYLOAD.players, '없는이름')).toBeNull();
  });
});

describe('Member.svelte', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    app.data = PAYLOAD;
    app.status = 'ready';
    router.start();
    fx.text = '';
  });
  afterEach(() => { router.stop(); });

  it('없는 멤버 → 빈 상태 한 문장', () => {
    render(Member, { sub: '', params: { name: '없는이름' } });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('없는이름');
    expect(screen.getByText(/해당 멤버가 없습니다/)).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('머리: 이름 · 주 라인(뛴 판 기준) · 전적 셀 · 하위 탭 5개 · 수식 줄 — 티어·MMR·배치 없음', async () => {
    const { container } = render(Member, { sub: '', params: { name: '앙앙맹' } });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('앙앙맹');
    expect(container.querySelector('.tierbadge')).toBeNull();
    expect(container.querySelector('.lane')?.textContent).toBe('원딜');   // payload 의 cp.main_lane(정글)이 아니라 role_dist
    const dts = [...container.querySelectorAll('.cells dt')].map((d) => d.textContent);
    expect(dts).toEqual(['전적', '승률', 'KDA', '킬 관여', '분당 딜', '최근']);
    expect(container.querySelector('.cells .wr')?.textContent).toBe('45%');
    expect(screen.getByText('계정 2개 합산')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['요약', '상대별 전적', '최근 경기', '파트너 · 상대 챔피언', '세부 지표']);
    expect(fx.text).toBe('=승률(승 13 · 패 16) → 45% · 29판');
    expect(document.title).toBe('앙앙맹 · 내전 해체 분석기');
    // 요약 탭 청크가 오면 라인별 성적 표가 그려진다
    const lanes = await screen.findByRole('table', { name: '라인별 성적' });
    expect([...lanes.querySelectorAll('thead th')].map((h) => h.textContent?.trim()).filter(Boolean)).toEqual(['라인', '판', '승률', 'KDA', '분당 딜', '킬 관여']);
    expect(screen.getByRole('table', { name: '챔피언' })).toBeTruthy();
    expect(screen.getByText('라인별 승률은 3판 이상부터 색을 입힙니다.')).toBeTruthy();
    // payload 에는 사다리 필드가 실려 있지만 화면 어디에도 사다리 말이 없다
    expect(container.textContent).not.toMatch(LADDER_WORD);
    expect(fx.text).not.toMatch(LADDER_WORD);
  });

  it('5판 미만 멤버도 머리에 배치 표시가 없다', () => {
    const { container } = render(Member, { sub: '', params: { name: '맹구' } });
    expect(container.querySelector('.placing')).toBeNull();
    expect(container.querySelector('.head')?.textContent).not.toMatch(LADDER_WORD);
    expect(fx.text).toBe('=승률(승 1 · 패 2) → 33% · 3판');
  });

  it('하위 탭 목록에 MMR 검산이 없고, 옛 탭 id(mmr)는 탭으로 인정하지 않는다', () => {
    expect(SUBTABS.map((t) => t.id)).toEqual(['summary', 'vs', 'recent', 'partners', 'metrics']);
    expect(isSubId('mmr')).toBe(false);
    expect(isSubId('summary')).toBe(true);
  });

  it('비교 칸: 버튼 → 콤보 → Enter 로 #/m/이름/vs/상대', async () => {
    render(Member, { sub: '', params: { name: '앙앙맹' } });
    const btn = screen.getByRole('button', { name: '비교' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const inp = screen.getByRole('combobox', { name: '비교할 멤버' }) as HTMLInputElement;
    await fireEvent.focus(inp);
    await fireEvent.input(inp, { target: { value: 'f' } });
    expect(screen.getAllByRole('option').map((o) => o.querySelector('.name')?.textContent)).toEqual(['Faker']);
    await fireEvent.keyDown(inp, { key: 'Enter' });
    expect(decodeURIComponent(location.hash)).toBe('#/m/앙앙맹/vs/Faker');
  });

  it('비교 화면: 두 이름 나란히 · 맞대결 스코어(뒤집힌 키) · 전적 비교표', async () => {
    render(Member, { sub: 'compare', params: { name: '앙앙맹', b: 'Faker' } });
    expect(screen.queryByRole('tablist')).toBeNull();
    const heads = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(heads).toEqual(['앙앙맹', 'Faker']);
    expect(screen.getByText('1 : 3')).toBeTruthy();
    expect(screen.getByText('맞대결 4판')).toBeTruthy();
    const cmp = screen.getByRole('table', { name: '전적 비교' });
    expect([...cmp.querySelectorAll('tbody tr')].map((r) => r.querySelector('td')?.textContent?.trim())).toEqual(['판', '승률', 'KDA', '킬 관여', '분당 딜']);
    expect(document.body.textContent).not.toMatch(LADDER_WORD);
    const vs = screen.getByRole('table', { name: '맞대결 · 4판' });
    const firstRow = [...vs.querySelectorAll('tbody tr')][0]!;
    expect(firstRow.textContent).toContain('제드');
    expect(firstRow.textContent).toContain('아리');
    expect(firstRow.textContent).toContain('Faker');
  });
});
