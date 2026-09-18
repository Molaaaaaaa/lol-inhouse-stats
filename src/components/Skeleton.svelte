<script lang="ts">
  /**
   * 로딩 스켈레톤 — 표 모양(머리행 + 행 번호 홈통 + 셀 막대). 스피너 대신 자리를 잡는다.
   * 장식이라 aria-hidden — "불러오는 중" 안내는 화면이 #sr 로 알린다.
   * 펄스는 은은하게(불투명도만), 움직임 줄이기에서는 없다.
   */
  let { rows = 6 }: { rows?: number } = $props();

  const idx = $derived(Array.from({ length: Math.max(0, rows) }, (_, i) => i));
</script>

<div class="skel" aria-hidden="true">
  <div class="hd"></div>
  {#each idx as i (i)}
    <div class="row">
      <span class="rn"></span>
      <span class="c w{i % 6}"></span>
      <span class="c num"></span>
      <span class="c num"></span>
    </div>
  {/each}
</div>

<style>
  .skel { border: 1px solid var(--grid); }
  .hd {
    height: var(--row-h);
    background: var(--gutter);
    border-bottom: 1px solid var(--grid);
  }
  .row {
    display: grid;
    grid-template-columns: 2.5ch minmax(0, 1fr) 5ch 5ch;
    gap: var(--sp-3);
    align-items: center;
    height: var(--row-h);
    padding: 0 var(--sp-2);
    border-bottom: 1px solid var(--grid);
  }
  .row:last-child { border-bottom: 0; }
  .rn, .c {
    display: block;
    height: .8em;
    background: var(--gutter);
  }
  .rn { width: 2ch; }
  .num { width: 4ch; justify-self: end; }
  /* 이름 막대 길이를 행마다 달리 한다 — 같은 길이가 줄지어 있으면 표가 아니라 무늬로 읽힌다 */
  .w0 { width: 70%; } .w1 { width: 55%; } .w2 { width: 80%; }
  .w3 { width: 60%; } .w4 { width: 75%; } .w5 { width: 50%; }
  .c { animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .45; } }
  @media (prefers-reduced-motion: reduce) {
    .c { animation: none; }
  }
</style>
