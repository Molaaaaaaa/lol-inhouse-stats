<script lang="ts">
  /**
   * 앱 셸 — 불씨 전광판의 뼈대. 위에서부터:
   * 헤더(브랜드 마크·제목 | 상태·서버 선택·새로고침·피드백) → 소환사명 검색 → 수식 줄 → 본문(.wrap, 카드 사이 16px)
   * → Riot 고지, 그리고 하단 독(SheetTabs — 화면 아래에 떠 있다. DOM 순서는 본문 앞이라 Tab 순서가 위→아래다).
   * 헤더는 데스크톱·태블릿(≥641px)에서만 위에 붙는다(반투명) — 폰에서는 세로 자리를 아끼려고 같이 스크롤한다.
   * 경기·멤버 수는 헤더가 아니라 화면 맨 위 요약 띠(SummaryStrip)가 보인다. 새 버전 배너는 맨 위, 안내 음성은 #sr.
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
  import Glyph from '$components/Glyph.svelte';
  import SearchCell from '$components/SearchCell.svelte';
  import FormulaBar from '$components/FormulaBar.svelte';
  import SheetTabs from '$components/SheetTabs.svelte';
  import FreshBanner from '$components/FreshBanner.svelte';
  import Skeleton from '$components/Skeleton.svelte';

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
  /** 서버 이름 — 서버가 여럿이면 선택 상자가 이미 보이므로 글로는 쓰지 않는다 */
  const serverName = $derived(app.status === 'ready' && app.data && app.index.length <= 1 ? app.data.name : '');
  /** 불러오는 중·오류 — 폰에서도 보여야 하는 상태(서버 이름만 있을 때는 폰에서 숨긴다) */
  const hasStatus = $derived(loading || (app.status === 'error' && !!app.error));
</script>

<a class="skip" href="#main">본문으로 건너뛰기</a>
<div id="sr" class="sr-only" aria-live="polite" role="status"></div>

<div class="shell">
  {#if stale}
    <FreshBanner />
  {/if}

  <header class="top">
    <h1 class="title"><a href="#/"><span class="mark"><Glyph name="mark" /></span><span>내전 해체 분석기</span></a></h1>
    <p id="meta" class="meta" class:has={hasStatus} aria-live="polite">
      {#if loading}
        <span class="muted">데이터를 불러오는 중…</span>
      {:else if app.status === 'error' && app.error}
        <span class="problem">{app.error.message}</span>
        {#if app.error.retry}<button type="button" class="ctl btn" onclick={app.error.retry}>다시 시도</button>{/if}
      {:else if serverName}
        <span class="muted">{serverName}</span>
      {/if}
    </p>
    <div class="tools">
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
        <span class="bl">새로고침</span>
      </button>
      <a class="ctl btn" href="#/feedback">피드백</a>
    </div>
  </header>

  <div class="bars">
    <SearchCell />
    <FormulaBar />
  </div>
  <SheetTabs />

  <main id="main" class="wrap" tabindex="-1" aria-busy={loading || viewPending}>
    {#if router.route.unknown}
      <p class="muted note" role="status">없는 화면입니다. 멤버 화면으로 이동했습니다.</p>
    {/if}
    {#if app.status === 'ready' && View}
      <View sub={router.route.sub} params={router.route.params} />
    {:else if loading || viewPending}
      <Skeleton rows={6} />
    {/if}
  </main>

  <footer class="foot">
    <p>
      내전 해체 분석기는 Riot Games 의 승인을 받지 않았으며 Riot Games 또는 리그 오브 레전드 제작·관리에 공식적으로 관여하는 누구의 견해나 의견도 대변하지 않습니다.
      Riot Games 및 관련 자산은 Riot Games, Inc. 의 상표 또는 등록 상표입니다.
    </p>
    <p class="foot-link"><a href="#/math/metrics">지표 안내</a><a href="#/feedback">피드백 남기기</a></p>
  </footer>
</div>

<style>
  .skip { position: absolute; left: -999px; top: 0; }
  .skip:focus {
    left: var(--sp-3); top: var(--sp-3); z-index: 40;
    background: var(--raised); color: var(--txt);
    padding: var(--sp-2) var(--sp-3); border: 1px solid var(--grid-strong); border-radius: var(--r-chip);
  }

  /* 독이 화면 아래에 떠 있어 본문·고지가 그 밑으로 안 들어가게 자리를 비운다:
     독 높이(항목 38 + 여백 10 + 선 2 = 50) + 아래 띄움 12 + 숨 12. 굵은 포인터는 항목 44px, 폰은 띄움 8 */
  .shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding-bottom: calc(74px + env(safe-area-inset-bottom, 0px));
  }

  /* 헤더 — 반투명 판(뒤가 흐리게 비친다), 아래 1px 선. 높이 56px 고정(표 머리행 sticky top = --sticky-top) */
  .top {
    position: sticky;
    top: 0;
    z-index: 25;
    display: flex;
    align-items: center;
    gap: var(--sp-2) var(--sp-3);
    height: 56px;
    padding: 0 var(--sp-4);
    background: color-mix(in srgb, var(--bg) 94%, transparent);
    border-bottom: 1px solid var(--grid);
  }
  @supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .top {
      background: color-mix(in srgb, var(--bg) 78%, transparent);
      -webkit-backdrop-filter: blur(14px) saturate(1.2);
      backdrop-filter: blur(14px) saturate(1.2);
    }
  }
  .title { flex: none; font-size: var(--fs-xl); font-weight: 700; white-space: nowrap; }
  .title a { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; text-decoration: none; }
  .title a:hover span:last-child { text-decoration: underline; text-underline-offset: .2em; }
  /* 브랜드 마크 — 28px 둥근 타일 판(무채색 그라디언트 + 1px 굵은 선), 위로 꺾여 오르는 선.
     액센트로 칠하지 않는다 — 액센트는 선택·초점·활성 독·MVP 에만(비평 반영) */
  .mark {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
    background: var(--grad-tile);
    color: var(--txt);
    font-size: 18px;
    box-shadow: var(--edge-hi);
  }
  .meta {
    flex: 1 1 auto;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--sp-2);
    font-size: var(--fs-sm);
    white-space: nowrap;
    overflow: hidden;
  }
  .meta > span { overflow: hidden; text-overflow: ellipsis; }
  .problem { color: var(--txt); }
  .tools { flex: none; display: flex; align-items: center; gap: var(--sp-2); }

  /* 컨트롤 — select·버튼 한 어휘(반경 8px · 1px --ctl-edge) */
  .ctl {
    min-height: 34px;
    padding: 0 var(--sp-3);
    background: var(--sheet);
    color: var(--txt);
    border: 1px solid var(--ctl-edge);
    border-radius: var(--r-chip);
    transition: background-color var(--dur-1) ease-out, border-color var(--dur-1) ease-out;
  }
  .btn { display: inline-flex; align-items: center; gap: var(--sp-1); white-space: nowrap; text-decoration: none; }
  .ctl:hover:not(:disabled) { background: var(--raised); }
  .ctl:active:not(:disabled) { background: var(--track); }
  .ctl:disabled { color: var(--dim2); border-color: var(--grid-strong); cursor: default; }
  select.ctl { max-width: 14rem; }

  /* 검색·수식 줄 — 헤더 아래 두 줄. 판 질감(--gutter), 아래 1px 선. 안쪽 글자는 본문 폭(--wrap)에 맞춘다 */
  .bars {
    background: color-mix(in srgb, var(--gutter) 80%, transparent);
    border-bottom: 1px solid var(--grid);
  }

  .wrap {
    flex: 1 0 auto;
    width: 100%;
    max-width: var(--wrap);
    margin: 0 auto;
    padding: var(--sp-4) var(--sp-4) var(--sp-5);
  }
  .note { padding-bottom: var(--sp-3); }

  .foot { padding: var(--sp-4); border-top: 1px solid var(--grid); color: var(--dim2); font-size: var(--fs-sm); }
  .foot p { max-width: 75ch; }
  .foot-link { margin-top: var(--sp-2); }
  .foot-link a { display: inline-block; min-height: 28px; color: var(--dim); text-underline-offset: .2em; }
  .foot-link a + a { margin-left: var(--sp-4); }
  .foot-link a:hover { color: var(--txt); text-decoration-thickness: 2px; }

  @media (pointer: coarse) {
    .shell { padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)); }
    .ctl { min-height: 44px; }
    .foot-link a { display: inline-flex; align-items: center; min-height: 44px; }
  }
  /* 태블릿 좁은 폭: 헤더 한 줄(56px)을 지키려고 선택 상자를 줄인다 */
  @media (min-width: 641px) and (max-width: 820px) {
    select.ctl { max-width: 11rem; }
  }

  /* 폰: 헤더는 같이 스크롤(고정하지 않는다), 새로고침은 도형만(이름은 보조기술에), 상태 글(불러오는 중·오류)은
     다음 줄 — 서버 이름만 있을 때는 줄을 만들지 않는다(세로 30px).
     독은 항목 44 + 여백 8 + 선 2 = 54, 아래 띄움 8 + 숨 8 */
  @media (max-width: 640px) {
    .shell { padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px)); }
    .top {
      position: static;
      flex-wrap: wrap;
      height: auto;
      min-height: 52px;
      padding: var(--sp-1) var(--sp-3);
    }
    .title { font-size: var(--fs-lg); }
    .tools { margin-left: auto; }
    .bl {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }
    .meta { order: 3; flex: 0 0 0; justify-content: flex-start; }
    .meta:not(.has) > span { display: none; }
    .meta.has { flex-basis: 100%; padding-bottom: var(--sp-1); }
    .wrap { padding: var(--sp-3) var(--sp-2) var(--sp-4); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ctl { transition: none; }
  }
</style>
