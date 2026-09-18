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
  .fresh {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: var(--row-h);
    padding: var(--sp-1) var(--sp-4);
    background: var(--gutter);
    border-bottom: 1px solid var(--grid-strong);
    color: var(--dim);
  }
  .msg { flex: 1 1 auto; min-width: 0; color: var(--txt); }
  .act {
    flex: none;
    min-height: 32px;
    padding: 0 var(--sp-3);
    background: var(--sel);
    color: var(--on-sel);
    border: 1px solid var(--sel);
    border-radius: var(--r-chip);
    font-weight: 650;
    transition: background-color .15s ease-out;
  }
  .act:hover { background: color-mix(in srgb, var(--sel) 88%, var(--txt)); }
  .act:active { background: color-mix(in srgb, var(--sel) 80%, var(--ink)); }
</style>
