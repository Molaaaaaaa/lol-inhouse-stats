/**
 * 경기 화면 테스트 픽스처 — 실데이터(2026-09-19, 57경기)의 모양을 작게 줄인 것.
 * 경기 3개(상세 있는 것 둘·없는 것 하나) · 상세 하나(팀 둘 × 2명, 킬 3개, 타임라인 6분) · 재미 지표 조각.
 */
import type { FunStats, GuildPayload, LaneId, MatchDetail, MatchDetailPlayer, RecentMatch } from '../../src/lib/data/types';

const P = (name: string, champ: string, lane: LaneId) => ({ name, champ, lane });

export const RECENT: RecentMatch[] = [
  {
    match_id: 'mold', ts: 1789483391629, d: 1,
    teams: [
      { win: false, players: [P('레드탑', 'Renekton', 'TOP'), P('레드정글', 'XinZhao', 'JUNGLE'), P('레드미드', 'TwistedFate', 'MIDDLE'), P('레드원딜', 'Kaisa', 'BOTTOM'), P('레드서폿', 'Rell', 'UTILITY')] },
      { win: true, players: [P('블루서폿', 'Pantheon', 'UTILITY'), P('블루탑', 'Zaahen', 'TOP'), P('블루미드', 'Zoe', 'MIDDLE'), P('블루정글', 'Vi', 'JUNGLE'), P('블루원딜', 'Ziggs', 'BOTTOM')] },
    ],
  },
  {
    match_id: 'mnew', ts: 1789486490844, d: 1,
    teams: [
      { win: true, players: [P('가', 'Ahri', 'MIDDLE'), P('나', 'Gwen', 'TOP')] },
      { win: false, players: [P('다', 'Akali', 'MIDDLE'), P('라', 'Sett', 'TOP')] },
    ],
  },
  {
    match_id: 'mnodet', ts: 1789479186226,
    teams: [
      { win: true, players: [P('마', 'Jhin', 'BOTTOM')] },
      { win: false, players: [P('바', 'Ezreal', 'BOTTOM')] },
    ],
  },
];

function player(pid: number, name: string, champ: string, lane: LaneId, o: Partial<MatchDetailPlayer> = {}): MatchDetailPlayer {
  return {
    pid, name, champ, lane,
    k: 5, d: 2, a: 7, kda: 6, cs: 180, gold: 12000, dmg: 20000, dmg_taken: 15000, dmg_turret: 3000, vision: 20,
    items: [3748, 3111, 3078, 6333, 2055, 3340, 3364], spells: [4, 12], perks: [8400, 8000],
    extra: { solo_kills: 2, time_dead: 95, dmg_physical: 18500, first_blood: 0 },
    build: [{ item: 1120, minute: 0 }, { item: 1029, minute: 3 }, { item: 3078, minute: 12 }, { item: 1029, minute: 12, sold: true } as { item: number; minute: number }],
    kda_events: [{ s: 545, t: 'D', vs: 'Renekton' }, { s: 552, t: 'A', vs: 'XinZhao' }, { s: 900, t: 'K', vs: 'Renekton' }, { s: 1500, t: 'D' } as { s: number; t: 'D'; vs: string }],
    ...o,
  };
}

export const DETAIL: MatchDetail = {
  match_id: 'mnew', duration: 1903,
  teams: [
    {
      team_id: 100, win: true, kills: 45, deaths: 20, assists: 90, gold: 62300,
      objectives: { towers: 10, dragons: 1, barons: 2, heralds: 1, grubs: 3 },
      bans: ['Nocturne', 'Kindred'],
      players: [player(2, '가', 'Ahri', 'MIDDLE', { k: 9, d: 4, a: 14, kda: 5.75, dmg: 39324 }), player(1, '나', 'Gwen', 'TOP', { dmg: 12000, items: [1001, 0, 0] })],
    },
    {
      team_id: 200, win: false, kills: 20, deaths: 45, assists: 30, gold: 48100,
      objectives: { towers: 3, dragons: 2, barons: 0, heralds: 0, grubs: 3 },
      bans: [],
      players: [player(4, '라', 'Sett', 'TOP', { dmg: 8000 }), player(3, '다', 'Akali', 'MIDDLE', { dmg: 25000 })],
    },
  ],
  kills: [
    { a: 2, v: 4, m: 5, x: 0.611, y: 0.586 },
    { a: 3, v: 1, m: 12, x: 0.2, y: 0.8 },
    { a: 0, v: 2, m: 20, x: 0.5, y: 0.5 },
  ],
  timeline: {
    minutes: [0, 1, 2, 3, 4, 5],
    a_gold: [2500, 2525, 4106, 5600, 7000, 9000],
    b_gold: [2500, 2500, 3744, 4821, 6544, 7500],
    gold_diff: [0, 25, 362, 779, 456, 1500],
    cs_diff: [0, 0, 1, 2, 3, 4], xp_diff: [0, 0, 10, 20, 30, 40],
  },
};

export const FUN = {
  sides: {
    team: [{ side: 'BLUE', games: 57, wins: 27, winrate: 0.474 }, { side: 'RED', games: 57, wins: 30, winrate: 0.526 }],
    players: [
      { discord_name: '양쪽', blue_g: 8, blue_w: 5, red_g: 11, red_w: 8 },
      { discord_name: '한쪽', blue_g: 3, blue_w: 3, red_g: 0, red_w: 0 },
      { discord_name: '차이큼', blue_g: 6, blue_w: 6, red_g: 5, red_w: 1 },
    ],
  },
  by_hour: [{ hour: 22, games: 17, winrate: 0.5 }, { hour: 0, games: 9, winrate: 0.5 }],
  by_duration: [
    { discord_name: '많이', short_g: 8, short_wr: 0.75, mid_g: 9, mid_wr: 0.556, long_g: 2, long_wr: 1 },
    { discord_name: '적게', short_g: 1, short_wr: 1, mid_g: 1, mid_wr: 0, long_g: 0, long_wr: 0 },
  ],
} as unknown as FunStats;

export const CHAMP_KO: Record<string, string> = {
  Ahri: '아리', Gwen: '그웬', Akali: '아칼리', Sett: '세트', Renekton: '레넥톤', XinZhao: '신 짜오', Zaahen: '자헨',
  Nocturne: '녹턴', Kindred: '킨드레드',
};

export const PAYLOAD = {
  name: '테스트 방', patch: '16.18.1', timestamp: '2026-09-19T00:00:00+00:00',
  summary: { total_games: 3, player_count: 4, avg_winrate: 0.5, avg_duration_sec: 1700 },
  min_games: 5, min_games_excluded: 0, min_games_lane: 3, min_days: 1, min_days_excluded: 0,
  metric_meta: {
    winrate: { label: '승률', lane: false, fmt: 'pct', desc: '' },
    kda: { label: 'KDA', lane: false, fmt: '', desc: '' },
    total_dmg: { label: '총 딜', lane: false, fmt: 'k', desc: '' },
    dmg_taken: { label: '받은 피해', lane: false, fmt: 'k', desc: '' },
    vision: { label: '시야 점수', lane: false, fmt: '', desc: '' },
    solo_kills: { label: '솔로킬', lane: false, fmt: '', desc: '' },
  },
  champ_ko: CHAMP_KO,
  objectives_available: true, ban_available: true,
  fun: FUN,
  recent_matches: RECENT,
  players: {},
} as unknown as GuildPayload;
