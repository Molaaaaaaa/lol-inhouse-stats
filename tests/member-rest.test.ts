import { describe, expect, it } from 'vitest';
import {
  hourRows, metricLanes, metricRows, vsRows, type VsSource,
} from '../src/lib/member-rest';
import type { H2HEntry, LaneId, MetricCell, MetricGroup, MetricMeta, PlayerPub } from '../src/lib/data/types';

// ── 픽스처 ─────────────────────────────────────────────────────────────
// 멤버 키 순서와 h2h 키 순서가 **다르다**(실데이터: p17|p10). 내가 a 쪽인 쌍과 b 쪽인 쌍을 하나씩 둔다.
const player = (name: string, tag?: string): PlayerPub =>
  ({ name, ...(tag ? { tag } : {}) }) as unknown as PlayerPub;
const h2h = (o: Partial<H2HEntry>): H2HEntry => ({
  with_games: 0, with_wins: 0, with_winrate: null, vs_games: 0, a_wins: 0, b_wins: 0, a_winrate: null, lanes: [], ...o,
});

const VS: VsSource = {
  players: {
    p1: player('나'),
    p2: player('상대A'),
    p3: player('상대B'),
    p4: player('안 만난 사람'),
    p5: player('팀만'),
    p6: player('겹침', '1'),
    p7: player('겹침', '2'),
  },
  h2h: {
    'p1|p2': h2h({ vs_games: 4, a_wins: 3, b_wins: 1, with_games: 2, with_wins: 2 }),   // 내가 a
    'p3|p1': h2h({ vs_games: 2, a_wins: 2, b_wins: 0, with_games: 5, with_wins: 1 }),   // 내가 b → 뒤집는다
    'p1|p5': h2h({ with_games: 3, with_wins: 1 }),                                       // 같은 팀만
    'p6|p1': h2h({ vs_games: 1, a_wins: 1 }),                                            // 동명이인
  },
  fun: {
    kill_matrix: [
      { killer: '나', victim: '상대A', kills: 5 },
      { killer: '상대A', victim: '나', kills: 2 },
      { killer: '상대B', victim: '나', kills: 7 },
      { killer: '겹침', victim: '나', kills: 3 },
    ],
  },
};

describe('vsRows — 나 기준 상대별 전적', () => {
  const rows = vsRows(VS, 'p1');
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));

  it('h2h 에 든 쌍만 행이 된다(안 만난 사람 없음) · 함께 판 ↓ 정렬', () => {
    expect(rows.map((r) => r.key)).toEqual(['p3', 'p5', 'p2', 'p6']);
    expect(by.p4).toBeUndefined();
  });
  it('내가 a 쪽이면 a_wins 가 내 승', () => {
    expect(by.p2).toMatchObject({ opp: '상대A', vsGames: 4, myWins: 3, oppWins: 1, vsWr: 0.75, withGames: 2, withWins: 2, withWr: 1 });
  });
  it('내가 b 쪽이면 a_wins/b_wins 를 뒤집는다 — with_wins 는 그대로', () => {
    expect(by.p3).toMatchObject({ opp: '상대B', vsGames: 2, myWins: 0, oppWins: 2, vsWr: 0, withGames: 5, withWins: 1, withWr: 0.2 });
  });
  it('킬·데스는 이름으로 찾고 방향을 보존한다. 항목이 없으면 0', () => {
    expect(by.p2).toMatchObject({ kills: 5, deaths: 2 });
    expect(by.p3).toMatchObject({ kills: 0, deaths: 7 });
  });
  it('맞대결이 없으면 맞대결 승률·킬·데스는 null(빈 칸)', () => {
    expect(by.p5).toMatchObject({ vsGames: 0, vsWr: null, kills: null, deaths: null, withGames: 3 });
  });
  it('이름이 겹치는 상대는 킬을 가릴 수 없어 null · 표시명은 이름~순번', () => {
    expect(by.p6).toMatchObject({ opp: '겹침~1', vsGames: 1, myWins: 0, oppWins: 1, kills: null, deaths: null });
  });
  it('모르는 멤버 키·빈 payload → 빈 배열', () => {
    expect(vsRows(VS, 'p99')).toEqual([]);
    expect(vsRows({ players: {}, h2h: {} }, 'p1')).toEqual([]);
  });
});

describe('hourRows — 시간대별 판수', () => {
  it('시각 오름차순 · 같은 시각 합산 · 0판·범위 밖은 뺀다 · 라벨은 hourKo', () => {
    const rows = hourRows([
      { hour: 22, games: 3 }, { hour: 0, games: 1 }, { hour: 22, games: 2 },
      { hour: 5, games: 0 }, { hour: 24, games: 9 }, { hour: 1.5, games: 2 },
    ]);
    expect(rows).toEqual([
      { hour: 0, games: 1, label: '00시' },
      { hour: 22, games: 5, label: '22시' },
    ]);
  });
  it('없으면 빈 배열', () => {
    expect(hourRows(null)).toEqual([]);
    expect(hourRows([])).toEqual([]);
  });
});

// ── 세부 지표 ──────────────────────────────────────────────────────────
const META: Record<string, MetricMeta> = {
  dpm: { label: '분당 딜', lane: false, fmt: '', desc: '1분당 챔피언에게 넣은 피해.' },
  gold_diff_10: { label: '골드차@10', lane: true, fmt: '', desc: '10분 시점 맞라인 상대와의 골드 차이. 대회 지표의 GD10 입니다.' },
  cs10: { label: 'CS@10', lane: true, fmt: '', desc: '10분 시점 내가 먹은 CS.' },
  time_dead: { label: '죽어 있던 시간', lane: false, fmt: 'sec', desc: '죽어서 누워 있던 시간의 판당 평균.' },
  kp: { label: '킬 관여', lane: false, fmt: 'pct', desc: '킬 관여율.' },
  kda: { label: 'KDA', lane: false, fmt: '', desc: '(킬+어시)÷데스. 판별 KDA를 평균 내면 한 판이 지배합니다.' },
};
const GROUPS: MetricGroup[] = [
  { group: '종합', metrics: ['dpm', 'kp', 'unknown_key'] },
  { group: '라인전', metrics: ['gold_diff_10', 'cs10'] },
  { group: '생존', metrics: ['time_dead'] },
  { group: '빈 그룹', metrics: ['nothing'] },
];
const cell = (value: number, games: number, rank: number, n: number, pct: number, lane: LaneId | null = null): MetricCell =>
  ({ value, games, rank, n, pct, lane });
const P: Pick<PlayerPub, 'metrics' | 'metrics_lane'> = {
  metrics: {
    dpm: cell(836.28, 29, 4, 25, 0.86),
    kp: cell(0.612, 29, 2, 25, 0.94),
    gold_diff_10: cell(120.5, 19, 9, 29, 0.707, 'BOTTOM'),
    cs10: cell(77.1, 2, 9, 29, 0.707, 'BOTTOM'),
    time_dead: cell(95, 29, 3, 25, 0.9),
  },
  metrics_lane: {
    JUNGLE: { gold_diff_10: cell(-40, 7, 9, 13, 0.346, 'JUNGLE'), cs10: cell(65.1, 7, 9, 13, 0.346, 'JUNGLE') },
    BOTTOM: { cs10: cell(77.1, 2, 9, 29, 0.707, 'BOTTOM') },
  },
};
const OPTS = { lower: ['time_dead'], minGames: 5, minGamesLane: 3 };

describe('metricRows — 그룹 순서의 표 행', () => {
  const groups = metricRows(P, META, GROUPS, '', OPTS);

  it('metric_groups 순서 · 셀 없는 지표와 빈 그룹은 빠진다', () => {
    expect(groups.map((g) => g.group)).toEqual(['종합', '라인전', '생존']);
    expect(groups[0]!.rows.map((r) => r.key)).toEqual(['dpm', 'kp']);
  });
  it('라벨은 mLabel · 값은 fmtMetric(서식은 meta) · 순위는 rank/n', () => {
    const [dpm, kp] = groups[0]!.rows;
    expect(dpm).toMatchObject({ label: '분당 딜', text: '836.28', rankText: '4/25', games: 29, pct: 0.86, bar: 86, lane: null, lower: false, thin: false });
    expect(kp).toMatchObject({ label: '킬 관여', text: '61%' });
    expect(groups[2]!.rows[0]!.text).toBe('1:35');
  });
  it('코드는 설명에 실제로 있을 때만 — 그룹의 hasCode 도 그에 따른다', () => {
    const lane = groups[1]!;
    expect(lane.rows.map((r) => r.code)).toEqual(['GD10', '']);
    expect(lane.hasCode).toBe(true);
    expect(groups[0]!.hasCode).toBe(false);
  });
  it('코드가 라벨과 같으면(KDA) 판을 붙이지 않는다', () => {
    const g = metricRows({ metrics: { kda: cell(2.98, 29, 7, 25, 0.74) } }, META, [{ group: '종합', metrics: ['kda'] }]);
    expect(g[0]!.rows[0]).toMatchObject({ label: 'KDA', code: '' });
    expect(g[0]!.hasCode).toBe(false);
  });
  it('낮을수록 좋은 지표는 막대가 없다(bar null) — 백분위 글자는 남는다', () => {
    expect(groups[2]!.rows[0]).toMatchObject({ key: 'time_dead', lower: true, bar: null, pct: 0.9 });
  });
  it('통합 보기에서 라인별 지표는 대표 라인을 밝힌다 · 문턱은 라인별 3판, 통합 5판', () => {
    const [gd, cs] = groups[1]!.rows;
    expect(gd).toMatchObject({ lane: 'BOTTOM', games: 19, thin: false });
    expect(cs).toMatchObject({ lane: 'BOTTOM', games: 2, thin: true });
  });
  it('라인 보기는 metrics_lane[라인]만 — lane 은 null(위에 이미 적혀 있다)', () => {
    const jg = metricRows(P, META, GROUPS, 'JUNGLE', OPTS);
    expect(jg.map((g) => g.group)).toEqual(['라인전']);
    expect(jg[0]!.rows.map((r) => [r.key, r.lane, r.thin])).toEqual([['gold_diff_10', null, false], ['cs10', null, false]]);
    expect(metricRows(P, META, GROUPS, 'TOP', OPTS)).toEqual([]);
  });
  it('meta·groups 가 없으면 빈 배열, 문턱 기본값은 5·3', () => {
    expect(metricRows(P, META, null, '')).toEqual([]);
    const g = metricRows({ metrics: { cs10: cell(1, 4, 1, 2, 0.5) } }, META, [{ group: 'x', metrics: ['cs10'] }]);
    expect(g[0]!.rows[0]!.thin).toBe(false);   // 라인별 지표 4판 ≥ 3
  });
});

describe('metricLanes', () => {
  it('화면 순서(탑→서폿)로, 모르는 키는 뺀다', () => {
    expect(metricLanes(P)).toEqual(['JUNGLE', 'BOTTOM']);
    expect(metricLanes({ metrics_lane: { UTILITY: {}, TOP: {}, WEIRD: {} } })).toEqual(['TOP', 'UTILITY']);
    expect(metricLanes({})).toEqual([]);
  });
});
