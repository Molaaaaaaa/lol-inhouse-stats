<script lang="ts">
  /**
   * 딜량 — 팀별 표 둘을 나란히(폰에서는 위아래). 값 칸은 숫자 아래 막대(셀의 --bar 너비)이고 모양은 그 팀의
   * **결과**다: 이긴 팀은 승 색 그라디언트, 진 팀은 패 색 사선 무늬(색만으로 가르지 않는다 — 표 머리에 '승'·'패').
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
              <td class="num bar {s.win ? 'win' : 'loss'}" style:--bar={bar(r.dmg)}>{kilo(r.dmg)}<span class="trk" aria-hidden="true"><i></i></span></td>
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
    font-size: var(--fs-sm); font-weight: 700;
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0 var(--sp-4);
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
  }
  tbody tr:last-child td { border-bottom-color: transparent; }
  thead th {
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-sm);
    font-weight: 700;
    border-bottom: 1px solid var(--grid-strong);
  }
  thead th:first-child { border-top-left-radius: var(--r-md); }
  thead th:last-child { border-top-right-radius: var(--r-md); }
  .num { text-align: right; width: 42%; }
  td.c0 { font-weight: 700; }
  td :global(.champ) { margin-right: var(--sp-1); }
  td.lane-top { border-left: 3px solid var(--lane-top); }
  td.lane-jg { border-left: 3px solid var(--lane-jg); }
  td.lane-mid { border-left: 3px solid var(--lane-mid); }
  td.lane-bot { border-left: 3px solid var(--lane-bot); }
  td.lane-sup { border-left: 3px solid var(--lane-sup); }
  tbody tr { transition: background-color var(--dur-1); }
  tbody tr:hover { background: color-mix(in srgb, var(--raised) 70%, transparent); }
  /* 데이터 막대 — 숫자 아래 둥근 트랙, 채움 너비는 셀의 --bar(인라인). 이긴 팀은 그라디언트, 진 팀은 사선 무늬 */
  td.bar { padding-top: 3px; line-height: 1.3; }
  .trk {
    display: block;
    height: 5px;
    margin-top: 3px;
    overflow: hidden;
    border-radius: var(--r-pill);
    background: var(--track);
  }
  .trk i { display: block; width: var(--bar); height: 100%; }
  td.win .trk i { background: var(--grad-win); }
  td.loss .trk i { background: var(--hatch-loss); }
  @media (max-width: 640px) {
    .pair { grid-template-columns: 1fr; gap: var(--sp-3) 0; }
  }
  @media (forced-colors: active) {
    .trk { forced-color-adjust: none; background: Canvas; outline: 1px solid CanvasText; }
    td.win .trk i { background: Highlight; }
    td.loss .trk i { background: CanvasText; }
  }
  @media (prefers-reduced-motion: reduce) {
    tbody tr { transition: none; }
  }
</style>
