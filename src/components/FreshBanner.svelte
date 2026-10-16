<script lang="ts">
  /**
   * 새 버전 배너 — 배포 뒤에 열려 있던 탭에 "새로고침해 주세요" 를 알린다.
   * 자동 새로고침은 하지 않는다(보던 화면과 펼친 패널이 통째로 날아간다) — 버튼으로만.
   */
  import Icon from '$components/Icon.svelte';
</script>

<div class="fresh" role="status">
  <Icon name="refresh-cw" />
  <span class="msg">사이트가 업데이트되었습니다. 새로고침해 주세요.</span>
  <button type="button" class="act" onclick={() => location.reload()}>새로고침</button>
</div>

<style>
  /* 맨 위 알림 띠 — 액센트 10% 틴트 판 + 아래 선. 버튼은 액센트 채움(선택·활성과 같은 '지금 할 일' 색) */
  .fresh {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: var(--row-h);
    padding: var(--sp-1) var(--sp-4);
    background: color-mix(in srgb, var(--sel) 10%, var(--sheet));
    border-bottom: 1px solid color-mix(in srgb, var(--sel) 40%, var(--grid));
    color: var(--dim);
  }
  .msg { flex: 1 1 auto; min-width: 0; color: var(--txt); }
  .act {
    flex: none;
    min-height: 34px;
    padding: 0 var(--sp-3);
    background: var(--grad-sel);
    color: var(--on-sel);
    border: 0;
    border-radius: var(--r-chip);
    font-weight: 700;
    box-shadow: var(--edge-hi);
  }
  .act:hover { background: var(--sel-hi); }
  .act:active { background: var(--sel); }
  /* 굵은 포인터 44px — scoped 34px 가 app.css 의 전역 button 규칙을 이기므로 여기서 다시 준다 */
  @media (pointer: coarse) {
    .act { min-height: 44px; }
  }
  @media (forced-colors: active) {
    .act { border: 1px solid ButtonText; }
  }
</style>
