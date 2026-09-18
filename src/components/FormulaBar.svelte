<script lang="ts">
  /**
   * 수식 줄 — 스프레드시트의 fx 줄. 화면 위 한 줄에 "선택된 것의 계산 근거" 를 보인다.
   * 내용은 $lib/fx.svelte 의 전역 상태에서 온다(화면이 setFx 로 쓰고, App 이 화면 전환 때 비운다).
   * role="status" + aria-live 라 선택이 바뀌면 보조기술도 근거를 듣는다.
   *
   * 말줄임은 없다: 글이 길면 두 줄까지 줄바꿈하고, 두 줄에도 안 들어가면 줄 자체가 버튼이 되어
   * 탭하면 다 펼친다(aria-expanded). 넘침은 접힌 상태에서만 잰다(scrollHeight > clientHeight) —
   * 글이 바뀌면 다시 접고 다시 잰다. title 에 기대지 않는다(폰에는 hover 가 없다).
   */
  import { tick } from 'svelte';
  import { fx } from '$lib/fx.svelte';

  const HINT = '행을 선택하면 계산 근거가 여기에 보입니다.';

  let wrap = $state<HTMLElement | undefined>();
  /** 접힌 두 줄에 다 안 들어간다 */
  let over = $state(false);
  let open = $state(false);

  function measure() {
    if (open) return;   // 펼친 동안은 재지 않는다 — 펼치면 넘침이 0 이 되어 버튼이 사라져 버린다
    const el = wrap?.querySelector<HTMLElement>('.txt');
    over = !!el && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
  }
  $effect(() => {
    void fx.text;   // 글이 바뀌면 접고 다시 잰다
    open = false;
    void tick().then(measure);
  });
  $effect(() => {
    const w = wrap;
    if (!w || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(w);
    return () => ro.disconnect();
  });
  function toggle() {
    open = !open;
    void tick().then(measure);
  }
</script>

<div class="fxbar" role="status" aria-live="polite" aria-label="수식 줄">
  <span class="glyph" aria-hidden="true">fx</span>
  <div class="bodywrap" bind:this={wrap}>
    {#if !fx.text}
      <span class="body hint">{HINT}</span>
    {:else if over || open}
      <!-- 줄바꿈·접기는 안쪽 span 에 — button 자체의 line-clamp 는 브라우저가 무시한다 -->
      <button type="button" class="body" aria-expanded={open} onclick={toggle}><span class="txt" class:clamp={!open}>{fx.text}</span></button>
    {:else}
      <span class="body"><span class="txt clamp">{fx.text}</span></span>
    {/if}
  </div>
</div>

<style>
  /* 격자 한 줄: 홈통 바탕, 위아래 1px 격자선. 글자는 --mono(계산식) */
  .fxbar {
    display: flex;
    align-items: stretch;
    gap: var(--sp-3);
    min-height: var(--row-h);
    padding: 0 var(--sp-4);
    background: var(--gutter);
    border-bottom: 1px solid var(--grid);
    font-family: var(--mono);
    font-size: var(--fs-sm);
  }
  .glyph {
    flex: none;
    display: flex;
    align-items: center;
    color: var(--dim);
    font-style: italic;
    /* 글리프 뒤 세로 격자선 — 행 번호 홈통과 같은 문법. 두 줄이 되면 같이 늘어난다 */
    padding-right: var(--sp-3);
    border-right: 1px solid var(--grid);
  }
  .bodywrap {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    padding: var(--sp-1) 0;
  }
  .body {
    display: block;
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--txt);
    font: inherit;
    line-height: var(--lh);
    text-align: left;
  }
  .txt {
    display: block;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  /* 접힘: 두 줄까지. 넘치면 줄이 버튼이 되어 탭하면 펼친다 */
  .clamp {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  button.body {
    margin: 0 calc(-1 * var(--sp-1));
    padding: 0 var(--sp-1);
    width: calc(100% + 2 * var(--sp-1));
    cursor: pointer;
    transition: background-color .12s;
  }
  button.body:hover { background: var(--raised); }
  button.body:active { background: var(--grid-strong); }
  button.body:focus-visible { outline-offset: 0; }
  .hint { color: var(--dim); }

  @media (prefers-reduced-motion: reduce) {
    button.body { transition: none; }
  }
</style>
