<script lang="ts">
  /**
   * 경기 상세 — 목록 카드 안에서 펼쳐지거나(`#/matches` 의 '상세' 버튼) 단독 주소(`#/matches/슬러그`)로.
   * 블록 카드(반경 12px)가 위에서부터: 팀 대결 막대(킬 · 골드 · 오브젝트) → 팀 합계 표(킬 · 골드 · 오브젝트 · 밴) →
   * 스코어보드(팀마다 표 하나, 라인 순) → 골드 추이 → 딜량 → 킬 지도 + 킬 기록 표.
   *
   * 팀 대결 막대는 가운데 축에서 바깥으로 뻗는다. 색은 진영이 아니라 **결과** — 이긴 팀은 승 색 그라디언트,
   * 진 팀은 패 색 사선 무늬, 머리에 '승'·'패' 글자(색만으로 가르지 않는다). 왼쪽이 블루(팀 0), 오른쪽이 레드.
   *
   * 스코어보드는 DataTable 이 아니라 같은 문법의 표다 — 셀에 아이템 이미지·펼침 버튼이 들어가고
   * 행 아래에 세부 행(타임라인·빌드 오더·세부 기록)이 붙어야 하는데 DataTable 셀은 그 구조를 받지 않는다.
   * 멤버 행의 펼침 버튼(aria-expanded)이 세부 행을 열고, 행 선택은 수식 줄에 `=KDA(k+a)/d = kda`.
   * payload 의 `mvp: true` 선수(그 경기 MVP, 이긴 팀에 한 명)는 멤버 이름 뒤에 MVP 표식이 붙는다.
   *
   * 스크린샷 기록에는 오브젝트·밴이 아예 없다. 0 으로 그리면 '한 번도 못 먹었다' 로 읽히므로
   * payload 의 objectives_available·ban_available 이 꺼져 있으면 열(과 대결 막대 줄) 자체를 빼고 사유를 적는다.
   */
  import type { GuildPayload, MatchDetail } from '$lib/data/types';
  import { kilo, mmss } from '$lib/fmt';
  import { mLabel } from '$lib/metrics';
  import { media } from '$lib/media.svelte';
  import { announce } from '$lib/a11y';
  import { setFx } from '$lib/fx.svelte';
  import {
    buildRows, extraRows, fxKda, itemImgUrl, killDots, rateRows, scoreboardRows, teamLabel, teamTotals, versusRows,
    type KillDot, type ScoreRow,
  } from '$lib/matches';
  import type { Col } from '$lib/table';
  import ChampImg from '$components/ChampImg.svelte';
  import LaneChip from '$components/LaneChip.svelte';
  import DataTable from '$components/DataTable.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import Icon from '$components/Icon.svelte';
  import MvpTag from '$components/MvpTag.svelte';
  import SheetCaption from '$components/SheetCaption.svelte';
  import StatTile from '$components/StatTile.svelte';
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
  const vs = $derived(versusRows(totals));
  // kills: 그 팀 킬 — 세부 기록의 킬 관여 분모
  const boards = $derived(teams.map((t, i) => ({
    key: String(t.team_id ?? i), label: teamLabel(t, i), win: !!t.win, kills: Number(t.kills) || 0, rows: scoreboardRows(t, ko),
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
  // 빼는 폭 = 블록 카드 안쪽 여백·테두리(데스크톱 12+12+2 · 폰 8+8+2) + 번호 칸(40 · 28) + 세부 칸 좌우 여백(12+12)
  let rootW = $state(0);
  const pdWidth = $derived.by(() => {
    if (rootW <= 0) return undefined;
    const used = media.phone ? 18 + 28 + 24 : 26 + 40 + 24;
    return `${Math.max(240, rootW - used)}px`;
  });
</script>

<div class="detail" data-slug={slug} bind:clientWidth={rootW}>
  {#if teams.length < 2}
    {#if hasTimeline}
      <div class="card blk"><GoldChart timeline={detail.timeline} {teams} /></div>
    {:else}
      <EmptyState text="이 경기의 상세 기록이 없습니다." />
    {/if}
  {:else}
    <!-- 팀 대결 — 가운데 축에서 바깥으로. 보조기술은 줄마다 한 문장 -->
    {#if vs.length && totals.length === 2}
      {@const [ta, tb] = totals}
      <div class="card blk vsb">
        <div class="vh">
          <span class="tn"><b>{ta!.label}</b><span class={['tag', ta!.win ? 'win' : 'loss']}>{ta!.res}</span></span>
          <span class="vt" id="{uid}-vs">팀 대결</span>
          <span class="tn r"><span class={['tag', tb!.win ? 'win' : 'loss']}>{tb!.res}</span><b>{tb!.label}</b></span>
        </div>
        <ul class="vrows" aria-labelledby="{uid}-vs">
          {#each vs as v (v.key)}
            <li class="vr">
              <span class="sr-only">{v.label} · {ta!.label} {v.aText} · {tb!.label} {v.bText}</span>
              <span class="vv a" aria-hidden="true">{v.aText}</span>
              <span class={['vbar', 'l', ta!.win ? 'w' : 'x']} aria-hidden="true"><i style:--w="{v.aPct}%"></i></span>
              <span class="vl" aria-hidden="true">{v.label}</span>
              <span class={['vbar', 'r', tb!.win ? 'w' : 'x']} aria-hidden="true"><i style:--w="{v.bPct}%"></i></span>
              <span class="vv b" aria-hidden="true">{v.bText}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- 팀 합계 -->
    <div class="card blk">
      <div class="sheet">
        <SheetCaption caption="팀 합계 · 경기 길이 {mmss(detail.duration)}" />
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
      </div>
      {#if missing}
        <p class="note">종료 화면에 없는 정보: {missing} — 라이엇 프로덕션 키 승인 후 표시됩니다.</p>
      {/if}
    </div>

    <!-- 스코어보드 -->
    {#each boards as b (b.key)}
      <div class="card blk">
        <div class="sheet">
          <SheetCaption caption="스코어보드 · {b.label} · {b.win ? '승' : '패'}" />
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
                  <td class="rn" aria-hidden="true"><span class="rnc">{i + 1}</span></td>
                  <td class="c0 name">
                    <button type="button" class="exp" aria-expanded={on} aria-controls={panelId(r)}
                            aria-label="{r.name} 세부 기록" onclick={(e) => { e.stopPropagation(); toggle(r); }}>
                      <Icon name="chevron-down" class={on ? 'car up' : 'car'} />
                    </button>
                    <ChampImg name={r.champ} {patch} />{r.name}{#if r.mvp}<MvpTag />{/if}
                  </td>
                  <td><LaneChip lane={r.lane} /></td>
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
                  {@const extra = [...rateRows(r, b.kills, detail.duration, meta), ...extraRows(r.raw.extra, meta)]}
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
                        <dl class="cells">
                          {#each extra as x (x.key)}
                            <StatTile label={x.label} value={x.text} compact />
                          {/each}
                        </dl>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/each}
    <p class="note">멤버 행의 펼침 버튼은 그 멤버의 킬 · 데스 · 어시 타임라인, 아이템 구매 순서, 세부 기록을 엽니다. 행을 선택하면 KDA 계산 근거가 수식 줄에 보입니다.</p>

    {#if hasTimeline}
      <div class="card blk"><GoldChart timeline={detail.timeline} {teams} /></div>
    {/if}

    <div class="card blk"><DmgBars {teams} champKo={ko} {patch} /></div>

    {#if dots.length}
      <div class="card blk kills">
        <KillMap {dots} selected={killSel} />
        <!-- rows2: 390px 에서 375px(실측) — 폰은 2줄 장부 행 -->
        <DataTable rows={dots} cols={killCols} caption="킬 기록 · {dots.length}킬" sortKey="m" sortDir={1} lowerBetterKeys={['m']} rows2
                   rowKey={(r) => String(r.i)} selectedKey={killSel >= 0 ? String(killSel) : undefined} onselect={pickKill} filter={false} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .detail { display: grid; gap: var(--sp-3); min-width: 0; container-type: inline-size; }
  /* 블록 카드 — 판 위(단독 주소)든 목록 카드의 우물 안이든 같은 모양 */
  .blk { min-width: 0; padding: var(--sp-1) var(--sp-3) var(--sp-3); }

  /* ── 팀 대결 막대 ── 머리(팀 · 결과 태그) 아래 줄마다 [값 | 막대 ← 축 → 막대 | 값], 가운데 라벨 */
  .vsb { padding-top: var(--sp-3); }
  .vh {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: var(--sp-2);
    padding-bottom: var(--sp-2);
  }
  .tn { display: inline-flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; }
  .tn.r { justify-self: end; }
  .vt { font-size: var(--fs-sm); font-weight: 700; color: var(--dim); }
  .tag {
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
  .tag.win { background: color-mix(in srgb, var(--win) 20%, transparent); color: var(--win-soft); }
  .tag.loss { background: color-mix(in srgb, var(--loss) 16%, transparent); color: var(--loss-soft); }
  .vrows { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .vr {
    display: grid;
    grid-template-columns: 5.5ch minmax(0, 1fr) 4.5em minmax(0, 1fr) 5.5ch;
    align-items: center;
    gap: var(--sp-2);
    min-height: 28px;
  }
  .vv { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .vv.a { text-align: right; }
  .vl { text-align: center; font-size: var(--fs-xs); color: var(--dim); white-space: nowrap; }
  .vbar {
    display: flex;
    height: 8px;
    border-radius: var(--r-pill);
    overflow: hidden;
    background: var(--track);
  }
  .vbar.l { justify-content: flex-end; }
  .vbar i {
    --w: 0%;   /* 막대 길이 — 인라인 style:--w 가 덮어쓴다 */
    display: block;
    width: var(--w);
    min-width: 2px;
  }
  .vbar.w i { background: var(--grad-win); }
  .vbar.x i { background: var(--hatch-loss); }
  /* 왼쪽 막대는 축에서 바깥(왼쪽)으로 뻗는다 — 그라디언트도 축 쪽이 옅다 */
  .vbar.l i { transform: scaleX(-1); }

  /* ── 표(팀 합계 · 스코어보드) — DataTable 과 같은 문법: 세로선 없이 행 구분선, 머리행 --gutter 위 모서리 12px,
     번호 칩, 첫 열 sticky. 넘치면 표만 가로 스크롤 ── */
  .sheet {
    --rn-w: 40px;
    --stick: var(--sheet);
    --hover: color-mix(in srgb, var(--raised) 70%, transparent);
    --hover-stick: color-mix(in srgb, var(--raised) 70%, var(--sheet));
    position: relative;
    overflow-x: auto;
  }
  .cap {
    font-size: var(--fs-sm); font-weight: 700;
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .cap .muted { font-weight: 400; }   /* 캡션 뒤 설명 구절은 보통 굵기 */
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
    transition: background-color var(--dur-1);
  }
  tbody tr:last-child td { border-bottom-color: transparent; }
  .num { text-align: right; }
  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--gutter);
    color: var(--dim);
    font-size: var(--fs-sm);
    font-weight: 700;
    border-bottom: 1px solid var(--grid-strong);
  }
  thead th:first-child { border-top-left-radius: var(--r-md); }
  thead th:last-child { border-top-right-radius: var(--r-md); }
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
    left: 0;
    z-index: 1;
    background: var(--stick);
    border-right: 1px solid var(--grid);
  }
  td.c0 { font-weight: 700; }
  .rn + .c0 { left: var(--rn-w); }
  thead .c0 { z-index: 3; background: var(--gutter); }
  td :global(.champ) { margin-right: var(--sp-1); }
  td.name :global(.mvp) { margin-left: var(--sp-1); }

  /* 조건부 서식 — 결과 채움(DataTable 과 같은 18%). 라인 칸은 라인 점 + 이름(LaneChip) */
  td.win { background-color: color-mix(in srgb, var(--win) 18%, transparent); }
  td.loss { background-color: color-mix(in srgb, var(--loss) 18%, transparent); }

  /* 스코어보드 행: 누르면 세부 행 펼침. hover 채움, 펼친 행은 2px 안쪽 선 + 왼쪽 3px 액센트 띠 */
  tr.sb { cursor: pointer; }
  tr.sb:hover td { background-color: var(--hover); }
  tr.sb:hover td.rn, tr.sb:hover td.c0 { background-color: var(--hover-stick); }
  tr.sb:active td:not(.rn) { background-color: var(--track); }
  tr.sel td { box-shadow: inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }
  tr.sel td:last-child { box-shadow: inset -2px 0 0 var(--sel), inset 0 2px 0 var(--sel), inset 0 -2px 0 var(--sel); }
  tr.sel td.rn::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--grad-sel);
  }

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
    border: 1px solid var(--ctl-edge);
    border-radius: var(--r-chip);
    background: var(--sheet);
    color: var(--dim);
    vertical-align: middle;
    transition: background-color var(--dur-1), color var(--dur-1), border-color var(--dur-1);
  }
  .exp:hover { background: var(--raised); color: var(--txt); }
  .exp:active { background: var(--track); }
  .exp[aria-expanded='true'] { border-color: var(--sel); color: var(--txt); }
  .exp :global(.car) { transition: transform var(--dur-2) var(--ease); }
  .exp :global(.car.up) { transform: rotate(180deg); }
  @media (pointer: coarse) {
    .exp::after { content: ''; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }
  }

  /* 아이템 칸 — 6칸 + 장신구, 빈 칸도 자리를 지킨다 */
  .slot {
    display: inline-block;
    width: 20px;
    height: 20px;
    vertical-align: middle;
    overflow: hidden;
    background: var(--ink);
    border: 1px solid var(--grid);
    border-radius: var(--r-xs);
    margin-right: 2px;
  }
  .slot :global(img), .slot img { display: block; width: 100%; height: 100%; }
  .slot.trk { margin-left: var(--sp-1); }
  .bans :global(.champ) { margin-right: 2px; }

  /* 세부 행 — 우물(--ink) 위에 타임라인 · 구매 순서 · 세부 기록 타일 */
  tr.pd td { background: var(--ink); white-space: normal; height: auto; padding: var(--sp-2) var(--sp-3) var(--sp-3); }
  tr.pd td.rn { background: var(--stick); }
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
    border-radius: var(--r-chip);
    background: var(--gutter);
  }
  .bitem .slot { width: 24px; height: 24px; margin: 0; }
  .bitem i { font-style: normal; font-size: var(--fs-sm); color: var(--dim); font-variant-numeric: tabular-nums; }
  .bitem.sold .slot { opacity: .4; }
  .bitem .x {
    position: absolute;
    top: 2px;
    right: 3px;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--txt);
    line-height: 1;
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: 6px;
    margin: 0;
  }

  .note { margin: 0; font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; }
  .blk > .note { padding-top: var(--sp-2); }
  .kills { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: var(--sp-3); align-items: start; }
  /* 상세가 좁으면(목록 안 펼침·폰) 지도와 킬 기록을 위아래로 */
  @container (max-width: 760px) {
    .kills { grid-template-columns: 1fr; }
  }

  /* 스펠·룬은 세부 행에도 적히므로 시트가 좁으면(목록 안 펼침 포함) 열을 뺀다 — 표가 시트를 넘지 않게.
     화면 폭이 아니라 시트 폭(컨테이너) 기준: 같은 표가 목록 안에서는 우물 여백만큼 좁다 */
  .sheet { container-type: inline-size; }
  @container (max-width: 1080px) {
    .xl { display: none; }
  }
  /* 폰: 셀 좌우 여백·번호 칸을 DataTable 과 같게 줄이고, 멤버 열은 7em(DataTable 이름열과 같다)에서 줄바꿈(말줄임 없음)한다 —
     그 안에 챔피언 초상은 뺀다(옆 '챔피언' 열이 이름을 적는다). 그래야 라인·챔피언·K/D/A·KDA 가 360px 안에 든다.
     열이 본질적으로 많고 열끼리 비교하는 표라 카드로 쪼개지 않는다 — 나머지 열은 가로 스크롤 + 잘림 힌트 */
  @media (max-width: 640px) {
    .blk { padding: var(--sp-1) var(--sp-2) var(--sp-2); }
    .vsb { padding-top: 10px; }
    .vr { grid-template-columns: 5ch minmax(0, 1fr) 3.5em minmax(0, 1fr) 5ch; gap: 6px; }
    .lo { display: none; }
    .sheet { --rn-w: 28px; }
    table { width: max-content; min-width: 100%; }   /* 100% 인 채로 이름 셀만 줄바꿈을 허용하면 그 열이 한 글자 폭까지 눌린다(DataTable 실측) */
    th, td { padding: 0 var(--sp-1) 0 6px; }
    .rn { padding: 0 2px; }
    .rnc { min-width: 20px; height: 20px; padding: 0 3px; }
    td.name { max-width: 7em; white-space: normal; overflow-wrap: anywhere; }
    td.name :global(.champ) { display: none; }
  }
  /* 강제 색상: 그라디언트·무늬·안쪽 선이 지워진다 — 막대는 시스템 색, 펼친 행은 아래 2px 선 */
  @media (forced-colors: active) {
    .vbar { forced-color-adjust: none; background: Canvas; outline: 1px solid CanvasText; }
    .vbar.w i { background: Highlight; }
    .vbar.x i { background: CanvasText; }
    .tag { border: 1px solid CanvasText; }
    tr.sel td { border-bottom: 2px solid Highlight; }
  }
  @media (prefers-reduced-motion: reduce) {
    th, td, .exp, .exp :global(.car) { transition: none; }
  }
</style>
