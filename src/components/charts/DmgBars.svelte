<script lang="ts">
  /**
   * 딜량 — 팀별 격자 표 둘을 나란히(폰에서는 위아래). 막대는 별도 요소 없이 셀 바탕(--bar 너비,
   * DataTable 과 같은 그라디언트 문법)이고 색은 그 팀의 **결과**(이긴 팀 --win · 진 팀 --loss, 22%).
   * 눈금은 양 팀 통틀어 최대 딜 — 두 표를 견줄 수 있어야 한다. 값은 항상 글자로도 있다.
   */
  import type { MatchDetailTeam } from '$lib/data/types';
  import { kilo } from '$lib/fmt';
  import { type ChampKo, scoreboardRows, teamLabel } from '$lib/matches';
  import ChampImg from '$components/ChampImg.svelte';

  interface Props {
    teams: readonly MatchDetailTeam[];
    champKo?: ChampKo;
    patch?: string | null;
    caption?: string;
  }
  let { teams, champKo = null, patch = null, caption = '딜량' }: Props = $props();

  const sheets = $derived(teams.map((t, i) => ({
    key: String(t.team_id ?? i),
    label: teamLabel(t, i),
    win: !!t.win,
    rows: scoreboardRows(t, champKo),
  })));
  const max = $derived(Math.max(1, ...sheets.flatMap((s) => s.rows.map((r) => r.dmg))));
  const bar = (v: number) => `${Math.round(Math.max(0, Math.min(1, v / max)) * 1000) / 10}%`;
</script>

<div class="dmg">
  <div class="cap">{caption}</div>
  <div class="pair">
    {#each sheets as s (s.key)}
      <table aria-label="{caption} · {s.label} · {s.win ? '승' : '패'}">
        <thead>
          <tr>
            <th scope="col" class="c0">{s.label} · {s.win ? '승' : '패'}</th>
            <th scope="col" class="num">딜</th>
          </tr>
        </thead>
        <tbody>
          {#each s.rows as r (r.key)}
            <tr>
              <td class="c0 {r.laneCls}"><ChampImg name={r.champ} {patch} />{r.name}</td>
              <td class="num bar {s.win ? 'win' : 'loss'}" style:--bar={bar(r.dmg)}>{kilo(r.dmg)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/each}
  </div>
</div>

<style>
  .dmg { width: 100%; min-width: 0; }
  .cap {
    font-size: var(--fs-xs);
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0 var(--sp-3);
  }
  table {
    --bar: 0%;
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-variant-numeric: tabular-nums;
    table-layout: fixed;
  }
  th, td {
    height: var(--row-h);
    padding: 0 var(--sp-2);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
    border-bottom: 1px solid var(--grid);
    border-right: 1px solid var(--grid);
  }
  th:first-child, td:first-child { border-left: 1px solid var(--grid); }
  thead th {
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-xs);
    font-weight: 500;
    border-top: 1px solid var(--grid-strong);
    border-bottom: 1px solid var(--grid-strong);
  }
  .num { text-align: right; width: 10ch; overflow: visible; }
  td.c0 { border-right: 1px solid var(--grid-strong); }
  td :global(.champ) { margin-right: var(--sp-1); }
  td.lane-top { box-shadow: inset 3px 0 0 var(--lane-top); }
  td.lane-jg { box-shadow: inset 3px 0 0 var(--lane-jg); }
  td.lane-mid { box-shadow: inset 3px 0 0 var(--lane-mid); }
  td.lane-bot { box-shadow: inset 3px 0 0 var(--lane-bot); }
  td.lane-sup { box-shadow: inset 3px 0 0 var(--lane-sup); }
  tbody tr { transition: background-color .12s; }
  tbody tr:hover { background: var(--raised); }
  /* 데이터 막대 — 셀 바탕, 색은 결과 토큰 22% */
  td.bar.win { background: linear-gradient(to right, color-mix(in srgb, var(--win) 22%, transparent) var(--bar), transparent var(--bar)); }
  td.bar.loss { background: linear-gradient(to right, color-mix(in srgb, var(--loss) 22%, transparent) var(--bar), transparent var(--bar)); }
  @media (max-width: 640px) {
    .pair { grid-template-columns: 1fr; gap: var(--sp-3) 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    tbody tr { transition: none; }
  }
</style>
