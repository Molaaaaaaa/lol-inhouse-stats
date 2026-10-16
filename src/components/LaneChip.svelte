<script lang="ts">
  /**
   * 라인 칩 — 8px 라인 점 + 라인 이름(항상 글자 — 점 색만으로 가르지 않는다). 수를 주면 '탑 6' 처럼 옆에 붙는다(천 단위 쉼표).
   * 이름·순서는 `$lib/lanes` 하나에서만 온다. 모르는 라인은 점 없이 글자만(숨기면 데이터 문제를 못 본다).
   */
  import { isLaneId, laneKo } from '$lib/lanes';
  import type { LaneId } from '$lib/data/types';

  interface Props {
    lane: LaneId | string | null | undefined;
    games?: number | null;
  }
  let { lane, games = null }: Props = $props();

  // 점 색 클래스 — LaneId 다섯 개만. 토큰 이름(--lane-*)과 같은 짧은 이름을 쓴다.
  const BAND: Readonly<Record<LaneId, string>> = { TOP: 'top', JUNGLE: 'jg', MIDDLE: 'mid', BOTTOM: 'bot', UTILITY: 'sup' };
  const band = $derived(isLaneId(lane) ? BAND[lane] : '');
</script>

<!-- 띄어쓰기는 {' '} 로 — 태그 안쪽 앞 공백은 컴파일러가 지운다('탑6' 이 됐다) -->
<span class="lane {band}" class:none={!band}>{laneKo(lane)}{#if games != null}{' '}<span class="n">{games.toLocaleString('ko-KR')}</span>{/if}</span>

<style>
  .lane {
    --dot: transparent;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    line-height: 1.6;
    white-space: nowrap;
  }
  .lane::before {
    content: '';
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: var(--r-dot);
    background: var(--dot);
  }
  .none::before { content: none; }
  .top { --dot: var(--lane-top); }
  .jg { --dot: var(--lane-jg); }
  .mid { --dot: var(--lane-mid); }
  .bot { --dot: var(--lane-bot); }
  .sup { --dot: var(--lane-sup); }
  @media (forced-colors: active) {
    .lane::before { forced-color-adjust: none; border: 1px solid CanvasText; }
  }
  .n { color: var(--dim); font-variant-numeric: tabular-nums; }
</style>
