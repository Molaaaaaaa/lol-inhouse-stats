<script lang="ts">
  /**
   * 시트 탭 — 최상위 내비(NAV 6개)를 스프레드시트 하단 시트 탭 모양으로.
   * 화면 간 이동이므로 tablist 가 아니라 <nav> 안의 링크(a href)다. 활성 탭은 aria-current="page".
   * 초점은 roving tabindex: 활성(또는 마지막으로 초점을 받은) 탭 하나만 Tab 순서에 있고,
   * ←→·Home/End 로 옮긴다. 모든 폭에서 화면 아래 고정 — 시트 탭은 시트 밑에 있다(폰에서는 엄지 자리).
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
  /* 탭 띠: 시트 아래, 화면 하단 고정(모든 폭 — 스프레드시트의 시트 탭은 시트 밑에 있다). 홈통 바탕,
     시트와 맞닿는 위쪽에 굵은 격자선. 활성 탭은 시트 바탕 + 위쪽 2px --sel 선이 그 격자선을 덮어
     시트와 이어진다. 본문·바닥글은 App 이 padding-bottom 으로 이만큼 비운다. */
  .nav {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;   /* 탭이 flex:1 1 0·min-width:0 이라 실제로는 늘 한 줄이다(가로 스크롤 없음) */
    background: var(--gutter);
    border-top: 1px solid var(--grid-strong);
    padding: 0 var(--sp-4) env(safe-area-inset-bottom, 0px);
  }
  /* 탭 하나: 내용 폭·왼쪽 정렬(≥641px). 오른쪽에 남는 자리는 빈 홈통 띠다 — 스프레드시트 시트 탭 그대로 */
  .tab {
    flex: 0 0 auto;
    min-width: 4.5rem;
    max-width: 10rem;
    min-height: var(--row-h);
    margin-top: -1px;
    padding: 0 var(--sp-4);
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
    border-radius: 0 0 var(--r-tab) var(--r-tab);
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
  }
  .tab.on + .tab, .tab:has(+ .tab.on) { border-left-color: var(--grid-strong); }

  /* 폰: 여섯이 화면 폭을 균등하게 나눠 갖는다(엄지 자리, 44px) */
  @media (max-width: 640px) {
    .nav { padding-left: 0; padding-right: 0; }
    .tab {
      flex: 1 1 0;
      min-width: 0;
      max-width: none;
      min-height: 44px;
      border-radius: 0;
      padding: 0 var(--sp-1);
    }
  }
</style>
