<script lang="ts">
  /**
   * 기록 화면 — `#/records/:sub`. 하위 화면 넷을 Subtabs 로 나누고 라우트가 상태다(딥링크 가능):
   * hall(명예의 전당, 기본) · deaths(역전·데스) · play(로밍·한타·오브젝트, 순위 화면에서 이사) ·
   * ties(관계, 시너지 화면에서 이사). 옛 주소 `mvp` 는 hall 로, 모르는 sub 도 hall 로 본다.
   *
   * 패널은 켜질 때만 mount 한다 — 각 패널의 선택·거르기·라인 선택은 그 패널 것이고, 하위 화면을 바꾸면
   * 수식 줄을 비운다(지난 패널의 근거가 새 패널 위에 남으면 거짓말이 된다).
   */
  import { app } from '$lib/data/store.svelte';
  import { href, router } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { clearFx } from '$lib/fx.svelte';
  import Subtabs, { type SubtabItem } from '$components/Subtabs.svelte';
  import Skeleton from '$components/Skeleton.svelte';
  import Hall from './records/Hall.svelte';
  import Deaths from './records/Deaths.svelte';
  import Play from './records/Play.svelte';
  import Ties from './records/Ties.svelte';

  let { sub = '' }: { sub?: string; params?: Record<string, string> } = $props();

  const TABS = [
    { id: 'hall', label: '명예의 전당' },
    { id: 'deaths', label: '역전 · 데스' },
    { id: 'play', label: '로밍 · 한타 · 오브젝트' },
    { id: 'ties', label: '관계' },
  ] as const satisfies readonly SubtabItem[];
  type SubId = (typeof TABS)[number]['id'];
  const isSubId = (s: string): s is SubId => TABS.some((t) => t.id === s);

  const active = $derived<SubId>(isSubId(sub) ? sub : 'hall');   // 'mvp'(옛 주소)·모르는 값 → hall

  // 하위 화면이 바뀌면(탭·뒤로 가기 모두) 수식 줄을 비운다
  let shown = '';
  $effect(() => {
    if (shown && shown !== active) clearFx();
    shown = active;
  });

  function go(id: string) {
    router.go(href(['records', id]));
    announce(TABS.find((t) => t.id === id)?.label ?? id);
  }
</script>

<section class="records" aria-labelledby="rec-h">
  <h2 id="rec-h" class="sr-only">기록</h2>
  <Subtabs tabs={TABS} {active} onchange={go} label="기록 하위 화면" prefix="rec" />
  <div id="rec-panel-{active}" role="tabpanel" aria-labelledby="rec-tab-{active}" class="panel">
    {#if !app.data}
      <Skeleton rows={6} />
    {:else if active === 'deaths'}
      <Deaths data={app.data} entered={true} />
    {:else if active === 'play'}
      <Play data={app.data} />
    {:else if active === 'ties'}
      <Ties data={app.data} />
    {:else}
      <Hall data={app.data} />
    {/if}
  </div>
</section>

<style>
  .records { display: grid; gap: var(--sp-2); min-width: 0; }
  .panel { min-width: 0; }
</style>
