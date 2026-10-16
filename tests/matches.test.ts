import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
  axisTop, buildRows, csDiffText, extraRows, fxKda, gapText, goldLanes, goldSeries, goldStep, goldSummary, goldTick, itemImgUrl,
  kdaCounts, kdaMarks, killDots, matchRows, MATCH_PAGE, niceStep, rateRows, scoreboardRows, teamLabel, teamTotals, trendRows,
  versusRows, wrCell, wrWithGames,
} from '../src/lib/matches';
import { app } from '../src/lib/data/store.svelte';
import { router } from '../src/lib/router.svelte';
import { clearFx, fx } from '../src/lib/fx.svelte';
import type { LazyFiles } from '../src/lib/data/loader';
import type { GuildPayload, MatchDetail, RecentMatch } from '../src/lib/data/types';
import List from '../src/routes/matches/List.svelte';
import Detail from '../src/routes/matches/Detail.svelte';
import Trend from '../src/routes/matches/Trend.svelte';
import Matches from '../src/routes/Matches.svelte';
import { CHAMP_KO, DETAIL, FUN, PAYLOAD, RECENT } from './fixtures/match-payload';
import { fakeSheetLayout } from './fake-layout';

/** 셀 글 — DataTable 스니펫 칸(.cs, 보이는 층은 보조기술에서 숨는다)은 보조기술 글(fmt), 그 밖은 보이는 글 */
const cellText = (td: Element) => (td.querySelector(':scope > .cs') ? td.querySelector(':scope > .sr-only') : td)?.textContent?.trim();

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
    expect(ahri).toMatchObject({ key: '100-2', champKo: '아리', lane: 'MIDDLE', laneCls: 'lane-mid', kdaText: '9/4/14', kda: 5.75 });
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
  it('대결 막대 — 킬·골드(+오브젝트가 실리면 타워·드래곤), 큰 쪽이 100, 오브젝트가 없으면 그 줄이 없다', () => {
    const on = versusRows(teamTotals(DETAIL.teams, true, true));
    expect(on.map((v) => [v.label, v.aText, v.bText, v.aPct, v.bPct])).toEqual([
      ['킬', '45', '20', 100, 44.4], ['골드', '62.3K', '48.1K', 100, 77.2], ['타워', '10', '3', 100, 30], ['드래곤', '1', '2', 50, 100],
    ]);
    expect(versusRows(teamTotals(DETAIL.teams, false, false)).map((v) => v.key)).toEqual(['kills', 'gold']);
    const zero = teamTotals(DETAIL.teams.map((t) => ({ ...t, kills: 0 })), false, false);
    expect(versusRows(zero)[0]).toMatchObject({ a: 0, b: 0, aPct: 0, bPct: 0 });   // 0 나누기 없음
    expect(versusRows(teamTotals(DETAIL.teams.slice(0, 1), true, true))).toEqual([]);
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
  it('킬 관여 · 분당 CS — (킬+어시)/팀 킬, CS/경기 시간 분. 팀 킬 0 · 경기 시간 0 은 대시', () => {
    const r = { k: 9, a: 14, cs: 180 };
    expect(rateRows(r, 45, 1903, PAYLOAD.metric_meta)).toEqual([
      { key: 'kp', label: '킬 관여', text: '51%' },     // 23/45
      { key: 'cspm', label: '분당 CS', text: '5.7' },   // 180 / 31.7분
    ]);
    expect(rateRows({ k: 0, a: 0, cs: 0 }, 10, 600, PAYLOAD.metric_meta).map((x) => x.text)).toEqual(['0%', '0.0']);
    expect(rateRows(r, 0, 0, PAYLOAD.metric_meta).map((x) => x.text)).toEqual(['-', '-']);
  });
  it('아이템 이미지 URL — 패치·id 가 URL 조각 모양일 때만', () => {
    expect(itemImgUrl('16.18.1', 3078)).toBe('https://ddragon.leagueoflegends.com/cdn/16.18.1/img/item/3078.png');
    expect(itemImgUrl('16.18.1', 0)).toBe('');
    expect(itemImgUrl('16.18.1/../x', 3078)).toBe('');
    expect(itemImgUrl(null, 3078)).toBe('');
  });
});

// MVP 는 이긴 팀 한 명에게만 `mvp: true` 키가 있다(진 팀·나머지 선수는 키 자체가 없다)
const MVP_RECENT: RecentMatch[] = RECENT.map((m) => (m.match_id === 'mnodet' ? m : {
  ...m,
  teams: m.teams.map((t) => (t.win ? { ...t, players: t.players.map((p) => (p.lane === 'MIDDLE' ? { ...p, mvp: true as const } : p)) } : t)),
}));
const MVP_DETAIL: MatchDetail = {
  ...DETAIL,
  teams: DETAIL.teams.map((t) => (t.win ? { ...t, players: t.players.map((p) => (p.name === '가' ? { ...p, mvp: true as const } : p)) } : t)),
};

describe('MVP — 파생값', () => {
  it('matchRows: mvp:true 선수만 mvp, 툴팁 끝에 MVP. 키가 없는 기록은 전부 false', () => {
    const rows = matchRows(MVP_RECENT, CHAMP_KO);
    const flagged = rows.flatMap((r) => [...r.win, ...r.loss]).filter((p) => p.mvp);
    expect(flagged.map((p) => p.name)).toEqual(['가', '블루미드']);
    expect(flagged.map((p) => p.tip)).toEqual(['미드 · 가 · 아리 · MVP', '미드 · 블루미드 · Zoe · MVP']);
    expect(rows[0]!.win.map((p) => p.mvp)).toEqual([false, true]);   // 라인 순: 탑 → 미드
    expect(rows[0]!.loss.every((p) => !p.mvp)).toBe(true);
    expect(matchRows(RECENT, CHAMP_KO).flatMap((r) => [...r.win, ...r.loss]).some((p) => p.mvp)).toBe(false);
  });
  it('scoreboardRows: mvp:true 인 행만 mvp', () => {
    expect(scoreboardRows(MVP_DETAIL.teams[0], CHAMP_KO).map((r) => [r.name, r.mvp])).toEqual([['나', false], ['가', true]]);
    expect(scoreboardRows(MVP_DETAIL.teams[1], CHAMP_KO).every((r) => !r.mvp)).toBe(true);
    expect(scoreboardRows(DETAIL.teams[0], CHAMP_KO).every((r) => !r.mvp)).toBe(true);
  });
});

/** 라인 두 개(탑·미드)만 실린 3분 타임라인 — 정글·원딜·서폿은 키가 없다 */
const LANE_TL: MatchDetail['timeline'] = {
  minutes: [0, 1, 2], a_gold: [2500, 3500, 5000], b_gold: [2500, 3000, 4000], gold_diff: [0, 500, 1000],
  cs_diff: [0, 3, 0], xp_diff: [0, 0, 0],
  lanes: { TOP: { gold: [0, 200, 400], cs: [0, 1, 2] }, MIDDLE: { gold: [0, -300, -100], cs: [0, -1, -2] } },
};

describe('goldSeries — 골드 추이', () => {
  it('세 열 같은 길이, 최대 격차·최종·팀 골드 최대', () => {
    const s = goldSeries(DETAIL.timeline)!;
    expect(s.minutes).toHaveLength(6);
    expect(s.diff).toEqual([0, 25, 362, 779, 456, 1500]);
    expect(s).toMatchObject({ peak: 1500, last: 1500, maxGold: 9000 });
    expect(goldSummary(s)).toBe('최종 블루 +1,500G · 최대 격차 1,500G');
    expect(goldSummary({ last: -320, peak: 900 })).toBe('최종 레드 +320G · 최대 격차 900G');
  });
  it('lane 을 주면 차이 열만 그 라인 맞상대 골드 차로 — 팀 골드 두 열은 그대로, 없는 라인은 null', () => {
    const s = goldSeries(LANE_TL, 'MIDDLE')!;
    expect(s.diff).toEqual([0, -300, -100]);
    expect(s).toMatchObject({ peak: 300, last: -100, maxGold: 5000 });
    expect(s.a).toEqual(goldSeries(LANE_TL)!.a);
    expect(goldSeries(LANE_TL)!.diff).toEqual([0, 500, 1000]);
    expect(goldSeries(LANE_TL, 'JUNGLE')).toBeNull();
    expect(goldSeries(DETAIL.timeline, 'MIDDLE')).toBeNull();
  });
  it('goldLanes — 실린 라인(탑 → 서폿 순), lanes 키가 없으면 null, 빈 사전이면 []', () => {
    expect(goldLanes(LANE_TL)).toEqual(['TOP', 'MIDDLE']);
    expect(goldLanes(DETAIL.timeline)).toBeNull();
    expect(goldLanes({ ...DETAIL.timeline, lanes: {} })).toEqual([]);
    expect(goldLanes(null)).toBeNull();
  });
  it('csDiffText — 10분 · 15분 · 마지막 분, 팀은 cs_diff · 라인은 lanes[l].cs, 그 분이 없으면 대시', () => {
    const minutes = Array.from({ length: 17 }, (_, i) => i);
    const tl = {
      minutes, cs_diff: minutes.map((m) => m * 2),
      lanes: { MIDDLE: { gold: minutes.map(() => 0), cs: minutes.map((m) => -m) } },
    };
    expect(csDiffText(tl)).toBe('CS 차 · 10분 +20 · 15분 +30 · 마지막 분 +32');
    expect(csDiffText(tl, 'MIDDLE')).toBe('CS 차 · 10분 −10 · 15분 −15 · 마지막 분 −16');
    expect(csDiffText(LANE_TL, 'MIDDLE')).toBe('CS 차 · 10분 - · 15분 - · 마지막 분 −2');   // 10분 전에 끝난 경기
    expect(csDiffText(LANE_TL)).toBe('CS 차 · 10분 - · 15분 - · 마지막 분 0');
    expect(csDiffText({ minutes: [0, 1] })).toBe('CS 차 · 10분 - · 15분 - · 마지막 분 -');
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
  it('셀 서식 — 승률(판), 단계는 Wilson 구간(점추정 아님), 문턱 미만은 표본 적음, 판 0 은 없음, 차이 %p', () => {
    expect(wrWithGames(0.75, 8)).toBe('75% (8)');
    expect(wrWithGames(null, 0)).toBe('-');
    expect(wrCell(0.75, 8, 5)).toEqual({ pct: '75%', games: 8, step: 'even', text: '75% (8)' });   // 하한 41% — 색 없음
    expect(wrCell(1, 6, 5)).toMatchObject({ step: 'up2', text: '100% (6), 60% 이상으로 높음' });
    expect(wrCell(0.1, 20, 5)).toMatchObject({ step: 'down2', text: '10% (20), 40% 이하로 낮음' });
    expect(wrCell(1, 1, 5)).toMatchObject({ step: 'few', text: '100% (1), 표본 적음' });
    expect(wrCell(0, 1, 5)?.step).toBe('few');   // 0% 도 값이다(빈 칸이 아니다)
    expect(wrCell(null, 0, 5)).toBeNull();
    expect(wrCell(0.5, 0, 5)).toBeNull();
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
    expect(old.querySelector('.pl img.champ')?.getAttribute('width')).toBe('16');   // 멤버 칩 안 16px 초상
    expect(old.querySelector('.pl.top')).not.toBeNull();
    // 한 경기가 카드 하나 — 접힌 카드는 호버 들림(.lift), 글로우는 없다
    expect(old.classList.contains('card')).toBe(true);
    expect(old.classList.contains('lift')).toBe(true);
    expect(old.classList.contains('glow')).toBe(false);
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
    const card = btn.closest('li.match')!;
    expect(card.classList.contains('glow')).toBe(true);    // 펼친 카드 = 선택된 카드
    expect(card.classList.contains('lift')).toBe(false);
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

  it('팀 합계·스코어보드가 래퍼보다 넓으면 각 캡션 오른쪽에 "열 n개 더 →" + 가장자리 선(DataTable 과 같은 문법)', () => {
    const restore = fakeSheetLayout();
    try {
      const { container } = render(Detail, { detail: DETAIL, data: PAYLOAD, slug: 'mnew' });
      const sheets = [...container.querySelectorAll('.sheet')];
      // 팀 합계: 머리 12칸 1200px / 스코어보드: 홈통 + 13칸 1400px, 보이는 폭 250px(경계 253) → 3번째 칸(200~300)부터 잘린다
      expect(sheets[0]!.querySelector('.cap')?.textContent).toMatch(/^팀 합계 · 경기 길이 31:43열 10개 더 →$/);
      expect(sheets[1]!.querySelector('.cap')?.textContent).toBe('스코어보드 · 블루팀 · 승열 12개 더 →');
      expect(sheets[1]!.querySelector('.edge')).not.toBeNull();
      expect(sheets[1]!.querySelector('.cut')?.getAttribute('aria-hidden')).toBe('true');
    } finally {
      restore();
    }
  });

  it('팀 대결 막대 — 머리(팀 · 승패 글자), 줄마다 보조기술 한 문장, 이긴 쪽 그라디언트 · 진 쪽 사선, 오브젝트 없으면 두 줄', () => {
    const { container } = render(Detail, { detail: DETAIL, data: PAYLOAD, slug: 'mnew' });
    const vsb = container.querySelector('.vsb')!;
    expect([...vsb.querySelectorAll('.vh .tn')].map((t) => t.textContent)).toEqual(['블루팀승', '패레드팀']);
    expect(vsb.querySelector('.vh .tag.win')?.textContent).toBe('승');
    const list = vsb.querySelector('ul.vrows')!;
    expect(container.querySelector('#' + CSS.escape(list.getAttribute('aria-labelledby')!))?.textContent).toBe('팀 대결');
    const rows = [...list.querySelectorAll('li.vr')];
    expect(rows.map((li) => li.querySelector('.sr-only')?.textContent)).toEqual([
      '킬 · 블루팀 45 · 레드팀 20', '골드 · 블루팀 62.3K · 레드팀 48.1K', '타워 · 블루팀 10 · 레드팀 3', '드래곤 · 블루팀 1 · 레드팀 2',
    ]);
    expect([...rows[0]!.querySelectorAll('[aria-hidden="true"]')].map((e) => e.textContent)).toEqual(['45', '', '킬', '', '20']);
    const [left, right] = [...rows[0]!.querySelectorAll('.vbar')];
    expect(left!.classList.contains('w') && right!.classList.contains('x')).toBe(true);   // 블루 승 · 레드 패
    expect((left!.querySelector('i') as HTMLElement).style.getPropertyValue('--w')).toBe('100%');
    expect((right!.querySelector('i') as HTMLElement).style.getPropertyValue('--w')).toBe('44.4%');
    cleanup();
    const off = render(Detail, { detail: DETAIL, data: { ...PAYLOAD, objectives_available: false } as GuildPayload, slug: 'mnew' });
    expect(off.container.querySelectorAll('.vsb li.vr')).toHaveLength(2);
  });

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
    expect(ahri.querySelector('td .lane.mid')?.textContent).toBe('미드');
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
    // 세부 기록은 작은 숫자 타일(StatTile) — dl 안의 dt·dd 짝
    expect([...pd.querySelectorAll('dl.cells dt')].map((d) => d.textContent)).toEqual(['킬 관여', '분당 CS', '솔로킬', '물리 피해', '죽어 있던 시간']);
    expect([...pd.querySelectorAll('dl.cells dd')].slice(0, 2).map((d) => d.textContent)).toEqual(['51%', '5.7']);   // (9+14)/45 · 180/31.7분
    expect(pd.textContent).toContain('소환사 주문');
    expect(board.querySelector('tr.sb.sel td.c0')?.textContent?.trim()).toBe('가');
    // 행 자체를 눌러도 토글된다(접힘)
    await fireEvent.click(board.querySelectorAll('tr.sb')[1]!);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(board.querySelector('tr.pd')).toBeNull();
  });

  it('세부 기록의 킬 관여는 그 멤버 팀의 킬이 분모 — 팀 킬 0 이면 0% 가 아니라 대시', async () => {
    const teams = DETAIL.teams.map((t, i) => (i === 1 ? { ...t, kills: 0 } : t));
    const { container } = render(Detail, { detail: { ...DETAIL, teams }, data: PAYLOAD, slug: 'mnew' });
    const cells = async (label: string) => {
      const board = container.querySelector(`table[aria-label="${label}"]`)!;
      await fireEvent.click(board.querySelectorAll('button.exp')[0]!);
      const pd = board.querySelector('tr.pd')!;
      return [...pd.querySelectorAll('dl.cells .stat')].slice(0, 2).map((c) => [c.querySelector('dt')?.textContent, c.querySelector('dd')?.textContent]);
    };
    // 레드팀 첫 행(라인 순: 라 · 탑) — 팀 킬 0
    expect(await cells('스코어보드 · 레드팀 · 패')).toEqual([['킬 관여', '-'], ['분당 CS', '5.7']]);
    // 블루팀 첫 행(나 · 탑) — (5+7)/45
    expect(await cells('스코어보드 · 블루팀 · 승')).toEqual([['킬 관여', '27%'], ['분당 CS', '5.7']]);
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

describe('MVP — 화면 표시', () => {
  beforeEach(() => { cleanup(); clearFx(); app.status = 'ready'; });

  it('목록: MVP 가 있는 경기마다 정확히 한 곳, 이긴 팀 칸 안, 글자 MVP. 없는 경기·진 팀에는 없다', () => {
    app.data = { ...PAYLOAD, recent_matches: MVP_RECENT } as GuildPayload;
    const { container } = render(List);
    const items = [...container.querySelectorAll('li.match')];
    expect(items.map((li) => li.querySelectorAll('.mvp').length)).toEqual([1, 1, 0]);
    for (const li of items.slice(0, 2)) {
      const tag = li.querySelector('.mvp')!;
      expect(tag.textContent).toBe('MVP');
      expect(tag.closest('.team')?.classList.contains('win')).toBe(true);
      expect(li.querySelectorAll('.team.loss .mvp')).toHaveLength(0);
    }
    // 이름 칸 안, 이름 바로 뒤 — 그 칸의 툴팁 문구에도 MVP 가 실린다
    const pl = items[0]!.querySelector('.mvp')!.closest('.pl') as HTMLElement;
    expect(pl.querySelector('.pn')?.textContent).toBe('가');
    expect(document.getElementById(pl.getAttribute('aria-describedby')!)?.textContent).toBe('미드 · 가 · 아리 · MVP');
  });

  it('목록: MVP 키가 없는 기록(MVP 를 싣기 전 발행물)에는 표식이 없다', () => {
    app.data = PAYLOAD;
    const { container } = render(List);
    expect(container.querySelectorAll('.mvp')).toHaveLength(0);
  });

  it('상세: MVP 행의 멤버 칸에 한 곳, 진 팀 스코어보드에는 없다. 펼침 단추 이름은 그대로', () => {
    const { container } = render(Detail, { detail: MVP_DETAIL, data: PAYLOAD, slug: 'mnew' });
    expect(container.querySelectorAll('.mvp')).toHaveLength(1);
    const boards = [...container.querySelectorAll('table[aria-label^="스코어보드"]')];
    const win = [...boards[0]!.querySelectorAll('tbody tr.sb')];
    expect(win.map((tr) => tr.querySelectorAll('td.c0 .mvp').length)).toEqual([0, 1]);
    expect(win[1]!.querySelector('td.c0')?.textContent?.trim()).toBe('가MVP');
    expect(win[1]!.querySelector('td.c0 button.exp')?.getAttribute('aria-label')).toBe('가 세부 기록');
    expect(boards[1]!.querySelectorAll('.mvp')).toHaveLength(0);
  });

  it('상세: MVP 키가 없는 상세 파일에는 표식이 없다', () => {
    const { container } = render(Detail, { detail: DETAIL, data: PAYLOAD, slug: 'mnew' });
    expect(container.querySelectorAll('.mvp')).toHaveLength(0);
  });

  it('목록에서 펼친 상세에도 같은 표식(경기 한 개당 MVP 한 명)', async () => {
    mockLazy(async () => MVP_DETAIL);
    app.data = { ...PAYLOAD, recent_matches: MVP_RECENT } as GuildPayload;
    const { container } = render(List);
    const li = container.querySelectorAll('li.match')[0]!;
    await fireEvent.click(li.querySelector('button[aria-expanded]')!);
    await waitFor(() => expect(li.querySelector('table[aria-label="팀 합계"]')).not.toBeNull());
    // 같은 경기가 행(.row)에도 펼친 스코어보드(.det table)에도 한 곳씩
    expect(li.querySelectorAll('.row .mvp')).toHaveLength(1);
    expect(li.querySelectorAll('.det table .mvp')).toHaveLength(1);
  });
});

describe('Trend — 경향', () => {
  beforeEach(() => { cleanup(); });

  it('진영별 승률 · 시간대 판수(승률 열 없음) · 멤버별 진영 · 경기 길이(판수 병기, 문턱 미만 옅게)', () => {
    const { container } = render(Trend, { data: PAYLOAD });
    const sides = container.querySelector('table[aria-label="진영별 승률"]')!;
    expect([...sides.querySelectorAll('thead th .h')].map((h) => h.textContent)).toEqual(['진영', '판', '승', '패', '승률']);
    expect([...sides.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map(cellText))).toEqual([
      ['블루', '57', '27', '30', '47%'], ['레드', '57', '30', '27', '53%'],
    ]);
    // 진영 승률 칸은 승률 게이지(보조기술 이름에 숫자를 다 담는다)
    expect(sides.querySelector('tbody tr .wg[role="img"]')?.getAttribute('aria-label')).toBe('승률 47%, 27승 30패, 57판');
    const hours = container.querySelector('svg[aria-label^="시간대별 판수"]')!;
    expect(hours.getAttribute('aria-label')).toBe('시간대별 판수: 00시 9판, 22시 17판');
    expect(container.textContent).not.toMatch(/시간대별 승률이 항상 50% 입니다\.[^]*승률 열/);
    // 카드 제목이 같은 말이라 차트 캡션은 보조기술에만
    expect(container.querySelector('.hourbars .cap')?.classList.contains('sr-only')).toBe(true);

    const players = container.querySelector('table[aria-label="멤버별 진영 성적"]')!;
    const prow = [...players.querySelectorAll('tbody tr')];
    expect(prow.map((tr) => tr.querySelector('td.c0')?.textContent?.trim())).toEqual(['차이큼', '양쪽']);
    const cells = [...prow[0]!.querySelectorAll('td:not(.rn)')];
    expect(cells.map(cellText)).toEqual(['차이큼', '6', '6', '100% (6), 60% 이상으로 높음', '5', '1', '20% (5)', '+80%p']);
    // 단계 색은 글자(st-*) + 기호 — 채움(td.win·td.loss)이 아니다. 5판 20% 는 상한이 50% 를 넘어 중립
    expect(cells[3]!.querySelector('.st-up2')?.textContent).toBe('100%▲▲');
    expect(cells[6]!.querySelector('.st-even')?.textContent).toBe('20%');
    expect(players.querySelector('td.win, td.loss')).toBeNull();

    const dur = container.querySelector('table[aria-label="경기 길이별 승률"]')!;
    const drow = [...dur.querySelectorAll('tbody tr')];
    expect([...drow[0]!.querySelectorAll('td:not(.rn)')].map(cellText)).toEqual(['많이', '19', '75% (8)', '56% (9)', '100% (2), 표본 적음']);
    expect(drow[0]!.querySelectorAll('td')[5]!.querySelector('.st-few')).not.toBeNull();   // 2판 < 5
    expect(drow[0]!.querySelectorAll('td')[5]!.querySelector('.g')?.textContent).toBe('(2)');
    // 문턱 미만은 옅은 색에 더해 '표본 적음'을 보이는 글로 — 문턱 이상 칸에는 없다
    expect(drow[0]!.querySelectorAll('td')[5]!.querySelector('.fw')?.textContent).toBe('표본 적음');
    expect(drow[0]!.querySelectorAll('td')[3]!.querySelector('.fw')).toBeNull();
    expect([...drow[1]!.querySelectorAll('td:not(.rn)')].map(cellText)).toEqual(['적게', '2', '100% (1), 표본 적음', '0% (1), 표본 적음', '-']);
    expect(dur.querySelector('td.win, td.loss')).toBeNull();
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
