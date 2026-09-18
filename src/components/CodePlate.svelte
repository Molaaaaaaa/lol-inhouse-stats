<script lang="ts">
  /**
   * 코드 판 — 지표 라벨 옆에 붙는 대회식 코드(GD10 · CSM). `.code` 유틸(--mono · --fs-xs · --dim) 위에
   * --gutter 바탕과 1px --grid 테두리만 얹은 작은 판. 코드는 `$lib/metric-code` 의 metricCode(desc) 로
   * 설명에 실제로 있는 것만 뽑는다 — 빈 문자열이면 아무것도 그리지 않는다.
   */
  let { code }: { code: string } = $props();
</script>

{#if code}
  <span class="code plate">{code}</span>
{/if}

<style>
  .plate {
    display: inline-block;
    padding: 0 var(--sp-1);
    margin-left: var(--sp-1);
    border: 1px solid var(--grid);
    border-radius: var(--r-chip);
    background: var(--gutter);
    line-height: 1.4;
    vertical-align: middle;
    white-space: nowrap;
  }
</style>
