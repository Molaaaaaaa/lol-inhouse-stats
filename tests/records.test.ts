import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Records from '../src/routes/Records.svelte';
import Hall from '../src/routes/records/Hall.svelte';
import Deaths from '../src/routes/records/Deaths.svelte';
import Play from '../src/routes/records/Play.svelte';
import Ties from '../src/routes/records/Ties.svelte';
import { app } from '../src/lib/data/store.svelte';
import { LazyFiles } from '../src/lib/data/loader';
import { router } from '../src/lib/router.svelte';
import { clearFx, fx } from '../src/lib/fx.svelte';
import {
  RECORD_DEFS, comebackRows, deathRows, dragonKo, hallFx, hallRows, heatCaption, heatDot, heatPoints,
  mvpNote, pentaRows, serverRows,
} from '../src/lib/records';
import type { GuildPayload, RecordEntry, RecordsMap } from '../src/lib/data/types';

// ── 픽스처 — 실데이터(2026-09-18) 모양 그대로, 값만 작게 ──
const TS = 1788445306150;   // 2026. 9. 3.
const RECORDS: RecordsMap = {
  best_kda: { a: 14, champ: 'Ahri', d: 1, dur: 1804, k: 14, name: '외 걸', ts: TS, value: 28, win: true },
  best_lane_cs_adv: { a: 8, champ: 'Ryze', d: 3, dur: 2496, k: 5, name: '외 걸', ts: TS, value: '+144', win: true },
  longest_living: { a: 14, champ: 'Viktor', d: 1, dur: 1834, k: 7, name: '정준토', ts: TS, value: '30:13', win: true },
  longest_streak: { name: 'Choi Eun Ho', value: 6 },
  most_dmg: { a: 13, champ: 'Xerath', d: 3, dur: 2324, k: 13, name: '짹짹공주', ts: TS, value: 67094, win: false },
  most_steals: { name: '', value: 0 },          // 이름 없는 기록은 행이 없다
  min_games: 5,
  // 실데이터의 펜타 항목에는 value 가 없다(계약 타입은 요구하지만) — 화면은 이름·챔피언만 쓴다
  pentas: [{ champ: 'Yunara', name: '코 파' }, { champ: 'Jinx', name: '코 파' }] as unknown as RecordEntry[],
};
const PAYLOAD = {
  patch: '16.18.1',
  summary: { total_games: 57, player_count: 36, avg_winrate: 0.5, avg_duration_sec: 1686 },
  min_games: 5, min_games_excluded: 11, min_games_lane: 3, min_days: 1, min_days_excluded: 0,
  champ_ko: { Ahri: '아리', Ryze: '라이즈', Viktor: '빅토르', Xerath: '제라스', Yunara: '유나라', Jinx: '징크스', Aurora: '오로라' },
  metric_meta: { winrate: { label: '승률', lane: false, fmt: 'pct', desc: '' } },
  records: RECORDS,
  server_records: {
    avg_kills: 48.4,
    shortest: { dur: 914, kills: 22, ts: TS }, longest: { dur: 2496, kills: 55, ts: TS }, most_kills: { dur: 2324, kills: 82, ts: TS },
  },
  mvp: [{ games: 43, mvp: 9, name: '조 C' }, { games: 55, mvp: 7, name: '외 걸' }],
  mvp_excluded: { awards: 4, players: 3 },
  objectives_available: true,
  fun: {
    comeback: [
      { discord_name: '외 걸', behind_g: 7, comeback: 3, comeback_rate: 0.429, ahead_g: 5, thrown: 1, throw_rate: 0.2 },
      { discord_name: '앙앙맹', behind_g: 0, comeback: 0, comeback_rate: 0, ahead_g: 3, thrown: 0, throw_rate: 0 },
      { discord_name: '무기록', behind_g: 0, comeback: 0, comeback_rate: 0, ahead_g: 0, thrown: 0, throw_rate: 0 },
    ],
    deaths: [
      { discord_name: '외 걸', games: 6, first_death_min: 11.5, fb_given: 0.167, bounty_given: 1504 },
      { discord_name: '앙앙맹', games: 0, first_death_min: null, fb_given: 0, bounty_given: null },
    ],
    roaming: [
      { discord_name: '쟈부쟈부', frames: 29, lane: 'UTILITY', roam_rate: 0.862 },
      { discord_name: '외 걸', frames: 110, lane: 'MIDDLE', roam_rate: 0.309 },
    ],
    teamfight: [{ discord_name: '진뀨뀨', fights: 45, joined: 41, join_rate: 0.911 }],
    dragons: [{ dragon: 'CHEMTECH_DRAGON', taken: 40, winrate: 0.625 }, { dragon: 'ELDER_DRAGON', taken: 1, winrate: 1 }],
    co_deaths: [{ a: '윙봉현', b: '주 암', games: 2, n: 7, per_game: 3.5 }],
    assist_flow: [{ giver: '주 암', taker: '현 우', games: 3, assists: 9, taker_kills: 12, share: 0.75 }],
    sprees: {
      sprees: [{ name: '외 걸', champ: 'Aurora', streak: 14, minute: 25 }],
      stoppers: [{ runner: '외 걸', stopper: '앙앙맹', streak: 14 }],
    },
  },
} as unknown as GuildPayload;

const ko = (id: string) => (PAYLOAD.champ_ko as Record<string, string>)[id] ?? id;
const tableOf = (el: ParentNode, caption: string) => el.querySelector(`table[aria-label="${caption}"]`)!;
const heads = (t: Element) => [...t.querySelectorAll('thead th[scope="col"] .h')].map((h) => h.textContent);
const bodyRows = (t: Element) => [...t.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
const cells = (tr: Element) => [...tr.querySelectorAll('td:not(.rn)')].map((td) => td.textContent?.trim());

beforeEach(() => {
  cleanup();
  location.hash = '';
  clearFx();
  app.data = PAYLOAD;
  app.status = 'ready';
  app.lazy = new LazyFiles('g1');
});

// ── 순수 함수 ─────────────────────────────────────────────────────────

describe('records — 순수 함수', () => {
  it('hallRows: DEFS 순서 · 이름 없는 기록·min_games·pentas 는 행 없음 · 값 서식(천단위·문자열 그대로·연승)', () => {
    const rows = hallRows(RECORDS, ko);
    expect(rows.map((r) => r.key)).toEqual(['best_kda', 'most_dmg', 'best_lane_cs_adv', 'longest_living', 'longest_streak']);
    expect(rows.map((r) => r.value)).toEqual(['28', '67,094', '+144', '30:13', '6연승']);
    expect(rows.map((r) => r.valueNum)).toEqual([28, 67094, null, null, 6]);
    expect(rows[0]).toMatchObject({ label: '최고 KDA', name: '외 걸', champ: 'Ahri', champKo: '아리', kdaText: '14/1/14', win: true, dur: 1804, ts: TS });
    expect(rows[4]).toMatchObject({ label: '최장 연승', champ: '', champKo: '', kdaText: '', win: null, dur: null, ts: null });
    expect(hallRows(null, ko)).toEqual([]);
    expect(hallRows({ min_games: 5 }, ko)).toEqual([]);
  });
  it('RECORD_DEFS 이름표에 금지어·이모지가 없다', () => {
    const BANNED = ['궁합', '판 수', '바텀', '서포터', '레이팅', '스탯', '선수', '볼 멤버', '고르면', '고르세요', '같이 뛴', '안 뛴', '폈다', '접었다', '빠져 있습니다', '그리지 못', '낼 만'];
    for (const [, label] of RECORD_DEFS) {
      expect(BANNED.filter((b) => label.includes(b)), label).toEqual([]);
      expect(/\p{Extended_Pictographic}/u.test(label), label).toBe(false);
    }
  });
  it('hallFx: 있는 조각만 잇는다', () => {
    const rows = hallRows(RECORDS, ko);
    expect(hallFx(rows[0]!)).toBe('=최고 KDA 28 · 외 걸 · 아리 14/1/14 · 승 · 30:04 · 9. 3.');
    expect(hallFx(rows[4]!)).toBe('=최장 연승 6연승 · Choi Eun Ho');
  });
  it('pentaRows: 목록만 · 같은 사람 두 번도 키가 다르다', () => {
    const rows = pentaRows(RECORDS, ko);
    expect(rows.map((r) => [r.name, r.champKo])).toEqual([['코 파', '유나라'], ['코 파', '징크스']]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
    expect(pentaRows({ pentas: 3 }, ko)).toEqual([]);
  });
  it('serverRows: 최단·최장·최다 킬 + 평균 행 · avg_kills 없으면(옛 발행물) 빈 배열', () => {
    const rows = serverRows(PAYLOAD.server_records, 57);
    expect(rows.map((r) => [r.label, r.time, r.kills, r.when])).toEqual([
      ['최단 경기', '15:14', 22, '9. 3.'], ['최장 경기', '41:36', 55, '9. 3.'],
      ['최다 킬 경기', '38:44', 82, '9. 3.'], ['경기당 평균 킬', '', 48.4, '전체 57경기'],
    ]);
    expect(serverRows({ avg_kills: 0 } as never, 57)).toEqual([]);
    expect(serverRows(null, 57)).toEqual([]);
  });
  it('mvpNote: 표 합계 + 제외분 = 총 경기 · 제외 없으면 빈 문자열', () => {
    expect(mvpNote(PAYLOAD.mvp, { awards: 4, players: 3 }, 5)).toBe('판수 미달 3명 제외(4회) · 표 합계 16회 + 4회 = 총 20경기 · 문턱 5판');
    expect(mvpNote(PAYLOAD.mvp, { awards: 0, players: 0 }, 5)).toBe('');
    expect(mvpNote(PAYLOAD.mvp, null, 5)).toBe('');
  });
  it('comebackRows: 분모 0 이면 비율 null · 열세·우세 둘 다 0 이면 행 없음', () => {
    const rows = comebackRows(PAYLOAD.fun.comeback);
    expect(rows.map((r) => r.name)).toEqual(['외 걸', '앙앙맹']);
    expect(rows[0]).toMatchObject({ behind_g: 7, comeback: 3, comeback_rate: 0.429, ahead_g: 5, thrown: 1, throw_rate: 0.2 });
    expect(rows[1]).toMatchObject({ behind_g: 0, comeback_rate: null, ahead_g: 3, throw_rate: 0 });
    expect(comebackRows(null)).toEqual([]);
  });
  it('deathRows: 분모는 games — 0판이면 퍼블 헌납률 null, 없는 값은 null', () => {
    const rows = deathRows(PAYLOAD.fun.deaths);
    expect(rows[0]).toEqual({ name: '외 걸', games: 6, first_death_min: 11.5, fb_given: 0.167, bounty_given: 1504 });
    expect(rows[1]).toEqual({ name: '앙앙맹', games: 0, first_death_min: null, fb_given: null, bounty_given: null });
  });
  it('dragonKo: 사전에 있으면 한국어, 없으면 그대로', () => {
    expect(dragonKo('CHEMTECH_DRAGON')).toBe('화학공학');
    expect(dragonKo('ELDER_DRAGON')).toBe('장로');
    expect(dragonKo('NEW_DRAGON')).toBe('NEW_DRAGON');
    expect(dragonKo(null)).toBe('?');
  });
  it('heatPoints: 14870 기준 → SVG 좌표(y 뒤집음) · 라인 거르기 · 맵 밖은 가장자리로', () => {
    const pts = [
      { x: 0, y: 0, m: 1, lane: 'TOP' }, { x: 14870, y: 14870, m: 20, lane: 'JUNGLE' },
      { x: 7435, y: 7435, m: 5, lane: 'TOP' }, { x: -100, y: 20000, m: 3, lane: 'MIDDLE' },
    ] as const;
    const all = heatPoints(pts, '', 260);
    expect(all.map((p) => [p.x, p.y])).toEqual([[0, 260], [260, 0], [130, 130], [0, 0]]);
    expect(heatPoints(pts, 'TOP', 260).map((p) => p.m)).toEqual([1, 5]);
    expect(heatPoints(null, '', 260)).toEqual([]);
  });
  it('heatDot·heatCaption: 점이 많을수록 작고 옅게 · 표본 문구는 사실대로', () => {
    expect(heatDot(100)).toEqual({ r: 2.6, op: 0.5 });
    expect(heatDot(700)).toEqual({ r: 2.2, op: 0.42 });
    expect(heatDot(2000)).toEqual({ r: 1.8, op: 0.34 });
    expect(heatCaption({ games: 42, total: 2765, capped: true, points: new Array(2000) })).toBe('최근 42경기 · 데스 2,000건 · 표본 상한(전체 2,765건 중)');
    expect(heatCaption({ games: 0, total: 3, capped: false, points: [1, 2, 3] })).toBe('데스 3건');
  });
});

// ── 화면 ─────────────────────────────────────────────────────────────

describe('Records — 하위 화면', () => {
  beforeEach(() => { router.start(); });
  afterEach(() => { router.stop(); });

  it('기본은 명예의 전당 · 탭 넷 · 옛 주소 mvp 와 모르는 sub 는 hall', async () => {
    render(Records, { sub: 'hall', params: {} });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['명예의 전당', '역전 · 데스', '로밍 · 한타 · 오브젝트', '관계']);
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('명예의 전당');
    expect(screen.getByRole('tabpanel').id).toBe('rec-panel-hall');
    expect(tableOf(document.body, '개인 기록')).toBeTruthy();
    cleanup();
    render(Records, { sub: 'mvp', params: {} });
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('명예의 전당');
    cleanup();
    render(Records, { sub: 'nope', params: {} });
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('명예의 전당');
  });
  it('탭을 누르면 라우트가 바뀌고(#/records/ties) 수식 줄이 비워진다', async () => {
    const { rerender } = render(Records, { sub: 'hall', params: {} });
    await fireEvent.click(bodyRows(tableOf(document.body, 'MVP'))[0]!);
    expect(fx.text).toBe('=MVP 9회 ÷ 43판 = 21%');
    await fireEvent.click(screen.getByRole('tab', { name: '관계' }));
    expect(location.hash).toBe('#/records/ties');
    await rerender({ sub: 'ties', params: {} });
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('관계');
    expect(tableOf(document.body, '동반 사망')).toBeTruthy();
    expect(fx.text).toBe('');
  });
  it('데이터가 없으면 스켈레톤', () => {
    app.data = null;
    const { container } = render(Records, { sub: 'hall', params: {} });
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
  });
});

describe('Hall — 명예의 전당', () => {
  beforeEach(() => { router.start(); });
  afterEach(() => { router.stop(); });

  it('경기 기록 네 행 · 개인 기록(초상·KDA·승패 채움·시각) · MVP 안내 · 펜타', () => {
    const { container } = render(Hall, { data: PAYLOAD });
    const sv = tableOf(container, '경기 기록');
    expect(heads(sv)).toEqual(['기록', '시간', '킬', '시각']);
    expect(bodyRows(sv).map(cells)).toEqual([
      ['최단 경기', '15:14', '22', '9. 3.'], ['최장 경기', '41:36', '55', '9. 3.'],
      ['최다 킬 경기', '38:44', '82', '9. 3.'], ['경기당 평균 킬', '', '48.4', '전체 57경기'],
    ]);
    expect(sv.querySelector('tbody tr[tabindex]')).toBeNull();   // 갈 곳이 없어 선택 없음

    const h = tableOf(container, '개인 기록');
    expect(heads(h)).toEqual(['기록', '멤버', '값', '챔피언', 'KDA', '결과', '시간', '시각']);
    const rows = bodyRows(h);
    expect(cells(rows[0]!)).toEqual(['최고 KDA', '외 걸', '28', '아리', '14/1/14', '승', '30:04', '9. 3.']);
    expect(rows[0]!.querySelectorAll('td:not(.rn)')[3]!.querySelector('img.champ')?.getAttribute('src')).toContain('/16.18.1/img/champion/Ahri.png');
    expect(rows[0]!.querySelectorAll('td:not(.rn)')[5]!.classList.contains('win')).toBe(true);
    expect(rows[1]!.querySelectorAll('td:not(.rn)')[5]!.classList.contains('loss')).toBe(true);
    expect(cells(rows[4]!)).toEqual(['최장 연승', 'Choi Eun Ho', '6연승', '', '', '', '', '']);
    expect(rows[4]!.querySelector('img')).toBeNull();

    const mvp = tableOf(container, 'MVP');
    expect(heads(mvp)).toEqual(['멤버', 'MVP', '판']);
    expect(bodyRows(mvp).map(cells)).toEqual([['조 C', '9', '43'], ['외 걸', '7', '55']]);
    expect(screen.getByRole('button', { name: 'MVP 설명' })).toBeTruthy();
    const notes = [...container.querySelectorAll('.note')].map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
    expect(notes.some((n) => n?.includes('판수 미달 3명 제외(4회) · 표 합계 16회 + 4회 = 총 20경기 · 문턱 5판'))).toBe(true);
    expect(notes.some((n) => n?.includes('5판 이상 참여한 멤버만 집계합니다 · 11명은 판수 미달로 제외.'))).toBe(true);

    const pent = tableOf(container, '펜타킬');
    expect(bodyRows(pent).map(cells)).toEqual([['코 파', '유나라'], ['코 파', '징크스']]);
  });
  it('펜타가 없으면 빈 상태 문장', () => {
    const { container } = render(Hall, { data: { ...PAYLOAD, records: { ...RECORDS, pentas: [] } } as GuildPayload });
    expect(container.querySelector('table[aria-label="펜타킬"]')).toBeNull();
    expect(container.querySelector('.empty')?.textContent).toBe('아직 펜타킬이 없습니다.');
  });
  it('행 선택 → 수식 줄, 같은 행 다시 → 멤버 화면 · 다른 표를 선택하면 앞 선택은 풀린다', async () => {
    const { container } = render(Hall, { data: PAYLOAD });
    const row = bodyRows(tableOf(container, '개인 기록'))[0]!;
    await fireEvent.click(row);
    expect(fx.text).toBe('=최고 KDA 28 · 외 걸 · 아리 14/1/14 · 승 · 30:04 · 9. 3.');
    expect(row.getAttribute('aria-selected')).toBe('true');
    const mvpRow = bodyRows(tableOf(container, 'MVP'))[0]!;
    await fireEvent.keyDown(mvpRow, { key: 'Enter' });
    expect(fx.text).toBe('=MVP 9회 ÷ 43판 = 21%');
    expect(row.getAttribute('aria-selected')).toBe('false');
    expect(mvpRow.getAttribute('aria-selected')).toBe('true');
    await fireEvent.click(mvpRow);
    expect(location.hash).toBe(`#/m/${encodeURIComponent('조 C')}`);
  });
});

describe('Deaths — 역전 · 데스', () => {
  beforeEach(() => { router.start(); });
  afterEach(() => { router.stop(); });

  it('역전 표: 분모 0 은 빈 셀 · 리드 실패율 ↓ 정렬 · 데스 표: 0판 행은 비율 없음 · 히트맵 자리', () => {
    const { container } = render(Deaths, { data: PAYLOAD, entered: false });
    const cb = tableOf(container, '역전 · 리드 실패');
    expect(heads(cb)).toEqual(['멤버', '열세 판', '역전', '역전승률', '우세 판', '리드 실패', '리드 실패율']);
    expect(bodyRows(cb).map(cells)).toEqual([
      ['외 걸', '7', '3', '43%', '5', '1', '20%'],
      ['앙앙맹', '0', '0', '-', '3', '0', '0%'],
    ]);
    expect([...cb.querySelectorAll('thead th[scope="col"]')][6]!.getAttribute('aria-sort')).toBe('descending');
    expect(screen.getByRole('button', { name: '역전승률 설명' })).toBeTruthy();

    const d = tableOf(container, '첫 데스 · 헌납');
    expect(heads(d)).toEqual(['멤버', '판', '첫 데스', '퍼블 헌납률', '헌납 현상금']);
    expect(bodyRows(d).map(cells)).toEqual([['외 걸', '6', '11.5분', '17%', '1,504'], ['앙앙맹', '0', '-', '-', '-']]);
    expect(bodyRows(d)[0]!.querySelectorAll('td:not(.rn)')[4]!.classList.contains('bar')).toBe(true);
    expect(container.querySelector('.heat')).toBeTruthy();
  });
  it('행 선택 → 근거(분자/분모), 다시 → 멤버 화면', async () => {
    const { container } = render(Deaths, { data: PAYLOAD, entered: false });
    const row = bodyRows(tableOf(container, '역전 · 리드 실패'))[0]!;
    await fireEvent.click(row);
    expect(fx.text).toBe('=역전승률 3/7 = 43% · 리드 실패율 1/5 = 20%');
    const drow = bodyRows(tableOf(container, '첫 데스 · 헌납'))[0]!;
    await fireEvent.click(drow);
    expect(fx.text).toBe('=퍼블 헌납률 17% (6판) · 첫 데스 11.5분 · 헌납 현상금 1,504');
    await fireEvent.click(drow);
    expect(location.hash).toBe(`#/m/${encodeURIComponent('외 걸')}`);
  });
});

describe('Play — 로밍 · 한타 · 오브젝트', () => {
  beforeEach(() => { router.start(); });
  afterEach(() => { router.stop(); });

  it('로밍(라인 띠·막대) · 한타 · 용(한국어 이름·채움은 획득 문턱)', async () => {
    const { container } = render(Play, { data: PAYLOAD });
    const roam = tableOf(container, '로밍');
    expect(heads(roam)).toEqual(['멤버', '라인', '프레임', '로밍 비율']);
    expect(bodyRows(roam).map(cells)).toEqual([['쟈부쟈부', '서폿', '29', '86%'], ['외 걸', '미드', '110', '31%']]);
    expect(bodyRows(roam)[0]!.querySelector('td.lane-sup')).toBeTruthy();
    expect(bodyRows(roam)[0]!.querySelector('td.bar')).toBeTruthy();
    expect(screen.getByRole('button', { name: '로밍 비율 설명' })).toBeTruthy();

    const f = tableOf(container, '한타');
    expect(bodyRows(f).map(cells)).toEqual([['진뀨뀨', '45', '41', '91%']]);

    const dr = tableOf(container, '용');
    expect(heads(dr)).toEqual(['용', '획득', '승률']);
    expect(bodyRows(dr).map(cells)).toEqual([['화학공학', '40', '63%'], ['장로', '1', '100%']]);
    const wrCells = bodyRows(dr).map((r) => r.querySelectorAll('td:not(.rn)')[2]!);
    expect(wrCells[0]!.classList.contains('win')).toBe(true);
    expect(wrCells[1]!.classList.contains('win')).toBe(false);   // 1회는 채우지 않는다
    expect(dr.querySelector('tbody tr[tabindex]')).toBeNull();

    await fireEvent.click(bodyRows(f)[0]!);
    expect(fx.text).toBe('=한타 참여율 41/45 = 91%');
    await fireEvent.click(bodyRows(roam)[0]!);
    expect(fx.text).toBe('=로밍 비율 86% · 서폿 · 0~15분 프레임 29');
    await fireEvent.click(bodyRows(roam)[0]!);
    expect(location.hash).toBe(`#/m/${encodeURIComponent('쟈부쟈부')}`);
  });
  it('오브젝트 기록이 없으면 빈 상태 문장', () => {
    const { container } = render(Play, { data: { ...PAYLOAD, objectives_available: false, fun: { ...PAYLOAD.fun, dragons: [] } } as GuildPayload });
    expect(container.querySelector('table[aria-label="용"]')).toBeNull();
    expect(container.querySelector('.empty')?.textContent).toBe('아직 오브젝트 기록이 없습니다.');
  });
});

describe('Ties — 관계', () => {
  beforeEach(() => { router.start(); });
  afterEach(() => { router.stop(); });

  it('네 표의 머리와 값 · 두 사람 행은 비교 화면으로, 한 사람 행은 멤버 화면으로', async () => {
    const { container } = render(Ties, { data: PAYLOAD });
    const co = tableOf(container, '동반 사망');
    expect(heads(co)).toEqual(['멤버 A', '멤버 B', '함께 판', '동반 사망', '판당']);
    expect(bodyRows(co).map(cells)).toEqual([['윙봉현', '주 암', '2', '7', '3.50']]);
    const fl = tableOf(container, '어시스트 흐름');
    expect(heads(fl)).toEqual(['어시스트 멤버', '킬 멤버', '어시', '킬 멤버 킬', '비중', '함께 판']);
    expect(bodyRows(fl).map(cells)).toEqual([['주 암', '현 우', '9', '12', '75%', '3']]);
    const sp = tableOf(container, '연속킬');
    expect(bodyRows(sp).map(cells)).toEqual([['외 걸', '오로라', '14', '25분']]);
    const st = tableOf(container, '연속킬 저지');
    expect(heads(st)).toEqual(['저지 멤버', '연속킬 멤버', '당시 연속킬']);
    expect(bodyRows(st).map(cells)).toEqual([['앙앙맹', '외 걸', '14']]);
    expect(screen.getByRole('button', { name: '판당 설명' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '비중 설명' })).toBeTruthy();

    await fireEvent.click(bodyRows(co)[0]!);
    expect(fx.text).toBe('=판당 동반 사망 7/2판 = 3.50 · 윙봉현 · 주 암');
    await fireEvent.click(bodyRows(co)[0]!);
    expect(location.hash).toBe(`#/m/${encodeURIComponent('윙봉현')}/vs/${encodeURIComponent('주 암')}`);
    await fireEvent.click(bodyRows(fl)[0]!);
    expect(fx.text).toBe('=비중 9/12킬 = 75% · 주 암 → 현 우 · 함께 3판');
    await fireEvent.click(bodyRows(sp)[0]!);
    expect(fx.text).toBe('=연속킬 14 · 외 걸 · 오로라 · 25분');
    await fireEvent.click(bodyRows(sp)[0]!);
    expect(location.hash).toBe(`#/m/${encodeURIComponent('외 걸')}`);
    await fireEvent.click(bodyRows(st)[0]!);
    expect(fx.text).toBe('=연속킬 14 저지 · 앙앙맹 → 외 걸');
  });
  it('표 이름·머리에 금지어가 없다', () => {
    const { container } = render(Ties, { data: PAYLOAD });
    const text = [...container.querySelectorAll('.cap, th')].map((e) => e.textContent).join(' ');
    for (const bad of ['궁합', '판 수', '바텀', '서포터', '레이팅', '스탯', '선수', '같이 뛴']) expect(text).not.toContain(bad);
  });
});
