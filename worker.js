/**
 * 내전 해체 분석기 — Cloudflare Worker
 *
 *  · POST /api/feedback  → 디스코드(또는 슬랙) 웹훅으로 전달
 *  · 그 외 모든 경로     → 정적 파일(env.ASSETS)
 *
 * 필요한 환경변수 (Workers → Settings → Variables and Secrets):
 *   FEEDBACK_WEBHOOK = 디스코드 채널 웹훅 URL (Secret 으로)
 * 없으면 503 을 돌려주고, 화면은 GitHub Issues 안내로 물러난다.
 *
 * 원칙
 *  · 웹훅 URL 은 브라우저로 절대 내보내지 않는다.
 *  · 남의 서버로 아무 내용이나 중계하는 통로가 되지 않도록 길이·빈도를 막는다.
 *  · @everyone 같은 멘션은 디스코드 쪽에서 통째로 비활성화한다.
 */

const MAX_BODY = 2000;
const MAX_WHO = 40;
const THROTTLE_SEC = 20;
const KINDS = ["버그", "숫자가 이상함", "이런 걸 보고 싶다", "기타"];

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
  const hook = env.FEEDBACK_WEBHOOK;
  if (!hook) {
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

  // 연타로 채널을 도배하지 못하게. 엣지 캐시를 짧은 자물쇠로 쓴다.
  const self = new URL(request.url).origin;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const cache = caches.default;
  const lock = new Request(`${self}/__fb-lock?ip=${encodeURIComponent(ip)}`);
  if (await cache.match(lock)) {
    return json({ error: `조금만 천천히요. ${THROTTLE_SEC}초 뒤에 다시 보내주세요.` }, 429);
  }

  const isSlack = /hooks\.slack\.com/.test(hook);
  const text =
    `**[${kind}]** ${who}` + "\n" +
    (page ? `\`${page}\`` + "\n" : "") +
    "```\n" + body.replace(/```/g, "'''") + "\n```";
  const payload = isSlack
    ? { text: text.replace(/\*\*/g, "*") }
    : { content: text.slice(0, 1900), allowed_mentions: { parse: [] } };

  let r;
  try {
    r = await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: "전달에 실패했습니다. 잠시 뒤 다시 시도해주세요." }, 502);
  }
  if (!r.ok) {
    return json({ error: "전달에 실패했습니다. 잠시 뒤 다시 시도해주세요." }, 502);
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
