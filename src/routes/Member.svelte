<script module lang="ts">
  import type { Component } from 'svelte';
  import type { GuildPayload, PlayerPub } from '$lib/data/types';

  /** 하위 화면이 받는 props — 요약·상대별·최근·파트너·세부 지표 전부 같은 계약 */
  export interface SubProps { key: string; p: PlayerPub; data: GuildPayload }

  /** 하위 화면 — id 는 탭 id, file 은 지연 import 경로. 라벨은 명사구(금지어·이모지 없음). */
  export const SUBTABS = [
    { id: 'summary', label: '요약', file: './member/Summary.svelte' },
    { id: 'vs', label: '상대별 전적', file: './member/Vs.svelte' },
    { id: 'recent', label: '최근 경기', file: './member/Recent.svelte' },
    { id: 'partners', label: '파트너 · 상대 챔피언', file: './member/Partners.svelte' },
    { id: 'metrics', label: '세부 지표', file: './member/Metrics.svelte' },
  ] as const;
  export type SubId = (typeof SUBTABS)[number]['id'];

  // 하위 화면은 탭을 켤 때 받는다(섹션 청크와 같은 원칙). 경로는 위 SUBTABS 의 file 과 같아야 한다 —
  // 패턴은 리터럴이어야 해서 두 번 적는다. 파일이 없는 탭은 '준비 중' 으로 남는다(빌드는 깨지지 않는다).
  const FILES = import.meta.glob<{ default: Component<SubProps> }>([
    './member/Summary.svelte', './member/Vs.svelte', './member/Recent.svelte',
    './member/Partners.svelte', './member/Metrics.svelte',
  ]);

  /** 마지막으로 보던 하위 화면 — 사람을 바꿔도 유지(모듈 변수. 세션 저장소는 쓰지 않는다). */
  const memo = { sub: 'summary' as SubId };
  export const isSubId = (s: string): s is SubId => SUBTABS.some((t) => t.id === s);
</script>

<script lang="ts">
  /**
   * 멤버 화면 — 표시명(`#/m/이름`, 동명이인은 `이름~2`)으로 한 사람을 연다.
   * 머리는 히어로 카드 하나: 이름 · 주 라인 · 연승·연패 알약 · 'MVP n회' · 계정 합산 · 비교 버튼(오른쪽 위),
   * 그 아래 승률 게이지(큰 승률 + 'n승 n패 · n판' + 막대)와 숫자 타일(KDA · 킬 관여 · 분당 딜 · 최근).
   * 승률은 게이지 하나로만 그린다(링을 겹쳐 두 번 그리지 않는다). 글로우·액센트 띠는 없다 — 카드 위쪽 1px 빛과
   * 그림자(--edge-hi + --shadow-1)만. 액센트는 선택·초점·활성 독·MVP 에만 쓴다(비평 반영).
   * 그 아래 하위 화면 탭(요약 · 상대별 전적 · 최근 경기 · 파트너·상대 챔피언 · 세부 지표).
   * `#/m/이름/vs/상대` 면 탭 대신 비교 화면.
   *
   * 'MVP n회' 는 payload mvp 목록(판수 문턱 이상만 실린다)에 있을 때만 — 0회·문턱 미만은 배지가 없다.
   * 수식 줄: 화면을 열 때 `=승률(승 3 · 패 2) → 60% · 5판`.
   * 하위 화면은 멤버가 바뀌면 {#key} 로 새로 만든다 — 표 거르기·라인 선택이 그 사람 것이어야 한다.
   */
  import { app, displayName } from '$lib/data/store.svelte';
  import { router, compareHref } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { setFx } from '$lib/fx.svelte';
  import { searchHits } from '$lib/search';
  import { fxMember, headerStats, mainLaneOf, mvpCount } from '$lib/member';
  import Subtabs from '$components/Subtabs.svelte';
  import LaneChip from '$components/LaneChip.svelte';
  import WinGauge from '$components/WinGauge.svelte';
  import StreakPill from '$components/StreakPill.svelte';
  import MvpTag from '$components/MvpTag.svelte';
  import StatTile from '$components/StatTile.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import Skeleton from '$components/Skeleton.svelte';
  import Icon from '$components/Icon.svelte';
  import Compare from './member/Compare.svelte';

  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();

  const name = $derived(params.name ?? '');
  const found = $derived(app.player(name));
  const data = $derived(app.data);
  const mainLane = $derived(found ? mainLaneOf(found.p) : '');
  const stats = $derived(found ? headerStats(found.p, data?.metric_meta) : []);
  const mvp = $derived(found ? mvpCount(data?.mvp, found.p) : 0);
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
    setFx(fxMember(found.p.record, data?.metric_meta));
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
    <header class="hero">
      <div class="idrow">
        <h1 id="{uid}-name">{name}</h1>
        {#if mainLane}<LaneChip lane={mainLane} />{/if}
        <StreakPill form={p.form} games={p.record.games} />
        {#if mvp > 0}<MvpTag count={mvp} />{/if}
        {#if p.account_count > 1}
          <span class="acc muted"><Icon name="id-card" /> 계정 {p.account_count}개 합산</span>
        {/if}
        <button type="button" class="ctl" aria-expanded={cmpOpen} aria-controls="{uid}-cmp" onclick={toggleCmp} bind:this={cmpBtn}>
          <Icon name="arrow-left-right" /><span>비교</span>
        </button>
      </div>

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

      <div class="body">
        <div class="gauge"><WinGauge w={p.record.winrate} n={p.record.games} minGames={data.min_games} variant="full" /></div>
        <dl class="stats">
          {#each stats as s (s.k)}
            <StatTile label={s.label} value={s.text} compact />
          {/each}
        </dl>
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
  .member { display: grid; gap: var(--sp-4); }

  /* 히어로 — 바깥 카드(20px) 하나. 위쪽 1px 빛 + 그림자만 — 액센트 띠·글로우는 두지 않는다(선택된 것이 아니다.
     액센트는 선택·초점·활성 독·MVP 에만). overflow 는 숨기지 않는다 — 비교 칸의 떠 있는 목록이 잘린다 */
  .hero {
    display: grid;
    gap: var(--sp-3);
    min-width: 0;
    padding: 18px;
    background: var(--grad-card);
    border: 1px solid var(--grid);
    border-radius: var(--r-lg);
    box-shadow: var(--edge-hi), var(--shadow-1);
  }
  .idrow { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2) var(--sp-3); }
  h1 { font-size: 1.375rem; overflow-wrap: anywhere; }   /* 22px — 화면 제목(18)과 요약 타일 값(24) 사이 */
  .acc { display: inline-flex; align-items: center; gap: var(--sp-1); font-size: var(--fs-sm); }
  .idrow .ctl { margin-left: auto; }

  /* 승률 게이지(왼쪽) | 숫자 타일(오른쪽). 좁으면 위아래 */
  .body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-3); align-items: center; }
  .gauge { min-width: 0; }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: var(--sp-2);
    margin: 0;
  }
  @media (min-width: 760px) {
    .body { grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: var(--sp-5); }
  }

  /* 컨트롤 — App 헤더의 .ctl 과 같은 어휘(반경 8px · 1px --ctl-edge) */
  .ctl {
    display: inline-flex; align-items: center; gap: var(--sp-1);
    min-height: 34px;
    padding: 0 var(--sp-3);
    background: var(--sheet);
    color: var(--txt);
    border: 1px solid var(--ctl-edge);
    border-radius: var(--r-chip);
    white-space: nowrap;
    transition: background-color var(--dur-1) ease-out, border-color var(--dur-1) ease-out;
  }
  .ctl:hover:not(:disabled) { background: var(--raised); }
  .ctl:active:not(:disabled) { background: var(--track); }
  .ctl[aria-expanded='true'] { background: var(--raised); border-color: var(--sel); }
  .ctl:disabled { color: var(--dim2); border-color: var(--grid-strong); cursor: default; }

  /* 비교 칸 — 소환사명 검색 셀과 같은 콤보(우물 바탕 둥근 입력 + 떠 있는 목록) */
  .cmp[hidden] { display: none; }
  .cmpbox { position: relative; max-width: 32ch; }
  .cmpbox :global(.glyph) {
    position: absolute; left: var(--sp-3); top: 50%; transform: translateY(-50%);
    color: var(--dim); pointer-events: none;
  }
  .cmpbox input {
    display: block; width: 100%; height: var(--row-h);
    padding: 0 var(--sp-3) 0 calc(var(--sp-3) * 2 + 1em);
    background: var(--ink); color: var(--txt);
    border: 1px solid var(--ctl-edge); border-radius: var(--r-md);
    -webkit-appearance: none; appearance: none;
    transition: border-color var(--dur-1);
  }
  .cmpbox input:hover { border-color: var(--dim2); }
  .cmpbox input:focus-visible { outline-offset: 0; }
  .list {
    position: absolute; left: 0; right: 0; top: calc(100% + 2px); z-index: 30;
    margin: 0; padding: var(--sp-1); list-style: none;
    max-height: calc(var(--row-h) * 6); overflow-y: auto;
    background: var(--raised); border: 1px solid var(--grid-strong); border-radius: var(--r-md);
    box-shadow: var(--shadow);
  }
  .list[hidden] { display: none; }
  .opt, .none {
    display: flex; align-items: center; gap: var(--sp-3);
    min-height: var(--row-h); padding: 0 var(--sp-3);
    border-radius: var(--r-chip);
  }
  .opt { cursor: pointer; }
  .opt .name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .opt .n { flex: none; font-size: var(--fs-sm); }
  .opt.cur { background: var(--track); box-shadow: inset 0 0 0 2px var(--sel); }
  .opt:active { background: var(--gutter); }
  .none { color: var(--dim); }

  .panel { min-width: 0; }

  @media (pointer: coarse) {
    .ctl { min-height: 44px; }
    .cmpbox input { height: 44px; }
  }
  /* 폰: 카드 안쪽 여백을 줄이고, 계정 합산 안내는 다음 줄로 — 비교 버튼이 이름 줄에 남는다
     (실측 375px 에서 버튼만 따로 떨어졌다) */
  @media (max-width: 640px) {
    .hero { padding: 14px 12px 12px; gap: 10px; }
    .idrow .acc { order: 9; flex-basis: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ctl, .cmpbox input { transition: none; }
  }
</style>
