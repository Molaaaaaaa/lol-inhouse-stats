/**
 * 솔랭 기준선 — 골드~마스터 솔랭 표본 안에서 내전 값이 상위 몇 % 인지. **계산만** 한다.
 * 화면(표·문구 조립)은 컴포넌트가 이 모듈이 돌려주는 데이터로 그린다.
 *
 * 왜 필요한가
 *   능력치 점수는 방 안 상대 위치라 사람이 늘거나 빠지면 같이 움직인다. 같은 지표(같은 정의·
 *   같은 라인)를 솔랭 표본 위에 놓으면 방과 무관한 눈금이 생긴다. 라인전·개인기 축은 표본에
 *   그 열이 없어 '기준 없음'으로 비운다 — 있는 척하지 않는다.
 *
 * 왜 티어 이름을 붙이지 않나 (실측)
 *   판당 딜·딜 비중·시야는 골드와 마스터의 중앙값이 거의 같다(딜은 골드가 오히려 높다).
 *   티어 이름을 붙이면 근거 없는 라벨이 된다 → 합산 표본 안의 **백분위만** 말한다.
 *   payload 의 tiers·tier_med 는 투명성용이고 여기서는 읽지 않는다.
 *
 * ⚠️ 배치 규칙은 파이썬 `inhouse/baseline.py:place` 와 **같은 식**이어야 한다. 검사
 *    (`scripts/_inhouse_check.py`)가 양쪽에 같은 수치 사례를 건다. 바꾸려면 둘 다 바꾼다.
 * ⚠️ 표본 크기·패치는 글에 박지 않는다 — payload 로 찍는다. 툴팁만 옛 값이라 '약 10만'과
 *    '49,094판'이 한 화면에 같이 뜬 적이 있다(`baseSampleText` 가 단일 출처).
 */
import type { Baseline, BaselineRole, GuildPayload, LaneId, PlayerPub } from '$lib/data/types';

/** payload 가 quantiles 를 싣지만, 파이썬 `QUANTILES` 와 같은 기본값을 둔다(단독 호출용). */
export const DEFAULT_QUANTILES: readonly number[] = [5, 10, 25, 50, 75, 90, 95];

/**
 * 분위수 q(quantiles 백분위에 대응) 위에서 value 의 '좋은 쪽' 백분위(0~100).
 * 분위수 사이는 선형 보간. 양 끝 밖은 첫/마지막 분위수와 0·100 의 중간(5 → 2.5, 95 → 97.5).
 * lowerBetter 면 100 − pct. 분위수가 비어 있으면 NaN — 95 를 돌려주던 옛 동작은 거짓말이었다.
 */
export function baselinePlace(
  q: readonly number[],
  value: number,
  lowerBetter: boolean,
  quantiles: readonly number[] = DEFAULT_QUANTILES,
): number {
  const n = Math.min(q.length, quantiles.length);
  if (n === 0) return NaN;
  const first = q[0]!, last = q[n - 1]!;
  const pFirst = quantiles[0]!, pLast = quantiles[n - 1]!;
  let pct = pLast;
  if (value <= first) pct = pFirst / 2;
  else if (value >= last) pct = (100 + pLast) / 2;
  else {
    for (let i = 0; i < n - 1; i++) {
      const lo = q[i]!, hi = q[i + 1]!;
      if (lo <= value && value <= hi) {
        const span = hi - lo;
        // 같은 값이 겹친 구간(span 0)은 가운데로 — 파이썬과 같은 처리
        pct = quantiles[i]! + (quantiles[i + 1]! - quantiles[i]!) * (span ? (value - lo) / span : 0.5);
        break;
      }
    }
  }
  return lowerBetter ? 100 - pct : pct;
}

/** 배지 색: 상위 25% 안이면 good, 하위 25% 면 bad, 나머지는 무표시 */
export type BaselineCls = '' | 'good' | 'bad';
export interface BaselinePos {
  pos: number;        // 좋은 쪽 백분위 (0~100)
  top: number;        // 상위 몇 % (1~99 로 자른 정수)
  label: string;      // "솔랭 상위 N%"
  cls: BaselineCls;
}

export function baselinePos(
  cell: Pick<BaselineRole, 'q'>,
  value: number,
  lowerBetter: boolean,
  quantiles: readonly number[] = DEFAULT_QUANTILES,
): BaselinePos {
  const pos = baselinePlace(cell.q, value, lowerBetter, quantiles);
  const top = Math.max(1, Math.min(99, Math.round(100 - pos)));
  return { pos, top, label: `솔랭 상위 ${top}%`, cls: pos >= 75 ? 'good' : pos <= 25 ? 'bad' : '' };
}

/** 표본 판수 — games 는 티어별 사전({GOLD:…, MASTER:…})이라 합쳐서 쓴다. */
export function baselineGames(b: Pick<Baseline, 'games'> | null | undefined): number {
  const g = b?.games;
  if (!g || typeof g !== 'object') return 0;
  return Object.values(g).reduce((s, v) => s + (+v || 0), 0);
}

/** "49,094판, 패치 16.10 이후" — 툴팁·패널 본문이 같은 문구를 쓴다. 표본이 없으면 "솔랭 표본". */
export function baseSampleText(b: Pick<Baseline, 'games' | 'patch_min'> | null | undefined): string {
  const n = baselineGames(b);
  return (n ? `${n.toLocaleString('ko-KR')}판` : '솔랭 표본') + (b?.patch_min ? `, 패치 ${b.patch_min} 이후` : '');
}

export interface BaselineCell {
  key: string;          // 지표 키 (포맷은 metric_meta 로 컴포넌트가)
  value: number;        // 이 멤버의 내전 값
  metricLabel: string;  // 기준선 쪽 지표 이름 (분당 딜·딜 비중·…)
  pos: BaselinePos;
}
export interface BaselineRow {
  label: string;        // 능력치 축 이름
  games: number | null; // 그 축의 표본 판수
  cells: BaselineCell[]; // 비어 있으면 '솔랭 기준 없음 — 내전 전용 지표'
}
export interface BaselinePanel {
  lane: LaneId;
  games: number;        // 표본 판수 합
  patchMin: string;
  sample: string;       // baseSampleText 와 같은 문구
  rows: BaselineRow[];
}

export const NO_BASELINE = '솔랭 기준 없음 — 내전 전용 지표';

/**
 * 멤버 화면 기준선 패널의 데이터. 그릴 수 없으면 null — 기준선이 없거나, 라인을 정할 수 없거나,
 * 능력치 프로필이 비었을 때. 라인은 능력치에서 고른 라인(curLane)이 먼저, 없으면 주 라인.
 * 축을 만든 지표가 둘이면 셀도 둘 — 합쳐서 하나로 뭉개지 않는다.
 */
export function baselinePanel(
  data: Pick<GuildPayload, 'baseline' | 'ratings' | 'lower_better'>,
  player: Pick<PlayerPub, 'profile' | 'profile_lane'> | null | undefined,
  ratingKey: string,
  curLane: LaneId | '' = '',
): BaselinePanel | null {
  const B = data.baseline;
  if (!B || !B.metrics || !Object.keys(B.metrics).length) return null;
  const main = data.ratings?.[ratingKey]?.main_lane ?? '';
  const lane = curLane || main;
  if (!lane) return null;
  const prof = player?.profile_lane?.[lane] ?? player?.profile ?? [];
  if (!prof.length) return null;
  const lower = new Set(data.lower_better ?? []);
  const rows: BaselineRow[] = prof.map((a) => {
    const cells: BaselineCell[] = [];
    for (const pt of a.parts ?? []) {
      const m = B.metrics[pt.key];
      const cell = m?.by_role[lane];
      // 분위수가 빈 칸은 기준이 없는 것과 같다 — NaN 배지를 내느니 비운다
      if (!m || !cell || !cell.q.length) continue;
      cells.push({
        key: pt.key,
        value: Number(pt.value),
        metricLabel: m.label,
        pos: baselinePos(cell, Number(pt.value), lower.has(pt.key), B.quantiles),
      });
    }
    return { label: a.label, games: a.games ?? null, cells };
  });
  return { lane, games: baselineGames(B), patchMin: B.patch_min, sample: baseSampleText(B), rows };
}
