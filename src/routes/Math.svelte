<script lang="ts">
  /**
   * 지표 안내 화면 — `#/math/metrics` 하나. 하위 화면이 없어 Subtabs 도 없다.
   * 옛 주소 `#/math/cp` 를 포함해 `#/math` 아래 어떤 sub 도 이 화면으로 떨어진다(sub 를 읽지 않는다).
   */
  import { app } from '$lib/data/store.svelte';
  import MetricGuide from './math/MetricGuide.svelte';

  let {}: { sub?: string; params?: Record<string, string> } = $props();
</script>

<MetricGuide data={app.data} />
