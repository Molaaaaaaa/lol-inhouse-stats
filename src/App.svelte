<script lang="ts">
  /**
   * 앱 셸 — 헤더(제목·서버 선택·새로고침·메타)·내비·화면 출구·새 버전 배너·로드 오류·안내 음성.
   * Phase 0 뼈대: 시각 결정(방향 라운드) 전이라 레이아웃만 있다.
   */
  import { onMount, type Component } from 'svelte';
  import { app } from '$lib/data/store.svelte';
  import { watchFreshness } from '$lib/data/loader';
  import { router } from '$lib/router.svelte';
  import { VIEWS, VIEW_TITLE } from '$lib/routes';
  import { NAV } from '$lib/nav';
  import { announce } from '$lib/a11y';

  type ViewProps = { sub: string; params: Record<string, string> };
  let View = $state<Component<ViewProps> | null>(null);
  let stale = $state(false);

  // 화면(섹션)이 바뀔 때만 청크를 받는다. 같은 섹션 안 이동은 props 로 흐른다.
  let loadedSection = '';
  $effect(() => {
    const sec = router.route.section;
    if (sec === loadedSection) return;
    loadedSection = sec;
    View = null;
    VIEWS[sec]().then((m) => {
      if (loadedSection !== sec) return;   // 그 사이 다른 화면으로 갔다
      View = m.default;
      document.title = `${VIEW_TITLE[sec]} · 내전 해체 분석기`;
      announce(`${VIEW_TITLE[sec]} 화면`);
      window.scrollTo({ top: 0 });
    });
  });

  onMount(() => {
    router.start();
    void app.boot();
    const stop = watchFreshness(() => { stale = true; });
    return () => { stop(); router.stop(); };
  });
</script>

<a class="skip" href="#main">본문으로 건너뛰기</a>
<div id="sr" class="sr-only" aria-live="polite" role="status"></div>

{#if stale}
  <div class="freshbar" role="status">
    사이트가 업데이트되었습니다. 새로고침해 주세요.
    <button type="button" onclick={() => location.reload()}>새로고침</button>
  </div>
{/if}

<header class="top">
  <h1><a href="#/">내전 해체 분석기</a></h1>
  {#if app.index.length > 1}
    <label class="sr-only" for="guildSel">서버 선택</label>
    <select id="guildSel" value={app.gid} onchange={(e) => app.select((e.currentTarget as HTMLSelectElement).value)}>
      {#each app.index as g (g.id)}
        <option value={g.id}>{g.name} ({g.players}명)</option>
      {/each}
    </select>
  {/if}
  <button type="button" onclick={() => app.reload()} aria-label="새로고침">새로고침</button>
  <p id="meta" class="meta" aria-live="polite">
    {#if app.status === 'loading'}데이터를 불러오는 중…{/if}
    {#if app.status === 'error' && app.error}
      {app.error.message}
      {#if app.error.retry}<button type="button" class="retry" onclick={app.error.retry}>다시 시도</button>{/if}
    {/if}
    {#if app.status === 'ready' && app.data}
      {app.data.name} · {app.data.summary.total_games}경기 · {app.data.summary.player_count}명
    {/if}
  </p>
</header>

<nav class="nav" aria-label="주 메뉴">
  {#each NAV as item (item.id)}
    <a href={item.href} class="navlink" class:on={router.route.section === item.id || (item.id === 'home' && router.route.section === 'member')}
       aria-current={router.route.section === item.id ? 'page' : undefined}>{item.label}</a>
  {/each}
</nav>

<main id="main" class="wrap" tabindex="-1">
  {#if router.route.unknown}
    <p class="muted" role="status">없는 화면입니다. 멤버 화면으로 이동했습니다.</p>
  {/if}
  {#if app.status === 'ready' && View}
    <View sub={router.route.sub} params={router.route.params} />
  {:else if app.status === 'ready'}
    <p class="muted">화면을 불러오는 중…</p>
  {/if}
</main>

<footer class="foot">
  <p class="muted">
    내전 해체 분석기는 Riot Games 의 승인을 받지 않았으며 Riot Games 또는 리그 오브 레전드 제작·관리에 공식적으로 관여하는 누구의 견해나 의견도 대변하지 않습니다.
    Riot Games 및 관련 자산은 Riot Games, Inc. 의 상표 또는 등록 상표입니다.
  </p>
</footer>

<style>
  .skip { position: absolute; left: -999px; top: 0; }
  .skip:focus { left: var(--sp-3); top: var(--sp-3); z-index: 10; background: var(--panel2); padding: var(--sp-2) var(--sp-3); border-radius: var(--r-ctl); }
  .freshbar { padding: var(--sp-2) var(--sp-4); background: var(--panel2); border-bottom: 1px solid var(--line); }
  .top { display: flex; gap: var(--sp-3); align-items: center; flex-wrap: wrap; padding: var(--sp-3) var(--sp-5); border-bottom: 1px solid var(--line); background: var(--panel); }
  h1 { font-size: var(--fs-head); margin: 0; font-weight: 700; }
  h1 a { color: inherit; text-decoration: none; }
  .meta { color: var(--dim); font-size: var(--fs-sm); margin: 0 0 0 auto; text-align: right; }
  .nav { display: flex; flex-wrap: wrap; gap: var(--sp-2); padding: var(--sp-3) var(--sp-5); }
  .navlink { color: var(--dim); text-decoration: none; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-pill); border: 1px solid transparent; }
  .navlink.on { color: var(--txt); border-color: var(--line2); background: var(--panel2); }
  .wrap { max-width: var(--wrap); margin: 0 auto; padding: var(--sp-3) var(--sp-4); }
  .foot { padding: var(--sp-4) var(--sp-5); border-top: 1px solid var(--line); }
  .muted { color: var(--dim); }
  select, button { background: var(--panel2); color: var(--txt); border: 1px solid var(--line); border-radius: var(--r-ctl); padding: var(--sp-2) var(--sp-3); font: inherit; cursor: pointer; }
</style>
