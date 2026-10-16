<script lang="ts">
  /**
   * MVP 표식 — 경기 목록의 멤버 칸·스코어보드의 멤버 열(이름 바로 뒤), 멤버 머리('MVP n회').
   * 뜻은 글자 'MVP' 가 말한다. 사건 강조라 액센트 그라디언트 채움 + 진한 글자 700 + 작은 글로우 —
   * 액센트를 쓰는 사건은 이것 하나다(선택·초점·활성 독과 함께 넷).
   * count 를 주면 'MVP 3회'(규칙으로 정해지는 사실 — 발행 쪽이 문턱 이상인 멤버만 싣는다). 간격은 놓인 자리가 정한다.
   */
  let { count }: { count?: number } = $props();
</script>

<span class="mvp">MVP{#if count != null}{' '}{count}회{/if}</span>

<style>
  .mvp {
    flex: none;
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 5px;
    background: var(--grad-sel);
    color: var(--on-sel);
    border-radius: var(--r-xs);
    box-shadow: var(--glow-event);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  @media (forced-colors: active) {
    .mvp { border: 1px solid CanvasText; }
  }
</style>
