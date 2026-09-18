<script lang="ts">
  /**
   * 라인 셀 — 왼쪽 3px 라인 띠 + 라인 이름(항상 글자). 판수를 주면 '탑 6' 처럼 옆에 붙는다.
   * 이름·순서는 `$lib/lanes` 하나에서만 온다. 모르는 라인은 띠 없이 글자만(숨기면 데이터 문제를 못 본다).
   */
  import { isLaneId, laneKo } from '$lib/lanes';
  import type { LaneId } from '$lib/data/types';

  interface Props {
    lane: LaneId | string | null | undefined;
    games?: number | null;
  }
  let { lane, games = null }: Props = $props();

  // 띠 색 클래스 — LaneId 다섯 개만. 토큰 이름(--lane-*)과 같은 짧은 이름을 쓴다.
  const BAND: Readonly<Record<LaneId, string>> = { TOP: 'top', JUNGLE: 'jg', MIDDLE: 'mid', BOTTOM: 'bot', UTILITY: 'sup' };
  const band = $derived(isLaneId(lane) ? BAND[lane] : '');
</script>

<!-- 띄어쓰기는 {' '} 로 — 태그 안쪽 앞 공백은 컴파일러가 지운다('탑6' 이 됐다) -->
<span class="lane {band}" class:none={!band}>{laneKo(lane)}{#if games != null}{' '}<span class="n">{games}</span>{/if}</span>

<style>
  .lane {
    display: inline-block;
    padding: 0 var(--sp-2);
    border-left: 3px solid transparent;
    line-height: 1.6;
    white-space: nowrap;
  }
  .none { border-left: 0; padding-left: 0; }
  .top { border-left-color: var(--lane-top); }
  .jg { border-left-color: var(--lane-jg); }
  .mid { border-left-color: var(--lane-mid); }
  .bot { border-left-color: var(--lane-bot); }
  .sup { border-left-color: var(--lane-sup); }
  .n { color: var(--dim); font-variant-numeric: tabular-nums; }
</style>
