<script lang="ts">
  /**
   * 숫자 타일 — 12px 라벨 + 큰 값(+ 단위). 안쪽 판(.tile, 반경 12px) 하나.
   * `<dl>` 안에 둔다(dt·dd 짝을 그린다). 라벨이 지표 이름이면 호출부가 mLabel(meta, 키)로 만든 글자를 준다
   * — 지표 이름을 손으로 적지 않는다.
   * 시각이면 datetime(ISO)을 주어 <time> 으로 그리고, 정확한 시각은 title 에 남긴다.
   */
  interface Props {
    label: string;
    value: string;
    unit?: string;
    /** 값이 시각일 때 <time datetime> */
    datetime?: string;
    /** 값 위에 뜨는 전체 문구(예: 전체 시각) */
    title?: string;
    /** 값 16px · 낮은 타일 — 카드 안에 여럿 늘어놓을 때 */
    compact?: boolean;
  }
  let { label, value, unit, datetime, title, compact = false }: Props = $props();
</script>

<div class="stat tile" class:compact>
  <dt class="k">{label}</dt>
  <dd class="v">{#if datetime}<time {datetime} {title}>{value}</time>{:else}<span {title}>{value}</span>{/if}{#if unit}<span class="u">{unit}</span>{/if}</dd>
</div>

<style>
  .stat {
    display: grid;
    align-content: center;
    gap: 2px;
    min-width: 0;
    min-height: 72px;
    padding: var(--sp-3) 14px;
  }
  .k { font-size: var(--fs-xs); color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .v {
    margin: 0;
    font-size: var(--fs-num);
    font-weight: 700;
    line-height: 1.15;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .u { margin-left: 2px; font-size: var(--fs-sm); font-weight: 400; color: var(--dim); }
  .compact { min-height: 0; padding: var(--sp-2) 10px; }
  .compact .v { font-size: var(--fs-lg); }
</style>
