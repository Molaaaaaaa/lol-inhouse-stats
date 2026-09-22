<script lang="ts">
  /**
   * 물음표(QMark) — 설명 툴팁을 여는 작은 원 버튼. 이 파일이 내보내는 형태는 이것 하나다.
   * 문구는 `key`(HELP 사전) 또는 `text` 로 주고, 실제 층은 `$lib/tip` 액션이 띄운다.
   *
   * 보이는 크기는 글줄 안 16px 로 두고, 손가락 기기에서만 ::after 로 44px 히트 영역을 편다 —
   * 크기를 키우면 표 머리 정렬이 통째로 어긋나고, 마우스 기기에서 44px 투명 영역은 옆 정렬 머리의
   * 클릭을 가로챈다(옛 파일도 pointer:coarse 에서만 폈다).
   * app.css 가 pointer:coarse 에서 button 에 주는 min-height 44px 는 여기서 되돌린다(히트 영역이 대신한다).
   */
  import { tip, type TipSpec } from '$lib/tip';
  import type { HelpPayload } from '$lib/help';

  interface Props {
    /** HELP 사전 키 */
    key?: string;
    /** 사전 대신 직접 주는 문구 */
    text?: string;
    /** 함수형 HELP 항목이 읽는 payload 조각(app.data 그대로 넘겨도 된다) */
    payload?: HelpPayload | null;
    /** 버튼 이름 — 문구 자체는 aria-describedby 로 읽히므로 짧게 */
    label?: string;
  }
  let { key, text, payload = null, label = '설명' }: Props = $props();

  const spec = $derived<TipSpec>(text != null ? { text, toggle: true } : { key: key ?? '', payload, toggle: true });
</script>

<button type="button" class="qmark" aria-label={label} use:tip={spec}>?</button>

<style>
  .qmark {
    position: relative;
    display: inline-flex;
    font-weight: 400;   /* 캡션·머리(700) 안에 있어도 물음표는 늘 같은 굵기 */
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    min-height: 0;
    margin-left: var(--sp-1);
    padding: 0;
    border: 1px solid var(--dim);
    border-radius: 50%;
    background: none;
    color: var(--dim);
    font-size: var(--fs-sm);
    line-height: 1;
    vertical-align: middle;
    cursor: help;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: color .15s, border-color .15s;
  }
  .qmark:hover, .qmark:focus-visible { color: var(--txt); border-color: var(--txt); }
  .qmark:active { color: var(--dim2); }
  .qmark:disabled { color: var(--dim2); border-color: var(--grid-strong); cursor: default; }
  @media (pointer: coarse) {
    .qmark::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 44px;
      height: 44px;
      transform: translate(-50%, -50%);
    }
  }
</style>
