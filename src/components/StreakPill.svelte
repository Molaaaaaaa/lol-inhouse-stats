<script lang="ts">
  /**
   * 연승·연패 알약 — 'n연승'·'n연패' 글자를 늘 쓴다(색만으로 가르지 않는다). 사실 표시일 뿐 정렬·순위 기준이 아니다
   * (연승의 내전 재측정 신뢰도가 잡음 수준이다).
   *
   * 단계는 셋: 연패 = 패 색 틴트 · 1~2연승 = 승 색 틴트 · 3연승 이상 = 승 색 틴트 + 겹친 갈매기 + 약한 글로우.
   * 대상 사이트의 주황 불꽃과 겹치지 않게 승 색(하늘) 계열만 쓴다. 움직임은 없다.
   *
   * 연속 규칙은 `$lib/roster` 의 streakOf 하나('최근' 셀 글자와 같은 셈) — 창을 다 채운 연속은 '5연승+'.
   * 0이거나 form 이 없으면 그리지 않는다.
   */
  import type { PlayerPub } from '$lib/data/types';
  import { streakOf } from '$lib/roster';
  import Glyph from '$components/Glyph.svelte';

  interface Props {
    /** players[*].form — { form: '4-1', dir: 'W'|'L', streak } */
    form: Pick<PlayerPub['form'], 'form' | 'dir' | 'streak'> | null | undefined;
    /** 그 멤버의 전체 판수(record.games) — 창보다 많이 뛰었는지 본다 */
    games: number;
  }
  let { form, games }: Props = $props();

  const HOT = 3;

  const s = $derived.by(() => {
    const k = streakOf(form, games);
    return k && { ...k, cls: k.word === '연패' ? 'loss' : k.n >= HOT ? 'hot' : 'win' };
  });
</script>

{#if s}
  <span class="sp {s.cls}">{#if s.cls === 'hot'}<Glyph name="streak" />{/if}<span>{s.n}{s.word}{#if s.more}<span aria-hidden="true">+</span><span class="sr-only">{' 이상'}</span>{/if}</span></span>
{/if}

<style>
  .sp {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    height: 22px;
    padding: 0 var(--sp-2);
    border: 1px solid transparent;
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }
  .win {
    background: color-mix(in srgb, var(--win) 14%, transparent);
    border-color: color-mix(in srgb, var(--win) 40%, transparent);
    color: var(--win-soft);
  }
  .hot {
    background: color-mix(in srgb, var(--win) 22%, transparent);
    border-color: color-mix(in srgb, var(--win) 60%, transparent);
    color: var(--win-soft);
    box-shadow: var(--glow-win);
  }
  .loss {
    background: color-mix(in srgb, var(--loss) 14%, transparent);
    border-color: color-mix(in srgb, var(--loss) 40%, transparent);
    color: var(--loss-soft);
  }
</style>
