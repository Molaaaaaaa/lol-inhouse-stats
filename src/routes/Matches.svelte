<script module lang="ts">
  /** 하위 화면 — 시트 안의 이름 있는 범위 둘. 라벨은 명사구. */
  export const SUBTABS = [
    { id: 'list', label: '최근 경기' },
    { id: 'trend', label: '경향' },
  ] as const;
  export type SubId = (typeof SUBTABS)[number]['id'];
</script>

<script lang="ts">
  /**
   * 경기 화면 — `#/matches`(최근 경기) · `#/matches/trend`(경향) · `#/matches/슬러그`(경기 상세 단독).
   * 하위 탭은 최근 경기·경향 둘이고, 상세는 목록 안에서 '상세' 버튼으로 펼치는 것과 같은 화면을
   * 단독 주소로 연다(탭은 최근 경기가 활성인 채, 위에 목록으로 돌아가는 링크).
   *
   * 상세 파일은 `app.lazy.matchDetail(slug)` 로 받는다. 실패는 캐시되지 않으므로 '다시 시도' 가 다시 받는다.
   */
  import type { MatchDetail } from '$lib/data/types';
  import { app } from '$lib/data/store.svelte';
  import { href, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { clearFx } from '$lib/fx.svelte';
  import { dateTimeKo } from '$lib/fmt';
  import Subtabs from '$components/Subtabs.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import Skeleton from '$components/Skeleton.svelte';
  import List from './matches/List.svelte';
  import Trend from './matches/Trend.svelte';
  import Detail from './matches/Detail.svelte';

  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();

  const data = $derived(app.data);
  const isDetail = $derived(sub === 'detail' && !!params.slug);
  const active = $derived<SubId>(sub === 'trend' ? 'trend' : 'list');
  const LIST_HREF = href(['matches']);

  function pickSub(id: string) {
    if (id === 'trend') router.go(href(['matches', 'trend']));
    else router.go(LIST_HREF);
  }

  // ── 단독 상세 ──
  let detail = $state<MatchDetail | null>(null);
  let detailStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let loadedSlug = '';
  const slug = $derived(isDetail ? (params.slug ?? '') : '');
  const known = $derived(data?.recent_matches?.find((m) => m.match_id === slug) ?? null);
  const detailTime = $derived(known ? dateTimeKo(known.ts) : '');

  async function loadDetail(s: string) {
    detailStatus = 'loading';
    detail = null;
    const d = app.lazy ? await app.lazy.matchDetail(s) : null;
    if (loadedSlug !== s) return;   // 그 사이 다른 경기로 갔다
    detail = d;
    detailStatus = d ? 'ready' : 'error';
    if (!d) announce('경기 상세를 불러오지 못했습니다.');
  }
  $effect(() => {
    const s = slug;
    if (!s || !app.lazy) { loadedSlug = ''; return; }
    if (s === loadedSlug) return;
    loadedSlug = s;
    void loadDetail(s);
  });
  function retry() {
    loadedSlug = slug;
    void loadDetail(slug);
  }

  // 하위 화면·상세가 바뀌면 지난 근거를 비운다
  $effect(() => {
    void sub; void slug;
    clearFx();
  });
  $effect(() => {
    document.title = `${isDetail ? '경기 상세' : SUBTABS.find((t) => t.id === active)?.label ?? '경기'} · 내전 해체 분석기`;
  });
</script>

<section class="matches" aria-labelledby="mt-h">
  <h2 id="mt-h" class="sr-only">경기</h2>
  <Subtabs tabs={SUBTABS} active={active} onchange={pickSub} label="경기 하위 화면" prefix="mt" />
  <div class="panel" role="tabpanel" id="mt-panel-{active}" aria-labelledby="mt-tab-{active}">
    {#if !data}
      <Skeleton rows={8} />
    {:else if isDetail}
      <div class="one">
        <p class="crumb">
          <a href={LIST_HREF}>최근 경기</a>
          <span class="sep" aria-hidden="true">›</span>
          <span>경기 상세{detailTime ? ` · ${detailTime}` : ''}</span>
        </p>
        {#if detailStatus === 'loading' || detailStatus === 'idle'}
          <Skeleton rows={6} />
        {:else if detailStatus === 'error' || !detail}
          <EmptyState text="경기 상세를 불러오지 못했습니다. 주소가 맞는지 확인하거나 다시 시도합니다." />
          <button type="button" class="ctl" onclick={retry}>다시 시도</button>
        {:else}
          <Detail {detail} {data} {slug} />
        {/if}
      </div>
    {:else if active === 'trend'}
      <Trend {data} />
    {:else}
      <List />
    {/if}
  </div>
</section>

<style>
  .matches { display: grid; gap: var(--sp-3); min-width: 0; }
  .panel { min-width: 0; }
  .one { display: grid; gap: var(--sp-3); }
  .crumb { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--dim); }
  .crumb a { color: var(--txt); text-underline-offset: .2em; }
  .sep { color: var(--dim2); }
  .ctl {
    justify-self: start;
    min-height: 32px;
    padding: 0 var(--sp-3);
    background: var(--sheet);
    color: var(--txt);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
    transition: background-color .15s ease-out, border-color .15s ease-out;
  }
  .ctl:hover:not(:disabled) { background: var(--raised); }
  .ctl:active:not(:disabled) { background: var(--ink); }
  .ctl:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; }
  @media (pointer: coarse) {
    .ctl { min-height: 44px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ctl { transition: none; }
  }
</style>
