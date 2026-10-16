<script lang="ts">
  /**
   * 하단 독 — 최상위 내비(NAV 6개)를 화면 아래에 떠 있는 둥근 띠로. 엄지 자리(폰)이고 가로 스크롤이 없다.
   * 화면 간 이동이므로 tablist 가 아니라 <nav> 안의 링크(a href)다. 활성 항목은 aria-current="page".
   * 초점은 roving tabindex: 활성(또는 마지막으로 초점을 받은) 항목 하나만 Tab 순서에 있고,
   * ←→·Home/End 로 옮긴다. 본문·바닥글은 App 이 독 높이만큼 아래를 비운다(--dock-h).
   */
  import { NAV } from '$lib/nav';
  import { router } from '$lib/router.svelte';

  /** member 화면은 멤버(home) 항목 소속이다 */
  function isOn(id: string): boolean {
    const sec = router.route.section;
    return sec === id || (id === 'home' && sec === 'member');
  }

  const activeIdx = $derived(Math.max(0, NAV.findIndex((n) => isOn(n.id))));
  /** 초점을 옮겨 둔 자리 — 화면이 바뀌면 활성 항목으로 되돌린다 */
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
      class="navlink"
      class:on={isOn(item.id)}
      aria-current={isOn(item.id) ? 'page' : undefined}
      tabindex={i === rovingIdx ? 0 : -1}
      onkeydown={(e) => onKey(e, i)}
      onfocus={() => { focusIdx = i; }}
    >{item.label}</a>
  {/each}
</nav>

<style>
  /* 독: 화면 아래 가운데 떠 있는 띠(반투명 홈통 · 1px 굵은 선 · 떠 있는 그림자). 반경은 동심 — 바깥 = 항목 12px + 안쪽 여백.
     flex-wrap 은 두되 항목이 줄어들 수 있어(min-width:0) 실제로는 늘 한 줄이다(가로 스크롤 없음).
     높이는 App 의 --dock-h 와 맞춘다: 항목 38px(굵은 포인터·폰 44px) + 위아래 5px + 선 2px */
  .nav {
    --pad: 5px;
    position: fixed;
    left: 50%;
    bottom: calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
    width: max-content;
    max-width: calc(100vw - var(--sp-4));
    padding: var(--pad);
    transform: translateX(-50%);
    background: color-mix(in srgb, var(--gutter) 92%, transparent);
    border: 1px solid var(--grid-strong);
    border-radius: calc(var(--r-md) + var(--pad));
    box-shadow: var(--shadow-2);
  }
  @supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .nav {
      background: color-mix(in srgb, var(--gutter) 78%, transparent);
      -webkit-backdrop-filter: blur(14px) saturate(1.2);
      backdrop-filter: blur(14px) saturate(1.2);
    }
  }
  .navlink {
    flex: 1 1 auto;
    min-width: 64px;
    min-height: 38px;
    padding: 0 var(--sp-3);
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    color: var(--dim);
    text-decoration: none;
    font-size: var(--fs-sm);
    border: 1px solid transparent;
    border-radius: var(--r-md);
    transition: background-color var(--dur-2) var(--ease), color var(--dur-1);
  }
  .navlink:hover { background: var(--raised); color: var(--txt); }
  .navlink:active { background: var(--track); }
  .navlink:focus-visible { outline-offset: 1px; }
  /* 활성: 액센트 채움 + 진한 글자 700 + 글로우 — 글자 굵기와 aria-current 가 색 없이도 활성을 말한다 */
  .navlink.on {
    background: var(--grad-sel);
    color: var(--on-sel);
    font-weight: 700;
    box-shadow: var(--glow-sel);
  }

  /* 굵은 포인터(태블릿 포함): 항목 44px — app.css 의 전역 `.navlink` 규칙(0,1,0)은 위 scoped 38px(0,2,0)에 진다
     (실측: 820·1024px 터치에서 38px 였다) */
  @media (pointer: coarse) {
    .navlink { min-height: 44px; }
  }
  /* 폰: 좌우 8px 띄운 전폭, 여섯이 균등하게 나눠 갖는다(44px) */
  @media (max-width: 640px) {
    .nav {
      left: var(--sp-2);
      right: var(--sp-2);
      bottom: calc(var(--sp-2) + env(safe-area-inset-bottom, 0px));
      width: auto;
      max-width: none;
      --pad: 4px;
      gap: 2px;
      transform: none;
    }
    .navlink { flex: 1 1 0; min-width: 0; min-height: 44px; padding: 0 2px; }
  }
  /* 강제 색상: 채움·글로우가 지워진다 — 활성 항목에 테두리를 남긴다 */
  @media (forced-colors: active) {
    .navlink.on { border: 2px solid Highlight; }
  }
  @media (prefers-reduced-motion: reduce) {
    .navlink { transition: background-color .1s, color .1s; }
  }
</style>
