/**
 * 내전 해체 분석기 — Cloudflare Worker
 *
 *  · 모든 경로 → 정적 파일(env.ASSETS). API 는 없다.
 *    (피드백 창구 /api/feedback 은 2026-09-03 사용자 결정으로 제거 — 웹훅 시크릿도 더 필요 없다.)
 *
 * ⚠️ 실제 배포에서 이 코드는 거의 타지 않는다 — [assets] 가 존재하는 파일을 엣지에서 바로
 *    응답하기 때문. 진짜 헤더는 같은 폴더의 `_headers` 가 붙인다. 여기 코드는 로컬(wrangler dev)과
 *    에셋이 없는 경로를 위한 보조 장치다.
 */
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set("content-security-policy", "frame-ancestors 'none'");
    out.headers.set("x-content-type-options", "nosniff");
    out.headers.set("referrer-policy", "no-referrer");
    return out;
  },
};
