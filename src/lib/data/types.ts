/**
 * 발행물(payload) 계약 — 백엔드 `inhouse/publish.py:_build_guild_payload` 가 쓰는 JSON 의 모양.
 *
 * ⚠️ 여기 있는 키는 **화면이 백엔드에 거는 약속**이다. 새 키를 화면에서 쓰려면 먼저 publish 쪽에
 *    넣고, 여기 타입을 맞춘다. 반대로 백엔드가 키를 빼면 여기서 컴파일이 깨져야 한다.
 *    실데이터(2026-09-18, 57경기·36명)에서 뽑은 모양이고, `?` 는 표본에서 빠진 적 있는 키다.
 *
 * 멤버 키 `p1..pN` 은 **발행마다 이름순으로 다시 매겨진다** — 딥링크·비교는 키가 아니라 이름으로.
 */

export type LaneId = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY';
export type TierName = '1티어' | '2티어' | '3티어' | '4티어' | '5티어';

// ── 색인 ──────────────────────────────────────────────────────────────
export interface GuildIndexEntry {
  id: string;        // 익명 슬러그 (g02d21130) — Discord 길드 ID 가 아니다
  name: string;
  players: number;
  games: number;
}

// ── 지표 레지스트리 ───────────────────────────────────────────────────
export type MetricFmt = '' | 'pct' | 'sec' | 'k';
export interface MetricMeta {
  label: string;     // 표 머리·칩에 쓰는 **유일한** 이름 (검사가 단일 출처를 강제한다)
  lane: boolean;     // 라인별 지표인가 (문턱이 라인별 3판)
  fmt: MetricFmt;
  desc: string;
}
export interface MetricGroup { group: string; metrics: string[] }
export interface RankingRow { discord_name: string; games: number; value: number; lane?: LaneId }
export interface RankingPending { key: string; label: string; reason: string }
/** 멤버 화면의 지표 셀 — 순위는 경쟁순위(공동 3위 다음은 5위) */
export interface MetricCell { value: number; games: number; lane: LaneId | null; rank: number; n: number; pct: number }

// ── 사다리 (CP·MMR) ───────────────────────────────────────────────────
export interface CpLane { mmr: number; dev: number; games: number; placed: boolean; strength: number }
export interface CpReplayRow {
  m: string;         // 경기 슬러그 (라이엇 매치 ID 아님)
  ts: number; lane: LaneId; win: boolean;
  k: number; e: number; contrib: number; adj: number;
  avg_me: number; avg_opp: number;
  d_mmr: number; d_cp: number; mmr: number; cp: number;
}
export interface CpEntry {
  name: string; games: number; main_lane: LaneId;
  mmr: number; cp: number; tier: TierName; points: number; to_next: number | null;
  placed: boolean;           // 배치 5판 전이면 false — 티어는 **어디에도** 보이면 안 된다
  lanes: Record<string, CpLane>;
  replay: CpReplayRow[];     // 합계가 화면 MMR 과 같아야 한다 (검산 화면)
}
export interface TierCut { name: TierName; cp: number | null; open_top: boolean }
export interface CpConstants {
  placement_games: number; k_place: number; k_norm: number; k_decay_half: number | null; k_min: number;
  mmr_base: number; cp_base: number; cp_min: number; cp_max: number; cp_size: number; e_clamp: number;
  cp_gap_div: number; cp_gap_cap: number; cp_adj_w: number; tier_points: number; tiers: TierCut[];
  lane_prior_k: number; off_lane_prior: number; dev_scale: number; dev_cap: number;
  perf_w: number; lean_w: number; lean_ref: number; perf_elo_per_z: number; perf_shrink_k: number; perf_z_cap: number;
  contrib_lo: number; contrib_hi: number; contrib_z_scale: number; lane_base_k: number;
  contrib_weights: { kp: number; dmg_share: number; kda_n: number };
}
export interface RatingEntry {
  name: string; games: number; main_lane: LaneId; playable: LaneId[];
  mmr: number; cp: number; tier: TierName; placed: boolean; strength: number;
  lanes: Record<string, CpLane>;
}
export interface RatingConstants {
  mmr_base: number; mmr_scale: number; off_role_penalty: number; off_lane_prior_elo: number;
  info_e_window: number; info_kernel_logit: number;
}
export interface CpOffLane {
  on_games: number; off_games: number; on_winrate: number; off_winrate: number;
  se_winrate: number; significant: boolean; constant: number; implied_mmr: number;
}

// ── 리더보드·기록·시너지 ─────────────────────────────────────────────
export interface LeaderboardRow {
  discord_name: string; games: number; wins: number; winrate: number; ci_lower: number;
  kda: number; kp: number; dpm: number;
}
export interface RecordEntry {
  name: string; value: number | string;
  champ?: string; ts?: number; dur?: number; win?: boolean; k?: number; d?: number; a?: number;
}
/** `records` 는 기록 이름 → 한 건(또는 pentas 처럼 목록) 의 사전이고 `min_games` 숫자가 섞여 있다 */
export type RecordsMap = Record<string, RecordEntry | RecordEntry[] | number>;
export interface ServerRecordGame { dur: number; ts: number; kills: number }
export interface ServerRecords { shortest: ServerRecordGame; longest: ServerRecordGame; most_kills: ServerRecordGame; avg_kills: number }
export interface MvpRow { name: string; games: number; mvp: number }
export interface SynergyRow { na: string; nb: string; games: number; winrate: number; expected: number; synergy: number; lift: number }
export interface TrioRow { a: string; b: string; c: string; games: number; winrate: number; synergy: number }
export interface H2HLane { lane: LaneId; same_lane: boolean; a_champ: string; b_champ: string; a_win: boolean }
/** 키는 `pA|pB` (pA < pB) */
export interface H2HEntry {
  with_games: number; with_wins: number; with_winrate: number | null;
  vs_games: number; a_wins: number; b_wins: number; a_winrate: number | null;
  lanes: H2HLane[];
}

// ── 챔피언 ───────────────────────────────────────────────────────────
export interface ChampionMetaRow { champion_name: string; games: number; winrate: number; kda: number; dpm: number; lane?: LaneId }
export interface ChampionMatchupRow { lane: LaneId; champ: string; vs_champ: string; games: number; winrate: number }
export interface BanRow { champion_id: number; champion_name: string; champion_kr: string; bans: number }

// ── 재미 지표 (fun) ───────────────────────────────────────────────────
export interface FunStats {
  kill_matrix: { killer: string; victim: string; kills: number }[];
  by_hour: { hour: number; games: number; winrate: number }[];
  by_duration: { discord_name: string; short_g: number; short_wr: number; mid_g: number; mid_wr: number; long_g: number; long_wr: number }[];
  comeback: { discord_name: string; behind_g: number; comeback: number; comeback_rate: number; ahead_g: number; thrown: number; throw_rate: number }[];
  deaths: { discord_name: string; games: number; first_death_min: number; fb_given: number; bounty_given: number }[];
  roaming: { discord_name: string; lane: LaneId; frames: number; roam_rate: number }[];
  dragons: { dragon: string; taken: number; winrate: number }[];
  teamfight: { discord_name: string; fights: number; joined: number; join_rate: number }[];
  co_deaths: { a: string; b: string; games: number; n: number; per_game: number }[];
  assist_flow: { giver: string; taker: string; games: number; assists: number; taker_kills: number; share: number }[];
  sprees: {
    sprees: { name: string; champ: string; streak: number; minute: number }[];
    stoppers: { runner: string; stopper: string; streak: number }[];
  };
  sides: {
    team: { side: 'BLUE' | 'RED'; games: number; wins: number; winrate: number }[];
    players: { discord_name: string; blue_g: number; blue_w: number; red_g: number; red_w: number }[];
  };
  champ_pool: { discord_name: string; lane: LaneId; games: number; champs: number; variety: number }[];
}

// ── 경기 목록 ────────────────────────────────────────────────────────
export interface RecentMatchPlayer { name: string; champ: string; lane: LaneId }
export interface RecentMatch {
  match_id: string;  // 익명 슬러그 — 상세는 data/<gid>/m/<slug>.json
  ts: number;
  d?: number;        // 1 이면 상세 파일이 있다
  teams: { win: boolean; players: RecentMatchPlayer[] }[];
}

// ── 솔랭 기준선 ──────────────────────────────────────────────────────
export interface BaselineRole { n: number; q: number[]; spread: number; tier_med: Record<string, number> }
export interface BaselineMetric { label: string; lower_better: boolean; by_role: Record<string, BaselineRole> }
export interface Baseline {
  roles: LaneId[]; tiers: string[]; tier_ko: Record<string, string>;
  quantiles: number[]; games: Record<string, number>; patch_min: string;
  metrics: Record<string, BaselineMetric>;
}

// ── 멤버 ─────────────────────────────────────────────────────────────
export interface PlayerRecord { games: number; wins: number; losses: number; winrate: number; ci_lower: number; kda: number; kp: number; dpm: number }
export interface AccountRecord extends Omit<PlayerRecord, 'ci_lower'> { riot_name: string; main_lane: LaneId }
export interface PlayerLaneStat { lane: LaneId; games: number; winrate: number; kda: number; dpm: number; kp: number; cs: number; vision: number; dmg_share: number }
export interface PlayerChampion { champion_name: string; lane: LaneId; games: number; winrate: number; kda: number }
export interface PlayerRecentGame { game_creation: number; champion_name: string; lane: LaneId; win: boolean; kda: number; dpm: number }
export interface PartnerRow { partner: string; games: number; winrate: number; synergy: number }
export interface VsChampRow { vs_champ: string; games: number; winrate: number }
export interface ProfilePart { key: string; label: string; value: number; rank: number; n: number }
export interface ProfileAxis {
  key: string; label: string; desc: string; score: number; pct: number; rank: number; n: number; games: number;
  parts: ProfilePart[];
  delta?: number;    // 지난 내전 대비 (문턱 미만이면 아예 없다)
}
export interface PlayerPub {
  name: string;
  tag?: string;      // 동명이인 구분 순번 (표시명이 겹칠 때만)
  account_count: number; accounts: string[]; account_records?: AccountRecord[];
  record: PlayerRecord;
  form: { form: string; dir: string; winrate: number; streak: number };
  lanes: PlayerLaneStat[];
  role_dist: { lane: LaneId; games: number; pct: number }[];
  champions: PlayerChampion[];
  recent_games: PlayerRecentGame[];
  partners_best: PartnerRow[]; partners_worst: PartnerRow[];
  nemesis_victim: { nemesis: VsChampRow[]; victim: VsChampRow[] };
  killer_champions: { killed: { champion: string; n: number }[]; killed_by: { champion: string; n: number }[] };
  by_hour: { hour: number; games: number; winrate: number }[];
  profile: ProfileAxis[];
  profile_lane?: Record<string, ProfileAxis[]>;
  metrics?: Record<string, MetricCell>;
  metrics_lane?: Record<string, Record<string, MetricCell>>;   // 라인 2개 이상인 사람만
}

// ── 길드 페이로드 (최상위) ────────────────────────────────────────────
export interface GuildPayload {
  guild_id: string;  // 익명 슬러그
  name: string;
  patch: string;
  timestamp: string;
  summary: { total_games: number; player_count: number; avg_winrate: number; avg_duration_sec: number };
  warnings: string[];
  min_games: number; min_games_excluded: number; min_games_lane: number;
  min_days: number; min_days_excluded: number;
  leaderboard: LeaderboardRow[];
  rankings: Record<string, RankingRow[]>;
  rankings_pending: RankingPending[];
  metric_groups: MetricGroup[];
  metric_meta: Record<string, MetricMeta>;
  lower_better: string[];
  profile_scale: { step: number; spread: number; room_avg: number; max: number; shrink_k: number; rings: number; delta_min: number };
  cp: Record<string, CpEntry>;
  cp_constants: CpConstants;
  cp_off_lane: CpOffLane;
  ratings: Record<string, RatingEntry>;
  rating_constants: RatingConstants;
  records: RecordsMap;
  server_records: ServerRecords;
  mvp: MvpRow[];
  mvp_excluded: { awards: number; players: number };
  synergy: SynergyRow[];
  trios: TrioRow[];
  h2h: Record<string, H2HEntry>;
  champion_meta: ChampionMetaRow[];
  champion_meta_lane: ChampionMetaRow[];
  champion_matchups: ChampionMatchupRow[];
  champ_ko: Record<string, string>;
  ban_meta: BanRow[];
  ban_available: boolean;
  objectives_available: boolean;
  fun: FunStats;
  recent_matches: RecentMatch[];
  baseline: Baseline | null;
  players: Record<string, PlayerPub>;
}

// ── 경기 상세 (data/<gid>/m/<slug>.json, 펼칠 때 로드) ──────────────
export interface MatchDetailPlayer {
  pid: number; name: string; champ: string; lane: LaneId;
  k: number; d: number; a: number; kda: number; cs: number; gold: number;
  dmg: number; dmg_taken: number; dmg_turret: number; vision: number;
  items: number[]; spells: number[]; perks: number[];
  extra: Record<string, number | boolean>;
  build: { item: number; minute: number; sold?: boolean }[];   // sold: 되판 아이템(실데이터에 있음)
  kda_events: { s: number; t: 'K' | 'D' | 'A'; vs: string }[];
}
export interface MatchDetailTeam {
  team_id: number; win: boolean; kills: number; deaths: number; assists: number; gold: number;
  objectives: { towers: number; dragons: number; barons: number; heralds: number; grubs: number };
  bans: string[];
  players: MatchDetailPlayer[];
}
export interface MatchDetail {
  match_id: string; duration: number;
  teams: MatchDetailTeam[];
  kills: { a: number; v: number; m: number; x: number; y: number }[];
  timeline: { minutes: number[]; a_gold: number[]; b_gold: number[]; gold_diff: number[]; cs_diff: number[]; xp_diff: number[] };
}

// ── 데스 히트맵 표본 (data/<gid>/deaths.json, 볼 때 로드) ────────────
export interface DeathsFile {
  points: { x: number; y: number; m: number; lane: LaneId }[];
  games: number; total: number; capped: boolean;
}
