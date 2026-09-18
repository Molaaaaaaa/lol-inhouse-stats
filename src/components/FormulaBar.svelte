<script lang="ts">
  /**
   * 수식 줄 — 스프레드시트의 fx 줄. 화면 위 한 줄에 "선택된 것의 계산 근거" 를 보인다.
   * 내용은 $lib/fx.svelte 의 전역 상태에서 온다(화면이 setFx 로 쓰고, App 이 화면 전환 때 비운다).
   * role="status" + aria-live 라 선택이 바뀌면 보조기술도 근거를 듣는다.
   */
  import { fx } from '$lib/fx.svelte';

  const HINT = '행을 선택하면 계산 근거가 여기에 보입니다.';
</script>

<div class="fxbar" role="status" aria-live="polite" aria-label="수식 줄">
  <span class="glyph" aria-hidden="true">fx</span>
  {#if fx.text}
    <span class="body" title={fx.text}>{fx.text}</span>
  {:else}
    <span class="body hint">{HINT}</span>
  {/if}
</div>

<style>
  /* 격자 한 줄: 홈통 바탕, 위아래 1px 격자선. 글자는 --mono(계산식) */
  .fxbar {
    display: flex;
    align-items: center;
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
    color: var(--dim);
    font-style: italic;
    /* 글리프 뒤 세로 격자선 — 행 번호 홈통과 같은 문법 */
    padding-right: var(--sp-3);
    border-right: 1px solid var(--grid);
    line-height: var(--row-h);
  }
  .body {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--txt);
  }
  .hint { color: var(--dim); }
</style>
