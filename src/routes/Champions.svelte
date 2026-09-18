<script lang="ts">
  /**
   * 챔피언 화면 — `#/champions/meta[/라인]`(메타 + 챔피언 폭) · `#/champions/matchup`(라인 매치업) ·
   * `#/champions/ban`(밴). 하위 화면은 Subtabs 로 나누고 라우트가 상태다(딥링크 가능).
   * 모르는 sub 는 meta 로 본다 — 옛 사이트의 '챔피언 폭' 탭(`pool`)은 메타 탭 아래 둘째 표로 합쳤다.
   */
  import { app } from '$lib/data/store.svelte';
  import { href, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import Subtabs, { type SubtabItem } from '$components/Subtabs.svelte';
  import Skeleton from '$components/Skeleton.svelte';
  import Meta from './champions/Meta.svelte';
  import Matchup from './champions/Matchup.svelte';
  import Ban from './champions/Ban.svelte';

  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();

  const TABS: readonly SubtabItem[] = [
    { id: 'meta', label: '메타' },
    { id: 'matchup', label: '매치업' },
    { id: 'ban', label: '밴' },
  ];
  type TabId = 'meta' | 'matchup' | 'ban';
  const active = $derived<TabId>(sub === 'matchup' || sub === 'ban' ? sub : 'meta');

  function go(id: string) {
    router.go(href(['champions', id]));
    announce(TABS.find((t) => t.id === id)?.label ?? id);
  }
</script>

<section class="champions" aria-labelledby="ch-h">
  <h2 id="ch-h" class="sr-only">챔피언</h2>
  <Subtabs tabs={TABS} {active} onchange={go} label="챔피언 하위 화면" prefix="ch" />
  <div id="ch-panel-{active}" role="tabpanel" aria-labelledby="ch-tab-{active}" class="panel">
    {#if !app.data}
      <Skeleton rows={6} />
    {:else if active === 'matchup'}
      <Matchup data={app.data} />
    {:else if active === 'ban'}
      <Ban data={app.data} />
    {:else}
      <Meta data={app.data} lane={params.lane ?? ''} minGames={app.minGames} />
    {/if}
  </div>
</section>

<style>
  .panel { padding-top: var(--sp-2); min-width: 0; }
</style>
