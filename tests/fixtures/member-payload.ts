/**
 * 멤버 화면 테스트 픽스처 — 실데이터(2026-09-18)의 모양을 작게 줄인 payload 조각.
 * p1 앙앙맹(라인 3개, 주 라인 원딜) · p2 맹구(5판 미만) · p3 Faker(비교용).
 */
import type { GuildPayload, PlayerPub, ProfileAxis } from '../../src/lib/data/types';

export const META = {
  winrate: { label: '승률', lane: false, fmt: 'pct', desc: '이긴 판의 비율.' },
  kda: { label: 'KDA', lane: false, fmt: '', desc: '(킬+어시)÷데스.' },
  kp: { label: '킬 관여', lane: false, fmt: 'pct', desc: '팀 킬 중 관여한 비율.' },
  dpm: { label: '분당 딜', lane: false, fmt: '', desc: '1분당 챔피언에게 넣은 피해.' },
  dmg_share: { label: '딜 비중', lane: false, fmt: 'pct', desc: '팀 딜 중 몫.' },
  vision: { label: '시야 점수', lane: false, fmt: '', desc: '시야 점수.' },
  deaths_per_game: { label: '판당 데스', lane: false, fmt: '', desc: '판당 데스 수.' },
} as const;

function axis(key: string, label: string, score: number, rank: number, n: number, games: number, delta?: number, parts: ProfileAxis['parts'] = []): ProfileAxis {
  return { key, label, desc: label, score, pct: 0.5, rank, n, games, parts, ...(delta != null ? { delta } : {}) };
}
export const PROFILE: ProfileAxis[] = [
  axis('attack', '공격', 3.86, 4, 25, 29, -0.48, [{ key: 'dpm', label: '분당 딜', value: 836.28, rank: 4, n: 25 }, { key: 'dmg_share', label: '딜 비중', value: 0.234, rank: 5, n: 25 }]),
  axis('laning', '라인전', 2.06, 21, 29, 19),
  axis('survive', '생존', 3.02, 13, 25, 29, -0.34, [{ key: 'deaths_per_game', label: '판당 데스', value: 4.9, rank: 11, n: 25 }]),
  axis('fight', '교전', 2.94, 12, 25, 29, 0.4, [{ key: 'kp', label: '킬 관여', value: 0.556, rank: 12, n: 25 }]),
  axis('vision', '시야', 1.35, 21, 25, 29, undefined, [{ key: 'vision', label: '시야 점수', value: 24.14, rank: 21, n: 25 }]),
  axis('mechanics', '개인기', 3.31, 4, 25, 29, -0.52),
];

/**
 * 발행 payload 에는 사다리 필드(cp·ratings)가 아직 실려 온다 — 화면은 읽지 않는다. 읽지 않음을 보이려고 일부러 남긴다
 * (티어·MMR·CP·배치 글자가 화면에 없다는 단언이 이 필드가 있는 payload 로 돈다).
 */
const LADDER_P1 = { name: '앙앙맹', games: 29, main_lane: 'JUNGLE', mmr: 1032, cp: 1020, tier: '2티어', points: 20, to_next: 80, placed: true, lanes: {}, replay: [] };

function player(name: string, games: number, wins: number, extra: Partial<PlayerPub> = {}): PlayerPub {
  const losses = games - wins;
  return {
    name, account_count: 1, accounts: [name],
    record: { games, wins, losses, winrate: games ? wins / games : 0, ci_lower: 0.3, kda: 2.98, kp: 0.556, dpm: 836.3 },
    form: { form: '3-2', dir: 'W', winrate: 0.6, streak: 2 },
    lanes: [], role_dist: [], champions: [], recent_games: [],
    partners_best: [], partners_worst: [], nemesis_victim: { nemesis: [], victim: [] },
    killer_champions: { killed: [], killed_by: [] }, by_hour: [], profile: [],
    ...extra,
  };
}

export const PAYLOAD = {
  guild_id: 'gtest', name: '테스트 방', patch: '16.10.1', timestamp: '2026-09-18T20:31:54',
  summary: { total_games: 57, player_count: 3, avg_winrate: 0.5, avg_duration_sec: 1800 },
  warnings: [], min_games: 5, min_games_excluded: 0, min_games_lane: 3, min_days: 0, min_days_excluded: 0,
  leaderboard: [], rankings: {}, rankings_pending: [], metric_groups: [],
  metric_meta: META, lower_better: ['deaths_per_game'],
  profile_scale: { step: 0.01, spread: 1.5, room_avg: 2.75, max: 5, shrink_k: 2, rings: 5, delta_min: 0.3 },
  cp: {
    p1: LADDER_P1,
    p2: { name: '맹구', games: 3, main_lane: 'TOP', mmr: 1010, cp: 1005, tier: '3티어', points: 55, to_next: 45, placed: false, lanes: {}, replay: [] },
    p3: { name: 'Faker', games: 12, main_lane: 'MIDDLE', mmr: 1120, cp: 1160, tier: '1티어', points: 10, to_next: null, placed: true, lanes: {}, replay: [] },
  },
  ratings: {
    p1: { ...LADDER_P1, playable: ['BOTTOM', 'JUNGLE'], strength: 0.1 },
    p2: { name: '맹구', games: 3, main_lane: 'TOP', playable: ['TOP'], mmr: 1010, cp: 1005, tier: '3티어', placed: false, strength: 0, lanes: {} },
    p3: { name: 'Faker', games: 12, main_lane: 'MIDDLE', playable: ['MIDDLE'], mmr: 1120, cp: 1160, tier: '1티어', placed: true, strength: 0.3, lanes: {} },
  },
  records: {}, server_records: { shortest: { dur: 0, ts: 0, kills: 0 }, longest: { dur: 0, ts: 0, kills: 0 }, most_kills: { dur: 0, ts: 0, kills: 0 }, avg_kills: 0 },
  mvp: [], mvp_excluded: { awards: 0, players: 0 }, synergy: [], trios: [],
  h2h: {
    // 키 순서가 뒤집혀 있다 — p3 가 앞. a=p3 기준 기록
    'p3|p1': { with_games: 2, with_wins: 2, with_winrate: 1, vs_games: 4, a_wins: 3, b_wins: 1, a_winrate: 0.75,
      lanes: [
        { lane: 'MIDDLE', same_lane: true, a_champ: 'Ahri', b_champ: 'Zed', a_win: true },
        { lane: 'BOTTOM', same_lane: false, a_champ: 'Kaisa', b_champ: 'Leona', a_win: false },
      ] },
  },
  champion_meta: [], champion_meta_lane: [], champion_matchups: [],
  champ_ko: { Kaisa: '카이사', Zeri: '제리', Ahri: '아리', Zed: '제드', Leona: '레오나' },
  ban_meta: [], ban_available: false, objectives_available: false,
  fun: {} as GuildPayload['fun'], recent_matches: [],
  baseline: {
    roles: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'], tiers: ['GOLD', 'MASTER'], tier_ko: {},
    quantiles: [5, 10, 25, 50, 75, 90, 95], games: { GOLD: 6220, MASTER: 20000 }, patch_min: '16.10',
    metrics: {
      dpm: { label: '분당 딜', lower_better: false, by_role: { BOTTOM: { n: 100, q: [400, 450, 520, 600, 700, 800, 860], spread: 1, tier_med: {} } } },
      kp: { label: '킬 관여', lower_better: false, by_role: { BOTTOM: { n: 100, q: [0.3, 0.35, 0.42, 0.5, 0.58, 0.65, 0.7], spread: 1, tier_med: {} } } },
    },
  },
  players: {
    p1: player('앙앙맹', 29, 13, {
      account_count: 2, accounts: ['앙앙맹', 'wo zhi xiang si'],
      lanes: [
        { lane: 'BOTTOM', games: 19, winrate: 0.368, kda: 2.99, dpm: 883.1, kp: 0.554, cs: 216.5, vision: 20.6, dmg_share: 0.252 },
        { lane: 'JUNGLE', games: 7, winrate: 0.714, kda: 2.96, dpm: 728.3, kp: 0.6, cs: 181.7, vision: 35.6, dmg_share: 0.186 },
        { lane: 'MIDDLE', games: 2, winrate: 0.5, kda: 3.1, dpm: 700, kp: 0.5, cs: 150, vision: 20, dmg_share: 0.2 },
      ],
      role_dist: [{ lane: 'BOTTOM', games: 19, pct: 0.655 }, { lane: 'JUNGLE', games: 7, pct: 0.241 }, { lane: 'MIDDLE', games: 3, pct: 0.103 }],
      champions: [
        { champion_name: 'Kaisa', lane: 'BOTTOM', games: 6, winrate: 0.333, kda: 2.46 },
        { champion_name: 'Zeri', lane: 'BOTTOM', games: 3, winrate: 0.333, kda: 2.15 },
      ],
      profile: PROFILE,
      profile_lane: { BOTTOM: PROFILE.map((a) => ({ ...a, games: 19, delta: undefined })), JUNGLE: PROFILE.slice(0, 4).map((a) => ({ ...a, games: 7 })) },
    }),
    p2: player('맹구', 3, 1, { role_dist: [{ lane: 'TOP', games: 3, pct: 1 }] }),
    p3: player('Faker', 12, 9, { role_dist: [{ lane: 'MIDDLE', games: 12, pct: 1 }] }),
  },
} as unknown as GuildPayload;
