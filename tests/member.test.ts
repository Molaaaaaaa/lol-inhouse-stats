import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import {
  axisLaneFor, axisLanes, axisRows, deltaText, formText, fxMember, fxReplayRow, fxReplaySum,
  h2hFor, headerStats, laneCls, laneRows, playerByName, replayCheck, replayRows, wrCls,
} from '../src/lib/member';
import { CP_P1, META, PAYLOAD, REPLAY } from './fixtures/member-payload';
import { app } from '../src/lib/data/store.svelte';
import { router } from '../src/lib/router.svelte';
import { fx } from '../src/lib/fx.svelte';
import Member from '../src/routes/Member.svelte';

const TIER_WORD = /[1-5]티어/;
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

describe('member.ts — 라인별 표', () => {
  it('laneRows: 출전 0판 라인은 빠지고, 배치 미완은 뒤로 가며 "배치 n/3" 문구·티어 없음', () => {
    const rows = laneRows(PAYLOAD, 'p1');
    expect(rows.map((r) => r.lane)).toEqual(['BOTTOM', 'JUNGLE', 'MIDDLE']);
    expect(rows[0]).toMatchObject({ games: 19, mmr: 1041, dev: 9, placed: true, placement: '완료', winrate: 0.368, kda: 2.99 });
    expect(rows[2]).toMatchObject({ games: 2, placed: false, placement: '배치 2/3' });
    expect(JSON.stringify(rows)).not.toMatch(TIER_WORD);
  });
  it('laneRows: 모르는 키는 빈 표', () => {
    expect(laneRows(PAYLOAD, 'p99')).toEqual([]);
  });
  it('laneCls·wrCls: 셀 클래스는 DataTable 이 아는 이름만', () => {
    expect(laneCls('TOP')).toBe('lane-top');
    expect(laneCls('UTILITY')).toBe('lane-sup');
    expect(laneCls('??')).toBe('');
    expect(wrCls(0.7, 10, 5)).toBe('win');
    expect(wrCls(0.3, 10, 5)).toBe('loss');
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

describe('member.ts — MMR 검산', () => {
  it('replayRows: 1..n 번호와 승패 글자', () => {
    const rows = replayRows(CP_P1);
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.res)).toEqual(['패', '승', '승']);
  });
  it('replayCheck: base + Σd_mmr 이 표시 MMR 과 맞으면 ok', () => {
    const c = replayCheck(CP_P1, 1000);
    expect(c.sum).toBeCloseTo(32.097, 3);
    expect(c.total).toBeCloseTo(1032.097, 3);
    expect(c.shown).toBe(1032);
    expect(c.ok).toBe(true);
    expect(replayCheck(CP_P1, 1000, 'd_cp').ok).toBe(true);
  });
  it('replayCheck: 표시 MMR 이 합계와 어긋나면 ok=false', () => {
    const c = replayCheck({ ...CP_P1, mmr: 1040 }, 1000);
    expect(c.ok).toBe(false);
    expect(replayCheck(null, 1000)).toMatchObject({ sum: 0, total: 1000, shown: 0, ok: false });
  });
  it('fxReplayRow · fxReplaySum 문구', () => {
    expect(fxReplayRow(REPLAY[0]!)).toBe('=64 × ((0 − 0.467) + 0.019) = −28.70');
    expect(fxReplaySum(replayCheck(CP_P1, 1000), 1000)).toBe('=SUM(ΔMMR) 1000 + 32.10 = 1032.10 → 1032');
    expect(fxReplaySum({ sum: -48.8, total: 951.2, shown: 951, ok: true }, 1000)).toBe('=SUM(ΔMMR) 1000 − 48.80 = 951.20 → 951');
  });
});

describe('member.ts — 수식 줄·맞대결', () => {
  it('fxMember: 배치 후에는 티어·점수, 배치 전에는 "배치 n/5" 만(티어 이름 없음)', () => {
    expect(fxMember(CP_P1, 5)).toBe('=티어(CP 1020) → 2티어 20점 · MMR 1032 · 29판');
    const f = fxMember(PAYLOAD.cp.p2, 5);
    expect(f).toBe('=티어(CP 1005) → 배치 3/5 · MMR 1010 · 3판');
    expect(f).not.toMatch(TIER_WORD);
    expect(fxMember(null, 5)).toBe('');
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

  it('머리: 이름·티어 셀·주 라인·전적 셀 · 하위 탭 6개 · 수식 줄', async () => {
    const { container } = render(Member, { sub: '', params: { name: '앙앙맹' } });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('앙앙맹');
    expect(container.querySelector('.tierbadge')?.textContent).toBe('2티어');
    expect(container.querySelector('.lane')?.textContent).toBe('원딜');
    const dts = [...container.querySelectorAll('.cells dt')].map((d) => d.textContent);
    expect(dts).toEqual(['전적', '승률', 'KDA', '킬 관여', '분당 딜', '최근']);
    expect(container.querySelector('.cells .wr')?.textContent).toBe('45%');
    expect(screen.getByText('계정 2개 합산')).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['요약', '상대별 전적', '최근 경기', '파트너 · 상대 챔피언', '세부 지표', 'MMR 검산']);
    expect(fx.text).toBe('=티어(CP 1020) → 2티어 20점 · MMR 1032 · 29판');
    expect(document.title).toBe('앙앙맹 · 내전 해체 분석기');
    // 요약 탭 청크가 오면 라인별 표가 그려진다
    await screen.findByRole('table', { name: '라인별 MMR' });
    expect(screen.getByRole('table', { name: '챔피언' })).toBeTruthy();
  });

  it('배치 전 멤버는 티어 이름이 어디에도 없다', () => {
    const { container } = render(Member, { sub: '', params: { name: '맹구' } });
    expect(container.querySelector('.placing')?.textContent).toBe('배치 3/5');
    expect(container.querySelector('.head')?.textContent).not.toMatch(TIER_WORD);
    expect(fx.text).not.toMatch(TIER_WORD);
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
    expect(screen.getByRole('table', { name: '전적 비교' })).toBeTruthy();
    const vs = screen.getByRole('table', { name: '맞대결 · 4판' });
    const firstRow = [...vs.querySelectorAll('tbody tr')][0]!;
    expect(firstRow.textContent).toContain('제드');
    expect(firstRow.textContent).toContain('아리');
    expect(firstRow.textContent).toContain('Faker');
  });
});
