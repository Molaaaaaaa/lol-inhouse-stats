<script lang="ts" generics="T">
  /**
   * 스프레드시트 격자 — 이 세계의 핵심 컴포넌트. 옛 renderTable + attachTableFilters + foldLongTables
   * 를 하나로 옮겼다(innerHTML 없이). 열 스펙·정렬·거르기 규칙은 $lib/table 의 순수 함수.
   *
   * - 머리 클릭·Enter·Space 로 정렬(같은 열 다시 → 방향 반전). 호출부가 sortKey 를 바꾸면(지표 전환)
   *   사용자가 누른 정렬은 버린다. aria-sort + announce.
   * - 거르기(rows > 20): 표 위 셀 모양 입력, 걸린 행만. 거르는 동안은 접지 않는다.
   *   질의는 인스턴스가 사는 동안 남는다 — 보는 대상이 바뀌면 호출부가 {#key} 로 새로 만든다.
   * - 접기(rows > 16): CSS 로 숨기지 않고 slice + '더 보기' 버튼(스크린리더가 버튼을 읽는다).
   *   rows 배열이 바뀌면 다시 접힌다.
   * - 행 번호 홈통 .rn(정렬 뒤에도 1..n), 첫 열 sticky left, 머리 sticky top.
   *   .sheet 이 가로 스크롤 래퍼인데, 스크롤 컨테이너 안에서는 sticky top 이 문서 스크롤을 못 따라온다.
   *   그래서 표가 래퍼 안에 다 들어가면(ResizeObserver 로 잰다) overflow 를 풀어 머리가 붙게 하고,
   *   넘칠 때만 가로 스크롤로 돌린다 — 문서는 어느 쪽이든 넘치지 않는다.
   *   넘칠 때는 잘림 힌트(오른쪽 경계 2px 선 + 캡션 줄 '열 n개 더 →'), 스크롤 끝에서는 사라진다.
   * - 머리 드롭다운(Col.pick): 열 필터. 보이는 층은 고른 값(전체면 열 이름)+화살표, 조작은 그 위에 겹친
   *   네이티브 select. select 위의 click·keydown 은 머리(정렬)로 올라가지 않는다.
   * - 선택: rowKey 가 있으면 행이 tabindex=0·aria-selected, 클릭·Enter → onselect.
   * - 조건부 서식은 cls 로 호출부가 클래스만 준다: win·loss(18% 채움)·t1~t5(16%)·pend(점선)·lane-*(왼쪽 띠).
   * - 셀 안 부품은 이웃 컴포넌트를 그대로 쓴다: 초상 ChampImg · 코드 판 CodePlate · 물음표 QMark(툴팁) ·
   *   빈 상태 EmptyState — 같은 부품이 화면마다 같은 모양이어야 한다.
   */
  import { app } from '$lib/data/store.svelte';
  import { announce } from '$lib/a11y';
  import { norm } from '$lib/search';
  import Icon from '$components/Icon.svelte';
  import ChampImg from '$components/ChampImg.svelte';
  import CodePlate from '$components/CodePlate.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import QMark from '$components/Tooltip.svelte';
  import {
    FILTER_MIN, FOLD_MIN, FOLD_SHOW, barPct, cell, cellText, colMax,
    defaultDir, filterRows, nextSort, sortRows, type Col, type SortDir,
  } from '$lib/table';

  interface Props {
    rows: readonly T[];
    cols: readonly Col<T>[];
    /** 표 이름 — aria-label 과 캡션 행 */
    caption: string;
    sortKey?: string;
    sortDir?: SortDir;
    /** 있으면 행이 선택 가능(각 행의 키·{#each} 키) */
    rowKey?: (r: T) => string;
    selectedKey?: string;
    onselect?: (r: T, key: string) => void;
    rowClass?: (r: T) => string;
    /** 기본 rows.length > 20 */
    filter?: boolean;
    /** 기본 rows.length > 16 → 10줄 + '더 보기' */
    fold?: boolean;
    /** 기본 true */
    rowNumbers?: boolean;
    compact?: boolean;
    /** 여기 든 열은 처음 누르면 오름차순, 막대 없음 */
    lowerBetterKeys?: readonly string[];
  }
  let {
    rows, cols, caption, sortKey, sortDir, rowKey, selectedKey, onselect, rowClass,
    filter, fold, rowNumbers = true, compact = false, lowerBetterKeys = [],
  }: Props = $props();

  const uid = $props.id();

  // ── 정렬 ── 사용자가 누른 정렬은 그때의 sortKey 아래에서만 유효하다
  let user = $state<{ under: string | undefined; k: string; d: SortDir } | null>(null);
  const sort = $derived.by((): { k: string | null; d: SortDir } => {
    if (user && user.under === sortKey) return { k: user.k, d: user.d };
    return { k: sortKey ?? null, d: sortDir ?? defaultDir(sortKey, lowerBetterKeys) };
  });
  const sortCol = $derived(cols.find((c) => c.k === sort.k));
  const sorted = $derived(sortRows(rows, sort.k, sort.d, sortCol?.nullLast ?? false));

  const sortable = (c: Col<T>) => c.sortable !== false;
  function sortBy(c: Col<T>) {
    if (!sortable(c)) return;
    const n = nextSort(sort, c.k, lowerBetterKeys);
    user = { under: sortKey, ...n };
    announce(`${c.h} 열 ${n.d === 1 ? '오름차순' : '내림차순'} 정렬`);
  }
  function onHeadKey(e: KeyboardEvent, c: Col<T>) {
    if (e.target !== e.currentTarget) return;   // 머리 안 물음표 버튼의 Enter/Space 는 정렬이 아니다
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    sortBy(c);
  }

  // ── 거르기 ──
  let q = $state('');
  const showFilter = $derived(filter ?? rows.length > FILTER_MIN);
  const filtering = $derived(showFilter && norm(q) !== '');
  const shown = $derived(filtering ? filterRows(sorted, q, cols) : sorted);
  const textCol = $derived(cols.find((c) => !c.num) ?? cols[0]);
  function onFilter(e: Event & { currentTarget: HTMLInputElement }) {
    q = e.currentTarget.value;
    if (filtering) announce(`${shown.length}건 일치`);
  }

  // ── 접기 ── 펼침은 rows 배열에 묶인다: 새 배열이 오면 다시 접힌다
  //    ($state.raw — 프록시로 감싸면 rows 와 같은 배열인지 === 로 못 견준다)
  let openFor = $state.raw<readonly T[] | null>(null);
  const foldable = $derived((fold ?? rows.length > FOLD_MIN) && !filtering);
  const open = $derived(openFor === rows);
  const folded = $derived(foldable && !open && shown.length > FOLD_SHOW);
  const visible = $derived(folded ? shown.slice(0, FOLD_SHOW) : shown);
  const hidden = $derived(shown.length - visible.length);
  function toggleFold() {
    const expand = !open;
    openFor = expand ? rows : null;
    announce(expand ? `전체 ${shown.length}줄 표시` : `${FOLD_SHOW}줄 표시`);
  }

  // ── 막대 ── 열 최대값은 전체 rows 기준이라 거르는 동안 막대가 흔들리지 않는다
  const maxes = $derived.by(() => {
    const m: Record<string, number> = {};
    for (const c of cols) if (c.bar && !lowerBetterKeys.includes(c.k)) m[c.k] = colMax(rows, c.k);
    return m;
  });
  /** 막대 너비 '66.7%' — 셀의 --bar 로 들어간다. 막대 열이 아니면 undefined */
  function barFor(c: Col<T>, r: T): string | undefined {
    const m = maxes[c.k];
    return m === undefined ? undefined : `${barPct(cell(r, c.k), m)}%`;
  }

  // ── 선택 ──
  // 행이 '누를 수 있는 것' 이려면 누른 뒤 일어나는 일(onselect)이 있어야 한다 — rowKey 만 있고 반응이 없는 표는
  // Tab 순서에 들어가 '눌렀는데 아무것도 없는' 행이 된다(실측: 멤버 화면 표 3개).
  const selectable = $derived(!!rowKey && !!onselect);
  function keyOf(r: T): string | undefined { return rowKey ? rowKey(r) : undefined; }
  function pick(r: T) {
    const k = keyOf(r);
    if (k !== undefined && onselect) onselect(r, k);
  }
  function onRowKey(e: KeyboardEvent, r: T) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    pick(r);
  }

  // ── 넘침 측정 ── 표가 래퍼에 들어가면 overflow 를 풀어 sticky top 이 문서 스크롤을 따라오게 한다.
  //    넘칠 때는 잘림 힌트: 오른쪽 가장자리(마지막으로 보이는 열의 경계)에 2px 선 + 캡션 줄 오른쪽에
  //    '열 n개 더 →'. n 은 오른쪽 경계 너머로 잘린 머리 칸 수(숨긴 .lo 열은 너비 0 이라 세지 않는다).
  //    스크롤이 끝에 닿으면 둘 다 사라진다.
  let sheetEl = $state<HTMLDivElement | undefined>();
  let tableEl = $state<HTMLTableElement | undefined>();
  let fit = $state(false);
  let cut = $state(0);
  let tableH = $state(0);
  function measure() {
    const s = sheetEl, t = tableEl;
    if (!s || !t) { cut = 0; return; }
    fit = t.offsetWidth <= s.clientWidth;
    tableH = t.offsetHeight;
    if (fit) { cut = 0; return; }
    const edge = s.scrollLeft + s.clientWidth + 1;
    let n = 0;
    for (const th of t.querySelectorAll<HTMLElement>('thead th')) {
      if (th.offsetWidth > 0 && th.offsetLeft + th.offsetWidth > edge) n++;
    }
    cut = n;
  }
  $effect(() => {
    const s = sheetEl, t = tableEl;
    if (!s || !t || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(s);
    ro.observe(t);
    measure();
    return () => ro.disconnect();
  });

  // ── 머리 드롭다운 ── 정렬 클릭·키와 섞이지 않게 select 위의 이벤트는 머리로 올리지 않는다
  function onPick(e: Event & { currentTarget: HTMLSelectElement }, c: Col<T>) {
    e.stopPropagation();
    c.pick?.onchange(e.currentTarget.value);
  }
  const stop = (e: Event) => e.stopPropagation();
  const pickLabel = (c: Col<T>): string =>
    c.pick?.options.find((o) => o.v === c.pick?.value && o.v !== '')?.label ?? c.h;

  const hideLo = (c: Col<T>) => !!c.lo && c.k !== sort.k;
  function ariaSort(c: Col<T>): 'ascending' | 'descending' | 'none' | undefined {
    if (!sortable(c)) return undefined;
    if (sort.k !== c.k) return 'none';
    return sort.d === 1 ? 'ascending' : 'descending';
  }
</script>

<div class={['sheet', fit && 'fit', !rowNumbers && 'norn', compact && 'compact']} bind:this={sheetEl} onscroll={measure}>
  <div class="cap"><span>{caption}</span>{#if cut > 0}<span class="cut" aria-hidden="true">열 {cut}개 더 →</span>{/if}</div>

  {#if rows.length === 0}
    <EmptyState text="아직 표시할 데이터가 없습니다." />
  {:else}
    {#if showFilter}
      <div class="tf">
        <label class="sr-only" for="{uid}-q">{caption} 검색</label>
        <input id="{uid}-q" type="search" class="tfi" value={q} oninput={onFilter}
               placeholder="{textCol?.h ?? ''} 검색" autocomplete="off" spellcheck="false" />
        {#if filtering}<span class="tfhit">{shown.length}건</span>{/if}
      </div>
    {/if}

    {#if cut > 0}<div class="edge" aria-hidden="true" style:--tbl-h="{tableH}px"></div>{/if}
    <table aria-label={caption} bind:this={tableEl}>
      <thead>
        <tr>
          {#if rowNumbers}<th class="rn" aria-hidden="true"></th>{/if}
          {#each cols as c, j (c.k)}
            <th scope="col"
                class={[c.num && 'num', hideLo(c) && 'lo', j === 0 && 'c0', sortable(c) && 'sortable', sort.k === c.k && 'on', c.pick && 'haspick']}
                tabindex={sortable(c) ? 0 : undefined}
                aria-sort={ariaSort(c)}
                onclick={sortable(c) ? () => sortBy(c) : undefined}
                onkeydown={sortable(c) ? (e) => onHeadKey(e, c) : undefined}>
              <span class={['h', c.pick && 'sr-only']}>{c.h}</span>
              {#if c.pick}
                <!-- 보이는 층은 고른 값(전체면 열 이름)+화살표, 실제 조작은 그 위에 겹친 네이티브 select -->
                <span class="pk" class:picked={c.pick.value !== ''}>
                  <span class="pkv" aria-hidden="true">{pickLabel(c)}<Icon name="chevron-down" class="pkic" /></span>
                  <select class="pks" aria-label={c.pick.label} value={c.pick.value}
                          onchange={(e) => onPick(e, c)} onclick={stop} onkeydown={stop}>
                    {#each c.pick.options as o (o.v)}
                      <option value={o.v}>{o.label}</option>
                    {/each}
                  </select>
                </span>
              {/if}
              {#if c.code}<CodePlate code={c.code} />{/if}
              {#if sort.k === c.k}<Icon name="chevron-down" class={sort.d === 1 ? 'sortic up' : 'sortic'} />{/if}
              {#if c.hlp}<QMark key={c.hlp} payload={app.data} label="{c.h} 설명" />{/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each visible as r, i (keyOf(r) ?? r)}
          {@const k = keyOf(r)}
          {@const sel = k !== undefined && k === selectedKey}
          <tr class={[rowClass?.(r), sel && 'sel']}
              tabindex={selectable ? 0 : undefined}
              aria-selected={selectable ? sel : undefined}
              onclick={selectable ? () => pick(r) : undefined}
              onkeydown={selectable ? (e) => onRowKey(e, r) : undefined}>
            {#if rowNumbers}<td class="rn" aria-hidden="true">{i + 1}</td>{/if}
            {#each cols as c, j (c.k)}
              {@const bar = barFor(c, r)}
              <td class={[c.num && 'num', hideLo(c) && 'lo', j === 0 && 'c0', bar !== undefined && 'bar', c.cls?.(r)]} style:--bar={bar}>
                {#if c.img}<ChampImg name={c.img(r)} patch={app.data?.patch} />{/if}
                {cellText(c, r, i)}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>

    {#if foldable && shown.length > FOLD_SHOW}
      <button type="button" class="more" onclick={toggleFold}>{open ? '접기' : `더 보기 (${hidden})`}</button>
    {/if}
  {/if}
</div>

<style>
  /* 래퍼: 기본은 가로 스크롤(문서가 넘치지 않게). 표가 다 들어가면 .fit — overflow 를 풀어 sticky top 이 살아난다 */
  .sheet {
    --rn-w: 36px;
    --rh: var(--row-h);
    position: relative;
    overflow-x: auto;
    background: var(--sheet);
    color: var(--txt);
  }
  .sheet.fit { overflow: visible; }
  .sheet.norn { --rn-w: 0px; }
  .sheet.compact { --rh: calc(var(--row-h) * .8); }

  /* 캡션 행 — 이름 있는 범위. 가로 스크롤에 끌려가지 않는다(보이는 폭만큼이라 오른쪽 끝이 곧 잘린 자리) */
  .cap {
    position: sticky;
    left: 0;
    display: flex;
    justify-content: space-between;
    gap: var(--sp-3);
    font-size: var(--fs-xs);
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .cut { flex: none; color: var(--dim2); font-variant-numeric: tabular-nums; }

  /* 잘림 힌트 선 — 보이는 폭의 오른쪽 가장자리(마지막으로 보이는 열의 경계)에 2px, 표 높이만큼.
     sticky 블록은 보이는 폭을 차지하므로 그 ::after 의 right:0 이 늘 화면 오른쪽 끝이다 */
  .edge {
    --tbl-h: 0px;   /* 표 높이 — 인라인 style:--tbl-h 가 덮어쓴다(막대의 --bar 와 같은 방식) */
    position: sticky;
    left: 0;
    z-index: 4;
    height: 0;
    pointer-events: none;
  }
  .edge::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 2px;
    height: var(--tbl-h);
    background: var(--grid-strong);
  }

  /* 거르기 칸 — 표 위의 셀 하나 */
  .tf {
    position: sticky;
    left: 0;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding-bottom: var(--sp-1);
  }
  .tfi {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    max-width: 32ch;
    height: var(--rh);
    padding: 0 var(--sp-2);
    background: var(--ink);
    color: var(--txt);
    border: 1px solid var(--grid-strong);
    border-radius: 0;
    transition: border-color .12s;
  }
  .tfi:hover { border-color: var(--dim2); }
  .tfi:focus-visible { outline-offset: 0; }
  .tfhit { font-size: var(--fs-sm); color: var(--dim); white-space: nowrap; }

  table {
    width: 100%;
    border-collapse: separate;   /* collapse 면 sticky 셀의 선이 스크롤에 떨어져 나간다 */
    border-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  th, td {
    height: var(--rh);
    padding: 0 var(--sp-2);
    text-align: left;
    white-space: nowrap;
    vertical-align: middle;
    border-bottom: 1px solid var(--grid);
    border-right: 1px solid var(--grid);
    background: transparent;
    transition: background-color .12s;
  }
  th:first-child, td:first-child { border-left: 1px solid var(--grid); }
  .num { text-align: right; }

  /* 머리행 — 홈통 바탕, sticky top */
  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-xs);
    font-weight: 500;
    border-top: 1px solid var(--grid-strong);
    border-bottom: 1px solid var(--grid-strong);
    user-select: none;
  }
  th.sortable { cursor: pointer; }
  th.sortable:hover { background: var(--raised); color: var(--txt); }
  th.sortable:active { background: var(--grid-strong); }
  th.on { color: var(--txt); }
  th :global(.sortic) { margin-left: var(--sp-1); color: var(--dim); }
  th :global(.sortic.up) { transform: rotate(180deg); }
  th.on :global(.sortic) { color: var(--txt); }

  /* 머리 드롭다운 — 셀 모양 상자(홈통 바탕·1px 격자선). 보이는 층(.pkv)은 고른 값 + 화살표,
     네이티브 select 는 투명하게 그 위를 덮어 탭·키보드·보조기술은 select 그대로 쓴다 */
  .pk {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 3px;
    background: var(--gutter);
    border: 1px solid var(--grid);
    color: var(--dim);
    font-weight: 500;
    vertical-align: middle;
    transition: background-color .12s, border-color .12s, color .12s;
  }
  th.on .pk, .pk.picked { color: var(--txt); }
  .pk.picked { border-color: var(--grid-strong); }
  .pk:hover { background: var(--raised); color: var(--txt); }
  .pk:has(.pks:focus-visible) { outline: 2px solid var(--sel); outline-offset: -2px; }
  .pk:has(.pks:active) { background: var(--grid-strong); }
  .pkv { display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; pointer-events: none; }
  .pk :global(.pkic) { width: 10px; height: 10px; flex: none; }
  .pks {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
  }
  .pks:disabled { cursor: default; }

  /* 행 번호 홈통 · 첫 열 sticky left */
  .rn {
    position: sticky;
    left: 0;
    z-index: 1;
    width: var(--rn-w);
    min-width: var(--rn-w);
    max-width: var(--rn-w);
    padding: 0 var(--sp-1);
    text-align: right;
    font-size: var(--fs-xs);
    color: var(--dim2);
    background: var(--gutter);
    border-right: 1px solid var(--grid-strong);
  }
  thead .rn { z-index: 3; }
  .c0 {
    position: sticky;
    left: var(--rn-w);
    z-index: 1;
    background: var(--sheet);
    border-right: 1px solid var(--grid-strong);
  }
  thead .c0 { z-index: 3; background: var(--gutter); }

  /* 행 hover · 선택 · 초점 — hover 는 채움, 선택은 2px 안쪽 선, 초점은 선 + 채움(셋이 서로 구분된다) */
  tbody tr { transition: background-color .12s; }
  tbody tr:hover, tbody tr:focus-visible { background: var(--raised); }
  tbody tr:hover td.c0, tbody tr:focus-visible td.c0 { background: var(--raised); }
  tbody tr[tabindex] { cursor: pointer; }
  tbody tr:focus-visible { outline: none; }
  tr.sel td:not(.rn), tbody tr:focus-visible td:not(.rn) {
    box-shadow: inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel);
  }
  tr.sel td.c0, tbody tr:focus-visible td.c0 {
    box-shadow: inset 2px 0 0 var(--sel), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel);
  }
  tr.sel td:last-child, tbody tr:focus-visible td:last-child {
    box-shadow: inset -2px 0 0 var(--sel), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel);
  }

  /* 데이터 막대 — 별도 요소 없이 셀 바탕. 너비는 셀의 --bar(인라인), 색은 여기 토큰 한 곳 */
  td.bar {
    --bar: 0%;   /* 기본값 — 인라인 style:--bar 가 덮어쓴다 */
    background: linear-gradient(to right, color-mix(in srgb, var(--sel) 22%, transparent) var(--bar), transparent var(--bar));
  }

  /* 조건부 서식 — 호출부가 cls 로 준 클래스. 색은 채움·띠에만, 글자는 무채색 그대로 */
  td.win { background: color-mix(in srgb, var(--win) 18%, transparent); }
  td.loss { background: color-mix(in srgb, var(--loss) 18%, transparent); }
  td.t1 { background: color-mix(in srgb, var(--t1) 16%, transparent); }
  td.t2 { background: color-mix(in srgb, var(--t2) 16%, transparent); }
  td.t3 { background: color-mix(in srgb, var(--t3) 16%, transparent); }
  td.t4 { background: color-mix(in srgb, var(--t4) 16%, transparent); }
  td.t5 { background: color-mix(in srgb, var(--t5) 16%, transparent); }
  td.pend { box-shadow: inset 0 0 0 1px transparent; outline: 1px dashed var(--grid-strong); outline-offset: -3px; color: var(--dim); }
  td.lane-top { box-shadow: inset 3px 0 0 var(--lane-top); }
  td.lane-jg { box-shadow: inset 3px 0 0 var(--lane-jg); }
  td.lane-mid { box-shadow: inset 3px 0 0 var(--lane-mid); }
  td.lane-bot { box-shadow: inset 3px 0 0 var(--lane-bot); }
  td.lane-sup { box-shadow: inset 3px 0 0 var(--lane-sup); }

  /* 초상(ChampImg)은 글자 앞에 한 칸 */
  td :global(.champ) { margin-right: var(--sp-1); }

  /* 더 보기 · 접기 — 표 아래 한 줄, 홈통 바탕 */
  .more {
    position: sticky;
    left: 0;
    display: block;
    width: 100%;
    height: var(--rh);
    padding: 0 var(--sp-2);
    text-align: left;
    color: var(--dim);
    background: var(--gutter);
    border: 0;
    border-left: 1px solid var(--grid);
    border-right: 1px solid var(--grid);
    border-bottom: 1px solid var(--grid);
    transition: background-color .12s, color .12s;
  }
  .more:hover { background: var(--raised); color: var(--txt); }
  .more:active { background: var(--grid-strong); }

  /* 폰: 보조 열 숨김(정렬 기준 열은 .lo 를 받지 않는다) · 셀을 촘촘하게 · 홈통 2.5ch ·
     고정 이름열은 긴 이름(실데이터 11자)이 화면을 다 먹지 않게 상한 + 말줄임 */
  @media (max-width: 640px) {
    .lo { display: none; }
    .sheet { --rn-w: 26px; }
    th, td { padding: 0 var(--sp-1) 0 6px; }
    .rn { padding: 0 var(--sp-1); }
    td.c0, th.c0 { max-width: 7em; overflow: hidden; text-overflow: ellipsis; }
  }
  /* 손가락 기기: 보이는 상자는 그대로 두고 투명 select 만 위아래로 펴 44px 표적을 만든다(물음표와 같은 방식) */
  @media (pointer: coarse) {
    .pks { top: -9px; bottom: -9px; height: auto; }   /* 26px 안쪽 + 18 = 44 */
  }
  @media (prefers-reduced-motion: reduce) {
    th, td, tbody tr, .more, .tfi, .pk { transition: none; }
  }
</style>
