<script lang="ts">
  /**
   * 자체 격자(멤버 세부 지표·경기 상세 표)의 캡션 행 + 잘림 힌트 — DataTable 의 캡션·`.cut`·`.edge` 와 같은 문법.
   * 부모 `.sheet`(가로 스크롤 래퍼) 안, 표 바로 앞에 둔다. 표가 래퍼보다 넓으면 캡션 줄 오른쪽에 '열 n개 더 →',
   * 보이는 폭의 오른쪽 가장자리에 2px 선. 스크롤이 끝에 닿으면 둘 다 사라진다. 잼은 $lib/sheet-fit.
   * DataTable 과 달리 overflow 를 풀지 않는다(.fit 없음) — 이 표들의 머리는 문서 스크롤에 붙지 않는다.
   */
  import { measureSheet } from '$lib/sheet-fit';

  let { caption }: { caption: string } = $props();

  let capEl = $state<HTMLDivElement | undefined>();
  let cut = $state(0);
  let tableH = $state(0);

  $effect(() => {
    const s = capEl?.parentElement;
    const t = s?.querySelector('table');
    if (!s || !t) return;
    const measure = () => ({ cut, tableH } = measureSheet(s, t));
    measure();
    s.addEventListener('scroll', measure);
    if (typeof ResizeObserver === 'undefined') return () => s.removeEventListener('scroll', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(s);
    ro.observe(t);
    return () => { s.removeEventListener('scroll', measure); ro.disconnect(); };
  });
</script>

<div class="cap" bind:this={capEl}><span>{caption}</span>{#if cut > 0}<span class="cut" aria-hidden="true">열 {cut}개 더 →</span>{/if}</div>
{#if cut > 0}<div class="edge" aria-hidden="true" style:--tbl-h="{tableH}px"></div>{/if}

<style>
  .cap {
    position: sticky;
    left: 0;
    display: flex;
    justify-content: space-between;
    gap: var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .cut { flex: none; font-weight: 400; color: var(--dim); font-variant-numeric: tabular-nums; }
  .edge {
    --tbl-h: 0px;   /* 표 높이 — 인라인 style:--tbl-h 가 덮어쓴다 */
    position: sticky;
    left: 0;
    z-index: 4;
    height: 0;
    pointer-events: none;
  }
  .edge::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 2px;
    height: var(--tbl-h);
    background: var(--grid-strong);
  }
</style>
