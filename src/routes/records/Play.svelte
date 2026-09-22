<script lang="ts">
  /**
   * 기록 · 로밍과 한타, 오브젝트 — 로밍 비율(라인별) · 한타 참여율 · 용 종류별 획득과 승률.
   * 순위 화면에서 옮겨 왔다(옛 renderFun 의 로밍·한타·용). 지표 설명은 HELP(로밍·한타) 물음표로.
   *
   * 행 선택 → 수식 줄에 근거(`=한타 참여율 41/45 = 91%`), 같은 행 다시 → 멤버 화면. 용 표는 갈 곳이 없다.
   */
  import type { FunStats, GuildPayload } from '$lib/data/types';
  import { num, pct } from '$lib/fmt';
  import { setFx } from '$lib/fx.svelte';
  import { laneKo } from '$lib/lanes';
  import { laneCls, wrCls } from '$lib/member';
  import { mLabel } from '$lib/metrics';
  import { dragonKo } from '$lib/records';
  import { memberHref, router } from '$lib/router.svelte';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import EmptyState from '$components/EmptyState.svelte';

  let { data }: { data: GuildPayload } = $props();

  type RoamRow = FunStats['roaming'][number];
  type FightRow = FunStats['teamfight'][number];
  type DragonRow = FunStats['dragons'][number];

  const minGames = $derived(data.min_games || 5);

  const roaming = $derived<RoamRow[]>(data.fun?.roaming ?? []);
  const roamCols: Col<RoamRow>[] = [
    { k: 'discord_name', h: '멤버' },
    { k: 'lane', h: '라인', fmt: (v) => laneKo(v as string), cls: (r) => laneCls(r.lane) },
    { k: 'frames', h: '프레임', num: true, lo: true },
    { k: 'roam_rate', h: '로밍 비율', num: true, bar: true, hlp: '로밍', fmt: (v) => pct(v as number) },
  ];

  const fights = $derived<FightRow[]>(data.fun?.teamfight ?? []);
  const fightCols: Col<FightRow>[] = [
    { k: 'discord_name', h: '멤버' },
    { k: 'fights', h: '한타', num: true },
    { k: 'joined', h: '참여', num: true, lo: true },
    { k: 'join_rate', h: '참여율', num: true, bar: true, hlp: '한타', fmt: (v) => pct(v as number) },
  ];

  const dragons = $derived<DragonRow[]>(data.fun?.dragons ?? []);
  const dragonCols = $derived<Col<DragonRow>[]>([
    { k: 'dragon', h: '용', fmt: (v) => dragonKo(v as string) },
    { k: 'taken', h: '획득', num: true, bar: true, fmt: (v) => num(v as number) },
    // 채움 문턱은 획득 수 — 장로 1회 100% 를 승리색으로 칠하지 않는다
    { k: 'winrate', h: mLabel(data.metric_meta, 'winrate'), num: true, fmt: (v) => pct(v as number), cls: (r) => wrCls(r.winrate, r.taken, minGames) },
  ]);

  let sel = $state<string | null>(null);
  function pick(key: string, fx: string, dest: string) {
    if (sel === key) { router.go(dest); return; }
    sel = key;
    setFx(fx);
  }
  const roamFx = (r: RoamRow) => `=로밍 비율 ${pct(r.roam_rate)} · ${laneKo(r.lane)} · 0~15분 프레임 ${r.frames}`;
  const fightFx = (r: FightRow) => `=한타 참여율 ${r.joined}/${r.fights} = ${pct(r.join_rate)}`;
</script>

<div class="play">
  <DataTable rows={roaming} cols={roamCols} caption="로밍" sortKey="roam_rate"
             rowKey={(r) => `roam:${r.discord_name}:${r.lane}`} selectedKey={sel ?? undefined}
             onselect={(r, k) => pick(k, roamFx(r), memberHref(r.discord_name))} />
  <p class="note">로밍 비율은 0~15분 동안 자기 자리를 벗어나 있던 시간 비율입니다. 행을 선택하면 계산 근거가 수식 줄에 보이고, 같은 행을 다시 선택하면 멤버 화면으로 이동합니다.</p>

  <div class="pair">
    <DataTable rows={fights} cols={fightCols} caption="한타" sortKey="join_rate"
               rowKey={(r) => `fight:${r.discord_name}`} selectedKey={sel ?? undefined}
               onselect={(r, k) => pick(k, fightFx(r), memberHref(r.discord_name))} />
    <div class="col">
      {#if !data.objectives_available && dragons.length === 0}
        <div class="cap">용</div>
        <EmptyState text="아직 오브젝트 기록이 없습니다." />
      {:else}
        <DataTable rows={dragons} cols={dragonCols} caption="용" sortKey="taken" filter={false} fold={false} />
        <p class="note">승률은 그 용을 가져간 팀의 승률입니다. 획득 {minGames}회부터 채웁니다.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .play { display: grid; gap: var(--sp-3); min-width: 0; }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-4);
    align-items: start;
  }
  .col { display: grid; gap: var(--sp-2); min-width: 0; }
  .cap {
    font-size: var(--fs-sm); font-weight: 700;
    color: var(--dim);
    padding: var(--sp-2) 0 var(--sp-1);
    white-space: nowrap;
  }
  .note { max-width: 75ch; font-size: var(--fs-sm); color: var(--dim); text-wrap: pretty; }
  @media (max-width: 640px) {
    .pair { grid-template-columns: 1fr; gap: var(--sp-3); }
  }
</style>
