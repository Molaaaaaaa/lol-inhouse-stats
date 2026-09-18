<script lang="ts">
  /**
   * 시트 탭 — 최상위 내비(NAV 6개)를 스프레드시트 하단 시트 탭 모양으로.
   * 화면 간 이동이므로 tablist 가 아니라 <nav> 안의 링크(a href)다. 활성 탭은 aria-current="page".
   * 초점은 roving tabindex: 활성(또는 마지막으로 초점을 받은) 탭 하나만 Tab 순서에 있고,
   * ←→·Home/End 로 옮긴다. ≤640px 에서는 화면 아래 고정(엄지 자리), 그 위에서는 수식 줄 아래 정적.
   */
  import { NAV } from '$lib/nav';
  import { router } from '$lib/router.svelte';

  /** member 화면은 멤버(home) 탭 소속이다 */
  function isOn(id: string): boolean {
    const sec = router.route.section;
    return sec === id || (id === 'home' && sec === 'member');
  }

  const activeIdx = $derived(Math.max(0, NAV.findIndex((n) => isOn(n.id))));
  /** 초점을 옮겨 둔 자리 — 화면이 바뀌면 활성 탭으로 되돌린다 */
  let focusIdx = $state(-1);
  const rovingIdx = $derived(focusIdx >= 0 ? focusIdx : activeIdx);
  $effect(() => { void router.route.section; focusIdx = -1; });

  let links: HTMLAnchorElement[] = $state([]);

  function moveTo(i: number) {
    const n = (i + NAV.length) % NAV.length;
    focusIdx = n;
    links[n]?.focus();
  }

  function onKey(e: KeyboardEvent, i: number) {
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); moveTo(i + 1); break;
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); moveTo(i - 1); break;
      case 'Home': e.preventDefault(); moveTo(0); break;
      case 'End': e.preventDefault(); moveTo(NAV.length - 1); break;
    }
  }
</script>

<nav class="nav" aria-label="주 메뉴">
  {#each NAV as item, i (item.id)}
    <a
      bind:this={links[i]}
      href={item.href}
      class="tab"
      class:on={isOn(item.id)}
      aria-current={isOn(item.id) ? 'page' : undefined}
      tabindex={i === rovingIdx ? 0 : -1}
      onkeydown={(e) => onKey(e, i)}
      onfocus={() => { focusIdx = i; }}
    >{item.label}</a>
  {/each}
</nav>

<style>
  /* 탭 띠: 홈통 바탕. 데스크톱은 아래쪽(시트와 맞닿는 곳)에 굵은 격자선, 활성 탭이 그 선을 덮어 시트와 이어진다. */
  .nav {
    display: flex;
    flex-wrap: wrap;
    background: var(--gutter);
    border-bottom: 1px solid var(--grid-strong);
    padding: 0 var(--sp-4);
  }
  .tab {
    flex: 1 1 0;
    min-width: 0;
    max-width: 10rem;
    min-height: var(--row-h);
    margin-bottom: -1px;
    padding: 0 var(--sp-2);
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--dim);
    text-decoration: none;
    font-size: var(--fs-sm);
    border-top: 2px solid transparent;
    border-bottom: 1px solid transparent;
    border-radius: var(--r-tab) var(--r-tab) 0 0;
    transition: background-color .15s ease-out, color .15s ease-out;
  }
  .tab + .tab { border-left: 1px solid var(--grid); }
  .tab:hover { background: var(--raised); color: var(--txt); }
  .tab:active { background: var(--sheet); }
  .tab.on {
    background: var(--sheet);
    color: var(--txt);
    font-weight: 650;
    border-top-color: var(--sel);
    border-bottom-color: var(--sheet);
  }
  .tab.on + .tab, .tab:has(+ .tab.on) { border-left-color: var(--grid-strong); }

  /* 폰: 화면 아래 고정. 시트와 맞닿는 곳이 위쪽이므로 굵은 선을 위에, 활성 탭의 --sel 선이 그 위를 덮는다. */
  @media (max-width: 640px) {
    .nav {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      z-index: 20;
      padding: 0 0 env(safe-area-inset-bottom, 0px);
      border-bottom: 0;
      border-top: 1px solid var(--grid-strong);
    }
    .tab {
      max-width: none;
      min-height: 44px;
      margin: -1px 0 0;
      border-bottom: 0;
      border-radius: 0;
      padding: 0 var(--sp-1);
    }
    .tab.on { border-bottom: 0; }
  }
</style>
