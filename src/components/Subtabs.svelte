<script module lang="ts">
  export interface SubtabItem { id: string; label: string }
</script>

<script lang="ts">
  /**
   * 하위 화면 탭 — 화면 안의 '이름 있는 범위' 탭. 하단 독(내비)보다 작은 둥근 세그먼트: 우물 띠 안의 단추,
   * 활성 탭은 밝은 판 + 아래 2px --sel. 굵기는 바꾸지 않는다(활성이 바뀔 때마다 글자 폭이 흔들린다).
   *
   * 키보드(WAI-ARIA tabs, 수동 활성): ←→ 로 초점 이동(끝에서 감김), Home/End 로 양 끝,
   * Enter/Space 로 선택 — <button> 이라 브라우저가 click 으로 바꿔 준다. tabindex 는 활성 탭만 0.
   * 44px 터치 표적은 이 파일의 pointer:coarse 규칙이 준다 — app.css 의 전역 `[role='tab']` 규칙(0,1,0)은
   * 여기 scoped 규칙(0,2,0)의 min-height 34px 에 진다(실측: 굵은 포인터에서 34px 였다).
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
  /* 세그먼트 — 우물 바탕의 둥근 띠 안에 탭 단추. 활성은 한 단 밝은 판 + 아래 2px --sel 선(색 없이도 판이 갈린다).
     굵기는 바꾸지 않는다(활성이 바뀔 때마다 글자 폭이 흔들린다). 폰에서 다섯이 안 들면 띠 안에서 줄을 바꾼다 */
  .subtabs {
    display: inline-flex;
    align-self: flex-start;   /* 세로 flex·grid 부모 안에서도 내용 폭(늘어나지 않는다) */
    justify-self: start;
    flex-wrap: wrap;
    gap: 2px;
    max-width: 100%;
    padding: 3px;
    background: var(--ink);
    border: 1px solid var(--grid);
    border-radius: calc(var(--r-chip) + 3px);
  }
  [role='tab'] {
    min-height: 34px;
    padding: 0 var(--sp-3);
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: var(--r-chip);
    background: none;
    color: var(--dim);
    font-size: var(--fs-md);
    white-space: nowrap;
    transition: color var(--dur-1), border-color var(--dur-1), background-color var(--dur-1);
  }
  [role='tab']:hover { color: var(--txt); background: var(--gutter); }
  [role='tab']:active { background: var(--raised); }
  [role='tab']:disabled { color: var(--dim2); cursor: default; background: none; }
  [role='tab'][aria-selected='true'] {
    color: var(--txt);
    background: var(--raised);
    border-bottom-color: var(--sel);
    box-shadow: var(--edge-hi);
  }
  /* 폰: 탭 다섯 개가 한 줄에 들게 촘촘히(실측 390px: 14px·12px 여백이면 다섯째가 다음 줄로 넘어갔다) */
  @media (max-width: 640px) {
    [role='tab'] { padding: 0 var(--sp-2); font-size: var(--fs-sm); }
  }
  @media (pointer: coarse) {
    [role='tab'] { min-height: 44px; }
  }
  @media (forced-colors: active) {
    [role='tab'][aria-selected='true'] { border-bottom-color: Highlight; }
  }
</style>
