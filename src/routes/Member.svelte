<script module lang="ts">
  import type { Component } from 'svelte';
  import type { GuildPayload, PlayerPub } from '$lib/data/types';

  /** 하위 화면이 받는 props — 요약·상대별·최근·파트너·세부 지표·검산 전부 같은 계약 */
  export interface SubProps { key: string; p: PlayerPub; data: GuildPayload }

  /** 하위 화면 — id 는 탭 id, file 은 지연 import 경로. 라벨은 명사구(금지어·이모지 없음). */
  export const SUBTABS = [
    { id: 'summary', label: '요약', file: './member/Summary.svelte' },
    { id: 'vs', label: '상대별 전적', file: './member/Vs.svelte' },
    { id: 'recent', label: '최근 경기', file: './member/Recent.svelte' },
    { id: 'partners', label: '파트너 · 상대 챔피언', file: './member/Partners.svelte' },
    { id: 'metrics', label: '세부 지표', file: './member/Metrics.svelte' },
    { id: 'mmr', label: 'MMR 검산', file: './member/MmrReplay.svelte' },
  ] as const;
  export type SubId = (typeof SUBTABS)[number]['id'];

  // 하위 화면은 탭을 켤 때 받는다(섹션 청크와 같은 원칙). 경로는 위 SUBTABS 의 file 과 같아야 한다 —
  // 패턴은 리터럴이어야 해서 두 번 적는다. 파일이 없는 탭은 '준비 중' 으로 남는다(빌드는 깨지지 않는다).
  const FILES = import.meta.glob<{ default: Component<SubProps> }>([
    './member/Summary.svelte', './member/Vs.svelte', './member/Recent.svelte',
    './member/Partners.svelte', './member/Metrics.svelte', './member/MmrReplay.svelte',
  ]);

  /** 마지막으로 보던 하위 화면 — 사람을 바꿔도 유지(모듈 변수. 세션 저장소는 쓰지 않는다). */
  const memo = { sub: 'summary' as SubId };
  export const isSubId = (s: string): s is SubId => SUBTABS.some((t) => t.id === s);
</script>

<script lang="ts">
  /**
   * 멤버 화면 — 표시명(`#/m/이름`, 동명이인은 `이름~2`)으로 한 사람을 연다.
   * 머리: 이름 · 티어 셀(배치 전엔 '배치 n/5') · 주 라인 · 전적 셀 한 줄 · 비교 칸.
   * 그 아래 하위 화면 탭(요약 · 상대별 전적 · 최근 경기 · 파트너·상대 챔피언 · 세부 지표 · MMR 검산).
   * `#/m/이름/vs/상대` 면 탭 대신 비교 화면.
   *
   * 수식 줄: 화면을 열 때 `=티어(CP …) → … · MMR … · 판`. 검산 탭은 자기 근거를 스스로 쓴다.
   * 하위 화면은 멤버가 바뀌면 {#key} 로 새로 만든다 — 표 거르기·라인 선택이 그 사람 것이어야 한다.
   */
  import { app, displayName } from '$lib/data/store.svelte';
  import { router, compareHref } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { setFx } from '$lib/fx.svelte';
  import { searchHits } from '$lib/search';
  import { fxMember, headerStats } from '$lib/member';
  import Subtabs from '$components/Subtabs.svelte';
  import TierBadge from '$components/TierBadge.svelte';
  import LaneChip from '$components/LaneChip.svelte';
  import WinRate from '$components/WinRate.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import Skeleton from '$components/Skeleton.svelte';
  import Icon from '$components/Icon.svelte';
  import Compare from './member/Compare.svelte';

  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();

  const name = $derived(params.name ?? '');
  const found = $derived(app.player(name));
  const data = $derived(app.data);
  const cp = $derived(found && data ? data.cp?.[found.key] : undefined);
  const need = $derived(data?.cp_constants?.placement_games ?? 5);
  const mainLane = $derived(cp?.main_lane ?? (found && data ? data.ratings?.[found.key]?.main_lane : undefined));
  const stats = $derived(found ? headerStats(found.p, data?.metric_meta) : []);
  const isCompare = $derived(sub === 'compare' && !!params.b);

  // ── 하위 화면 ──
  let active = $state<SubId>(memo.sub);
  let Sub = $state<Component<SubProps> | null>(null);
  let subMissing = $state(false);
  let loadedFor = '';
  function pickSub(id: string) {
    if (!isSubId(id)) return;
    active = id;
    memo.sub = id;
    announce(`${SUBTABS.find((t) => t.id === id)?.label ?? id} 화면`);
  }
  $effect(() => {
    const t = SUBTABS.find((x) => x.id === active);
    if (!t || t.file === loadedFor) return;
    loadedFor = t.file;
    Sub = null;
    const load = FILES[t.file];
    subMissing = !load;
    if (!load) return;
    void load().then((m) => {
      if (loadedFor !== t.file) return;   // 그 사이 다른 탭으로 갔다
      Sub = m.default;
    });
  });

  // ── 수식 줄 · 제목 · 스크롤 ──
  // 같은 섹션 안에서 사람이 바뀌면 App 은 스크롤을 안 올린다(섹션 전환에만) — 여기서 올린다.
  let shownKey = '';
  $effect(() => {
    if (!found) { document.title = '멤버 · 내전 해체 분석기'; return; }
    document.title = `${name} · 내전 해체 분석기`;
    if (isCompare || active !== 'mmr') setFx(fxMember(cp, need));
    if (shownKey && shownKey !== found.key) window.scrollTo({ top: 0 });
    shownKey = found.key;
  });

  // ── 비교 칸 — 다른 멤버를 초성으로 찾아 #/m/이름/vs/상대 로 ──
  const uid = $props.id();
  let cmpOpen = $state(false);
  let q = $state('');
  let cur = $state(-1);
  let listOpen = $state(false);
  let cmpInput = $state<HTMLInputElement | undefined>();
  let cmpBtn = $state<HTMLButtonElement | undefined>();
  const cands = $derived.by(() => {
    if (!data) return [];
    return Object.values(data.players).map((x) => ({ name: displayName(x), games: x.record.games })).filter((c) => c.name !== name);
  });
  const hits = $derived(searchHits(q, cands));
  const shown = $derived(listOpen && q.trim().length > 0);
  const activeId = $derived(shown && cur >= 0 && cur < hits.length ? `${uid}-opt-${cur}` : undefined);
  function toggleCmp() {
    cmpOpen = !cmpOpen;
    if (cmpOpen) setTimeout(() => cmpInput?.focus(), 0);
  }
  function closeList() { listOpen = false; cur = -1; }
  function pick(c: { name: string } | undefined) {
    if (!c) return;
    router.go(compareHref(name, c.name));
    q = '';
    closeList();
    cmpOpen = false;
  }
  function move(d: 1 | -1) {
    if (!hits.length) return;
    listOpen = true;
    cur = cur < 0 ? (d > 0 ? 0 : hits.length - 1) : (cur + d + hits.length) % hits.length;
  }
  function onCmpKey(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Enter': if (shown && hits.length) { e.preventDefault(); pick(hits[cur >= 0 ? cur : 0]); } break;
      case 'Escape':
        e.preventDefault();
        if (shown) closeList();
        else if (q) q = '';
        else { cmpOpen = false; cmpBtn?.focus(); }   // 칸을 닫으면 초점은 연 버튼으로
        break;
      case 'Tab': closeList(); break;
    }
  }
</script>

{#if !data}
  <Skeleton rows={6} />
{:else if !found}
  <section class="member">
    <h1>{name || '멤버'}</h1>
    <EmptyState text="해당 멤버가 없습니다. 위의 소환사명 검색에서 이름이나 초성으로 찾을 수 있습니다." />
  </section>
{:else}
  {@const p = found.p}
  <section class="member" aria-labelledby="{uid}-name">
    <header class="head">
      <div class="idrow">
        <h1 id="{uid}-name">{name}</h1>
        {#if cp}
          <TierBadge cp={cp.cp} placed={cp.placed} games={cp.games} placementGames={need} data={data} tier={cp.placed ? cp.tier : undefined} />
        {/if}
        {#if mainLane}<LaneChip lane={mainLane} />{/if}
        {#if p.account_count > 1}
          <span class="acc muted"><Icon name="id-card" /> 계정 {p.account_count}개 합산</span>
        {/if}
        <button type="button" class="ctl" aria-expanded={cmpOpen} aria-controls="{uid}-cmp" onclick={toggleCmp} bind:this={cmpBtn}>
          <Icon name="arrow-left-right" /><span>비교</span>
        </button>
      </div>

      <dl class="cells">
        {#each stats as s (s.k)}
          <div class="cell">
            <dt>{s.label}</dt>
            <dd>
              {#if s.k === 'winrate'}
                <WinRate w={p.record.winrate} n={p.record.games} minGames={data.min_games} />
              {:else}
                {s.text}
              {/if}
            </dd>
          </div>
        {/each}
      </dl>

      <div id="{uid}-cmp" class="cmp" hidden={!cmpOpen}>
        <label class="sr-only" for="{uid}-cmpq">비교할 멤버</label>
        <div class="cmpbox">
          <Icon name="search" class="glyph" />
          <input id="{uid}-cmpq" type="text" bind:value={q} bind:this={cmpInput}
                 placeholder="비교할 멤버" autocomplete="off" autocapitalize="off" spellcheck="false"
                 role="combobox" aria-autocomplete="list" aria-controls="{uid}-list" aria-expanded={shown} aria-activedescendant={activeId}
                 oninput={() => { cur = -1; listOpen = true; }} onkeydown={onCmpKey}
                 onfocus={() => { listOpen = true; }} onblur={closeList} />
          <ul id="{uid}-list" class="list" role="listbox" aria-label="비교 후보" hidden={!shown}>
            {#if shown}
              {#each hits as c, i (c.name)}
                <li id="{uid}-opt-{i}" class="opt" class:cur={i === cur} role="option" aria-selected={i === cur}
                    onmousedown={(e) => { e.preventDefault(); }} onmouseup={() => pick(c)} onmousemove={() => { cur = i; }}>
                  <span class="name">{c.name}</span><span class="n muted">{c.games}판</span>
                </li>
              {:else}
                <li class="none" role="option" aria-selected="false" aria-disabled="true">검색 결과가 없습니다</li>
              {/each}
            {/if}
          </ul>
        </div>
      </div>
    </header>

    {#if isCompare}
      <Compare key={found.key} {p} {data} b={params.b ?? ''} />
    {:else}
      <Subtabs tabs={SUBTABS} active={active} onchange={pickSub} label="멤버 하위 화면" prefix="m" />
      <div class="panel" role="tabpanel" id="m-panel-{active}" aria-labelledby="m-tab-{active}">
        {#key found.key}
          {#if Sub}
            <Sub key={found.key} {p} {data} />
          {:else if subMissing}
            <EmptyState text="아직 준비되지 않은 화면입니다." />
          {:else}
            <Skeleton rows={6} />
          {/if}
        {/key}
      </div>
    {/if}
  </section>
{/if}

<style>
  .member { display: grid; gap: var(--sp-3); }
  .head { display: grid; gap: var(--sp-3); }
  .idrow { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2) var(--sp-3); }
  h1 { font-size: var(--fs-xl); overflow-wrap: anywhere; }
  .acc { display: inline-flex; align-items: center; gap: var(--sp-1); font-size: var(--fs-sm); }
  .idrow .ctl { margin-left: auto; }

  /* 셀 모양 버튼 — App 헤더의 .ctl 과 같은 어휘 */
  .ctl {
    display: inline-flex; align-items: center; gap: var(--sp-1);
    min-height: 32px;
    padding: 0 var(--sp-3);
    background: var(--sheet);
    color: var(--txt);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
    white-space: nowrap;
    transition: background-color .15s ease-out, border-color .15s ease-out;
  }
  .ctl:hover:not(:disabled) { background: var(--raised); }
  .ctl:active:not(:disabled) { background: var(--ink); }
  .ctl[aria-expanded='true'] { background: var(--raised); border-color: var(--sel); }
  .ctl:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; }

  /* 전적 셀 한 줄 — 격자 셀(라벨은 홈통 바탕의 작은 머리, 값은 시트 바탕) */
  .cells {
    display: flex; flex-wrap: wrap;
    margin: 0;
    border: 1px solid var(--grid);
    border-right: 0;
  }
  .cell { flex: 1 0 auto; min-width: 0; border-right: 1px solid var(--grid); }
  .cell dt {
    padding: 0 var(--sp-2);
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-xs);
    line-height: 1.8;
    border-bottom: 1px solid var(--grid);
    white-space: nowrap;
  }
  .cell dd {
    margin: 0;
    padding: var(--sp-1) var(--sp-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* 비교 칸 — 검색 셀과 같은 콤보(홈통 바탕 입력 + 떠 있는 목록) */
  .cmp[hidden] { display: none; }
  .cmpbox { position: relative; max-width: 32ch; }
  .cmpbox :global(.glyph) {
    position: absolute; left: var(--sp-2); top: 50%; transform: translateY(-50%);
    color: var(--dim); pointer-events: none;
  }
  .cmpbox input {
    display: block; width: 100%; height: var(--row-h);
    padding: 0 var(--sp-2) 0 calc(var(--sp-2) * 2 + 1em);
    background: var(--gutter); color: var(--txt);
    border: 1px solid var(--grid-strong); border-radius: 0;
    -webkit-appearance: none; appearance: none;
  }
  .cmpbox input:hover { background: var(--raised); }
  .list {
    position: absolute; left: 0; right: 0; top: 100%; z-index: 30;
    margin: 0; padding: 0; list-style: none;
    max-height: calc(var(--row-h) * 6); overflow-y: auto;
    background: var(--raised); border: 1px solid var(--grid-strong); border-top: 0;
    box-shadow: var(--shadow);
  }
  .list[hidden] { display: none; }
  .opt, .none {
    display: flex; align-items: center; gap: var(--sp-3);
    min-height: var(--row-h); padding: 0 var(--sp-3);
    border-bottom: 1px solid var(--grid);
  }
  .opt { cursor: pointer; }
  .opt:last-child { border-bottom: 0; }
  .opt .name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .opt .n { flex: none; font-size: var(--fs-sm); }
  .opt.cur { outline: 2px solid var(--sel); outline-offset: -2px; }
  .opt:active { background: var(--gutter); }
  .none { color: var(--dim); }

  .panel { min-width: 0; }

  @media (pointer: coarse) {
    .ctl { min-height: 44px; }
  }
  /* 폰: 계정 합산 안내는 다음 줄로 — 비교 버튼이 이름 줄에 남는다(실측 375px 에서 버튼만 따로 떨어졌다) */
  @media (max-width: 640px) {
    .idrow .acc { order: 9; flex-basis: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ctl { transition: none; }
  }
</style>
