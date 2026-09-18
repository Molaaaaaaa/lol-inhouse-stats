/**
 * 지표 이름·포맷·설명 조회 — 발행물의 `metric_meta`·`lower_better` 위에서만 읽는 순수 함수.
 *
 * 규칙: **표 머리·칩에 쓰는 지표 이름은 `metric_meta.label` 만** 쓴다. 화면에 'DPM' 처럼 직접
 * 적으면 발행 쪽 이름('분당 딜')과 갈라져 같은 숫자가 탭마다 다른 이름으로 불린다
 * (실측: 랭킹 탭은 '분당 딜', 리더보드·플레이어 탭은 'DPM' 이었다). 지표 목록·라벨·포맷은
 * 서버가 준 것만 쓴다 — 예전엔 화면에도 배열을 두고 publish 에도 두어서, 한쪽만 고치면
 * 조용히 어긋났다. 검사(`scripts/_inhouse_check.py`)가 발행물의 리터럴 라벨을 잡는다.
 *
 * 전역 DATA 를 읽지 않는다. 컴포넌트가 store 의 `data.metric_meta`·`data.lower_better` 를
 * 넘기고, 테스트는 작은 사전을 넘긴다. 사전이 아직 없을 때(로딩 전)도 키를 그대로 돌려줘
 * 화면이 깨지지 않는다.
 */
import type { GuildPayload, MetricFmt } from './data/types';

export type MetricMetaMap = GuildPayload['metric_meta'];

/** 표 머리·칩용 이름. 사전에 없으면 키 그대로 — 빈 칸보다는 키가 무엇인지 보이는 편이 낫다. */
export function mLabel(meta: MetricMetaMap | null | undefined, key: string): string {
  return meta?.[key]?.label || key;
}

/** 값 포맷 종류. 없으면 '' — 숫자를 그대로 찍는다. */
export function mFmt(meta: MetricMetaMap | null | undefined, key: string): MetricFmt {
  return meta?.[key]?.fmt || '';
}

/** 지표 설명(툴팁). 없으면 '' — 툴팁 쪽이 "안 띄움" 으로 처리한다. */
export function mDesc(meta: MetricMetaMap | null | undefined, key: string): string {
  return meta?.[key]?.desc || '';
}

/** 낮을수록 좋은 지표인가(데스·첫 데스 시각 등). 정렬 방향·기준선 위치가 이 값을 뒤집는다. */
export function lowerBetter(lower: readonly string[] | null | undefined, key: string): boolean {
  return (lower ?? []).includes(key);
}
