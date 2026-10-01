/**
 * 내전 해체 분석기 — Cloudflare Worker
 *
 *  · POST   /api/feedback  → R2 에 파일 하나로 쓴다 (`feedback/<시각>-<난수>.json`)
 *  · GET    /api/feedback  → 최근 목록(공개). 화면이 댓글처럼 보여 준다
 *  · PATCH  /api/feedback  → 완료 표시 토글 (관리자만)
 *  · DELETE /api/feedback  → 삭제 (관리자 암호 **또는** 글 비밀번호 4자리)
 *  · 그 외 모든 경로        → 정적 파일(env.ASSETS)
 *
 * 바인딩·시크릿 (wrangler.toml / `npx wrangler secret put`):
 *   FB       = R2 버킷(필수). 없으면 503, 화면은 안내로 물러난다.
 *   FB_ADMIN = 관리자 암호(선택). 없으면 완료 표시는 사이트에서 막히고, 관리자는 자기 PC 에서
 *              `python -m scripts.inhouse_feedback --done/--rm` 으로 한다.
 *              (글 비밀번호로 **쓴 사람이 자기 글을 지우는** 길은 시크릿과 무관하게 늘 열려 있다.)
 *
 * 원칙
 *  · 이 버킷은 분석 산출물의 **유일한 원격 사본**이다 → `feedback/` 접두사 밖은 절대 건드리지 않는다.
 *    키는 받은 그대로 쓰지 않고 `^[0-9A-Za-z._-]+\.json$` 만 통과시킨다(경로 탈출 금지).
 *  · 저장하는 것은 사람이 적은 내용뿐이다 — IP·UA 는 저장하지 않는다(연타 차단에만 쓴다).
 *  · **공개 목록에는 식별자를 내보내지 않는다.** 누가 본문에 라이엇 태그·디스코드 ID·PUUID 를
 *    적어도 GET 응답에서 가린다(발행물 관문이 보는 경로가 아니므로 여기서 직접 막는다).
 *    R2 원본은 그대로라 관리자는 PC 에서 전문을 본다.
 */

const MAX_BODY = 2000;
const MAX_WHO = 40;
const THROTTLE_SEC = 20;
const KINDS = ["버그", "숫자가 이상함", "이런 걸 보고 싶다", "기타"];
const PREFIX = "feedback/";
const LIST_MAX = 100;
const ID_OK = /^[0-9A-Za-z._-]+\.json$/;
const PIN_OK = /^\d{4}$/;
const PIN_RETRY_SEC = 10;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** 글 비밀번호는 **해시로만** 둔다(글마다 다른 소금 + SHA-256). 목록 응답에는 해시도 소금도 안 싣는다.
 *  4자리는 10,000가지뿐이라 **틀리면 10초 잠가** 반복 시도를 느리게 만든다(친구 사이 글이라 이 정도로 둔다). */
async function pinHash(salt, pin) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 눈에 안 보이는 제어문자·과도한 줄바꿈만 정리. 내용 자체는 손대지 않는다. */
function clean(s, max) {
  return String(s == null ? "" : s)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);
}

/** 공개 목록용 가리기 — 라이엇 태그(#KR1)·디스코드 ID(17~20자리)·PUUID(긴 토큰). */
function maskIds(s) {
  return String(s || "")
    .replace(/#[A-Za-z0-9]{2,5}\b/g, "#…")
    .replace(/\b\d{17,20}\b/g, "[숫자]")
    .replace(/\b[0-9A-Za-z_-]{70,}\b/g, "[식별자]");
}

/** 관리자 요청 본문 읽기. 암호는 **본문**으로 받는다 — 헤더 값은 ISO-8859-1 만 담을 수 있어
 *  한글 암호를 쓰면 브라우저의 fetch 가 요청도 못 만들고 예외를 던진다(실측 2026-10-01). */
async function readAdmin(request, env) {
  let d = {};
  try {
    d = await request.json();
  } catch (e) {
    return { bad: json({ error: "요청을 읽지 못했습니다." }, 400) };
  }
  if (String(d.pw || "") !== String(env.FB_ADMIN)) {
    return { bad: json({ error: "관리자 암호가 맞지 않습니다." }, 403) };
  }
  const id = String(d.id || "");
  if (!ID_OK.test(id)) return { bad: json({ error: "어느 것인지 알 수 없습니다." }, 400) };
  return { id, done: d.done !== false };
}

async function post(request, env) {
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
  // 키는 시각 순으로 정렬된다 — 목록도 관리자 쪽도 받은 순서대로 읽는다
  const id = `${at.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}.json`;
  // 글 비밀번호(선택) — 적어 두면 **쓴 사람이 자기 글을 지울 수 있다**. 원문은 어디에도 안 남는다.
  const pin = String(data.pin || "");
  const pinSalt = PIN_OK.test(pin) ? crypto.randomUUID().slice(0, 8) : "";
  const pinH = pinSalt ? await pinHash(pinSalt, pin) : "";
  try {
    await bucket.put(PREFIX + id, JSON.stringify({
      at, who, kind, body, page, done: false, pin_salt: pinSalt, pin_hash: pinH,
    }), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  } catch (e) {
    return json({ error: "보관에 실패했습니다. 잠시 뒤 다시 시도해주세요." }, 502);
  }
  await cache.put(
    lock,
    new Response("1", { headers: { "cache-control": `max-age=${THROTTLE_SEC}` } })
  );
  return json({ ok: true, id });
}

async function list(env) {
  const bucket = env.FB;
  if (!bucket) return json({ items: [], off: true });
  const got = await bucket.list({ prefix: PREFIX, limit: 1000 });
  const keys = got.objects.map((o) => o.key).sort().reverse().slice(0, LIST_MAX);
  const items = [];
  for (const key of keys) {
    const obj = await bucket.get(key);
    if (!obj) continue;
    let r;
    try {
      r = JSON.parse(await obj.text());
    } catch (e) {
      continue;                       // 읽을 수 없는 한 건이 목록 전체를 막지 않게
    }
    items.push({
      id: key.slice(PREFIX.length),
      at: r.at || "",
      who: maskIds(r.who || "익명"),
      kind: r.kind || "기타",
      body: maskIds(r.body || ""),
      done: !!r.done,
      haspin: !!r.pin_hash,          // 지우기 단추를 보일지 — 해시·소금은 내보내지 않는다
    });
  }
  return json({ items });
}

async function setDone(request, env) {
  const bucket = env.FB;
  if (!bucket) return json({ error: "보관함이 연결되지 않았습니다." }, 503);
  const d = await readAdmin(request, env);
  if (d.bad) return d.bad;
  const obj = await bucket.get(PREFIX + d.id);
  if (!obj) return json({ error: "이미 지워졌습니다." }, 404);
  let r;
  try {
    r = JSON.parse(await obj.text());
  } catch (e) {
    return json({ error: "내용을 읽지 못했습니다." }, 500);
  }
  r.done = d.done;
  r.done_at = d.done ? new Date().toISOString() : "";
  await bucket.put(PREFIX + d.id, JSON.stringify(r), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return json({ ok: true, done: r.done });
}

/** 삭제는 둘 중 하나면 된다: 관리자 암호(FB_ADMIN) **또는** 그 글의 비밀번호 4자리. */
async function remove(request, env) {
  const bucket = env.FB;
  if (!bucket) return json({ error: "보관함이 연결되지 않았습니다." }, 503);
  let d = {};
  try {
    d = await request.json();
  } catch (e) {
    return json({ error: "요청을 읽지 못했습니다." }, 400);
  }
  const id = String(d.id || "");
  if (!ID_OK.test(id)) return json({ error: "어느 것인지 알 수 없습니다." }, 400);

  const admin = !!env.FB_ADMIN && String(d.pw || "") === String(env.FB_ADMIN);
  if (!admin) {
    const obj = await bucket.get(PREFIX + id);
    if (!obj) return json({ error: "이미 지워졌습니다." }, 404);
    let r;
    try {
      r = JSON.parse(await obj.text());
    } catch (e) {
      return json({ error: "내용을 읽지 못했습니다." }, 500);
    }
    if (!r.pin_hash) {
      return json({ error: "이 글에는 비밀번호가 없습니다 — 관리자에게 말해 주세요." }, 403);
    }
    // 틀린 뒤에는 잠깐 잠근다(한 번 오타는 10초 뒤 다시 하면 된다)
    const self = new URL(request.url).origin;
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const cache = caches.default;
    const lock = new Request(`${self}/__fb-try?ip=${encodeURIComponent(ip)}`);
    if (await cache.match(lock)) {
      return json({ error: `잠시 뒤에 다시 해주세요(${PIN_RETRY_SEC}초).` }, 429);
    }
    const pin = String(d.pin || "");
    if (!PIN_OK.test(pin) || (await pinHash(r.pin_salt || "", pin)) !== r.pin_hash) {
      await cache.put(
        lock,
        new Response("1", { headers: { "cache-control": `max-age=${PIN_RETRY_SEC}` } })
      );
      return json({ error: "비밀번호가 맞지 않습니다." }, 403);
    }
  }
  await bucket.delete(PREFIX + id);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/feedback") {
      if (request.method === "GET") return list(env);
      if (request.method === "POST") return post(request, env);
      if (request.method === "DELETE") return remove(request, env);   // 관리자 암호 또는 글 비밀번호
      if (request.method === "PATCH") {
        if (!env.FB_ADMIN) return json({ error: "관리자 기능이 꺼져 있습니다." }, 503);
        return setDone(request, env);
      }
      return json({ error: "지원하지 않는 방식입니다." }, 405);
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
