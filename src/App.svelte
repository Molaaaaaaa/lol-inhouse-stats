<script lang="ts">
  /**
   * 앱 셸 — 내전 장부(스프레드시트) 세계의 뼈대. 위에서부터:
   * 헤더 한 줄(제목·서버 선택·새로고침·메타) → 소환사명 검색 셀 → 수식 줄 → 본문(.wrap) → Riot 고지,
   * 그리고 시트 탭은 모든 폭에서 화면 아래 고정(시트 밑 — DOM 순서는 본문 앞이라 Tab 순서가 위→아래다).
   * 새 버전 배너는 맨 위, 안내 음성은 #sr.
   *
   * 화면(섹션)이 바뀔 때만 청크를 받고, 그때 수식 줄을 비운다(지난 화면의 근거가 남지 않게).
   */
  import { onMount, type Component } from 'svelte';
  import { app } from '$lib/data/store.svelte';
  import { watchFreshness } from '$lib/data/loader';
  import { router } from '$lib/router.svelte';
  import { VIEWS, VIEW_TITLE } from '$lib/routes';
  import { announce } from '$lib/a11y';
  import { clearFx } from '$lib/fx.svelte';
  import Icon from '$components/Icon.svelte';
  import SearchCell from '$components/SearchCell.svelte';
  import FormulaBar from '$components/FormulaBar.svelte';
  import SheetTabs from '$components/SheetTabs.svelte';
  import FreshBanner from '$components/FreshBanner.svelte';

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
    clearFx();
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

  const loading = $derived(app.status === 'loading' || app.status === 'idle');
  const viewPending = $derived(app.status === 'ready' && !View);
  const SKEL_ROWS = [0, 1, 2, 3, 4, 5, 6];
</script>

<a class="skip" href="#main">본문으로 건너뛰기</a>
<div id="sr" class="sr-only" aria-live="polite" role="status"></div>

<div class="shell">
  {#if stale}
    <FreshBanner />
  {/if}

  <header class="top">
    <h1 class="title"><a href="#/">내전 해체 분석기</a></h1>
    {#if app.index.length > 1}
      <label class="sr-only" for="guildSel">서버 선택</label>
      <select id="guildSel" class="ctl" value={app.gid} onchange={(e) => app.select((e.currentTarget as HTMLSelectElement).value)}>
        {#each app.index as g (g.id)}
          <option value={g.id}>{g.name} ({g.players}명)</option>
        {/each}
      </select>
    {/if}
    <button type="button" class="ctl btn" onclick={() => app.reload()} disabled={loading || !app.gid}>
      <Icon name="refresh-cw" />
      <span>새로고침</span>
    </button>
    <p id="meta" class="meta" aria-live="polite">
      {#if loading}
        <span class="muted">데이터를 불러오는 중…</span>
      {:else if app.status === 'error' && app.error}
        <span class="problem">{app.error.message}</span>
        {#if app.error.retry}<button type="button" class="ctl btn" onclick={app.error.retry}>다시 시도</button>{/if}
      {:else if app.status === 'ready' && app.data}
        <span class="muted">{app.data.name} · {app.data.summary.total_games}경기 · {app.data.summary.player_count}명</span>
      {/if}
    </p>
  </header>

  <SearchCell />
  <FormulaBar />
  <SheetTabs />

  <main id="main" class="wrap" tabindex="-1" aria-busy={loading || viewPending}>
    {#if router.route.unknown}
      <p class="muted note" role="status">없는 화면입니다. 멤버 화면으로 이동했습니다.</p>
    {/if}
    {#if app.status === 'ready' && View}
      <View sub={router.route.sub} params={router.route.params} />
    {:else if loading || viewPending}
      <div class="skel" aria-hidden="true">
        {#each SKEL_ROWS as i (i)}
          <div class="skrow" class:head={i === 0}>
            <span class="rn"></span>
            <span class="c c1"></span>
            <span class="c c2"></span>
            <span class="c c3"></span>
            <span class="c c4"></span>
          </div>
        {/each}
      </div>
    {/if}
  </main>

  <footer class="foot">
    <p>
      내전 해체 분석기는 Riot Games 의 승인을 받지 않았으며 Riot Games 또는 리그 오브 레전드 제작·관리에 공식적으로 관여하는 누구의 견해나 의견도 대변하지 않습니다.
      Riot Games 및 관련 자산은 Riot Games, Inc. 의 상표 또는 등록 상표입니다.
    </p>
  </footer>
</div>

<style>
  .skip { position: absolute; left: -999px; top: 0; }
  .skip:focus {
    left: var(--sp-3); top: var(--sp-3); z-index: 40;
    background: var(--raised); color: var(--txt);
    padding: var(--sp-2) var(--sp-3); border: 1px solid var(--grid-strong); border-radius: var(--r-chip);
  }

  /* 시트 탭이 화면 아래 고정이라 본문·고지가 그 밑으로 안 들어가게 자리를 비운다(탭 높이 + 위 격자선) */
  .shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding-bottom: calc(var(--row-h) + 1px + env(safe-area-inset-bottom, 0px));
  }

  /* 헤더 한 줄 — 제목은 파일 이름, 나머지는 도구. 홈통 바탕, 아래 격자선 */
  .top {
    display: flex; align-items: center; flex-wrap: wrap;
    gap: var(--sp-2) var(--sp-3);
    min-height: var(--row-h);
    padding: var(--sp-2) var(--sp-4);
    background: var(--gutter);
    border-bottom: 1px solid var(--grid);
  }
  .title { font-size: var(--fs-lg); font-weight: 650; white-space: nowrap; }
  .title a { text-decoration: none; }
  .title a:hover { text-decoration: underline; text-underline-offset: .2em; }
  .meta {
    margin-left: auto;
    display: inline-flex; align-items: center; gap: var(--sp-2);
    font-size: var(--fs-sm);
    text-align: right;
  }
  .problem { color: var(--txt); }

  /* 셀 모양 컨트롤 — select·버튼 한 어휘 */
  .ctl {
    min-height: 32px;
    padding: 0 var(--sp-3);
    background: var(--sheet);
    color: var(--txt);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
    transition: background-color .15s ease-out, border-color .15s ease-out;
  }
  .btn { display: inline-flex; align-items: center; gap: var(--sp-1); white-space: nowrap; }
  .ctl:hover:not(:disabled) { background: var(--raised); }
  .ctl:active:not(:disabled) { background: var(--ink); }
  .ctl:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; }
  select.ctl { max-width: 14rem; }

  .wrap { flex: 1 0 auto; width: 100%; max-width: var(--wrap); margin: 0 auto; padding: var(--sp-3) var(--sp-4) var(--sp-5); }
  .note { padding-bottom: var(--sp-3); }

  /* 스켈레톤 — 표 모양(행 번호 홈통 + 셀 4개). 움직이지 않는다: 로딩은 상태지 연출이 아니다 */
  .skel { border: 1px solid var(--grid); }
  .skrow { display: flex; align-items: center; gap: var(--sp-3); height: var(--row-h); padding: 0 var(--sp-3); border-bottom: 1px solid var(--grid); }
  .skrow:last-child { border-bottom: 0; }
  .skrow.head { background: var(--gutter); }
  .rn { flex: none; width: 2.5ch; height: .7em; background: var(--grid); border-radius: 2px; }
  .c { display: block; height: .7em; background: var(--grid); border-radius: 2px; }
  .head .c { background: var(--grid-strong); }
  .c1 { flex: 3 1 0; } .c2 { flex: 1 1 0; } .c3 { flex: 1 1 0; } .c4 { flex: 2 1 0; }

  .foot { padding: var(--sp-4); border-top: 1px solid var(--grid); color: var(--dim2); font-size: var(--fs-xs); }
  .foot p { max-width: 75ch; }

  @media (pointer: coarse) {
    .ctl { min-height: 44px; }
  }

  /* 폰: 탭이 44px 이라 그만큼(+ 위 격자선) 비운다 */
  @media (max-width: 640px) {
    .shell { padding-bottom: calc(45px + env(safe-area-inset-bottom, 0px)); }
    .top { padding-left: var(--sp-3); padding-right: var(--sp-3); }
    .meta { flex-basis: 100%; margin-left: 0; justify-content: flex-start; text-align: left; }
    .wrap { padding-left: var(--sp-3); padding-right: var(--sp-3); }
    .c3 { display: none; }
  }
</style>
