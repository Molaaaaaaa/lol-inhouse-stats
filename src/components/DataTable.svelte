<script lang="ts" generics="T">
  /**
   * 카드형 표 — 옛 renderTable + attachTableFilters + foldLongTables 를 하나로 옮겼다(innerHTML 없이).
   * 열 스펙·정렬·거르기 규칙은 $lib/table 의 순수 함수. 카드(Panel) 안에 놓는다: 세로 격자선 없이 행 구분선만,
   * 머리행은 --gutter 에 위 모서리 12px, 행 번호는 둥근 칩, 선택 행은 왼쪽 3px 액센트 띠 + 2px 안쪽 선.
   *
   * - 머리 클릭·Enter·Space 로 정렬(같은 열 다시 → 방향 반전). 호출부가 sortKey 를 바꾸면(지표 전환)
   *   사용자가 누른 정렬은 버린다. aria-sort + announce.
   * - 거르기(rows > 20): 표 위 셀 모양 입력, 걸린 행만. 거르는 동안은 접지 않는다.
   *   질의는 인스턴스가 사는 동안 남는다 — 보는 대상이 바뀌면 호출부가 {#key} 로 새로 만든다.
   * - 접기(rows > 16): CSS 로 숨기지 않고 slice + '더 보기' 버튼(스크린리더가 버튼을 읽는다).
   *   rows 배열이 바뀌면 다시 접힌다.
   * - 행 번호 홈통 .rn(정렬 뒤에도 1..n, 칩으로 그린다), 첫 열 sticky left, 머리 sticky top(.fit 일 때만 고정 헤더 아래 --sticky-top, 넘칠 때는 0).
   *   .sheet 이 가로 스크롤 래퍼인데, 스크롤 컨테이너 안에서는 sticky top 이 문서 스크롤을 못 따라온다.
   *   그래서 표가 래퍼 안에 다 들어가면(ResizeObserver 로 잰다) overflow 를 풀어 머리가 붙게 하고,
   *   넘칠 때만 가로 스크롤로 돌린다 — 문서는 어느 쪽이든 넘치지 않는다.
   *   넘칠 때는 잘림 힌트(오른쪽 경계 2px 선 + 캡션 줄 '열 n개 더 →'), 스크롤 끝에서는 사라진다.
   * - 머리 드롭다운(Col.pick): 열 필터. 보이는 층은 고른 값(전체면 열 이름)+화살표, 조작은 그 위에 겹친
   *   네이티브 select. select 위의 click·keydown 은 머리(정렬)로 올라가지 않는다.
   * - 선택: rowKey 가 있으면 행이 tabindex=0·aria-selected, 클릭·Enter → onselect.
   * - 조건부 서식은 cls 로 호출부가 클래스만 준다: win·loss(18% 채움). 라인 열은 셀 스니펫 LaneChip(점 + 이름).
   * - 셀 스니펫(Col.cell): 글자 대신 그릴 보이는 층(WinGauge·StreakPill·배지). aria-hidden 으로 감싸고 fmt 글자를
   *   보조기술 전용으로 같은 칸에 둔다 — 거르기·rows2 빈 칸 판정도 fmt 글자다(정렬은 행 값).
   * - captionHidden: 카드(Panel) 제목이 캡션과 같은 말일 때 캡션을 보조기술에만 남긴다(잘림 힌트는 보인다).
   * - 셀 안 부품은 이웃 컴포넌트를 그대로 쓴다: 초상 ChampImg · 코드 판 CodePlate · 물음표 QMark(툴팁) ·
   *   빈 상태 EmptyState — 같은 부품이 화면마다 같은 모양이어야 한다.
   * - 2줄 장부 행(rows2): 호출부가 `rows2` 를 주고 폰(media.phone, ≤640px)일 때만 켜진다 — 390px 에서 넘치는
   *   표만(실측) 호출부가 켠다. 행이 3열 격자가 되어 1줄 이름(굵게), 그 아래 '라벨: 값' 셀 셋씩. 라벨은 td 의
   *   data-label 을 ::before 가 읽는다. 머리행은 보조기술에만 남기고(clip) 정렬·드롭다운·물음표·코드 판은
   *   그리지 않는다(보이지 않는 초점 0). 홈통은 왼쪽에 absolute 로 행 높이 전부. 가로 스크롤 0.
   */
  import { app } from '$lib/data/store.svelte';
  import { announce } from '$lib/a11y';
  import { media } from '$lib/media.svelte';
  import { norm } from '$lib/search';
  import { measureSheet } from '$lib/sheet-fit';
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
    /** 폰에서 2줄 장부 행 — 390px 에서 넘치는 표만 켠다(실측). 활성 = rows2 && media.phone */
    rows2?: boolean;
    /** 캡션을 보조기술 전용으로 — 감싼 카드(Panel)의 제목이 같은 말을 이미 보일 때 */
    captionHidden?: boolean;
  }
  let {
    rows, cols, caption, sortKey, sortDir, rowKey, selectedKey, onselect, rowClass,
    filter, fold, rowNumbers = true, compact = false, lowerBetterKeys = [], rows2 = false, captionHidden = false,
  }: Props = $props();

  const uid = $props.id();

  /** 2줄 장부 행 활성 — DOM 도 달라지므로(머리 조작 없음·data-label) CSS 만으로는 못 한다 */
  const r2 = $derived(rows2 && media.phone);

  // ── 정렬 ── 사용자가 누른 정렬은 그때의 sortKey 아래에서만 유효하다
  let user = $state<{ under: string | undefined; k: string; d: SortDir } | null>(null);
  /** 사용자가 머리를 눌러 정렬한 상태 — 래퍼에 .usersort 로 나간다(홈통 번호가 순위가 아닌 순간).
      rows2 활성 중에는 무시한다: 데스크톱에서 정렬한 채 폰으로 돌리면 되돌릴 조작이 없는 정렬이 남는다(실측) */
  const userSorted = $derived(user !== null && user.under === sortKey && !r2);
  const sort = $derived.by((): { k: string | null; d: SortDir } => {
    if (userSorted && user) return { k: user.k, d: user.d };
    return { k: sortKey ?? null, d: sortDir ?? defaultDir(sortKey, lowerBetterKeys) };
  });
  const sortCol = $derived(cols.find((c) => c.k === sort.k));
  const sorted = $derived(sortRows(rows, sort.k, sort.d, sortCol?.nullLast ?? false));

  /** 머리로 정렬할 수 있는가 — rows2 활성 중에는 없다(옛 카드 모드와 같다. 머리가 보이지 않는다) */
  const sortable = (c: Col<T>) => c.sortable !== false && !r2;
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
    ({ fit, cut, tableH } = measureSheet(s, t));
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
  /** rows2 격자 열 수 — 이름 셀 뒤 데이터 셀이 4개면 2열(2×2 로 빈 칸이 없다), 그 외 3열 */
  const r2cols = $derived(cols.filter((c) => !hideLo(c)).length - 1 === 4 ? 2 : 3);
  /** rows2 에서 값이 빈 셀은 그리지 않는다(라벨만 남은 칸이 된다 — 지표 안내 '코드' 60/68행 실측) */
  const blank = (c: Col<T>, r: T, i: number) => r2 && !c.img && cellText(c, r, i) === '';
  function ariaSort(c: Col<T>): 'ascending' | 'descending' | 'none' | undefined {
    if (!sortable(c)) return undefined;
    if (sort.k !== c.k) return 'none';
    return sort.d === 1 ? 'ascending' : 'descending';
  }
</script>

<div class={['sheet', fit && 'fit', !rowNumbers && 'norn', compact && 'compact', userSorted && 'usersort', r2 && 'rows2']}
     style:--r2-cols={r2 ? r2cols : undefined} bind:this={sheetEl} onscroll={measure}>
  <div class={['cap', captionHidden && 'capx', captionHidden && cut === 0 && 'capz']}><span class:sr-only={captionHidden}>{caption}</span>{#if cut > 0}<span class="cut" aria-hidden="true">열 {cut}개 더 →</span>{/if}</div>

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
            <!-- rows2 활성: 머리는 보조기술에만 남는다(clip) — 초점·정렬·드롭다운·물음표·코드 판 없음 -->
            <th scope="col"
                class={[c.num && 'num', hideLo(c) && 'lo', j === 0 && 'c0', sortable(c) && 'sortable', sort.k === c.k && 'on', c.pick && !r2 && 'haspick']}
                tabindex={sortable(c) ? 0 : undefined}
                aria-sort={ariaSort(c)}
                onclick={sortable(c) ? () => sortBy(c) : undefined}
                onkeydown={sortable(c) ? (e) => onHeadKey(e, c) : undefined}>
              <span class={['h', c.pick && !r2 && 'sr-only']}>{c.h}</span>
              {#if !r2 && c.pick}
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
              {#if !r2 && c.code}<CodePlate code={c.code} />{/if}
              {#if !r2 && sort.k === c.k}<Icon name="chevron-down" class={sort.d === 1 ? 'sortic up' : 'sortic'} />{/if}
              {#if !r2 && c.hlp}<QMark key={c.hlp} payload={app.data} label="{c.h} 설명" />{/if}
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
            {#if rowNumbers}<td class="rn" aria-hidden="true"><span class="rnc">{i + 1}</span></td>{/if}
            {#each cols as c, j (c.k)}
              {@const bar = barFor(c, r)}
              <td class={[c.num && 'num', hideLo(c) && 'lo', j === 0 && 'c0', bar !== undefined && 'bar', blank(c, r, i) && 'blank', c.cls?.(r)]} style:--bar={bar}
                  data-label={c.hs ?? c.h}>
                {#if c.img}<ChampImg name={c.img(r)} patch={app.data?.patch} />{/if}
                {#if c.cell}
                  <!-- 보이는 층은 스니펫, 읽히는 것은 fmt 글자(같은 칸) -->
                  <span class="cs" aria-hidden="true">{@render c.cell(r, i)}</span><span class="sr-only">{cellText(c, r, i)}</span>
                {:else if r2}
                  <!-- 값을 한 요소로: 라벨 옆에 안 들면 값 전체가 다음 줄로 가고 ▲▼ 도 값에 붙어 간다 -->
                  <span class="v">{cellText(c, r, i)}</span>
                {:else}
                  {cellText(c, r, i)}
                {/if}
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
  /* 래퍼: 기본은 가로 스크롤(문서가 넘치지 않게). 표가 다 들어가면 .fit — overflow 를 풀어 sticky top 이 살아난다.
     바탕은 투명 — 감싼 카드(Panel)의 면이 보인다. 붙어 있는 칸(홈통·첫 열·머리)만 불투명하게 칠한다 */
  .sheet {
    --rn-w: 40px;
    --rh: var(--row-h);
    --r2-cols: 3;   /* 2줄 장부 행의 격자 열 수 — 기본값. 인라인 style:--r2-cols 가 덮어쓴다(--bar 와 같은 방식) */
    --stick: var(--sheet);                                            /* 붙어 있는 칸의 바탕 */
    --hover: color-mix(in srgb, var(--raised) 70%, transparent);      /* 행 호버 */
    --hover-stick: color-mix(in srgb, var(--raised) 70%, var(--sheet));
    position: relative;
    overflow-x: auto;
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
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--dim);
    padding: 0 0 var(--sp-2);
    white-space: nowrap;
  }
  /* 캡션을 카드 제목에 맡겼을 때: 잘림 힌트만 오른쪽에 남는다. 힌트도 없으면 줄 자체가 0 */
  .cap.capx { justify-content: flex-end; }
  .cap.capz { padding: 0; }
  .cut { flex: none; font-weight: 400; color: var(--dim); font-variant-numeric: tabular-nums; }

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
    border-radius: var(--r-pill);
    background: var(--grid-strong);
  }

  /* 거르기 칸 — 표 위 둥근 입력 하나 */
  .tf {
    position: sticky;
    left: 0;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding-bottom: var(--sp-2);
  }
  .tfi {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    max-width: 32ch;
    height: var(--rh);
    padding: 0 var(--sp-3);
    background: var(--ink);
    color: var(--txt);
    border: 1px solid var(--ctl-edge);
    border-radius: var(--r-chip);
    transition: border-color var(--dur-1);
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
  /* 셀 — 세로 격자선 없이 행 구분선 1px 만 */
  th, td {
    height: var(--rh);
    padding: 0 var(--sp-2);
    text-align: left;
    white-space: nowrap;
    vertical-align: middle;
    border-bottom: 1px solid var(--grid);
    background: transparent;
    transition: background-color var(--dur-1);
  }
  tbody tr:last-child td { border-bottom-color: transparent; }
  .num { text-align: right; }

  /* 머리행 — --gutter 판, 위 모서리 12px, sticky top.
     고정 헤더 아래(--sticky-top)에 붙는 것은 .fit(overflow 를 푼 상태)일 때만이다. 넘쳐서 .sheet 이 가로 스크롤
     상자가 되면 sticky 의 기준이 그 상자라 57px 가 상자 안에서 적용된다 — 머리가 57px 내려앉아 첫 행을 덮었다(실측) */
  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-sm);
    font-weight: 700;
    letter-spacing: 0;
    border-bottom: 1px solid var(--grid-strong);
    user-select: none;
  }
  .sheet.fit thead th { top: var(--sticky-top); }
  thead th:first-child { border-top-left-radius: var(--r-md); }
  thead th:last-child { border-top-right-radius: var(--r-md); }
  th.sortable { cursor: pointer; }
  th.sortable:hover { background: var(--raised); color: var(--txt); }
  th.sortable:active { background: var(--track); }
  th.on { color: var(--txt); }
  th :global(.sortic) { margin-left: var(--sp-1); color: var(--dim); }
  th :global(.sortic.up) { transform: rotate(180deg); }
  th.on :global(.sortic) { color: var(--sel); }

  /* 머리 드롭다운 — 둥근 칩 상자(1px 테두리). 보이는 층(.pkv)은 고른 값 + 화살표,
     네이티브 select 는 투명하게 그 위를 덮어 탭·키보드·보조기술은 select 그대로 쓴다 */
  .pk {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 6px;
    background: var(--sheet);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
    color: var(--dim);
    font-weight: 700;
    vertical-align: middle;
    transition: background-color var(--dur-1), border-color var(--dur-1), color var(--dur-1);
  }
  th.on .pk, .pk.picked { color: var(--txt); }
  .pk.picked { border-color: var(--ctl-edge); }
  .pk:hover { background: var(--raised); color: var(--txt); }
  .pk:has(.pks:focus-visible) { outline: 2px solid var(--sel); outline-offset: -2px; }
  .pk:has(.pks:active) { background: var(--track); }
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

  /* 행 번호 홈통(번호는 둥근 칩) · 첫 열 sticky left */
  .rn {
    position: sticky;
    left: 0;
    z-index: 1;
    width: var(--rn-w);
    min-width: var(--rn-w);
    max-width: var(--rn-w);
    padding: 0 var(--sp-1);
    text-align: center;
    background: var(--stick);
  }
  .rnc {
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 22px;
    padding: 0 4px;
    border-radius: var(--r-chip);
    background: var(--raised);
    color: var(--dim);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 1;
  }
  thead .rn { z-index: 3; background: var(--gutter); }
  .c0 {
    position: sticky;
    left: var(--rn-w);
    z-index: 1;
    background: var(--stick);
  }
  td.c0 { font-weight: 700; }
  thead .c0 { z-index: 3; background: var(--gutter); }
  /* 가로로 넘칠 때만 고정 열 오른쪽 경계선 — 스크롤되는 칸이 그 밑으로 지나간다 */
  .sheet:not(.fit):not(.rows2) .c0 { border-right: 1px solid var(--grid-strong); }

  /* 행 hover · 선택 · 초점 — hover 는 채움, 선택은 왼쪽 3px 액센트 띠 + 2px 안쪽 선, 초점은 선 + 채움(셋이 서로 구분된다) */
  tbody tr { transition: background-color var(--dur-1); }
  tbody tr:hover, tbody tr:focus-visible { background: var(--hover); }
  tbody tr:hover td.c0, tbody tr:focus-visible td.c0,
  tbody tr:hover td.rn, tbody tr:focus-visible td.rn { background: var(--hover-stick); }
  tbody tr[tabindex] { cursor: pointer; }
  tbody tr:focus-visible { outline: none; }
  .sheet:not(.rows2) tr.sel td, .sheet:not(.rows2) tbody tr:focus-visible td {
    box-shadow: inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel);
  }
  .sheet:not(.rows2) tbody tr:focus-visible td:first-child {
    box-shadow: inset 2px 0 0 var(--sel), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel);
  }
  .sheet:not(.rows2) tr.sel td:last-child, .sheet:not(.rows2) tbody tr:focus-visible td:last-child {
    box-shadow: inset -2px 0 0 var(--sel), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel);
  }
  /* 선택 띠 — 첫 칸(홈통 또는 첫 열, 둘 다 sticky 라 기준 상자가 된다)의 왼쪽 3px */
  .sheet:not(.rows2) tr.sel td:first-child::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--grad-sel);
  }

  /* 데이터 막대 — 별도 요소 없이 셀 아래쪽 3px 띠. 너비는 셀의 --bar(인라인), 색은 여기 토큰 한 곳 */
  td.bar {
    --bar: 0%;   /* 기본값 — 인라인 style:--bar 가 덮어쓴다 */
    background-image: var(--grad-win);
    background-size: var(--bar) 3px;
    background-position: left bottom 4px;
    background-repeat: no-repeat;
  }

  /* 조건부 서식 — 호출부가 cls 로 준 클래스. 색은 채움·띠에만(background-color — 막대 띠와 겹쳐 산다) */
  td.win { background-color: color-mix(in srgb, var(--win) 18%, transparent); }
  td.loss { background-color: color-mix(in srgb, var(--loss) 18%, transparent); }

  /* 초상(ChampImg)은 글자 앞에 한 칸 · 셀 스니펫은 한 덩어리 */
  td :global(.champ) { margin-right: var(--sp-1); }
  .cs { display: inline-flex; align-items: center; vertical-align: middle; }

  /* 더 보기 · 접기 — 표 아래 둥근 단추 한 줄 */
  .more {
    position: sticky;
    left: 0;
    display: block;
    width: 100%;
    height: var(--rh);
    margin-top: var(--sp-2);
    padding: 0 var(--sp-3);
    text-align: left;
    color: var(--dim);
    background: var(--gutter);
    border: 1px solid var(--grid);
    border-radius: var(--r-chip);
    transition: background-color var(--dur-1), color var(--dur-1);
  }
  .more:hover { background: var(--raised); color: var(--txt); }
  .more:active { background: var(--track); }

  /* 태블릿(641~1100px): 셀 좌우 여백 8 → 6. 카드(Panel) 안쪽 여백이 표 폭을 34px 먹어, 13열 판수 순위가 820px 에서
     넘쳤다(옛 표는 딱 맞았다 — 실측 788/788). 데스크톱 16 · 태블릿 12 · 폰 10 */
  @media (min-width: 641px) and (max-width: 1100px) {
    th, td { padding: 0 6px; }
  }
  /* 폰: 보조 열 숨김(정렬 기준 열은 .lo 를 받지 않는다) · 셀을 촘촘하게 · 홈통 28px ·
     고정 이름열은 긴 이름(실데이터 11자)이 화면을 다 먹지 않게 7em 상한, 그 안에서 두 줄로 줄바꿈
     (말줄임이 아니라 이름 전부가 보인다 — 행이 늘어도 된다).
     표 폭을 max-content 로 두는 이유: width:100% 인 채로 이름 셀만 줄바꿈을 허용하면 자동 표 배치가
     남는 폭을 그 열에서 빼앗아 55px·세 줄로 눌린다(실측). max-content 면 상한 7em 을 그대로 받는다. */
  @media (max-width: 640px) {
    .lo { display: none; }
    .sheet { --rn-w: 28px; }
    table { width: max-content; min-width: 100%; }
    th, td { padding: 0 var(--sp-1) 0 6px; }
    .rn { padding: 0 2px; }
    .rnc { min-width: 20px; height: 20px; padding: 0 3px; }
    th.c0 { max-width: 7em; overflow: hidden; text-overflow: ellipsis; }
    td.c0 { max-width: 7em; white-space: normal; overflow-wrap: anywhere; }
  }
  /* 2줄 장부 행(.rows2 — 호출부 prop + 폰에서만): 표·tbody 는 블록, 행은 3열 격자(홈통은 격자 열이 아니라
     왼쪽 absolute — 격자 열로 두면 4번째 셀부터 홈통 칸에 떨어진다), 이름 셀은 한 줄 전부, 나머지는
     '라벨: 값'(라벨은 data-label 을 ::before 가 읽고 margin auto 로 값을 오른쪽에 민다 — ▲▼ ::after 도 값 옆에
     붙는다). 머리행은 보조기술에만 남긴다(display:none 이면 th scope=col 연결이 끊긴다). 선택·초점은 행의
     ::after 한 겹(absolute 홈통 위에 그려진다), 선택 띠는 행의 ::before. 채움(막대·승패)·초상·셀 스니펫은 셀 규칙 그대로 산다. */
  .sheet.rows2 { overflow: visible; }
  .sheet.rows2 table, .sheet.rows2 tbody { display: block; width: 100%; min-width: 0; }
  .sheet.rows2 thead {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  .sheet.rows2 tbody { border-top: 1px solid var(--grid-strong); }
  .sheet.rows2 tbody tr {
    display: grid;
    grid-template-columns: repeat(var(--r2-cols), minmax(0, 1fr));
    position: relative;
    padding-left: var(--rn-w);
    border-bottom: 1px solid var(--grid);
  }
  .sheet.rows2.norn tbody tr { padding-left: 0; }
  .sheet.rows2 td {
    display: flex;
    flex-wrap: wrap;             /* 라벨+값이 한 줄에 안 들면 값이 다음 줄 오른쪽으로(낱말이 잘리기 전에) */
    justify-content: flex-end;
    align-items: center;
    gap: var(--sp-1);
    height: auto;
    min-height: 32px;
    max-width: none;
    padding: 0 6px;
    white-space: normal;
    overflow-wrap: anywhere;
    position: static;
    border: 0;
  }
  .sheet.rows2 td.lo, .sheet.rows2 td.blank { display: none; }
  .sheet.rows2 td.rn {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    justify-content: center;
    align-items: flex-start;
    padding-top: 6px;
    background: transparent;
  }
  .sheet.rows2 td.c0 {
    grid-column: 1 / -1;
    justify-content: flex-start;
    font-weight: 700;
    background: transparent;
  }
  .sheet.rows2 td:not(.c0):not(.rn)::before {
    content: attr(data-label);
    content: attr(data-label) / '';   /* 보이는 라벨만 — 보조기술은 thead 의 머리(scope=col)를 이미 읽는다(둘이면 두 번 읽힌다) */
    flex: none;
    margin-right: auto;
    font-size: var(--fs-sm);
    font-weight: 400;
    color: var(--dim);
  }
  /* 설명 셀(호출부 cls 'note'): 한 줄 전부, 보통 굵기·옅은 글자 — '솔랭 기준 없음 — 내전 전용 지표' 같은 문장.
     c0 규칙 뒤에 두어 첫 열이어도 굵지 않다 */
  .sheet.rows2 td.note { grid-column: 1 / -1; justify-content: flex-start; font-weight: 400; color: var(--dim); }
  .sheet.rows2 td.note::before { content: none; }
  .sheet.rows2 td :global(.champ) { margin-right: 0; }
  .sheet.rows2 .v { min-width: 0; text-align: right; }
  .sheet.rows2 td.c0 .v { text-align: left; }
  .sheet.rows2 tbody tr:hover td.c0, .sheet.rows2 tbody tr:focus-visible td.c0,
  .sheet.rows2 tbody tr:hover td.rn, .sheet.rows2 tbody tr:focus-visible td.rn { background: transparent; }
  .sheet.rows2 tr.sel::after, .sheet.rows2 tbody tr:focus-visible::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;   /* 홈통 td.rn 의 z-index 1 위에 — 아니면 선택 선의 왼쪽 2px 가 홈통 아래 숨는다(실측) */
    border-radius: var(--r-xs);
    box-shadow: inset 0 0 0 2px var(--sel);
    pointer-events: none;
  }
  .sheet.rows2 tr.sel::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: 3px;
    background: var(--grad-sel);
  }
  /* 태블릿(641~820px): 머리 13px/700 으로 순위판 13열이 800px 에서 41px 넘쳤다 — 셀 좌우 여백 8→6px 로 흡수 */
  @media (min-width: 641px) and (max-width: 820px) {
    th, td { padding: 0 6px; }
  }
  /* 손가락 기기: 보이는 상자는 그대로 두고 투명 select 만 위아래로 펴 44px 표적을 만든다(물음표와 같은 방식) */
  @media (pointer: coarse) {
    .pks { top: -9px; bottom: -9px; height: auto; }   /* 26px 안쪽 + 18 = 44 */
    /* rows2 셀은 탭 표적이 아니다(행 전체가 표적) — 32px 그대로 두어 첫 화면에 5행이 든다 */
  }
  /* 강제 색상: 채움·띠·안쪽 선(box-shadow)이 지워진다 — 선택 행은 아래 2px 시스템 색 선으로 남는다 */
  @media (forced-colors: active) {
    .sheet:not(.rows2) tr.sel td { border-bottom: 2px solid Highlight; }
  }
  @media (prefers-reduced-motion: reduce) {
    th, td, tbody tr, .more, .tfi, .pk { transition: none; }
  }
</style>
