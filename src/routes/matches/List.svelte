<script lang="ts">
  /**
   * 최근 경기 — 한 경기가 카드 하나: 위 줄(번호 칩 · 시각 · '상세' 버튼 · 주소 링크) → [승] 5명 · vs · [패] 5명.
   * 팀 줄은 결과 색 틴트 바탕에 '승'·'패' 글자 태그(색만으로 가르지 않는다), 멤버는 칩(라인 점 · 초상 · 이름).
   * 좁은 화면(≤900px)에서는 두 팀이 위아래로 쌓인다. 50경기씩 그리고 '더 보기' 로 잇는다(다시 그리지 않으므로 펼친 상세는 남는다).
   * payload 의 `mvp: true` 선수(그 경기 MVP, 이긴 팀 한 명)는 이름 뒤에 MVP 표식이 붙는다.
   *
   * 접힌 카드는 마우스 기기에서 호버하면 살짝 들린다(.lift). 펼친 카드는 선택된 카드라 글로우를 두고 들리지 않는다.
   * ⚠️ 줄 전체를 button 으로 만들지 않는다 — 버튼은 내용을 이름으로 눌러 담아 안에 있는 멤버 10명·
   *    챔피언이 보조기술에서 개별로 안 읽힌다(옛 결정). '상세' 버튼(aria-expanded)만 누른다.
   * ⚠️ 상세 HTML 을 미리 만들지 않는다. 누를 때 `app.lazy.matchDetail(slug)` 로 받아 카드 안에 Detail 을
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
  import MvpTag from '$components/MvpTag.svelte';
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

  // 받는 동안 disabled 로 만들지 않는다 — disabled 가 되는 순간 초점이 body 로 빠져(실측) 펼친 뒤
  // Tab 이 처음부터 다시 시작된다. 중복 누름은 loading 가드가 막는다.
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
      <span class={['pl', p.band, p.mvp && 'has-mvp']} use:tip={p.tip}>
        <ChampImg name={p.champ} {patch} size={16} />
        <span class="pn">{p.name}</span>
        {#if p.mvp}<MvpTag />{/if}
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
        <li class={['match', 'card', on ? 'glow' : 'lift']}>
          <div class="row">
            <div class="hd">
              <span class="rn" aria-hidden="true">{i + 1}</span>
              <time class="t" datetime={r.ts ? new Date(r.ts).toISOString() : undefined}>{r.time}</time>
            </div>
            {@render team(r.win, true)}
            <span class="vs" aria-hidden="true">vs</span>
            {@render team(r.loss, false)}
            <div class="act">
              {#if r.hasDetail}
                <button type="button" class="ctl" aria-expanded={on} aria-controls={panelId(r.slug)}
                        aria-label="{r.time} 경기 상세" aria-busy={loading[r.slug] ? true : undefined} onclick={() => toggle(r)}>
                  <Icon name="chevron-down" class={on ? 'car up' : 'car'} /><span>상세</span>
                </button>
                <a class="lnk" href={matchHref(r.slug)} aria-label="{r.time} 경기 상세 주소"><Icon name="link" /></a>
              {:else}
                <span class="nodet">상세 없음</span>
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
  .list { display: grid; gap: 10px; min-width: 0; }
  .cap {
    font-size: var(--fs-sm); font-weight: 700;
    color: var(--dim);
    white-space: nowrap;
  }
  /* min-width 0: 격자 항목의 자동 최소 폭이 펼친 상세의 표 폭까지 따라가 문서를 넘치게 한다(실측 800px) */
  .matches {
    display: grid;
    gap: 10px;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .match { min-width: 0; }

  /* 카드 한 장: 위 줄(번호 · 시각 · 동작) 아래 [승 팀 · vs · 패 팀] */
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    grid-template-areas:
      'hd hd act'
      'win vs loss';
    align-items: center;
    gap: var(--sp-2) 10px;
    padding: 10px var(--sp-3) var(--sp-3);
  }
  .hd { grid-area: hd; display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
  .rn {
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
    font-variant-numeric: tabular-nums;
  }
  .t {
    font-size: var(--fs-sm);
    color: var(--dim);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* 팀 줄 — 결과 색 틴트 바탕 + 글자 태그. 다섯 칩이 한 줄에 안 들면 줄을 바꾼다(이름을 짓누르지 않는다).
     나란히 놓일 때 두 팀 줄의 높이를 맞춘다(한쪽만 두 줄이면 틴트 판 높이가 갈린다) */
  .team {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-content: center;
    align-self: stretch;
    gap: var(--sp-1) 6px;
    min-width: 0;
    padding: var(--sp-1);
    border-radius: var(--r-chip);
  }
  .team.win { grid-area: win; background: color-mix(in srgb, var(--win) 10%, transparent); }
  .team.loss { grid-area: loss; background: color-mix(in srgb, var(--loss) 8%, transparent); }
  .res {
    flex: none;
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--r-xs);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 1;
  }
  .team.win .res { background: color-mix(in srgb, var(--win) 20%, transparent); color: var(--win-soft); }
  .team.loss .res { background: color-mix(in srgb, var(--loss) 16%, transparent); color: var(--loss-soft); }

  /* 멤버 칩 — 라인 점 · 초상 16px · 이름(긴 이름은 줄임표, 전체는 툴팁) · MVP 표식 */
  .pl {
    --dot: transparent;
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    flex: 0 1 auto;
    min-width: 0;
    max-width: 11em;
    height: 24px;
    padding: 0 6px;
    border-radius: var(--r-chip);
    background: var(--gutter);
    font-size: var(--fs-sm);
    line-height: 1;
  }
  .pl::before {
    content: '';
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: var(--r-dot);
    background: var(--dot);
  }
  /* MVP 표식이 든 칸은 표식 폭만큼 상한을 넓힌다 — 안 그러면 표식이 이름 칸을 깎아 긴 이름이 줄임표가 된다.
     15em = 11em(표식 없는 칸의 상한) + 표식 바깥 폭(3.3em 안팎, 실측) + 여유 */
  .pl.has-mvp { max-width: 15em; }
  .pl.top { --dot: var(--lane-top); }
  .pl.jg { --dot: var(--lane-jg); }
  .pl.mid { --dot: var(--lane-mid); }
  .pl.bot { --dot: var(--lane-bot); }
  .pl.sup { --dot: var(--lane-sup); }
  .pl :global(.champ) { border-radius: var(--r-xs); }
  .pn { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vs {
    grid-area: vs;
    padding: 2px 6px;
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-xs);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--dim);
    line-height: 1.2;
  }

  .act { grid-area: act; justify-self: end; display: inline-flex; align-items: center; gap: var(--sp-1); }
  .nodet { font-size: var(--fs-sm); color: var(--dim); white-space: nowrap; }

  /* 컨트롤 — 헤더의 .ctl 과 같은 어휘(반경 8px · 1px --ctl-edge). '상세' 는 줄바꿈하지 않는다 */
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    min-height: 32px;
    padding: 0 10px;
    background: var(--sheet);
    color: var(--txt);
    border: 1px solid var(--ctl-edge);
    border-radius: var(--r-chip);
    font-size: var(--fs-sm);
    white-space: nowrap;
    transition: background-color var(--dur-1) ease-out, border-color var(--dur-1) ease-out;
  }
  .ctl:hover { background: var(--raised); }
  .ctl:active { background: var(--track); }
  .ctl[aria-expanded='true'] { background: var(--raised); border-color: var(--sel); }
  .ctl :global(.car) { transition: transform var(--dur-2) var(--ease); }
  .ctl :global(.car.up) { transform: rotate(180deg); }
  .lnk {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--dim);
    border: 1px solid transparent;
    border-radius: var(--r-chip);
    transition: color var(--dur-1), background-color var(--dur-1);
  }
  .lnk:hover { color: var(--txt); background: var(--raised); }
  .lnk:active { background: var(--track); }

  /* 펼친 상세 — 카드 안 우물(--ink). 상세의 블록 카드들이 그 위에 뜬다 */
  .det {
    padding: var(--sp-3);
    background: var(--ink);
    border-top: 1px solid var(--grid);
    border-radius: 0 0 var(--r-md) var(--r-md);
  }
  .det[hidden] { display: none; }
  .fail { margin: 0; font-size: var(--fs-sm); color: var(--dim); }

  .more {
    display: block;
    width: 100%;
    min-height: var(--row-h);
    padding: 0 var(--sp-3);
    text-align: left;
    color: var(--dim);
    background: var(--gutter);
    border: 1px solid var(--grid);
    border-radius: var(--r-md);
    transition: background-color var(--dur-1), color var(--dur-1);
  }
  .more:hover { background: var(--raised); color: var(--txt); }
  .more:active { background: var(--track); }

  @media (pointer: coarse) {
    .ctl, .lnk { min-height: 44px; }
    .lnk { width: 44px; }
  }
  /* 좁은 폭: 두 팀이 위아래로. 동작은 위 줄 오른쪽 그대로 */
  @media (max-width: 900px) {
    .row {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        'hd act'
        'win win'
        'loss loss';
    }
    .vs { display: none; }
  }
  /* 폰: 다섯 칩이 한 줄을 나누면 이름이 한 글자만 남는다(실측 'C…') — 칩을 내용 폭으로 두고 줄을 바꾼다 */
  @media (max-width: 640px) {
    .row { padding: var(--sp-2) 10px 10px; }
    .pl, .pl.has-mvp { max-width: 100%; }
    .pn { max-width: 7ch; }
    .det { padding: var(--sp-2); }
  }
  @media (forced-colors: active) {
    .res { border: 1px solid CanvasText; }
    .pl::before { forced-color-adjust: none; border: 1px solid CanvasText; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ctl, .lnk, .more, .ctl :global(.car) { transition: none; }
  }
</style>
