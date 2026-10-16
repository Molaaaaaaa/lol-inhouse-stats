<script module lang="ts">
  /** 요약 띠 한 칸 */
  export interface SummaryItem {
    /** 타일 라벨('경기') */
    label: string;
    /** 값('111') */
    value: string;
    /** 단위('판') */
    unit?: string;
    /** 폰 한 줄에 쓸 짧은 글(라벨을 담는다: '평균 27:47'). 없으면 값+단위('111판')에 라벨은 보조기술에만 */
    short?: string;
    /** 값이 시각이면 ISO 문자열 — <time datetime> */
    datetime?: string;
    /** 값 위 전체 문구(정확한 시각) */
    title?: string;
  }
</script>

<script lang="ts">
  /**
   * 요약 띠 — 화면 맨 위 숫자 타일 줄(데스크톱·태블릿은 한 줄 타일, 폰은 한 줄 글).
   * 폰(media.phone, ≤640px)에서 타일 2×2 를 두면 첫 화면이 약 130px 먹어 아래 목록이 밀린다(비평 실측) —
   * 그래서 '111판 · 37명 · 평균 27:47 · 갱신 10/1 16:27' 한 줄(40px 이하)로 접는다.
   * DOM 이 달라지므로 CSS 가 아니라 media.phone 으로 가른다(DataTable rows2 와 같은 방식).
   * 로딩 중에는 그리지 않는다(호출부가 데이터가 있을 때만 둔다) — '0' 을 먼저 보이지 않는다.
   */
  import { media } from '$lib/media.svelte';
  import StatTile from '$components/StatTile.svelte';

  let { items }: { items: readonly SummaryItem[] } = $props();
</script>

{#if media.phone}
  <p class="line">
    {#each items as it, i (it.label)}{#if i}<span class="sep" aria-hidden="true">{' · '}</span>{/if}<span class="it">{#if !it.short}<span class="sr-only">{`${it.label} `}</span>{/if}{#if it.datetime}<time datetime={it.datetime} title={it.title}>{it.short ?? `${it.value}${it.unit ?? ''}`}</time>{:else}{it.short ?? `${it.value}${it.unit ?? ''}`}{/if}</span>{/each}
  </p>
{:else}
  <dl class="strip" style:--n={items.length}>
    {#each items as it (it.label)}
      <StatTile label={it.label} value={it.value} unit={it.unit} datetime={it.datetime} title={it.title} />
    {/each}
  </dl>
{/if}

<style>
  .strip {
    --n: 4;   /* 칸 수 — 인라인 style:--n 이 덮어쓴다 */
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 10px;
    margin: 0;
  }
  /* 태블릿(641~820px): 네 칸 한 줄이면 칸이 150px 아래로 줄어 '10/1 16:27' 같은 값이 넘친다 */
  @media (max-width: 820px) {
    .strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-height: 28px;
    color: var(--dim);
    font-size: var(--fs-sm);
    font-variant-numeric: tabular-nums;
  }
  .it { white-space: nowrap; color: var(--txt); }
  .sep { white-space: pre; }
</style>
