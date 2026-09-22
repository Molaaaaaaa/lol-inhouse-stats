<script lang="ts">
  /**
   * 티어 계산식 — 옛 renderCpMath(legacy/index.html) 의 내용을 payload `cp_constants` 로 다시 쓴 것.
   * 숫자는 전부 payload 에서 온다(글에 박은 상수는 발행이 바뀌면 반드시 표류한다). 옛 글의
   * "실측 n판 뒤 …" 같은 그때의 측정치는 뺐다 — 데이터에 따라 달라지는 값은 글에 넣지 않는다.
   *
   * 여섯 단계는 계산 순서(실력 → 확률 → 기여도 → MMR → CP → 티어)라 번호가 정보다.
   * 홈에서는 사다리 아래 늘 펼쳐 두고(접지 않는다), 계산식 화면에서도 같은 것을 그린다.
   */
  import type { GuildPayload, LaneId, TierCut } from '$lib/data/types';
  import { cpTiers } from '$lib/tier';
  import { mLabel } from '$lib/metrics';
  import { laneKo } from '$lib/lanes';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';
  import EmptyState from '$components/EmptyState.svelte';

  type Src = Partial<Pick<GuildPayload, 'cp_constants' | 'metric_meta'>>;
  let { data }: { data: Src | null | undefined } = $props();

  const C = $derived(data?.cp_constants);
  const meta = $derived(data?.metric_meta);
  const tiers = $derived(cpTiers(data));
  const need = $derived(C?.placement_games ?? 0);
  const full = $derived(C?.tier_points ?? 0);
  const eHi = $derived(C ? (1 - C.e_clamp).toFixed(3) : '');

  // 기여도 재료 — 지표 이름은 metric_meta 의 것만(kda_n 은 지표 키가 아니라 식 그대로)
  const WEIGHT_KEYS = ['kp', 'dmg_share', 'kda_n'] as const;
  const weights = $derived.by(() => {
    const w = C?.contrib_weights;
    if (!w) return '';
    return WEIGHT_KEYS
      .map((k) => `${k === 'kda_n' ? 'ln(1+KDA)' : mLabel(meta, k)} ${Math.round((w[k] ?? 0) * 100)}%`)
      .join(' · ');
  });
  const kRule = $derived(!C ? '' : C.k_decay_half
    ? `${C.k_norm} 에서 시작해 ${C.k_decay_half}판마다 절반, 최소 ${C.k_min}`
    : `${C.k_norm} 고정`);
  const cuts = $derived(tiers.filter((t) => t.cp != null).map((t) => t.cp).join(' · '));

  // 티어 컷 표 — 위 티어의 바닥 − 1 이 이 티어의 천장
  interface TierRow { name: string; idx: number; range: string; note: string }
  const tierRows = $derived(tiers.map((t: TierCut, i): TierRow => {
    const above = i > 0 ? tiers[i - 1]?.cp ?? null : null;
    const range = t.cp == null
      ? (above != null ? `${above - 1} 이하` : '전체')
      : (above != null ? `${t.cp}~${above - 1}` : `${t.cp} 이상`);
    return { name: t.name, idx: i + 1, range, note: t.open_top ? '상한 없음' : (t.cp == null ? '최하위' : '') };
  }));
  const tierCols: Col<TierRow>[] = [
    { k: 'name', h: '티어', cls: (r) => `t${r.idx}`, sortable: false },
    { k: 'range', h: 'CP', num: true, sortable: false },
    { k: 'note', h: '비고', sortable: false },
  ];

  // 옛 글의 예("서폿 주력이 미드를 가면") — 라인 이름은 lanes.ts 의 표기로만
  const SUP: LaneId = 'UTILITY';
  const MID: LaneId = 'MIDDLE';
</script>

{#if !C}
  <EmptyState text="아직 계산식을 표시할 데이터가 없습니다." />
{:else}
  <section class="cpf" aria-labelledby="cpf-h">
    <h2 id="cpf-h" class="cap">티어 계산식</h2>
    <p class="note">점수는 둘이 한 쌍으로 움직입니다. 롤이 MMR 과 LP 를 나눈 것과 같은 구조입니다.</p>
    <pre class="fml">MMR   숨은 추정치입니다. 증거만큼 움직이며, 다음 판 승률 계산과 CP 를 끌어당기는 기준점으로 씁니다.
CP    보이는 점수입니다. 이기면 +{C.cp_min}~{C.cp_max}, 지면 −{C.cp_min}~{C.cp_max} 로 규칙적입니다.
티어   CP 를 {full}점 단위로 나눈 것입니다. 그래서 CP 와 티어는 어긋나지 않습니다.</pre>

    <h3 class="cap"><span class="stp">1</span>이 판에 쓰는 실력 — 실제로 선 라인 기준</h3>
    <pre class="fml">실력 = MMR + 라인 편차(그 판의 라인)
라인 편차 = (n × 관측 + {C.lane_prior_k} × 사전값) ÷ (n + {C.lane_prior_k})      n = 그 라인 판수
  관측 = (그 라인 잔차 평균 − 전체 잔차 평균) × {C.dev_scale} 을 ±{C.dev_cap} 로 자름
  사전값 = 0 (주 라인) / {C.off_lane_prior} (그 외)</pre>
    <p class="note">{laneKo(SUP)}이 주 라인인 멤버가 {laneKo(MID)}로 출전하면 {laneKo(MID)} 실력으로 계산합니다.
      n/(n+{C.lane_prior_k}) 는 라인 배치 {C.lane_prior_k}판입니다. 1판짜리 라인이 실력처럼 보이면 안 되기 때문입니다.
      주 라인의 사전값이 0 인 이유: 전체 MMR 자체가 대부분 주 라인에서 만들어진 숫자라, 거기에도 벌점을 걸면
      다섯 라인이 전부 자기 CP 아래로 내려갑니다.</p>

    <h3 class="cap"><span class="stp">2</span>이길 확률 — 팀 대 팀, 다섯 명이 같은 값</h3>
    <pre class="fml">E = 1 ÷ (1 + 10^((상대 팀 평균 실력 − 우리 팀 평균 실력) ÷ 400))</pre>
    <p class="note">개인 대 상대 팀으로 재지 않습니다. 밸런스를 맞춘 방에서 강한 멤버는 개인 기대치가 0.8 이어도
      팀이 반반이라 50% 만 이기고, 그 어긋남이 판수에 비례해 점수를 흘려보냅니다. 결과를 정하는 것은 팀 합뿐입니다.</p>

    <h3 class="cap"><span class="stp">3</span>기여도 — 라인 안에서, 팀 안에서</h3>
    <pre class="fml">재료 = {weights}
각 재료를 그 라인의 평균·표준편차로 z 화   (기준값은 n/(n+{C.lane_base_k}) 로 수축)
기여도 = 1 + {C.contrib_z_scale} × (z − 팀 평균 z)   를 {C.contrib_lo}~{C.contrib_hi} 로 자름
기여 보정 = (기여도 − 1) × {C.perf_w}   ← 팀 안에서 합이 0</pre>
    <p class="note">라인 안에서 재는 이유: 딜 비중·킬 관여는 라인을 심하게 탑니다. 라인 보정 없이 재면 기여도가
      실력이 아니라 라인을 재고, 딜 비중이 낮은 라인은 판마다 점수를 잃습니다. 팀 안에서 합이 0 이라 차등은
      팀 안에서만 재분배되고 총점은 새지 않습니다.</p>

    <h3 class="cap"><span class="stp">4</span>MMR 갱신 — 정확성 담당</h3>
    <pre class="fml">ΔMMR = K × ((결과 − E) + 기여 보정)      결과 = 승 1 / 패 0
K = {C.k_place} (배치 {need}판 동안) → {kRule}</pre>
    <p class="note">기여 보정을 곱하지 않고 더하는 이유: 곱하면 진 경기를 캐리한 멤버가 더 잃습니다. 더하면 잘한
      멤버는 이길 때 더 받고 져도 덜 잃습니다. 판이 쌓일수록 K 를 줄이는 것은 승패의 잡음이 덜 쌓이게 하기 위해서입니다.</p>

    <h3 class="cap"><span class="stp">5</span>CP 갱신 — 한 판에 {C.cp_min}~{C.cp_max}</h3>
    <pre class="fml">ec = E 를 {C.e_clamp}~{eHi} 로 자름
기본 폭 = {C.cp_size} × (1 − ec)  (이길 때)   /   {C.cp_size} × ec  (질 때)
gap = ((MMR − CP) ÷ {C.cp_gap_div}) 을 ±{C.cp_gap_cap} 로 자름
보정 = gap + 기여 보정 × {C.cp_adj_w}
이기면  ΔCP = +(기본 폭 + 보정) 을 {C.cp_min}~{C.cp_max} 로 자름
지면    ΔCP = −(기본 폭 − 보정) 을 {C.cp_min}~{C.cp_max} 로 자름</pre>
    <p class="note">{C.cp_size} 와 {C.e_clamp} 는 정한 값이 아니라 유도된 값입니다. 점수 총합이 흘러가지 않으려면
      이길 때 얻는 값과 질 때 잃는 값의 합이 {C.cp_min}+{C.cp_max}={C.cp_size} 로 고정돼야 하고, 두 값이
      {C.cp_min}~{C.cp_max} 안에 있으려면 E 가 {C.e_clamp}~{eHi} 안이어야 합니다. 불리한 판을 이기면
      {C.cp_max} 에 가깝게, 유리한 판을 이기면 {C.cp_min} 에 가깝게 받습니다.</p>
    <p class="note">gap 이 롤의 'LP 가 MMR 을 따라가는' 장치입니다. CP 가 MMR 보다 뒤처져 있으면 판마다 최대
      ±{C.cp_gap_cap} 씩 더 얹어 따라붙게 합니다.</p>

    <h3 class="cap"><span class="stp">6</span>티어 — CP 에 눈금을 그은 것</h3>
    <pre class="fml">티어 = CP 가 어느 {full}점 칸에 있는가       티어 점수 = 그 칸 안에서 몇 점인가
배치 {need}판을 마치기 전에는 티어를 표시하지 않습니다 (그 구간은 K={C.k_place} 라 크게 흔들립니다)</pre>
    {#if tierRows.length}
      <div class="cuts">
        <DataTable rows={tierRows} cols={tierCols} caption="티어 컷" rowNumbers={false} compact />
      </div>
    {/if}
    <p class="note">경계가 {cuts} 인 이유: 점수 총합이 보존되어 방 평균이 {C.cp_base} 에 고정되므로, 평균인 멤버가
      가운데 티어의 한가운데에 오게 놓았습니다. 경계를 {C.cp_base} 에 두면 방의 절반이 영원히 경계 위에서
      오르내립니다. 승급 보호(버퍼)는 일부러 없습니다. 넣으면 'CP 는 높은데 티어는 낮은' 역전이 생깁니다.
      대신 경계 근처의 오르내림은 숨기지 않고 다음 티어까지 몇 점으로 드러냅니다.</p>
    <p class="note">1티어는 {full - 1}점을 넘어갑니다. 위가 없으니 자를 이유가 없습니다. 위로 갈수록 오르기 힘든 것은
      따로 규칙 없이 이미 그렇습니다. 유리한 쪽은 이겨도 {C.cp_min} 에 가깝게 받고 져도 {C.cp_max} 에 가깝게
      잃습니다. 마지막 티어는 0점에서 멈추되 보이는 점수만 멈춥니다. 속까지 막으면 그 멤버를 이긴 쪽에 점수가
      새로 생겨 전체가 부풉니다.</p>
    <p class="note">왜 {tiers.length}단계인가: 판이 쌓여도 점수 폭은 약 400 근처에서 멈춥니다. 티어 하나가 운과
      구분되려면 그만한 폭이 필요하니 400÷{full}≈{Math.round(400 / (full || 100))}단계가 이 방의 해상도입니다.
      더 잘게 나누면 한 판 두고 티어가 바뀌는 일이 대부분이 됩니다. 그것은 티어가 아니라 점수판입니다.</p>
  </section>
{/if}

<style>
  .cpf {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    max-width: 80ch;
  }
  /* 캡션 행 — 표 캡션(DataTable .cap)과 같은 자리·같은 크기. 단계 번호는 --mono 로 붙인다 */
  .cap {
    margin: 0;
    padding-top: var(--sp-3);
    font-size: var(--fs-sm);
    font-weight: 700;
    line-height: var(--lh);
    color: var(--dim);
    text-wrap: balance;
  }
  h2.cap { padding-top: var(--sp-4); }
  .stp {
    display: inline-block;
    min-width: 2ch;
    margin-right: var(--sp-2);
    font-family: var(--mono);
    color: var(--dim);
  }
  /* 계산식 — 우물(--ink) 위 모노. 폰에서는 줄이 접힌다 */
  .fml {
    margin: 0;
    padding: var(--sp-2) var(--sp-3);
    background: var(--ink);
    border: 1px solid var(--grid);
    color: var(--txt);
    font-family: var(--mono);
    font-size: var(--fs-sm);
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    tab-size: 4;
  }
  .note {
    margin: 0;
    max-width: 75ch;
    color: var(--dim);
    font-size: var(--fs-sm);
    text-wrap: pretty;
  }
  .cuts { max-width: 40ch; }
</style>
