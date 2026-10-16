<script lang="ts">
  /**
   * 로딩 스켈레톤 — 카드 안 표 모양(머리행 + 행 번호 칩 + 셀 막대). 스피너 대신 자리를 잡는다.
   * 장식이라 aria-hidden — "불러오는 중" 안내는 화면이 #sr 로 알린다.
   * 막대 위로 옅은 빛이 1.4초마다 지나간다(이 세계의 무한 반복은 이것 하나). 움직임 줄이기에서는 멈춘다.
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
  .skel {
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    background: var(--grad-card);
    border: 1px solid var(--grid);
    border-radius: var(--r-lg);
    box-shadow: var(--edge-hi), var(--shadow-1);
  }
  .hd {
    height: 34px;
    background: var(--gutter);
    border-radius: var(--r-md) var(--r-md) 0 0;
  }
  .row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 5ch 5ch;
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
    border-radius: var(--r-xs);
    background-color: var(--raised);
  }
  .rn { width: 24px; height: 20px; border-radius: var(--r-chip); }
  .num { width: 4ch; justify-self: end; }
  /* 이름 막대 길이를 행마다 달리 한다 — 같은 길이가 줄지어 있으면 표가 아니라 무늬로 읽힌다 */
  .w0 { width: 70%; } .w1 { width: 55%; } .w2 { width: 80%; }
  .w3 { width: 60%; } .w4 { width: 75%; } .w5 { width: 50%; }
  @media (prefers-reduced-motion: no-preference) {
    .rn, .c {
      background-image: linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--txt) 7%, transparent) 50%, transparent 100%);
      background-size: 200% 100%;
      background-repeat: no-repeat;
      animation: shimmer 1.4s ease-in-out infinite;
    }
  }
  @keyframes shimmer {
    from { background-position: 150% 0; }
    to { background-position: -50% 0; }
  }
  @media (max-width: 640px) {
    .skel { padding: 10px; }
  }
</style>
