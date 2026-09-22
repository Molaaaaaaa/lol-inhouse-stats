<script lang="ts">
  /**
   * 경향 — 진영 · 시간대 · 경기 길이. 이름 있는 범위 넷:
   * 진영별 승률(블루·레드 — 한 경기에 블루 1 · 레드 1 이라 상쇄되지 않는 실제 정보) ·
   * 멤버별 진영(양쪽 다 출전한 사람만, 차이 절댓값 순) · 시간대별 판수(승률 열 없음 — 내전은 우리끼리
   * 5대5 라 어느 시간대든 승패가 정확히 상쇄되어 항상 50% 다) · 경기 길이별 승률(구간 판수 병기,
   * 문턱 미만은 옅게 — 1판 0% 를 빨갛게 칠하면 "짧은 판에 약하다" 로 읽힌다).
   */
  import type { GuildPayload } from '$lib/data/types';
  import { pct } from '$lib/fmt';
  import { gapText, trendRows, wrCellCls, wrWithGames, type DurationRow, type SidePlayerRow, type SideTeamRow } from '$lib/matches';
  import { mLabel } from '$lib/metrics';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import HourBars from '$components/charts/HourBars.svelte';

  let { data }: { data: GuildPayload } = $props();

  const need = $derived(data.min_games ?? 5);
  const t = $derived(trendRows(data.fun));
  const WR = $derived(mLabel(data.metric_meta, 'winrate'));

  const sideCols = $derived<Col<SideTeamRow>[]>([
    { k: 'side', h: '진영', hlp: '진영' },
    { k: 'games', h: '판', num: true },
    { k: 'wins', h: '승', num: true },
    { k: 'losses', h: '패', num: true },
    { k: 'winrate', h: WR, num: true, bar: true, fmt: (v) => (v == null ? '-' : pct(v as number)), cls: (r) => wrCellCls(r.winrate, r.games, need) },
  ]);
  const playerCols = $derived<Col<SidePlayerRow>[]>([
    { k: 'name', h: '멤버' },
    { k: 'blueG', h: '블루 판', num: true, lo: true },
    { k: 'blueW', h: '블루 승', num: true, lo: true },
    { k: 'blueWr', h: `블루 ${WR}`, num: true, fmt: (v, r) => wrWithGames(v as number | null, r.blueG), cls: (r) => wrCellCls(r.blueWr, r.blueG, need) },
    { k: 'redG', h: '레드 판', num: true, lo: true },
    { k: 'redW', h: '레드 승', num: true, lo: true },
    { k: 'redWr', h: `레드 ${WR}`, num: true, fmt: (v, r) => wrWithGames(v as number | null, r.redG), cls: (r) => wrCellCls(r.redWr, r.redG, need) },
    { k: 'gap', h: '차이', num: true, nullLast: true, fmt: (v) => gapText(v as number | null) },
  ]);
  const durCols = $derived<Col<DurationRow>[]>([
    { k: 'name', h: '멤버' },
    { k: 'games', h: '판', num: true },
    { k: 'shortWr', h: '~25분', num: true, hlp: '길이', nullLast: true, fmt: (v, r) => wrWithGames(v as number | null, r.shortG), cls: (r) => wrCellCls(r.shortWr, r.shortG, need) },
    { k: 'midWr', h: '25~35분', num: true, nullLast: true, fmt: (v, r) => wrWithGames(v as number | null, r.midG), cls: (r) => wrCellCls(r.midWr, r.midG, need) },
    { k: 'longWr', h: '35분~', num: true, nullLast: true, fmt: (v, r) => wrWithGames(v as number | null, r.longG), cls: (r) => wrCellCls(r.longWr, r.longG, need) },
  ]);
</script>

<div class="trend">
  <div class="pair">
    <div class="range">
      <DataTable rows={t.sides} cols={sideCols} caption="진영별 승률" sortKey="key" sortDir={1} filter={false} fold={false} rowNumbers={false} />
      <p class="note">한 경기에 블루 1팀 · 레드 1팀이므로 두 진영 승수의 합이 경기 수입니다. 표본이 작으면 크게 흔들리므로 경기 수를 함께 확인합니다.</p>
    </div>
    <div class="range">
      <HourBars rows={t.hours} />
      <p class="note">내전은 승패가 상쇄되어 시간대별 승률이 항상 50% 입니다. 대신 시간대별 참여 판수를 봅니다.</p>
    </div>
  </div>

  <div class="range">
    <DataTable rows={t.players} cols={playerCols} caption="멤버별 진영 성적" sortKey="absGap" />
    <p class="note">양쪽 진영에 모두 출전한 멤버만 표시합니다. 차이 = 블루 승률 − 레드 승률(%p), 절댓값이 큰 순입니다. 괄호 안은 그 진영 판수이며 {need}판 미만은 옅게 표시합니다.</p>
  </div>

  <div class="range">
    <!-- rows2: 390px 에서 409px(실측) — 폰은 2줄 장부 행 -->
    <DataTable rows={t.duration} cols={durCols} caption="경기 길이별 승률" sortKey="games" rows2 />
    <p class="note">경기 시간을 25분 · 35분 기준으로 나눈 구간별 승률입니다. 괄호 안은 그 구간의 판수이며 {need}판 미만은 옅게 표시합니다.</p>
  </div>
</div>

<style>
  .trend { display: grid; gap: var(--sp-4); min-width: 0; }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-4);
    align-items: start;
  }
  .range { display: grid; gap: var(--sp-2); min-width: 0; }
  .note { margin: 0; font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; }
  /* 문턱 미만 승률 셀 — DataTable 이 cls 로 받은 클래스. 채움 없이 글자만 옅게 */
  .trend :global(td.wr-dim) { color: var(--dim); }
  @media (max-width: 640px) {
    .pair { grid-template-columns: 1fr; }
  }
</style>
