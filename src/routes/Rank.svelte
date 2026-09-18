<script module lang="ts">
  /** 하위 화면 id — 'board' 승률 리더보드 · 'metric' 지표 순위. 'play'(로밍·한타·오브젝트)는 기록 화면으로 이사했다. */
  export const SUB_IDS = ['board', 'metric'] as const;
  export type SubId = (typeof SUB_IDS)[number];
  export const isSubId = (s: string): s is SubId => (SUB_IDS as readonly string[]).includes(s);

  /** 마지막으로 보던 지표 — 탭을 오가도 유지(모듈 변수. 세션 저장소는 쓰지 않는다). */
  export const memo = { key: '', lane: '' };
</script>

<script lang="ts">
  /**
   * 순위 화면 — 하위 탭 둘: 승률(리더보드, `#/rank/board/:lane?`) · 지표(지표 순위, `#/rank/metric/:key/:lane?`).
   * 탭·지표·라인 선택은 전부 URL 이 상태다. 옛 `#/rank/play` 는 기록 화면(`#/records/play`)으로 보낸다.
   * 승률 탭의 이름은 지표 이름의 단일 출처(metric_meta.label)에서 온다 — 표 머리와 같은 글자여야 한다.
   */
  import { app } from '$lib/data/store.svelte';
  import { href, metricHref, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { clearFx } from '$lib/fx.svelte';
  import { mLabel } from '$lib/metrics';
  import Subtabs from '$components/Subtabs.svelte';
  import Board from './rank/Board.svelte';
  import MetricRank from './rank/MetricRank.svelte';

  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();

  const active = $derived<SubId>(isSubId(sub) ? sub : 'board');
  const tabs = $derived([
    { id: 'board', label: mLabel(app.data?.metric_meta, 'winrate') },
    { id: 'metric', label: '지표' },
  ]);
  const labelOf = (id: SubId) => tabs.find((t) => t.id === id)?.label ?? id;

  // 옛 주소 — 로밍·한타·오브젝트는 기록 화면으로
  $effect(() => {
    if (sub === 'play') router.go(href(['records', 'play']));
  });
  // 지표 탭에서 보던 지표·라인을 기억해 두었다가 탭을 오갈 때 돌아온다
  $effect(() => {
    if (active === 'metric' && params.key) { memo.key = params.key; memo.lane = params.lane ?? ''; }
  });

  function pickSub(id: string) {
    if (!isSubId(id) || id === active) return;
    clearFx();
    announce(`${labelOf(id)} 순위`);
    router.go(id === 'board' ? href(['rank', 'board']) : metricHref(memo.key || 'dpm', memo.lane || undefined));
  }
</script>

<section class="rank" aria-labelledby="rank-h">
  <h2 id="rank-h" class="sr-only">순위</h2>
  <Subtabs {tabs} {active} onchange={pickSub} label="순위 하위 화면" prefix="rank" />
  <div class="panel" role="tabpanel" id="rank-panel-{active}" aria-labelledby="rank-tab-{active}">
    {#if active === 'metric'}
      <MetricRank {params} />
    {:else}
      <Board {params} />
    {/if}
  </div>
</section>

<style>
  .rank { display: grid; gap: var(--sp-3); }
  .panel { min-width: 0; }
</style>
