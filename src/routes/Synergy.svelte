<script lang="ts">
  // Phase 0 자리표시자 — 화면은 Phase 2·3 에서 채운다.
  let { sub = '', params = {} }: { sub?: string; params?: Record<string, string> } = $props();
</script>

<section aria-labelledby="h-Synergy">
  <h2 id="h-Synergy">Synergy</h2>
  <p class="muted">준비 중 · {sub} {JSON.stringify(params)}</p>
</section>
