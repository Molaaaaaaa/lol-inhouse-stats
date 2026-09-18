<script lang="ts">
  /**
   * 승률 셀 — 글자는 항상 pct(w), 채움은 조건부 서식(높음 --win 18% · 낮음 --loss 18%).
   * n(판수)과 문턱을 주면 문턱 미만은 색으로 단정하지 않고 글자만 옅게 한다(wr-dim) —
   * 1판 0% 를 빨갛게 칠하면 "짧은 판에 약하다"로 읽힌다(실측 20셀).
   */
  import { pct } from '$lib/fmt';
  import { wrClass } from '$lib/tier';

  interface Props {
    /** 승률 0~1 */
    w: number;
    /** 판수 — 문턱 판정용. minGames 와 같이 줘야 한다 */
    n?: number | null;
    /** 문턱(app.minGames · app.minGamesLane) */
    minGames?: number | null;
  }
  let { w, n = null, minGames = null }: Props = $props();

  const cls = $derived(minGames != null ? wrClass(w, n, minGames) : wrClass(w));
</script>

<span class="wr {cls}">{pct(w)}</span>

<style>
  .wr {
    display: inline-block;
    min-width: 4ch;
    padding: 0 var(--sp-1);
    text-align: right;
    font-variant-numeric: tabular-nums;
    line-height: 1.6;
  }
  .wr-h { background: color-mix(in srgb, var(--win) 18%, transparent); }
  .wr-l { background: color-mix(in srgb, var(--loss) 18%, transparent); }
  .wr-dim { color: var(--dim); }
</style>
