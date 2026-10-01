/**
 * 내전 해체 분석기 — Cloudflare Worker
 *
 *  · POST /api/feedback  → **R2 에 파일 하나로 쓴다** (`feedback/<시각>-<난수>.json`)
 *  · 그 외 모든 경로     → 정적 파일(env.ASSETS)
 *
 * 받는 사람은 관리자 한 명이다. 중계(디스코드·메일·이슈)는 쓰지 않는다 —
 * 관리자가 자기 PC 에서 `python -m scripts.inhouse_feedback` 로 끌어와 읽는다.
 * 사이트에도 발행 JSON 에도 피드백은 남지 않는다.
 *
 * 바인딩 (wrangler.toml `[[r2_buckets]]`):
 *   FB = R2 버킷. 없으면 503 을 돌려주고 화면은 안내로 물러난다(아무 데도 안 쌓인다).
 *
 * 원칙
 *  · 이 버킷은 분석 산출물의 **유일한 원격 사본**이다 → 여기서는 `feedback/` 접두사로
 *    **put 만** 한다. list·get·delete 를 부르지 않는다(버그가 나도 남의 파일을 못 건드린다).
 *  · 남의 저장소를 아무 내용으로나 채우지 못하게 길이·빈도를 막는다.
 *  · 저장하는 것은 사람이 적은 내용뿐이다 — IP·UA 는 저장하지 않는다(연타 차단에만 쓴다).
 */

const MAX_BODY = 2000;
const MAX_WHO = 40;
const THROTTLE_SEC = 20;
const KINDS = ["버그", "숫자가 이상함", "이런 걸 보고 싶다", "기타"];
const PREFIX = "feedback/";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** 눈에 안 보이는 제어문자·과도한 줄바꿈만 정리. 내용 자체는 손대지 않는다. */
function clean(s, max) {
  return String(s == null ? "" : s)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);
}

async function feedback(request, env) {
  const bucket = env.FB;
  if (!bucket) {
    return json({ error: "아직 접수 창구가 연결되지 않았습니다.", fallback: "github" }, 503);
  }

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ error: "요청을 읽지 못했습니다." }, 400);
  }

  const body = clean(data.body, MAX_BODY);
  const who = clean(data.who, MAX_WHO) || "익명";
  const kind = KINDS.includes(data.kind) ? data.kind : "기타";
  const page = clean(data.page, 120);
  if (body.length < 5) {
    return json({ error: "내용을 다섯 글자 이상 적어주세요." }, 400);
  }

  // 연타로 저장소를 채우지 못하게. 엣지 캐시를 짧은 자물쇠로 쓴다(IP 는 저장하지 않는다).
  const self = new URL(request.url).origin;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const cache = caches.default;
  const lock = new Request(`${self}/__fb-lock?ip=${encodeURIComponent(ip)}`);
  if (await cache.match(lock)) {
    return json({ error: `조금만 천천히요. ${THROTTLE_SEC}초 뒤에 다시 보내주세요.` }, 429);
  }

  const at = new Date().toISOString();
  // 키는 시각 순으로 정렬된다 — 관리자 쪽에서 받은 순서대로 읽는다
  const key = `${PREFIX}${at.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}.json`;
  try {
    await bucket.put(key, JSON.stringify({ at, who, kind, body, page }), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  } catch (e) {
    return json({ error: "보관에 실패했습니다. 잠시 뒤 다시 시도해주세요." }, 502);
  }

  await cache.put(
    lock,
    new Response("1", { headers: { "cache-control": `max-age=${THROTTLE_SEC}` } })
  );
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/feedback") {
      if (request.method === "POST") return feedback(request, env);
      // 읽기는 사이트에서 안 한다 — 관리자가 R2 에서 직접 가져간다.
      return json({ error: "POST 로 보내주세요." }, 405);
    }
    // 나머지는 전부 정적 파일.
    // ⚠️ 실제 배포에서 이 경로는 거의 타지 않는다 — [assets] 가 존재하는 파일을 엣지에서
    //    바로 응답하기 때문. 진짜 헤더는 같은 폴더의 `_headers` 가 붙인다. 여기 코드는
    //    로컬(wrangler dev)과 에셋이 없는 경로를 위한 보조 장치다.
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set("content-security-policy", "frame-ancestors 'none'");
    out.headers.set("x-content-type-options", "nosniff");
    out.headers.set("referrer-policy", "no-referrer");
    return out;
  },
};
