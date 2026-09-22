<script lang="ts">
  /**
   * 지표 안내 — payload 의 지표 레지스트리(metric_groups 순서 · metric_meta)를 표 하나로.
   * 이름은 mLabel, 설명은 mDesc, 코드 판은 설명에 실제로 든 대회식 코드(metricCode)만.
   * 라인별 지표(문턱이 라인 판수)와 낮을수록 좋은 지표는 글자로 표시한다(색만으로 구분하지 않는다).
   * 68개라 거르기 칸이 붙고, 안내 표라 접지 않는다.
   */
  import type { GuildPayload } from '$lib/data/types';
  import { lowerBetter, mDesc, mLabel } from '$lib/metrics';
  import { metricCode } from '$lib/metric-code';
  import type { Col } from '$lib/table';
  import DataTable from '$components/DataTable.svelte';

  type Src = Partial<Pick<GuildPayload, 'metric_groups' | 'metric_meta' | 'lower_better'>>;
  let { data }: { data: Src | null | undefined } = $props();

  interface Row { key: string; group: string; label: string; code: string; desc: string; scope: string; dir: string }
  // 설명의 **강조** 표식은 글자로만 그리는 셀에서는 별표로 남는다 — 옛 화면은 innerHTML 로 <b> 를 만들었다
  const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1');
  const rows = $derived.by((): Row[] => {
    const meta = data?.metric_meta;
    const out: Row[] = [];
    for (const g of data?.metric_groups ?? []) {
      for (const key of g.metrics) {
        const desc = plain(mDesc(meta, key));
        const label = mLabel(meta, key);
        // 설명이 지표 이름 자체(KDA)를 되풀이한 것은 대회식 코드가 아니다
        const code = metricCode(desc);
        out.push({
          key, group: g.group, label, code: code === label ? '' : code, desc,
          scope: meta?.[key]?.lane ? '라인별' : '전체',
          dir: lowerBetter(data?.lower_better, key) ? '낮을수록 좋음' : '높을수록 좋음',
        });
      }
    }
    return out;
  });

  const cols: Col<Row>[] = [
    { k: 'label', h: '지표' },
    { k: 'code', h: '코드', cls: () => 'code' },
    { k: 'group', h: '구분', lo: true },
    { k: 'scope', h: '집계', lo: true },
    { k: 'dir', h: '방향', lo: true },
    { k: 'desc', h: '설명', cls: () => 'wrap', sortable: false },
  ];
</script>

<section class="guide" aria-labelledby="mg-h">
  <h2 id="mg-h" class="sr-only">지표 설명</h2>
  <!-- rows2: 390px 에서 629px(실측, 설명 열) — 폰은 2줄 장부 행, 설명 셀은 한 줄 전부(아래 스타일) -->
  <DataTable {rows} {cols} caption="지표 {rows.length}개 · 발행 순서" fold={false} rows2 />
</section>

<style>
  /* 설명 열만 줄을 접는다 — 표 셀 기본은 한 줄(nowrap)이라 문장이 화면을 가로로 밀어낸다 */
  .guide :global(td.wrap) {
    white-space: normal;
    min-width: 28ch;
    max-width: 60ch;
    padding-bottom: var(--sp-2);
    line-height: 1.45;
    color: var(--dim);
    text-wrap: pretty;
  }
  /* 여러 줄 설명 옆의 이름·코드는 첫 줄에 맞춘다 */
  .guide :global(.sheet:not(.rows2) tbody td) { vertical-align: top; padding-top: var(--sp-2); }
  /* 폰: 보조 열(구분·집계·방향)이 숨고 설명 열이 남은 폭을 다 쓴다 — 표가 옆으로 새지 않게 */
  @media (max-width: 640px) {
    .guide :global(td.wrap) { min-width: 0; }
  }
  /* 2줄 장부 행(폰): 설명 셀은 격자 한 줄 전부, 라벨 뒤에 문장이 이어 흐른다(값을 오른쪽에 미는 셀이 아니다) */
  .guide :global(.sheet.rows2 td.wrap) { grid-column: 1 / -1; display: block; max-width: none; padding-top: var(--sp-1); }
  .guide :global(.sheet.rows2 td.wrap::before) { margin-right: var(--sp-2); }
</style>
