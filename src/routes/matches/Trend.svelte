<script lang="ts">
  /**
   * 경향 — 진영 · 시간대 · 경기 길이. 카드(Panel) 넷:
   * 진영별 승률(블루·레드 — 한 경기에 블루 1 · 레드 1 이라 상쇄되지 않는 실제 정보, 승률 게이지) ·
   * 멤버별 진영(양쪽 다 출전한 사람만, 차이 절댓값 순) · 시간대별 판수(승률 열 없음 — 내전은 우리끼리
   * 5대5 라 어느 시간대든 승패가 정확히 상쇄되어 항상 50% 다) · 경기 길이별 승률(구간 판수 병기).
   *
   * 승률 칸의 색은 승률 단계(Wilson 구간)의 글자색 + 기호(▲▼) — 점추정으로 칠하지 않는다. 그 칸 판수가
   * 문턱 미만이면 옅은 글자(1판 0% 를 빨갛게 칠하면 "짧은 판에 약하다" 로 읽힌다).
   */
  import type { GuildPayload } from '$lib/data/types';
  import { gapText, trendRows, wrCell, type DurationRow, type SidePlayerRow, type SideTeamRow } from '$lib/matches';
  import { mLabel } from '$lib/metrics';
  import type { Col } from '$lib/table';
  import { WR_MARK, WR_WORD, wrText } from '$lib/tier';
  import DataTable from '$components/DataTable.svelte';
  import Panel from '$components/Panel.svelte';
  import WinGauge from '$components/WinGauge.svelte';
  import HourBars from '$components/charts/HourBars.svelte';

  let { data }: { data: GuildPayload } = $props();

  const need = $derived(data.min_games ?? 5);
  const t = $derived(trendRows(data.fun));
  const WR = $derived(mLabel(data.metric_meta, 'winrate'));

  /** 진영 승률 칸의 글 — 거르기·보조기술용(보이는 층은 sideWr 게이지) */
  const sideText = (r: SideTeamRow) => (r.winrate == null ? '-' : wrText(r.winrate, r.games, need));
  const cellText = (w: number | null, n: number) => wrCell(w, n, need)?.text ?? '-';

  const sideCols = $derived<Col<SideTeamRow>[]>([
    { k: 'side', h: '진영', hlp: '진영' },
    { k: 'games', h: '판', num: true },
    { k: 'wins', h: '승', num: true },
    { k: 'losses', h: '패', num: true },
    { k: 'winrate', h: WR, cell: sideWr, fmt: (_v, r) => sideText(r) },
  ]);
  const playerCols = $derived<Col<SidePlayerRow>[]>([
    { k: 'name', h: '멤버' },
    { k: 'blueG', h: '블루 판', num: true, lo: true },
    { k: 'blueW', h: '블루 승', num: true, lo: true },
    { k: 'blueWr', h: `블루 ${WR}`, num: true, cell: blueWr, fmt: (_v, r) => cellText(r.blueWr, r.blueG) },
    { k: 'redG', h: '레드 판', num: true, lo: true },
    { k: 'redW', h: '레드 승', num: true, lo: true },
    { k: 'redWr', h: `레드 ${WR}`, num: true, cell: redWr, fmt: (_v, r) => cellText(r.redWr, r.redG) },
    { k: 'gap', h: '차이', num: true, nullLast: true, fmt: (v) => gapText(v as number | null) },
  ]);
  const durCols = $derived<Col<DurationRow>[]>([
    { k: 'name', h: '멤버' },
    { k: 'games', h: '판', num: true },
    { k: 'shortWr', h: '~25분', num: true, hlp: '길이', nullLast: true, cell: shortWr, fmt: (_v, r) => cellText(r.shortWr, r.shortG) },
    { k: 'midWr', h: '25~35분', num: true, nullLast: true, cell: midWr, fmt: (_v, r) => cellText(r.midWr, r.midG) },
    { k: 'longWr', h: '35분~', num: true, nullLast: true, cell: longWr, fmt: (_v, r) => cellText(r.longWr, r.longG) },
  ]);
</script>

<!-- 승률(판수) 칸 — 단계 글자색 + 기호, 판수는 옅게. 문턱 미만은 '표본 적음'을 글로(옅은 색만으로 가르지 않는다). 판 0 이면 '-' -->
{#snippet wrg(w: number | null, n: number)}
  {@const c = wrCell(w, n, need)}
  {#if c}<span class="wg" class:few={c.step === 'few'}><span class="st-{c.step}">{c.pct}{#if WR_MARK[c.step]}<span class="mk">{WR_MARK[c.step]}</span>{/if}</span><span class="g">({c.games})</span>{#if c.step === 'few'}<span class="fw">{WR_WORD.few}</span>{/if}</span>{:else}-{/if}
{/snippet}
{#snippet sideWr(r: SideTeamRow)}{#if r.winrate != null}<WinGauge w={r.winrate} n={r.games} minGames={need} />{:else}-{/if}{/snippet}
{#snippet blueWr(r: SidePlayerRow)}{@render wrg(r.blueWr, r.blueG)}{/snippet}
{#snippet redWr(r: SidePlayerRow)}{@render wrg(r.redWr, r.redG)}{/snippet}
{#snippet shortWr(r: DurationRow)}{@render wrg(r.shortWr, r.shortG)}{/snippet}
{#snippet midWr(r: DurationRow)}{@render wrg(r.midWr, r.midG)}{/snippet}
{#snippet longWr(r: DurationRow)}{@render wrg(r.longWr, r.longG)}{/snippet}

<div class="trend">
  <div class="pair">
    <Panel title="진영별 승률" level={3}>
      <DataTable rows={t.sides} cols={sideCols} caption="진영별 승률" captionHidden sortKey="key" sortDir={1} filter={false} fold={false} rowNumbers={false} />
      <p class="note">한 경기에 블루 1팀 · 레드 1팀이므로 두 진영 승수의 합이 경기 수입니다. 표본이 작으면 크게 흔들리므로 경기 수를 함께 확인합니다.</p>
    </Panel>
    <Panel title="시간대별 판수" level={3}>
      <HourBars rows={t.hours} captionHidden />
      <p class="note">내전은 승패가 상쇄되어 시간대별 승률이 항상 50% 입니다. 대신 시간대별 참여 판수를 봅니다.</p>
    </Panel>
  </div>

  <Panel title="멤버별 진영 성적" level={3}>
    <DataTable rows={t.players} cols={playerCols} caption="멤버별 진영 성적" captionHidden sortKey="absGap" />
    <p class="note">양쪽 진영에 모두 출전한 멤버만 표시합니다. 차이 = 블루 승률 − 레드 승률(%p), 절댓값이 큰 순입니다. 괄호 안은 그 진영 판수이며 {need}판 미만은 옅게 '표본 적음'으로 표시합니다.</p>
  </Panel>

  <Panel title="경기 길이별 승률" level={3}>
    <!-- rows2: 390px 에서 409px(실측) — 폰은 2줄 장부 행 -->
    <DataTable rows={t.duration} cols={durCols} caption="경기 길이별 승률" captionHidden sortKey="games" rows2 />
    <p class="note">경기 시간을 25분 · 35분 기준으로 나눈 구간별 승률입니다. 괄호 안은 그 구간의 판수이며 {need}판 미만은 옅게 '표본 적음'으로 표시합니다.</p>
  </Panel>
</div>

<style>
  .trend { display: grid; gap: var(--sp-4); min-width: 0; }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-4);
    align-items: start;
  }
  .note { margin: 0; padding-top: var(--sp-2); font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; }
  /* 승률(판수) 칸 — 승률은 단계 글자색(전역 .st-*)·문턱 이상 단계만 굵게, 판수는 옅은 괄호 */
  .wg { display: inline-flex; align-items: baseline; gap: 3px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .wg .st-up2, .wg .st-down2 { font-weight: 700; }
  .mk { margin-left: 2px; font-size: .72em; letter-spacing: -.05em; }
  .g { color: var(--dim); }
  /* 문턱 미만: '표본 적음'은 값 아래 줄(오른쪽 맞춤, 12px) — 한 줄이면 칸이 55px 넓어져 멤버별 진영 표가 390px 에서
     71px 넘쳤다(실측). 격자라 칸 폭은 두 줄 중 넓은 쪽뿐이다(줄바꿈 flex 는 한 줄 폭을 그대로 잡는다) */
  .wg.few { display: inline-grid; grid-template-columns: 1fr auto; column-gap: 3px; }
  .wg.few > :first-child { justify-self: end; }   /* 남는 폭은 첫 칸이 먹고 승률은 판수 옆에 붙는다 */
  .fw { grid-column: 1 / -1; justify-self: end; font-size: var(--fs-xs); line-height: 1.4; color: var(--dim2); }
  @media (max-width: 640px) {
    .trend { gap: var(--sp-3); }
    .pair { grid-template-columns: minmax(0, 1fr); gap: var(--sp-3); }
  }
</style>
