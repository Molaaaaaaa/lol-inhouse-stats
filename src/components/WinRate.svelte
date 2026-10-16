<script lang="ts">
  /**
   * 승률 글자 — 퍼센트를 승률 단계(`$lib/tier` 의 wrStep, Wilson 구간 기준) 색으로 칠하고 기호(▲▲·▲·▼·▼▼)를 붙인다.
   * 구간이 50% 를 벗어날 때만 색이 있다(5판 80% 는 무채색). 판수가 문턱 미만이면 옅은 글자 + '표본 적음' —
   * 1판 0% 를 빨갛게 칠하면 "짧은 판에 약하다"로 읽힌다(실측 20셀).
   * 기호는 보조기술에서 숨기고 같은 뜻의 문구(WR_WORD)를 읽힌다.
   */
  import { pct } from '$lib/fmt';
  import { WR_MARK, WR_WORD, wrStep } from '$lib/tier';

  interface Props {
    /** 승률 0~1 */
    w: number;
    /** 판수 */
    n: number;
    /** 문턱(app.minGames · app.minGamesLane) */
    minGames: number;
  }
  let { w, n, minGames }: Props = $props();

  const step = $derived(wrStep(w, n, minGames));
</script>

<span class="wr st-{step}">{pct(w)}{#if WR_MARK[step]}<span class="mk" aria-hidden="true">{WR_MARK[step]}</span>{/if}{#if step === 'few'}<span class="few">{WR_WORD.few}</span>{:else if WR_WORD[step]}<span class="sr-only">, {WR_WORD[step]}</span>{/if}</span>

<style>
  .wr {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .st-up2, .st-down2 { font-weight: 700; }
  .mk { font-size: .72em; letter-spacing: -.05em; }
  .few { font-size: var(--fs-xs); color: var(--dim2); }
</style>
