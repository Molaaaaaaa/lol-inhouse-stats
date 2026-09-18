<script lang="ts">
  /**
   * 시너지 화면 — `#/synergy/duo`(기본) · `#/synergy/trio` · `#/synergy/heat`. 하위 화면은 Subtabs 로
   * 나누고 라우트가 상태다(딥링크 가능). 모르는 sub 는 duo 로 본다.
   * 옛 사이트의 `#/synergy/ties`(맞대결)는 기록 화면으로 옮겨 갔다 — 그 주소는 기록으로 보낸다.
   *
   * 하위 화면 셋은 같은 payload 조각(synergy·trios)을 보는 작은 표라 섹션 청크에 함께 싣는다
   * (계산식 화면과 같은 원칙). 각 하위 화면이 자기 표·선택·수식 줄을 가진다.
   */
  import { app } from '$lib/data/store.svelte';
  import { href, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { clearFx } from '$lib/fx.svelte';
  import Subtabs, { type SubtabItem } from '$components/Subtabs.svelte';
  import Skeleton from '$components/Skeleton.svelte';
  import Duo from './synergy/Duo.svelte';
  import Trio from './synergy/Trio.svelte';
  import Heat from './synergy/Heat.svelte';

  let { sub = '' }: { sub?: string; params?: Record<string, string> } = $props();

  const TABS: readonly SubtabItem[] = [
    { id: 'duo', label: '듀오' },
    { id: 'trio', label: '트리오' },
    { id: 'heat', label: '히트맵' },
  ];
  type SubId = 'duo' | 'trio' | 'heat';
  const isSubId = (s: string): s is SubId => TABS.some((t) => t.id === s);
  const active = $derived<SubId>(isSubId(sub) ? sub : 'duo');

  // 옛 주소 `#/synergy/ties` → 기록 화면의 맞대결
  $effect(() => {
    if (sub === 'ties') router.go(href(['records', 'ties']));
  });

  function go(id: string) {
    router.go(href(['synergy', id]));
    clearFx();   // 지난 탭에서 고른 조합의 근거가 새 표 위에 남지 않게
    announce(`${TABS.find((t) => t.id === id)?.label ?? id} 화면`);
  }
</script>

<section class="synergy" aria-labelledby="syn-h">
  <h2 id="syn-h" class="sr-only">시너지</h2>
  <Subtabs tabs={TABS} {active} onchange={go} label="시너지 하위 화면" prefix="syn" />
  <div id="syn-panel-{active}" role="tabpanel" aria-labelledby="syn-tab-{active}" class="panel">
    {#if !app.data}
      <Skeleton rows={8} />
    {:else if active === 'trio'}
      <Trio data={app.data} minGames={app.minGames} />
    {:else if active === 'heat'}
      <Heat data={app.data} minGames={app.minGames} />
    {:else}
      <Duo data={app.data} minGames={app.minGames} />
    {/if}
  </div>
</section>

<style>
  .synergy { display: grid; gap: var(--sp-2); }
  .panel { min-width: 0; }
</style>
