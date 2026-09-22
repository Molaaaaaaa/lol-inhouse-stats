<script module lang="ts">
  export interface SubtabItem { id: string; label: string }
</script>

<script lang="ts">
  /**
   * 하위 화면 탭 — 멤버 페이지 안의 '이름 있는 범위' 탭. 시트 탭(내비)보다 작다: 평평한 글자에
   * 활성 탭만 밑줄 2px --sel. 굵기는 바꾸지 않는다(활성이 바뀔 때마다 글자 폭이 흔들린다).
   *
   * 키보드(WAI-ARIA tabs, 수동 활성): ←→ 로 초점 이동(끝에서 감김), Home/End 로 양 끝,
   * Enter/Space 로 선택 — <button> 이라 브라우저가 click 으로 바꿔 준다. tabindex 는 활성 탭만 0.
   * 44px 터치 표적은 app.css 의 `[role='tab']` 규칙이 pointer:coarse 에서 준다.
   */
  interface Props {
    tabs: readonly SubtabItem[];
    active: string;
    onchange: (id: string) => void;
    /** tablist 의 aria-label — 무엇을 나누는 탭인가('멤버 하위 화면') */
    label?: string;
    /** 주면 탭 id 를 `{prefix}-tab-{id}`, 패널을 `{prefix}-panel-{id}` 로 연결한다 */
    prefix?: string;
  }
  let { tabs, active, onchange, label = '하위 화면', prefix }: Props = $props();

  let bar: HTMLDivElement | undefined = $state();

  function focusAt(i: number): void {
    const n = tabs.length;
    if (!n || !bar) return;
    const k = ((i % n) + n) % n;
    const el = bar.querySelectorAll<HTMLButtonElement>('[role="tab"]')[k];
    el?.focus();
  }

  function onkey(e: KeyboardEvent, i: number): void {
    const map: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    const to = map[e.key];
    if (to === undefined) return;
    e.preventDefault();
    focusAt(to);
  }
</script>

<div class="subtabs" role="tablist" aria-label={label} bind:this={bar}>
  {#each tabs as t, i (t.id)}
    <button
      type="button"
      role="tab"
      id={prefix ? `${prefix}-tab-${t.id}` : undefined}
      aria-controls={prefix ? `${prefix}-panel-${t.id}` : undefined}
      aria-selected={t.id === active}
      tabindex={t.id === active ? 0 : -1}
      onclick={() => { if (t.id !== active) onchange(t.id); }}
      onkeydown={(e) => onkey(e, i)}
    >{t.label}</button>
  {/each}
</div>

<style>
  .subtabs {
    display: flex;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--grid);
  }
  [role='tab'] {
    min-height: var(--row-h);
    margin-bottom: -1px;
    padding: 0 var(--sp-3);
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--dim);
    font-size: var(--fs-md);
    white-space: nowrap;
    transition: color .15s, border-color .15s, background-color .15s;
  }
  [role='tab']:hover { color: var(--txt); background: var(--raised); }
  [role='tab']:active { background: var(--gutter); }
  [role='tab']:disabled { color: var(--dim2); cursor: default; background: none; }
  [role='tab'][aria-selected='true'] {
    color: var(--txt);
    border-bottom-color: var(--sel);
  }
  /* 폰: 탭 다섯 개가 한 줄에 들게 촘촘히(실측 390px: 14px·12px 여백이면 다섯째가 다음 줄로 넘어갔다) */
  @media (max-width: 640px) {
    [role='tab'] { padding: 0 var(--sp-2); font-size: var(--fs-sm); }
  }
</style>
