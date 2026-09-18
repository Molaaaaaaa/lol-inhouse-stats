/**
 * 순위 화면 테스트 픽스처 — 실데이터(2026-09-18)의 모양을 작게 줄인 payload 조각.
 * 리더보드는 발행 문턱(5판) 위 넷, players 는 문턱 아래 '신입' 과 동명이인 '앙리~2' 까지 다섯.
 * rankings 는 통합 지표(dpm · 판당 데스=낮을수록 좋음) 둘과 라인별 지표(CS@10 · 골드차@10) 둘.
 */
import type { GuildPayload, LaneId, LeaderboardRow, PlayerLaneStat, PlayerPub, RankingRow } from '../../src/lib/data/types';

function laneStat(lane: LaneId, games: number, winrate: number, extra: Partial<PlayerLaneStat> = {}): PlayerLaneStat {
  return { lane, games, winrate, kda: 3, dpm: 700, kp: 0.5, cs: 180, vision: 25, dmg_share: 0.2, ...extra };
}
function player(name: string, games: number, wins: number, lanes: PlayerLaneStat[], tag?: string): PlayerPub {
  return {
    name, ...(tag ? { tag } : {}),
    record: { games, wins, losses: games - wins, winrate: games ? wins / games : 0, ci_lower: 0, kda: 3, kp: 0.5, dpm: 700 },
    lanes,
  } as unknown as PlayerPub;
}
function lb(discord_name: string, games: number, wins: number, ci_lower: number, kda: number, kp: number, dpm: number): LeaderboardRow {
  return { discord_name, games, wins, winrate: Math.round((wins / games) * 1000) / 1000, ci_lower, kda, kp, dpm };
}
const row = (discord_name: string, games: number, value: number, lane?: LaneId): RankingRow =>
  lane ? { discord_name, games, value, lane } : { discord_name, games, value };

export const RANK_META = {
  winrate: { label: '승률', lane: false, fmt: 'pct', desc: '이긴 판의 비율.' },
  kda: { label: 'KDA', lane: false, fmt: '', desc: '(킬+어시)÷데스. KDA 는 누적입니다.' },
  kp: { label: '킬 관여', lane: false, fmt: 'pct', desc: '팀 킬 중 관여한 비율.' },
  dpm: { label: '분당 딜', lane: false, fmt: '', desc: '1분당 챔피언에게 넣은 피해. **판별 값의 평균**입니다.' },
  vision: { label: '시야 점수', lane: false, fmt: '', desc: '시야 점수.' },
  deaths_per_game: { label: '판당 데스', lane: false, fmt: '', desc: '판당 데스 수.' },
  cspm: { label: '분당 CS', lane: true, fmt: '', desc: '1분당 CS. 대회 지표는 CSM 입니다.' },
  cs10: { label: 'CS@10', lane: true, fmt: '', desc: '10분 시점 CS.' },
  gold_diff_10: { label: '골드차@10', lane: true, fmt: '', desc: '10분 시점 맞라인 골드 차이. 대회 지표는 GD10 입니다.' },
} as const;

export const RANK_PAYLOAD = {
  name: '테스트 방', patch: '15.18.1', timestamp: '2026-09-17T11:31:54+00:00',
  summary: { total_games: 57, player_count: 5, avg_winrate: 0.5, avg_duration_sec: 1686 },
  min_games: 5, min_games_excluded: 1, min_games_lane: 3, min_days: 1, min_days_excluded: 0,
  // 서버 정렬(신뢰성 내림차순) 그대로. 앙리는 discord_name 이고 players 쪽 표시명은 '앙리~2'
  leaderboard: [
    lb('앙앙맹', 6, 6, 0.61, 4.67, 0.484, 1296),
    lb('Faker', 20, 14, 0.481, 5.1, 0.6, 900),
    lb('맹구', 12, 6, 0.254, 2.2, 0.55, 640),
    lb('앙리', 5, 3, 0.231, 1.8, 0.7, 300),
  ],
  players: {
    p1: player('앙앙맹', 6, 6, [laneStat('TOP', 6, 1, { dpm: 1296, cs: 247.2, vision: 33.2 }), laneStat('MIDDLE', 3, 0.33, { dpm: 800 })]),
    p2: player('맹구', 12, 6, [laneStat('JUNGLE', 12, 0.5, { dpm: 640, cs: 150.4 })]),
    p3: player('신입', 2, 0, [laneStat('BOTTOM', 2, 0)]),
    p4: player('Faker', 20, 14, [laneStat('MIDDLE', 20, 0.7, { dpm: 900, cs: 220 }), laneStat('TOP', 4, 0.75, { dpm: 650 })]),
    p5: player('앙리', 5, 3, [laneStat('UTILITY', 5, 0.6, { dpm: 300, cs: 40, vision: 60 })], '2'),
  },
  rankings: {
    dpm: [row('앙앙맹', 6, 1295.97), row('Faker', 20, 900), row('맹구', 12, 900), row('앙리', 5, 300)],
    deaths_per_game: [row('앙앙맹', 6, 2.5), row('Faker', 20, 4), row('맹구', 12, 3)],
    cs10: [row('앙앙맹', 6, 90, 'TOP'), row('Faker', 20, 85, 'MIDDLE'), row('Faker', 4, 80, 'TOP'), row('맹구', 12, 20, 'JUNGLE')],
    gold_diff_10: [row('앙앙맹', 6, 150, 'TOP'), row('Faker', 20, -30, 'MIDDLE'), row('Faker', 4, 0, 'TOP')],
  },
  rankings_pending: [{ key: 'vspm', label: '분당 시야', reason: '시야 점수 프레임이 없는 패치입니다.' }],
  metric_groups: [
    { group: '종합', metrics: ['dpm', 'kda', 'deaths_per_game', 'cspm'] },
    { group: '라인전', metrics: ['gold_diff_10', 'cs10'] },
  ],
  metric_meta: RANK_META,
  lower_better: ['deaths_per_game'],
  baseline: null,
  cp: {}, cp_constants: { placement_games: 5, tiers: [] },
} as unknown as GuildPayload;
