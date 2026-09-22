import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
  axisTop, buildRows, extraRows, fxKda, gapText, goldSeries, goldStep, goldSummary, goldTick, itemImgUrl, kdaCounts, kdaMarks,
  killDots, matchRows, MATCH_PAGE, niceStep, scoreboardRows, teamLabel, teamTotals, trendRows, wrCellCls, wrWithGames,
} from '../src/lib/matches';
import { app } from '../src/lib/data/store.svelte';
import { router } from '../src/lib/router.svelte';
import { clearFx, fx } from '../src/lib/fx.svelte';
import type { LazyFiles } from '../src/lib/data/loader';
import type { GuildPayload, RecentMatch } from '../src/lib/data/types';
import List from '../src/routes/matches/List.svelte';
import Detail from '../src/routes/matches/Detail.svelte';
import Trend from '../src/routes/matches/Trend.svelte';
import Matches from '../src/routes/Matches.svelte';
import { CHAMP_KO, DETAIL, FUN, PAYLOAD, RECENT } from './fixtures/match-payload';

// ── 순수 함수 ──────────────────────────────────────────────────────────

describe('matchRows — 최근 경기 행', () => {
  it('시각 내림차순, 이긴 팀이 먼저, 팀 안은 라인 순, 챔피언 한글·툴팁', () => {
    const rows = matchRows(RECENT, CHAMP_KO);
    expect(rows.map((r) => r.slug)).toEqual(['mnew', 'mold', 'mnodet']);
    const old = rows[1]!;
    expect(old.win.map((p) => p.name)).toEqual(['블루탑', '블루정글', '블루미드', '블루원딜', '블루서폿']);
    expect(old.loss.map((p) => p.lane)).toEqual(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']);
    expect(old.win[0]).toMatchObject({ champ: 'Zaahen', champKo: '자헨', band: 'top', tip: '탑 · 블루탑 · 자헨' });
    expect(old.loss[1]!.champKo).toBe('신 짜오');
    expect(old.hasDetail).toBe(true);
    expect(rows[2]!.hasDetail).toBe(false);
    expect(old.time).toMatch(/\d+\. \d+\./);
  });
  it('사전에 없는 챔피언은 id 그대로, 슬러그 없는 항목은 건너뜀', () => {
    const rows = matchRows([{ match_id: '', ts: 1, teams: [] }, { match_id: 'x', ts: 2, teams: [{ win: true, players: [{ name: 'a', champ: 'Nope', lane: 'TOP' }] }] }] as RecentMatch[]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.win[0]!.champKo).toBe('Nope');
    expect(rows[0]!.loss).toEqual([]);
  });
  it('빈 입력 → 빈 배열, MATCH_PAGE 는 50', () => {
    expect(matchRows(null)).toEqual([]);
    expect(MATCH_PAGE).toBe(50);
  });
});

describe('scoreboardRows · teamTotals', () => {
  it('라인 순, 아이템 6칸 + 장신구, 스펠·룬 이름, KDA 글자', () => {
    const rows = scoreboardRows(DETAIL.teams[0], CHAMP_KO);
    expect(rows.map((r) => r.name)).toEqual(['나', '가']);   // 탑 → 미드
    const ahri = rows[1]!;
    expect(ahri).toMatchObject({ key: '100-2', champKo: '아리', laneKo: '미드', laneCls: 'lane-mid', kdaText: '9/4/14', kda: 5.75 });
    expect(ahri.items).toEqual([3748, 3111, 3078, 6333, 2055, 3340]);
    expect(ahri.trinket).toBe(3364);
    expect(ahri.spells).toBe('점멸 · 순간이동');
    expect(ahri.perks).toBe('결의 · 정밀');
    // 아이템이 3개면 6칸으로 채우고 장신구는 없다
    expect(rows[0]!.items).toEqual([1001, 0, 0, 0, 0, 0]);
    expect(rows[0]!.trinket).toBeNull();
    expect(fxKda(ahri)).toBe('=KDA(9+14)/4 = 5.75');
  });
  it('팀 합계 — 오브젝트·밴은 사용 가능할 때만', () => {
    const on = teamTotals(DETAIL.teams, true, true);
    expect(on[0]).toMatchObject({ label: '블루팀', res: '승', kills: 45, gold: 62300, towers: 10, grubs: 3, bans: ['Nocturne', 'Kindred'] });
    expect(on[1]).toMatchObject({ label: '레드팀', res: '패', bans: [] });
    const off = teamTotals(DETAIL.teams, false, false);
    expect(off[0]!.towers).toBeNull();
    expect(off[0]!.bans).toEqual([]);
    expect(teamLabel({ team_id: 200 }, 0)).toBe('레드팀');
    expect(teamLabel({ team_id: 0 }, 1)).toBe('레드팀');
  });
  it('세부 기록 — 0 은 빼고, K·m:ss 서식, 레지스트리 이름 우선', () => {
    const rows = extraRows(DETAIL.teams[0]!.players[0]!.extra, PAYLOAD.metric_meta);
    expect(rows).toEqual([
      { key: 'solo_kills', label: '솔로킬', text: '2' },
      { key: 'dmg_physical', label: '물리 피해', text: '18.5K' },
      { key: 'time_dead', label: '죽어 있던 시간', text: '1:35' },
    ]);
    expect(extraRows(null)).toEqual([]);
  });
  it('아이템 이미지 URL — 패치·id 가 URL 조각 모양일 때만', () => {
    expect(itemImgUrl('16.18.1', 3078)).toBe('https://ddragon.leagueoflegends.com/cdn/16.18.1/img/item/3078.png');
    expect(itemImgUrl('16.18.1', 0)).toBe('');
    expect(itemImgUrl('16.18.1/../x', 3078)).toBe('');
    expect(itemImgUrl(null, 3078)).toBe('');
  });
});

describe('goldSeries — 골드 추이', () => {
  it('세 열 같은 길이, 최대 격차·최종·팀 골드 최대', () => {
    const s = goldSeries(DETAIL.timeline)!;
    expect(s.minutes).toHaveLength(6);
    expect(s.diff).toEqual([0, 25, 362, 779, 456, 1500]);
    expect(s).toMatchObject({ peak: 1500, last: 1500, maxGold: 9000 });
    expect(goldSummary(s)).toBe('최종 블루 +1,500G · 최대 격차 1,500G');
    expect(goldSummary({ last: -320, peak: 900 })).toBe('최종 레드 +320G · 최대 격차 900G');
  });
  it('gold_diff 가 없으면 a − b 로, 점이 2개 미만이면 null', () => {
    const s = goldSeries({ minutes: [0, 1], a_gold: [100, 400], b_gold: [100, 250] })!;
    expect(s.diff).toEqual([0, 150]);
    expect(goldSeries({ minutes: [0] })).toBeNull();
    expect(goldSeries(null)).toBeNull();
  });
  it('눈금 — 격차별 단위, 상한은 눈금 배수, 라벨', () => {
    expect([goldStep(1500), goldStep(5000), goldStep(9000), goldStep(20000)]).toEqual([500, 1000, 2500, 5000]);
    expect(axisTop(1500, 500)).toBe(1500);
    expect(axisTop(1501, 500)).toBe(2000);
    expect(axisTop(0, 500)).toBe(500);
    expect([niceStep(1500, 3), niceStep(4937, 3), niceStep(9000, 4), niceStep(68000, 4), niceStep(0, 4)]).toEqual([500, 2500, 2500, 25000, 500]);
    expect([goldTick(0), goldTick(2500), goldTick(2500, true), goldTick(-500, true), goldTick(10000)]).toEqual(['0', '2.5K', '+2.5K', '−0.5K', '10K']);
  });
});

describe('killDots — 킬 지도', () => {
  it('점 색은 잡은 팀의 결과, a=0 은 처형, 툴팁 문구', () => {
    const dots = killDots(DETAIL.kills, DETAIL.teams);
    expect(dots.map((d) => d.cls)).toEqual(['win', 'loss', 'exec']);
    expect(dots[0]!.label).toBe('5분 · 가 → 라');
    expect(dots[2]!.label).toBe('20분 · 처형(포탑 · 미니언) → 가');
    expect(dots[1]).toMatchObject({ x: 0.2, y: 0.8, killer: '다', victim: '나' });
  });
  it('좌표는 0~1 로 자르고, 모르는 pid 는 ?', () => {
    const dots = killDots([{ a: 9, v: 8, m: 1, x: 1.5, y: -1 }], DETAIL.teams);
    expect(dots[0]).toMatchObject({ x: 1, y: 0, killer: '?', victim: '?', cls: 'exec' });
    expect(killDots(null, null)).toEqual([]);
  });
});

describe('buildRows · kdaMarks', () => {
  it('구매 순서 — 분 오름차순, 되판 것 표시, id 0 제외', () => {
    const rows = buildRows([{ item: 3078, minute: 12 }, { item: 0, minute: 1 }, { item: 1029, minute: 12, sold: true } as { item: number; minute: number }, { item: 1120, minute: 0 }]);
    expect(rows.map((r) => [r.item, r.minute, r.sold])).toEqual([[1120, 0, false], [3078, 12, false], [1029, 12, true]]);
    expect(buildRows(null)).toEqual([]);
  });
  it('K/D/A 표식 — 초→분 라벨, 상대 챔피언 한글, 처형 데스, 겹침 순번', () => {
    const marks = kdaMarks(DETAIL.teams[0]!.players[0]!.kda_events, 1903, CHAMP_KO);
    expect(marks.map((m) => m.kind)).toEqual(['D', 'A', 'K', 'D']);
    expect(marks[0]!.label).toBe('9분 데스 · 레넥톤');
    expect(marks[1]!.label).toBe('9분 어시 · 신 짜오');
    expect(marks[2]!.label).toBe('15분 킬 · 레넥톤');
    expect(marks[3]!.label).toBe('25분 데스 · 처형(포탑 · 미니언)');
    expect(marks[2]!.t).toBeCloseTo(900 / 1903, 5);
    expect(kdaCounts(marks)).toEqual({ K: 1, D: 2, A: 1 });
    const same = kdaMarks([{ s: 100, t: 'A' }, { s: 101, t: 'A' }, { s: 102, t: 'K' }], 600);
    expect(same.map((m) => m.stack)).toEqual([0, 1, 0]);
    expect(kdaMarks(null, 0)).toEqual([]);
  });
});

describe('trendRows — 경향', () => {
  it('진영별 승률은 승/판으로, 멤버별은 양쪽 출전만 차이 순, 시간대는 판수만, 길이는 총 판수 순', () => {
    const t = trendRows(FUN);
    expect(t.sides.map((s) => [s.side, s.games, s.wins, s.losses])).toEqual([['블루', 57, 27, 30], ['레드', 57, 30, 27]]);
    expect(t.sides[0]!.winrate).toBeCloseTo(27 / 57, 6);
    expect(t.players.map((p) => p.name)).toEqual(['차이큼', '양쪽']);
    expect(t.players[0]).toMatchObject({ blueG: 6, blueW: 6, blueWr: 1, redG: 5, redW: 1, redWr: 0.2 });
    expect(t.players[0]!.gap).toBeCloseTo(0.8, 6);
    expect(t.hours.map((h) => [h.hour, h.games])).toEqual([[0, 9], [22, 17]]);
    expect(t.hours[0]).not.toHaveProperty('winrate');
    expect(t.duration.map((d) => [d.name, d.games])).toEqual([['많이', 19], ['적게', 2]]);
    expect(t.duration[1]).toMatchObject({ longG: 0, longWr: null, midG: 1, midWr: 0 });
  });
  it('빈 fun → 빈 표 넷', () => {
    const t = trendRows(null);
    expect(t).toEqual({ sides: [], players: [], hours: [], duration: [] });
  });
  it('셀 서식 — 승률(판), 문턱 미만은 wr-dim, 판 0 은 빈 문자열, 차이 %p', () => {
    expect(wrWithGames(0.75, 8)).toBe('75% (8)');
    expect(wrWithGames(null, 0)).toBe('-');
    expect(wrCellCls(0.75, 8, 5)).toBe('win wr-h');   // 채움(win) + ▲(wr-h) — DataTable 이 승률 셀에만 기호를 붙인다
    expect(wrCellCls(0.2, 8, 5)).toBe('loss wr-l');
    expect(wrCellCls(0.5, 8, 5)).toBe('');
    expect(wrCellCls(1, 1, 5)).toBe('wr-dim');
    expect(wrCellCls(null, 0, 5)).toBe('');
    expect([gapText(0.334), gapText(-0.2), gapText(0), gapText(null)]).toEqual(['+33%p', '−20%p', '0%p', '-']);
  });
});

// ── 화면 ────────────────────────────────────────────────────────────────

function mockLazy(impl: (slug: string) => Promise<typeof DETAIL | null>) {
  const matchDetail = vi.fn(impl);
  app.lazy = { matchDetail } as unknown as LazyFiles;
  return matchDetail;
}

describe('List — 최근 경기 목록', () => {
  beforeEach(() => {
    cleanup();
    clearFx();
    app.data = PAYLOAD;
    app.status = 'ready';
  });

  it('한 경기 한 행: 시각 · 승 5명 · 패 5명 · 상세 버튼 · 주소 링크. 줄 전체는 버튼이 아니다', () => {
    const { container } = render(List);
    const items = [...container.querySelectorAll('li.match')];
    expect(items).toHaveLength(3);
    const old = items[1]!;
    expect(old.querySelector('time')?.textContent).toMatch(/\d+\. \d+\./);
    expect([...old.querySelectorAll('.team.win .pn')].map((e) => e.textContent)).toEqual(['블루탑', '블루정글', '블루미드', '블루원딜', '블루서폿']);
    expect([...old.querySelectorAll('.team.loss .pn')].map((e) => e.textContent)).toEqual(['레드탑', '레드정글', '레드미드', '레드원딜', '레드서폿']);
    expect(old.querySelector('.team.win .res')?.textContent).toBe('승');
    expect(old.querySelector('.team.loss .res')?.textContent).toBe('패');
    expect(old.querySelectorAll('img.champ')).toHaveLength(10);
    expect(old.querySelector('.pl.top')).not.toBeNull();
    expect(old.querySelector('.pl')?.getAttribute('aria-describedby')).toMatch(/^tip-d/);
    const btn = old.querySelector('button[aria-expanded]')!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.textContent?.trim()).toBe('상세');
    expect(old.querySelector('a.lnk')?.getAttribute('href')).toBe('#/matches/mold');
    expect(old.querySelector('.row')?.getAttribute('role')).toBeNull();
    // 상세 없는 경기: 버튼·링크 없음
    expect(items[2]!.querySelector('button[aria-expanded]')).toBeNull();
    expect(items[2]!.textContent).toContain('상세 없음');
    expect(container.querySelector('.more')).toBeNull();   // 3경기 < 50
  });

  it("'상세' → 그 자리에 Detail 펼침(aria-expanded), 다시 누르면 접힘. 성공은 한 번만 받는다", async () => {
    const lazy = mockLazy(async () => DETAIL);
    const { container } = render(List);
    const btn = container.querySelector('li.match button[aria-expanded]') as HTMLButtonElement;
    await fireEvent.click(btn);
    await waitFor(() => expect(btn.getAttribute('aria-expanded')).toBe('true'));
    const det = container.querySelector('#' + CSS.escape(btn.getAttribute('aria-controls')!))!;
    expect(det.hasAttribute('hidden')).toBe(false);
    expect(det.querySelector('table[aria-label="팀 합계"]')).not.toBeNull();
    expect(lazy).toHaveBeenCalledWith('mnew');
    await fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(det.hasAttribute('hidden')).toBe(true);
    await fireEvent.click(btn);
    await waitFor(() => expect(btn.getAttribute('aria-expanded')).toBe('true'));
    expect(lazy).toHaveBeenCalledTimes(1);
  });

  it("실패하면 '다시 눌러 주세요' 를 보이고 캐시하지 않는다 — 다음 누름이 다시 받는다", async () => {
    let n = 0;
    const lazy = mockLazy(async () => (n++ === 0 ? null : DETAIL));
    const { container } = render(List);
    const btn = container.querySelector('li.match button[aria-expanded]') as HTMLButtonElement;
    await fireEvent.click(btn);
    await waitFor(() => expect(container.textContent).toContain('경기 상세를 불러오지 못했습니다. 다시 눌러 주세요.'));
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(btn);
    await waitFor(() => expect(btn.getAttribute('aria-expanded')).toBe('true'));
    expect(lazy).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('다시 눌러 주세요');
  });

  it("50경기씩 — '더 보기' 가 다음 50을 잇고 남은 수를 적는다", async () => {
    const many: RecentMatch[] = Array.from({ length: 120 }, (_, i) => ({
      match_id: `m${i}`, ts: 1789400000000 + i * 1000, teams: [{ win: true, players: [] }, { win: false, players: [] }],
    }));
    app.data = { ...PAYLOAD, recent_matches: many } as GuildPayload;
    const { container } = render(List);
    expect(container.querySelectorAll('li.match')).toHaveLength(50);
    const more = container.querySelector('.more') as HTMLButtonElement;
    expect(more.textContent).toBe('더 보기 (50 / 남은 70경기)');
    await fireEvent.click(more);
    expect(container.querySelectorAll('li.match')).toHaveLength(100);
    expect(container.querySelector('.more')?.textContent).toBe('더 보기 (20 / 남은 20경기)');
    await fireEvent.click(container.querySelector('.more')!);
    expect(container.querySelectorAll('li.match')).toHaveLength(120);
    expect(container.querySelector('.more')).toBeNull();
  });

  it('경기가 없으면 한 문장', () => {
    app.data = { ...PAYLOAD, recent_matches: [] } as GuildPayload;
    const { container } = render(List);
    expect(container.textContent).toContain('아직 기록된 경기가 없습니다.');
  });
});

describe('Detail — 경기 상세', () => {
  beforeEach(() => { cleanup(); clearFx(); });

  it('팀 합계(오브젝트·밴) · 팀별 스코어보드(라인 순, 아이템 칸, 스펠·룬 lo) · 골드 · 딜량 · 킬 지도 · 킬 기록', () => {
    const { container } = render(Detail, { detail: DETAIL, data: PAYLOAD, slug: 'mnew' });
    const totals = container.querySelector('table[aria-label="팀 합계"]')!;
    expect([...totals.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['팀', '결과', '킬', '데스', '어시', '골드', '타워', '드래곤', '바론', '전령', '유충', '밴']);
    const rows = [...totals.querySelectorAll('tbody tr')];
    expect([...rows[0]!.querySelectorAll('td')].slice(0, 6).map((td) => td.textContent)).toEqual(['블루팀', '승', '45', '20', '90', '62.3K']);
    expect(rows[0]!.querySelector('td.win')).not.toBeNull();
    expect(rows[1]!.querySelector('td.loss')).not.toBeNull();
    expect(rows[0]!.querySelectorAll('td.bans img.champ')).toHaveLength(2);
    expect(rows[1]!.querySelector('td.bans')?.textContent?.trim()).toBe('-');
    expect(container.textContent).toContain('경기 길이 31:43');

    const boards = [...container.querySelectorAll('table[aria-label^="스코어보드"]')];
    expect(boards.map((t) => t.getAttribute('aria-label'))).toEqual(['스코어보드 · 블루팀 · 승', '스코어보드 · 레드팀 · 패']);
    const heads = [...boards[0]!.querySelectorAll('thead th[scope="col"]')].map((th) => th.textContent);
    expect(heads).toEqual(['멤버', '라인', '챔피언', 'K/D/A', 'KDA', 'CS', '골드', '총 딜', '받은 피해', '시야 점수', '아이템', '스펠', '룬']);
    expect(boards[0]!.querySelectorAll('thead th.lo')).toHaveLength(2);
    const sb = [...boards[0]!.querySelectorAll('tbody tr.sb')];
    expect(sb.map((tr) => tr.querySelector('td.c0')?.textContent?.trim())).toEqual(['나', '가']);
    const ahri = sb[1]!;
    expect(ahri.querySelector('td.lane-mid')?.textContent).toBe('미드');
    expect([...ahri.querySelectorAll('td.num')].map((td) => td.textContent)).toEqual(['9/4/14', '5.75', '180', '12.0K', '39.3K', '15.0K', '20']);
    expect(ahri.querySelectorAll('td.items .slot')).toHaveLength(7);   // 6칸 + 장신구
    expect(ahri.querySelectorAll('td.items img.itemslot')).toHaveLength(7);
    expect(sb[0]!.querySelectorAll('td.items img.itemslot')).toHaveLength(1);   // 빈 칸은 자리만
    expect(ahri.querySelectorAll('td.lo')[0]?.textContent).toBe('점멸 · 순간이동');

    expect(container.querySelector('svg[aria-label^="골드 추이"]')).not.toBeNull();
    expect(container.querySelectorAll('table[aria-label^="딜량"]')).toHaveLength(2);
    expect(container.querySelector('svg[aria-label^="킬 지도"]')).not.toBeNull();
    expect(container.querySelector('table[aria-label="킬 기록 · 3킬"]')).not.toBeNull();
  });

  it('멤버 행 펼침(aria-expanded) → 타임라인 · 빌드 오더(되판 것 ✕) · 세부 기록, 수식 줄 =KDA', async () => {
    const { container } = render(Detail, { detail: DETAIL, data: PAYLOAD, slug: 'mnew' });
    const board = container.querySelector('table[aria-label="스코어보드 · 블루팀 · 승"]')!;
    const btn = board.querySelectorAll('button.exp')[1] as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('가 세부 기록');
    await fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(fx.text).toBe('=KDA(9+14)/4 = 5.75');
    const pd = board.querySelector('#' + CSS.escape(btn.getAttribute('aria-controls')!))!;
    expect(pd).not.toBeNull();
    expect(pd.querySelector('svg[aria-label^="킬 · 데스 · 어시 타임라인"]')?.getAttribute('aria-label')).toContain('가 킬 1 데스 2 어시 1');
    const build = [...pd.querySelectorAll('.bitem')];
    expect(build.map((b) => b.querySelector('i')?.textContent)).toEqual(['0′', '3′', '12′', '12′']);
    expect(build[3]!.classList.contains('sold')).toBe(true);
    expect(build[3]!.querySelector('.x')?.textContent).toBe('✕');
    expect(build[2]!.querySelector('.x')).toBeNull();
    expect([...pd.querySelectorAll('.cell dt')].map((d) => d.textContent)).toEqual(['솔로킬', '물리 피해', '죽어 있던 시간']);
    expect(pd.textContent).toContain('소환사 주문');
    expect(board.querySelector('tr.sb.sel td.c0')?.textContent?.trim()).toBe('가');
    // 행 자체를 눌러도 토글된다(접힘)
    await fireEvent.click(board.querySelectorAll('tr.sb')[1]!);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(board.querySelector('tr.pd')).toBeNull();
  });

  it('오브젝트·밴이 없는 발행물은 열을 빼고 사유를 적는다', () => {
    const data = { ...PAYLOAD, objectives_available: false, ban_available: false } as GuildPayload;
    const { container } = render(Detail, { detail: DETAIL, data, slug: 'mnew' });
    const heads = [...container.querySelector('table[aria-label="팀 합계"]')!.querySelectorAll('thead th')].map((th) => th.textContent);
    expect(heads).toEqual(['팀', '결과', '킬', '데스', '어시', '골드']);
    expect(container.textContent).toContain('종료 화면에 없는 정보: 드래곤 · 바론 · 타워, 밴');
  });

  it('킬 기록 행을 선택하면 지도의 그 점이 강조된다', async () => {
    const { container } = render(Detail, { detail: DETAIL, data: PAYLOAD, slug: 'mnew' });
    const table = container.querySelector('table[aria-label="킬 기록 · 3킬"]')!;
    const first = table.querySelector('tbody tr') as HTMLTableRowElement;
    expect([...first.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim())).toEqual(['5분', '가', '라', '이긴 팀']);
    await fireEvent.click(first);
    expect(container.querySelectorAll('svg .dot.on')).toHaveLength(1);
    expect(first.getAttribute('aria-selected')).toBe('true');
  });
});

describe('Trend — 경향', () => {
  beforeEach(() => { cleanup(); });

  it('진영별 승률 · 시간대 판수(승률 열 없음) · 멤버별 진영 · 경기 길이(판수 병기, 문턱 미만 옅게)', () => {
    const { container } = render(Trend, { data: PAYLOAD });
    const sides = container.querySelector('table[aria-label="진영별 승률"]')!;
    expect([...sides.querySelectorAll('thead th .h')].map((h) => h.textContent)).toEqual(['진영', '판', '승', '패', '승률']);
    expect([...sides.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim()))).toEqual([
      ['블루', '57', '27', '30', '47%'], ['레드', '57', '30', '27', '53%'],
    ]);
    const hours = container.querySelector('svg[aria-label^="시간대별 판수"]')!;
    expect(hours.getAttribute('aria-label')).toBe('시간대별 판수: 00시 9판, 22시 17판');
    expect(container.textContent).not.toMatch(/시간대별 승률이 항상 50% 입니다\.[^]*승률 열/);

    const players = container.querySelector('table[aria-label="멤버별 진영 성적"]')!;
    const prow = [...players.querySelectorAll('tbody tr')];
    expect(prow.map((tr) => tr.querySelector('td.c0')?.textContent?.trim())).toEqual(['차이큼', '양쪽']);
    const cells = [...prow[0]!.querySelectorAll('td:not(.rn)')];
    expect(cells.map((td) => td.textContent?.trim())).toEqual(['차이큼', '6', '6', '100% (6)', '5', '1', '20% (5)', '+80%p']);
    expect(cells[3]!.classList.contains('win')).toBe(true);
    expect(cells[6]!.classList.contains('loss')).toBe(true);

    const dur = container.querySelector('table[aria-label="경기 길이별 승률"]')!;
    const drow = [...dur.querySelectorAll('tbody tr')];
    expect([...drow[0]!.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim())).toEqual(['많이', '19', '75% (8)', '56% (9)', '100% (2)']);
    expect(drow[0]!.querySelectorAll('td')[3]!.classList.contains('win')).toBe(true);
    expect(drow[0]!.querySelectorAll('td')[5]!.classList.contains('wr-dim')).toBe(true);   // 2판 < 5
    expect([...drow[1]!.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim())).toEqual(['적게', '2', '100% (1)', '0% (1)', '-']);
    expect(drow[1]!.querySelectorAll('td')[4]!.classList.contains('loss')).toBe(false);
  });
});

describe('Matches — 라우트', () => {
  beforeEach(() => {
    cleanup();
    location.hash = '';
    clearFx();
    app.data = PAYLOAD;
    app.status = 'ready';
    router.start();
  });
  afterEach(() => { router.stop(); });

  it('하위 탭 최근 경기 · 경향(prefix mt), 기본은 목록', () => {
    render(Matches, { sub: 'list', params: {} });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['최근 경기', '경향']);
    expect(tabs[0]!.id).toBe('mt-tab-list');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').id).toBe('mt-panel-list');
    expect(screen.getByRole('list', { name: '최근 경기' })).toBeTruthy();
  });

  it('경향 탭을 누르면 #/matches/trend 로, sub=trend 면 경향 화면', async () => {
    render(Matches, { sub: 'list', params: {} });
    await fireEvent.click(screen.getAllByRole('tab')[1]!);
    expect(location.hash).toBe('#/matches/trend');
    cleanup();
    const { container } = render(Matches, { sub: 'trend', params: {} });
    expect(screen.getAllByRole('tab')[1]!.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('table[aria-label="진영별 승률"]')).not.toBeNull();
  });

  it('단독 주소(sub=detail) — 목록 링크 + 상세, 실패하면 다시 시도', async () => {
    let n = 0;
    const lazy = mockLazy(async () => (n++ === 0 ? null : DETAIL));
    const { container } = render(Matches, { sub: 'detail', params: { slug: 'mnew' } });
    await waitFor(() => expect(container.textContent).toContain('경기 상세를 불러오지 못했습니다.'));
    expect(container.querySelector('.crumb a')?.getAttribute('href')).toBe('#/matches');
    await fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(container.querySelector('table[aria-label="팀 합계"]')).not.toBeNull());
    expect(lazy).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.crumb')?.textContent).toContain('경기 상세 ·');
    expect(screen.getAllByRole('tab')[0]!.getAttribute('aria-selected')).toBe('true');
  });
});
