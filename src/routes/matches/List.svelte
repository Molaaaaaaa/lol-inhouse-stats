<script lang="ts">
  /**
   * 최근 경기 — 한 경기가 한 행: 행 번호 홈통 · 시각 · [승] 5명 · vs · [패] 5명 · '상세' 버튼 · 주소 링크.
   * 폰에서는 두 팀이 두 줄. 50경기씩 그리고 '더 보기' 로 잇는다(다시 그리지 않으므로 펼친 상세는 남는다).
   *
   * ⚠️ 줄 전체를 button 으로 만들지 않는다 — 버튼은 내용을 이름으로 눌러 담아 안에 있는 멤버 10명·
   *    챔피언이 보조기술에서 개별로 안 읽힌다(옛 결정). '상세' 버튼(aria-expanded)만 누른다.
   * ⚠️ 상세 HTML 을 미리 만들지 않는다. 누를 때 `app.lazy.matchDetail(slug)` 로 받아 그 자리에 Detail 을
   *    펼친다. 실패하면 '다시 눌러 주세요' — loader 가 실패를 캐시하지 않으므로 다음 누름이 다시 받는다.
   */
  import type { MatchDetail } from '$lib/data/types';
  import { app } from '$lib/data/store.svelte';
  import { matchHref } from '$lib/router.svelte';
  import { announce } from '$lib/a11y';
  import { tip } from '$lib/tip';
  import { MATCH_PAGE, matchRows, type MatchRow } from '$lib/matches';
  import ChampImg from '$components/ChampImg.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import Icon from '$components/Icon.svelte';
  import Skeleton from '$components/Skeleton.svelte';
  import Detail from './Detail.svelte';

  const FAIL = '경기 상세를 불러오지 못했습니다. 다시 눌러 주세요.';

  const uid = $props.id();
  const data = $derived(app.data);
  const rows = $derived(matchRows(data?.recent_matches, data?.champ_ko));
  const patch = $derived(data?.patch);

  // ── 페이징 ── 새 payload 가 오면 처음부터
  let shown = $state(MATCH_PAGE);
  $effect(() => { void rows; shown = MATCH_PAGE; });
  const visible = $derived(rows.slice(0, shown));
  const left = $derived(rows.length - visible.length);
  function more() {
    shown = Math.min(rows.length, shown + MATCH_PAGE);
    announce(`최근 ${shown}경기 표시`);
  }

  // ── 펼침 · 상세 ── 상세는 슬러그별로 한 번만 받는다(성공만). 실패는 문구만 남기고 캐시하지 않는다.
  let open = $state<Record<string, boolean>>({});
  let loading = $state<Record<string, boolean>>({});
  let failed = $state<Record<string, boolean>>({});
  let details = $state.raw<Record<string, MatchDetail>>({});

  async function toggle(r: MatchRow) {
    const slug = r.slug;
    if (open[slug]) {
      open[slug] = false;
      announce('경기 상세 접힘');
      return;
    }
    if (loading[slug]) return;
    if (!details[slug]) {
      loading[slug] = true;
      failed[slug] = false;
      const d = app.lazy ? await app.lazy.matchDetail(slug) : null;
      loading[slug] = false;
      if (!d) {
        failed[slug] = true;
        announce(FAIL);
        return;   // open 을 안 세워 다음 누름이 다시 받는다
      }
      details = { ...details, [slug]: d };
    }
    open[slug] = true;
    announce('경기 상세 펼침');
  }
  const panelId = (slug: string) => `${uid}-d-${slug}`;
</script>

{#snippet team(players: MatchRow['win'], win: boolean)}
  <div class={['team', win ? 'win' : 'loss']}>
    <span class="res">{win ? '승' : '패'}</span>
    {#each players as p, i (`${p.name}-${i}`)}
      <span class={['pl', p.band]} use:tip={p.tip}>
        <ChampImg name={p.champ} {patch} />
        <span class="pn">{p.name}</span>
      </span>
    {/each}
  </div>
{/snippet}

<div class="list">
  {#if !data}
    <Skeleton rows={8} />
  {:else if rows.length === 0}
    <EmptyState text="아직 기록된 경기가 없습니다." />
  {:else}
    <div class="cap">최근 경기 · {rows.length}경기</div>
    <ol class="matches" aria-label="최근 경기">
      {#each visible as r, i (r.slug)}
        {@const on = !!open[r.slug]}
        <li class="match" class:on>
          <div class="row">
            <span class="rn" aria-hidden="true">{i + 1}</span>
            <time class="t" datetime={r.ts ? new Date(r.ts).toISOString() : undefined}>{r.time}</time>
            {@render team(r.win, true)}
            <span class="vs" aria-hidden="true">vs</span>
            {@render team(r.loss, false)}
            <div class="act">
              {#if r.hasDetail}
                <button type="button" class="ctl" aria-expanded={on} aria-controls={panelId(r.slug)}
                        aria-label="{r.time} 경기 상세" disabled={!!loading[r.slug]} onclick={() => toggle(r)}>
                  <Icon name="chevron-down" class={on ? 'car up' : 'car'} /><span>상세</span>
                </button>
                <a class="lnk" href={matchHref(r.slug)} aria-label="{r.time} 경기 상세 주소"><Icon name="link" /></a>
              {:else}
                <span class="muted nodet">상세 없음</span>
              {/if}
            </div>
          </div>
          {#if r.hasDetail}
            <div class="det" id={panelId(r.slug)} hidden={!on && !loading[r.slug] && !failed[r.slug]}>
              {#if on && details[r.slug]}
                <Detail detail={details[r.slug]!} {data} slug={r.slug} />
              {:else if loading[r.slug]}
                <Skeleton rows={4} />
              {:else if failed[r.slug]}
                <p class="fail" role="status">{FAIL}</p>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
    {#if left > 0}
      <button type="button" class="more" onclick={more}>더 보기 ({Math.min(left, MATCH_PAGE)} / 남은 {left}경기)</button>
    {/if}
  {/if}
</div>

<style>
  .list { --rn-w: 36px; display: grid; gap: 0; min-width: 0; }
  .cap {
    font-size: var(--fs-xs);
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  /* min-width 0: 격자 항목의 자동 최소 폭이 펼친 상세의 표 폭까지 따라가 문서를 넘치게 한다(실측 800px) */
  .matches {
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--grid-strong);
    border-left: 1px solid var(--grid);
    border-right: 1px solid var(--grid);
  }
  .match { border-bottom: 1px solid var(--grid); }
  .match.on { box-shadow: inset 0 0 0 2px var(--sel); }

  /* 한 행: 홈통 · 시각 · 승 팀 · vs · 패 팀 · 동작 */
  .row {
    display: grid;
    grid-template-columns: var(--rn-w) 7.5em minmax(0, 1fr) auto minmax(0, 1fr) auto;
    align-items: center;
    min-height: var(--row-h);
    transition: background-color .12s;
  }
  .row:hover { background: var(--raised); }
  .rn {
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 var(--sp-1);
    font-size: var(--fs-xs);
    color: var(--dim2);
    background: var(--gutter);
    border-right: 1px solid var(--grid-strong);
  }
  .t {
    padding: 0 var(--sp-2);
    font-size: var(--fs-sm);
    color: var(--dim);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .team {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    min-width: 0;
    padding: var(--sp-1) var(--sp-2);
  }
  .res {
    flex: none;
    min-width: 2.2em;
    padding: 0 var(--sp-1);
    text-align: center;
    font-size: var(--fs-sm);
    line-height: 1.6;
  }
  .team.win .res { background: color-mix(in srgb, var(--win) 18%, transparent); }
  .team.loss .res { background: color-mix(in srgb, var(--loss) 18%, transparent); }
  /* 멤버 칸 — 초상 + 이름, 다섯이 한 줄을 나눠 갖는다(이름은 줄임표, 전체는 툴팁) */
  .pl {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: 1 1 0;
    min-width: 0;
    padding-left: var(--sp-1);
    border-left: 3px solid transparent;
    font-size: var(--fs-sm);
    line-height: 1.6;
  }
  .pl.top { border-left-color: var(--lane-top); }
  .pl.jg { border-left-color: var(--lane-jg); }
  .pl.mid { border-left-color: var(--lane-mid); }
  .pl.bot { border-left-color: var(--lane-bot); }
  .pl.sup { border-left-color: var(--lane-sup); }
  .pn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vs { padding: 0 var(--sp-1); font-size: var(--fs-xs); color: var(--dim2); }
  .act {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    padding: 0 var(--sp-2);
    border-left: 1px solid var(--grid);
    align-self: stretch;
  }
  .nodet { font-size: var(--fs-xs); white-space: nowrap; }

  /* 셀 모양 버튼 — 헤더의 .ctl 과 같은 어휘 */
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    min-height: 28px;
    padding: 0 var(--sp-2);
    background: var(--sheet);
    color: var(--txt);
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
    font-size: var(--fs-sm);
    white-space: nowrap;
    transition: background-color .15s ease-out, border-color .15s ease-out;
  }
  .ctl:hover:not(:disabled) { background: var(--raised); }
  .ctl:active:not(:disabled) { background: var(--ink); }
  .ctl[aria-expanded='true'] { background: var(--raised); border-color: var(--sel); }
  .ctl:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; }
  .ctl :global(.car) { transition: transform .15s; }
  .ctl :global(.car.up) { transform: rotate(180deg); }
  .lnk {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--dim);
    border: 1px solid transparent;
    border-radius: var(--r-chip);
    transition: color .15s, background-color .15s;
  }
  .lnk:hover { color: var(--txt); background: var(--raised); }
  .lnk:active { background: var(--ink); }

  /* 펼친 상세 — 홈통 바탕 위에 한 단 들여서, 홈통 열은 비운다 */
  .det {
    padding: var(--sp-2) var(--sp-3) var(--sp-4) calc(var(--rn-w) + var(--sp-3));
    background: var(--gutter);
    border-top: 1px solid var(--grid);
  }
  .det[hidden] { display: none; }
  .fail { margin: 0; font-size: var(--fs-sm); color: var(--dim); }

  .more {
    display: block;
    width: 100%;
    height: var(--row-h);
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

  @media (pointer: coarse) {
    .ctl, .lnk { min-height: 44px; }
    .lnk { width: 44px; }
  }
  /* 폰: 두 팀이 두 줄. 시각과 동작은 첫 줄 */
  @media (max-width: 640px) {
    .row {
      grid-template-columns: var(--rn-w) minmax(0, 1fr) auto;
      grid-template-areas:
        'rn t act'
        'rn win win'
        'rn loss loss';
    }
    .rn { grid-area: rn; }
    .t { grid-area: t; padding-top: var(--sp-1); }
    .act { grid-area: act; align-self: start; border-left: 0; padding-top: 2px; }
    .team.win { grid-area: win; }
    .team.loss { grid-area: loss; padding-bottom: var(--sp-2); }
    /* 폰: 다섯 칸이 한 줄을 나누면 이름이 한 글자만 남는다(실측 'C…') — 칸을 내용 폭으로 두고 줄을 바꾼다 */
    .team { flex-wrap: wrap; gap: var(--sp-1) var(--sp-2); }
    .pl { flex: 0 1 auto; max-width: 100%; }
    .pn { max-width: 7ch; }
    .vs { display: none; }
    .det { padding-left: var(--sp-3); }
  }
  @media (prefers-reduced-motion: reduce) {
    .row, .ctl, .lnk, .more, .ctl :global(.car) { transition: none; }
  }
</style>
