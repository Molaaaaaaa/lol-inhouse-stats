<script lang="ts">
  /**
   * 빈 상태 — 안쪽 판(12px) 하나에 문장 하나. 아이콘·삽화 없음.
   * 문구는 호출부가 준다: 무엇을 하면 되는지 한 문장(`아직 ○○이 없습니다.`), 사이트 말투(~합니다).
   */
  let { text }: { text: string } = $props();
</script>

<p class="empty">{text}</p>

<style>
  .empty {
    margin: 0;
    padding: var(--sp-4);
    background: var(--gutter);
    border: 1px dashed var(--grid-strong);
    border-radius: var(--r-md);
    color: var(--dim);
    font-size: var(--fs-md);
    text-wrap: pretty;
  }
</style>
