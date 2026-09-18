<script lang="ts">
  /**
   * 계산식 화면 — `#/math/cp`(티어 계산식) · `#/math/metrics`(지표 설명). 하위 화면은 Subtabs 로 나누고
   * 라우트가 상태다(딥링크 가능). 모르는 sub 는 cp 로 본다.
   */
  import { app } from '$lib/data/store.svelte';
  import { href, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import Subtabs, { type SubtabItem } from '$components/Subtabs.svelte';
  import CpFormula from './math/CpFormula.svelte';
  import MetricGuide from './math/MetricGuide.svelte';

  let { sub = '' }: { sub?: string; params?: Record<string, string> } = $props();

  const TABS: readonly SubtabItem[] = [
    { id: 'cp', label: '티어 계산식' },
    { id: 'metrics', label: '지표 설명' },
  ];
  const active = $derived(sub === 'metrics' ? 'metrics' : 'cp');

  function go(id: string) {
    router.go(href(['math', id]));
    announce(TABS.find((t) => t.id === id)?.label ?? id);
  }
</script>

<section class="math" aria-labelledby="math-h">
  <h2 id="math-h" class="sr-only">계산식</h2>
  <Subtabs tabs={TABS} {active} onchange={go} label="계산식 하위 화면" prefix="math" />
  <div id="math-panel-{active}" role="tabpanel" aria-labelledby="math-tab-{active}" class="panel">
    {#if active === 'metrics'}
      <MetricGuide data={app.data} />
    {:else}
      <CpFormula data={app.data} />
    {/if}
  </div>
</section>

<style>
  .panel { padding-top: var(--sp-2); }
</style>
