<script lang="ts">
  /**
   * 경기 상세 — 목록 안에서 펼쳐지거나(`#/matches` 의 '상세' 버튼) 단독 주소(`#/matches/슬러그`)로.
   * 위에서부터: 팀 합계 표(킬·골드·오브젝트·밴) → 스코어보드(팀마다 격자 하나, 라인 순) → 골드 추이 →
   * 딜량 → 킬 지도 + 킬 기록 표.
   *
   * 스코어보드는 DataTable 이 아니라 같은 문법의 표다 — 셀에 아이템 이미지·펼침 버튼이 들어가고
   * 행 아래에 세부 행(타임라인·빌드 오더·세부 기록)이 붙어야 하는데 DataTable 셀은 글자·초상만 받는다.
   * 멤버 행의 펼침 버튼(aria-expanded)이 세부 행을 열고, 행 선택은 수식 줄에 `=KDA(k+a)/d = kda`.
   *
   * 스크린샷 기록에는 오브젝트·밴이 아예 없다. 0 으로 그리면 '한 번도 못 먹었다' 로 읽히므로
   * payload 의 objectives_available·ban_available 이 꺼져 있으면 열 자체를 빼고 사유를 적는다.
   */
  import type { GuildPayload, MatchDetail } from '$lib/data/types';
  import { kilo, mmss } from '$lib/fmt';
  import { mLabel } from '$lib/metrics';
  import { announce } from '$lib/a11y';
  import { setFx } from '$lib/fx.svelte';
  import {
    buildRows, extraRows, fxKda, itemImgUrl, killDots, scoreboardRows, teamLabel, teamTotals, type KillDot, type ScoreRow,
  } from '$lib/matches';
  import type { Col } from '$lib/table';
  import ChampImg from '$components/ChampImg.svelte';
  import DataTable from '$components/DataTable.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import Icon from '$components/Icon.svelte';
  import GoldChart from '$components/charts/GoldChart.svelte';
  import DmgBars from '$components/charts/DmgBars.svelte';
  import KillMap from '$components/charts/KillMap.svelte';
  import KdaTimeline from '$components/charts/KdaTimeline.svelte';

  interface Props {
    detail: MatchDetail;
    data: GuildPayload;
    slug: string;
  }
  let { detail, data, slug }: Props = $props();

  const uid = $props.id();
  const patch = $derived(data.patch);
  const ko = $derived(data.champ_ko);
  const meta = $derived(data.metric_meta);
  const teams = $derived(detail.teams ?? []);
  const hasObj = $derived(!!data.objectives_available);
  const hasBan = $derived(!!data.ban_available);
  const totals = $derived(teamTotals(teams, hasObj, hasBan));
  const boards = $derived(teams.map((t, i) => ({
    key: String(t.team_id ?? i), label: teamLabel(t, i), win: !!t.win, rows: scoreboardRows(t, ko),
  })));
  const missing = $derived([hasObj ? null : '드래곤 · 바론 · 타워', hasBan ? null : '밴'].filter(Boolean).join(', '));

  // ── 스코어보드 행 펼침 · 선택 ──
  let open = $state('');
  function toggle(r: ScoreRow) {
    const next = open === r.key ? '' : r.key;
    open = next;
    setFx(fxKda(r));
    announce(next ? `${r.name} 세부 기록 펼침` : `${r.name} 세부 기록 접힘`);
  }
  const panelId = (r: ScoreRow) => `${uid}-pd-${r.key}`;
  const SB_COLS = 13;   // rn 제외 열 수 — 세부 행 colspan

  // ── 킬 지도 · 킬 기록 ──
  const dots = $derived(killDots(detail.kills, teams));
  let killSel = $state(-1);
  const TEAM_KO: Readonly<Record<KillDot['cls'], string>> = { win: '이긴 팀', loss: '진 팀', exec: '처형' };
  const killCols: Col<KillDot>[] = [
    { k: 'm', h: '분', num: true, fmt: (v) => `${v}분` },
    { k: 'killer', h: '잡은 멤버' },
    { k: 'victim', h: '잡힌 멤버' },
    { k: 'cls', h: '팀', fmt: (v) => TEAM_KO[v as KillDot['cls']] ?? '', cls: (r) => (r.cls === 'exec' ? '' : r.cls) },
  ];
  function pickKill(_r: KillDot, key: string) {
    killSel = killSel === Number(key) ? -1 : Number(key);
  }

  const hasTimeline = $derived((detail.timeline?.minutes?.length ?? 0) > 1);

  // 세부 행의 폭 — 표 셀은 내용만큼 넓어지므로(차트가 셀을, 셀이 표를 키운다) 화면 폭을 재서 못 박는다.
  // 표가 가로로 넘칠 때(폰)도 세부 행은 sticky left 로 보이는 자리에 남는다.
  let rootW = $state(0);
  const RN_W = 36, PD_PAD = 24;
  const pdWidth = $derived(rootW > 0 ? `${Math.max(240, rootW - RN_W - PD_PAD)}px` : undefined);
</script>

<div class="detail" data-slug={slug} bind:clientWidth={rootW}>
  {#if teams.length < 2}
    {#if hasTimeline}
      <GoldChart timeline={detail.timeline} {teams} />
    {:else}
      <EmptyState text="이 경기의 상세 기록이 없습니다." />
    {/if}
  {:else}
    <!-- 팀 합계 -->
    <div class="sheet">
      <div class="cap">팀 합계 · 경기 길이 {mmss(detail.duration)}</div>
      <table aria-label="팀 합계">
        <thead>
          <tr>
            <th scope="col" class="c0">팀</th>
            <th scope="col">결과</th>
            <th scope="col" class="num">킬</th>
            <th scope="col" class="num">데스</th>
            <th scope="col" class="num">어시</th>
            <th scope="col" class="num">골드</th>
            {#if hasObj}
              <th scope="col" class="num">타워</th>
              <th scope="col" class="num">드래곤</th>
              <th scope="col" class="num">바론</th>
              <th scope="col" class="num">전령</th>
              <th scope="col" class="num">유충</th>
            {/if}
            {#if hasBan}<th scope="col">밴</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each totals as t (t.key)}
            <tr>
              <td class="c0">{t.label}</td>
              <td class={t.win ? 'win' : 'loss'}>{t.res}</td>
              <td class="num">{t.kills}</td>
              <td class="num">{t.deaths}</td>
              <td class="num">{t.assists}</td>
              <td class="num">{kilo(t.gold)}</td>
              {#if hasObj}
                <td class="num">{t.towers}</td>
                <td class="num">{t.dragons}</td>
                <td class="num">{t.barons}</td>
                <td class="num">{t.heralds}</td>
                <td class="num">{t.grubs}</td>
              {/if}
              {#if hasBan}
                <td class="bans">
                  {#each t.bans as c, i (`${c}-${i}`)}
                    <ChampImg name={c} {patch} />
                  {:else}
                    <span class="muted">-</span>
                  {/each}
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
      {#if missing}
        <p class="note">종료 화면에 없는 정보: {missing} — 라이엇 프로덕션 키 승인 후 표시됩니다.</p>
      {/if}
    </div>

    <!-- 스코어보드 -->
    {#each boards as b (b.key)}
      <div class="sheet">
        <div class="cap">스코어보드 · {b.label} · {b.win ? '승' : '패'}</div>
        <table aria-label="스코어보드 · {b.label} · {b.win ? '승' : '패'}">
          <thead>
            <tr>
              <th class="rn" aria-hidden="true"></th>
              <th scope="col" class="c0">멤버</th>
              <th scope="col">라인</th>
              <th scope="col">챔피언</th>
              <th scope="col" class="num">K/D/A</th>
              <th scope="col" class="num">{mLabel(meta, 'kda')}</th>
              <th scope="col" class="num">CS</th>
              <th scope="col" class="num">골드</th>
              <th scope="col" class="num">{mLabel(meta, 'total_dmg')}</th>
              <th scope="col" class="num">{mLabel(meta, 'dmg_taken')}</th>
              <th scope="col" class="num">{mLabel(meta, 'vision')}</th>
              <th scope="col">아이템</th>
              <th scope="col" class="lo xl">스펠</th>
              <th scope="col" class="lo xl">룬</th>
            </tr>
          </thead>
          <tbody>
            {#each b.rows as r, i (r.key)}
              {@const on = open === r.key}
              <tr class="sb" class:sel={on} onclick={() => toggle(r)}>
                <td class="rn" aria-hidden="true">{i + 1}</td>
                <td class="c0 name">
                  <button type="button" class="exp" aria-expanded={on} aria-controls={panelId(r)}
                          aria-label="{r.name} 세부 기록" onclick={(e) => { e.stopPropagation(); toggle(r); }}>
                    <Icon name="chevron-down" class={on ? 'car up' : 'car'} />
                  </button>
                  <ChampImg name={r.champ} {patch} />{r.name}
                </td>
                <td class={r.laneCls}>{r.laneKo}</td>
                <td>{r.champKo}</td>
                <td class="num">{r.kdaText}</td>
                <td class="num">{r.kda}</td>
                <td class="num">{r.cs}</td>
                <td class="num">{kilo(r.gold)}</td>
                <td class="num">{kilo(r.dmg)}</td>
                <td class="num">{kilo(r.dmgTaken)}</td>
                <td class="num">{r.vision}</td>
                <td class="items">
                  {#each r.items as id, j (j)}
                    {@const src = itemImgUrl(patch, id)}
                    <span class="slot">{#if src}<img class="itemslot" {src} loading="lazy" decoding="async" alt="" width="20" height="20" />{/if}</span>
                  {/each}
                  {#if r.trinket}
                    {@const src = itemImgUrl(patch, r.trinket)}
                    <span class="slot trk">{#if src}<img class="itemslot" {src} loading="lazy" decoding="async" alt="" width="20" height="20" />{/if}</span>
                  {/if}
                </td>
                <td class="lo xl">{r.spells || '-'}</td>
                <td class="lo xl">{r.perks || '-'}</td>
              </tr>
              {#if on}
                {@const build = buildRows(r.raw.build)}
                {@const extra = extraRows(r.raw.extra, meta)}
                <tr class="pd" id={panelId(r)}>
                  <td class="rn" aria-hidden="true"></td>
                  <td colspan={SB_COLS}>
                    <div class="pdwrap" style:width={pdWidth}>
                      <p class="pdline"><span class="muted">소환사 주문</span> {r.spells || '-'} <span class="sep">·</span> <span class="muted">룬</span> {r.perks || '-'}</p>
                      <KdaTimeline events={r.raw.kda_events} duration={detail.duration} champKo={ko} name={r.name} />
                      <div class="cap">아이템 구매 순서 <span class="muted">— 산 순서입니다. ✕ 는 되판 것</span></div>
                      {#if build.length}
                        <ol class="build">
                          {#each build as x (x.i)}
                            {@const src = itemImgUrl(patch, x.item)}
                            <li class="bitem" class:sold={x.sold} title="{x.minute}분{x.sold ? ' · 되팖' : ''}">
                              <span class="slot">{#if src}<img class="itemslot" {src} loading="lazy" decoding="async" alt="" width="24" height="24" />{/if}</span>
                              <i>{x.minute}′</i>
                              {#if x.sold}<b class="x" aria-label="되팖">✕</b>{/if}
                            </li>
                          {/each}
                        </ol>
                      {:else}
                        <p class="muted none">구매 기록이 없습니다.</p>
                      {/if}
                      <div class="cap">이 판의 세부 기록</div>
                      {#if extra.length}
                        <dl class="cells">
                          {#each extra as x (x.key)}
                            <div class="cell"><dt>{x.label}</dt><dd>{x.text}</dd></div>
                          {/each}
                        </dl>
                      {:else}
                        <p class="muted none">아직 세부 기록이 없습니다.</p>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
    <p class="note">멤버 행의 펼침 버튼은 그 멤버의 킬 · 데스 · 어시 타임라인, 아이템 구매 순서, 세부 기록을 엽니다. 행을 선택하면 KDA 계산 근거가 수식 줄에 보입니다.</p>

    {#if hasTimeline}
      <GoldChart timeline={detail.timeline} {teams} />
    {/if}

    <DmgBars {teams} champKo={ko} {patch} />

    {#if dots.length}
      <div class="kills">
        <KillMap {dots} selected={killSel} />
        <DataTable rows={dots} cols={killCols} caption="킬 기록 · {dots.length}킬" sortKey="m" sortDir={1} lowerBetterKeys={['m']}
                   rowKey={(r) => String(r.i)} selectedKey={killSel >= 0 ? String(killSel) : undefined} onselect={pickKill} filter={false} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .detail { display: grid; gap: var(--sp-3); min-width: 0; container-type: inline-size; }

  /* 격자 — DataTable 과 같은 규칙. 넘치면 표만 가로 스크롤(첫 열 sticky) */
  .sheet { --rn-w: 36px; overflow-x: auto; background: var(--sheet); }
  .cap {
    position: sticky;
    left: 0;
    font-size: var(--fs-xs);
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  th, td {
    height: var(--row-h);
    padding: 0 var(--sp-2);
    text-align: left;
    white-space: nowrap;
    vertical-align: middle;
    border-bottom: 1px solid var(--grid);
    border-right: 1px solid var(--grid);
    transition: background-color .12s;
  }
  th:first-child, td:first-child { border-left: 1px solid var(--grid); }
  .num { text-align: right; }
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
  }
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
    left: 0;
    z-index: 1;
    background: var(--sheet);
    border-right: 1px solid var(--grid-strong);
  }
  .rn + .c0 { left: var(--rn-w); }
  thead .c0 { z-index: 3; background: var(--gutter); }
  td :global(.champ) { margin-right: var(--sp-1); }

  /* 조건부 서식 — 결과·라인 띠 */
  td.win { background: color-mix(in srgb, var(--win) 18%, transparent); }
  td.loss { background: color-mix(in srgb, var(--loss) 18%, transparent); }
  td.lane-top { box-shadow: inset 3px 0 0 var(--lane-top); }
  td.lane-jg { box-shadow: inset 3px 0 0 var(--lane-jg); }
  td.lane-mid { box-shadow: inset 3px 0 0 var(--lane-mid); }
  td.lane-bot { box-shadow: inset 3px 0 0 var(--lane-bot); }
  td.lane-sup { box-shadow: inset 3px 0 0 var(--lane-sup); }

  /* 스코어보드 행: 누르면 세부 행 펼침. hover 채움, 펼친 행은 2px 안쪽 선 */
  tr.sb { cursor: pointer; }
  tr.sb:hover td { background: var(--raised); }
  tr.sb:hover td.rn { background: var(--gutter); }
  tr.sb:active td:not(.rn) { background: var(--grid-strong); }
  tr.sel td:not(.rn) { box-shadow: inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }
  tr.sel td.c0 { box-shadow: inset 2px 0 0 var(--sel), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }
  tr.sel td:last-child { box-shadow: inset -2px 0 0 var(--sel), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }
  tr.sel td.lane-top { box-shadow: inset 3px 0 0 var(--lane-top), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }
  tr.sel td.lane-jg { box-shadow: inset 3px 0 0 var(--lane-jg), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }
  tr.sel td.lane-mid { box-shadow: inset 3px 0 0 var(--lane-mid), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }
  tr.sel td.lane-bot { box-shadow: inset 3px 0 0 var(--lane-bot), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }
  tr.sel td.lane-sup { box-shadow: inset 3px 0 0 var(--lane-sup), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }

  /* 펼침 버튼 — 셀 안 작은 정사각. 손가락 기기에서는 히트 영역만 44px 로 편다 */
  .exp {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    min-height: 0;
    margin-right: var(--sp-1);
    padding: 0;
    border: 1px solid var(--grid-strong);
    border-radius: var(--r-chip);
    background: var(--gutter);
    color: var(--dim);
    vertical-align: middle;
    transition: background-color .15s, color .15s, border-color .15s;
  }
  .exp:hover { background: var(--raised); color: var(--txt); }
  .exp:active { background: var(--grid-strong); }
  .exp:disabled { color: var(--dim2); border-color: var(--grid); cursor: default; }
  .exp[aria-expanded='true'] { border-color: var(--sel); color: var(--txt); }
  .exp :global(.car) { transition: transform .15s; }
  .exp :global(.car.up) { transform: rotate(180deg); }
  @media (pointer: coarse) {
    .exp::after { content: ''; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }
  }

  /* 아이템 칸 — 6칸 + 장신구, 빈 칸도 자리를 지킨다 */
  .items { padding-top: 0; padding-bottom: 0; }
  .slot {
    display: inline-block;
    width: 20px;
    height: 20px;
    vertical-align: middle;
    background: var(--ink);
    border: 1px solid var(--grid);
    margin-right: 2px;
  }
  .slot :global(img), .slot img { display: block; width: 100%; height: 100%; }
  .slot.trk { margin-left: var(--sp-1); }
  .bans :global(.champ) { margin-right: 2px; }

  /* 세부 행 — 홈통 바탕 위에 한 단 들여서 */
  tr.pd td { background: var(--gutter); white-space: normal; height: auto; padding: var(--sp-2) var(--sp-3) var(--sp-3); }
  .pdwrap { position: sticky; left: var(--sp-3); display: grid; gap: var(--sp-1); min-width: 0; }
  .pdline { font-size: var(--fs-sm); }
  .sep { color: var(--dim2); padding: 0 var(--sp-1); }
  .none { font-size: var(--fs-sm); }
  .build {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .bitem {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--sp-1);
    border: 1px solid var(--grid);
    background: var(--sheet);
  }
  .bitem .slot { width: 24px; height: 24px; margin: 0; }
  .bitem i { font-style: normal; font-size: var(--fs-xs); color: var(--dim2); font-variant-numeric: tabular-nums; }
  .bitem.sold .slot { opacity: .4; }
  .bitem .x {
    position: absolute;
    top: 2px;
    right: 3px;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--txt);
    line-height: 1;
  }
  .cells {
    display: flex;
    flex-wrap: wrap;
    margin: 0;
    border: 1px solid var(--grid);
    border-right: 0;
    background: var(--sheet);
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
  .cell dd { margin: 0; padding: var(--sp-1) var(--sp-2); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .note { margin: 0; font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; }
  .kills { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: var(--sp-3); align-items: start; }
  /* 상세가 좁으면(목록 안 펼침·폰) 지도와 킬 기록을 위아래로 */
  @container (max-width: 760px) {
    .kills { grid-template-columns: 1fr; }
  }

  /* 스펠·룬은 세부 행에도 적히므로 시트가 좁으면(목록 안 펼침 포함) 열을 뺀다 — 표가 시트를 넘지 않게.
     화면 폭이 아니라 시트 폭(컨테이너) 기준: 같은 표가 목록 안에서는 홈통만큼 좁다 */
  .sheet { container-type: inline-size; }
  @container (max-width: 1080px) {
    .xl { display: none; }
  }
  @media (max-width: 640px) {
    .lo { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    th, td, .exp, .exp :global(.car) { transition: none; }
  }
</style>
