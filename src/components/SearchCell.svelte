<script lang="ts">
  /**
   * 소환사명 검색 — 헤더 아래 한 줄, 본문 폭 안의 둥근 입력. 이름(부분일치)·초성('ㅇㅇㅁ')으로
   * 후보를 띄우고, 고른 이름의 멤버 화면(#/m/이름)으로 간다. 난잡함 피드백의 유일한 찾기 수단 —
   * 표 강조·걸러 보기는 하지 않는다.
   *
   * 접근성: input role=combobox + 떠 있는 listbox, 초점은 입력에 머물고 aria-activedescendant 로
   * 가리킨다. ↑↓ 이동 · Enter 선택 · Esc 닫기. 목록은 position:absolute 떠 있는 층(--raised·--shadow·반경 12px).
   * 키보드는 전부 입력칸이 받으므로 option 은 포인터 표적이다 — mousedown 은 초점을 지키고(preventDefault),
   * mouseup 이 고른다(터치 탭도 mouseup 을 낸다).
   */
  import { app, displayName } from '$lib/data/store.svelte';
  import { router, memberHref } from '$lib/router.svelte';
  import { searchHits } from '$lib/search';
  import Icon from '$components/Icon.svelte';

  interface Cand { name: string; games: number }

  const uid = `sc-${Math.random().toString(36).slice(2, 8)}`;
  const listId = `${uid}-list`;

  let q = $state('');
  let open = $state(false);
  let cur = $state(-1);
  let listEl: HTMLUListElement | undefined = $state();

  const cands = $derived.by<Cand[]>(() => {
    const ps = app.data?.players;
    if (!ps) return [];
    return Object.values(ps).map((p) => ({ name: displayName(p), games: p.record.games }));
  });
  const hits = $derived(searchHits(q, cands));
  const typed = $derived(q.trim().length > 0);
  const shown = $derived(open && typed);
  const activeId = $derived(shown && cur >= 0 && cur < hits.length ? `${uid}-opt-${cur}` : undefined);

  function close() { open = false; cur = -1; }

  function pick(c: Cand | undefined) {
    if (!c) return;
    router.go(memberHref(c.name));
    q = '';
    close();
  }

  function onInput() { cur = -1; open = true; }

  function move(d: 1 | -1) {
    if (!hits.length) return;
    open = true;
    // 아무것도 안 가리킬 때 ↓ 는 첫 항목, ↑ 는 끝 항목. 그 뒤로는 감싼다.
    cur = cur < 0 ? (d > 0 ? 0 : hits.length - 1) : (cur + d + hits.length) % hits.length;
    // 목록이 길면 가리키는 항목이 보이게
    listEl?.querySelector<HTMLElement>(`#${uid}-opt-${cur}`)?.scrollIntoView?.({ block: 'nearest' });
  }

  function onKey(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Enter':
        if (shown && hits.length) { e.preventDefault(); pick(hits[cur >= 0 ? cur : 0]); }
        break;
      case 'Escape':
        if (shown) { e.preventDefault(); close(); }
        else if (q) { q = ''; }
        break;
      case 'Tab': close(); break;
    }
  }
</script>

<div class="cell">
  <label class="sr-only" for="{uid}-input">소환사명 검색</label>
  <Icon name="search" class="glyph" />
  <input
    id="{uid}-input"
    bind:value={q}
    type="text"
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
    enterkeyhint="go"
    placeholder="소환사명"
    role="combobox"
    aria-autocomplete="list"
    aria-controls={listId}
    aria-expanded={shown}
    aria-activedescendant={activeId}
    oninput={onInput}
    onkeydown={onKey}
    onfocus={() => { open = true; }}
    onblur={close}
  />
  <ul id={listId} class="list" role="listbox" aria-label="검색 결과" hidden={!shown} bind:this={listEl}>
    {#if shown}
      {#each hits as c, i (c.name)}
        <li
          id="{uid}-opt-{i}"
          class="opt"
          class:cur={i === cur}
          role="option"
          aria-selected={i === cur}
          onmousedown={(e) => { e.preventDefault(); }}
          onmouseup={() => pick(c)}
          onmousemove={() => { cur = i; }}
        >
          <span class="name">{c.name}</span>
          <span class="n num">{c.games}판</span>
        </li>
      {:else}
        <li class="none" role="option" aria-selected="false" aria-disabled="true">검색 결과가 없습니다</li>
      {/each}
    {/if}
  </ul>
</div>

<style>
  /* 검색 칸 — 본문 폭(--wrap) 안의 둥근 입력(우물 바탕 · 1px --ctl-edge). 초점 고리(2px --sel)는 app.css 의 :focus-visible */
  .cell {
    position: relative;
    max-width: var(--wrap);
    margin: 0 auto;
    padding: var(--sp-2) var(--sp-4) var(--sp-1);
  }
  .cell :global(.glyph) {
    position: absolute;
    left: calc(var(--sp-4) + var(--sp-3));
    top: calc(50% + 2px);
    transform: translateY(-50%);
    color: var(--dim);
    pointer-events: none;
  }
  input {
    display: block;
    width: 100%;
    height: 40px;
    padding: 0 var(--sp-3) 0 calc(var(--sp-3) * 2 + 1em);
    background: var(--ink);
    border: 1px solid var(--ctl-edge);
    border-radius: var(--r-md);
    -webkit-appearance: none;
    appearance: none;
    font-family: var(--font);
    transition: border-color var(--dur-1), background-color var(--dur-1);
  }
  input:hover { border-color: var(--dim2); }
  input:focus { background: var(--ink); }
  input:focus-visible { outline-offset: 0; }

  /* 떠 있는 층 — 판 위에 뜨는 목록. overflow 부모에 안 잘리게 absolute + z-index */
  .list {
    position: absolute;
    left: var(--sp-4); right: var(--sp-4); top: calc(100% + 2px);
    z-index: 30;
    margin: 0;
    padding: var(--sp-1);
    list-style: none;
    max-height: min(60vh, calc(var(--row-h) * 8));
    overflow-y: auto;
    background: var(--raised);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-md);
    box-shadow: var(--shadow);
  }
  .list[hidden] { display: none; }
  .opt {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: var(--row-h);
    padding: 0 var(--sp-3);
    border-radius: var(--r-chip);
    cursor: pointer;
  }
  .name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .n { flex: none; color: var(--dim); font-size: var(--fs-sm); }
  .opt.cur { background: var(--track); box-shadow: inset 0 0 0 2px var(--sel); }
  .opt:active { background: var(--gutter); }
  .none {
    min-height: var(--row-h);
    display: flex;
    align-items: center;
    padding: 0 var(--sp-3);
    color: var(--dim);
  }

  @media (pointer: coarse) {
    input { height: 44px; }
  }
  @media (max-width: 640px) {
    .cell { padding: var(--sp-2) var(--sp-3) var(--sp-1); }
    .cell :global(.glyph) { left: calc(var(--sp-3) * 2); }
    .list { left: var(--sp-3); right: var(--sp-3); max-height: min(50vh, calc(44px * 6)); }
  }
  @media (prefers-reduced-motion: reduce) {
    input { transition: none; }
  }
</style>
