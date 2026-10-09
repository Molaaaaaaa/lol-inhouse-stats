/**
 * 피드백 창구 클라이언트 — `/api/feedback`(worker.js)의 GET·POST·DELETE 를 부른다.
 * 서버가 목록의 라이엇 태그·디스코드 ID·PUUID 를 이미 가려서 내보낸다. 화면은 글을 텍스트 보간으로만 그린다.
 * 실패는 던지지 않고 값으로 돌려준다 — 서버의 `error` 문구가 있으면 그대로, 없으면(네트워크 실패) 기본 문구.
 */

export const KINDS = ['숫자가 이상함', '버그', '이런 걸 보고 싶다', '기타'] as const;
export type FeedbackKind = (typeof KINDS)[number];

export const MAX_BODY = 2000;
export const PIN_LEN = 4;

export interface FeedbackReply {
  body: string;
  at: string;
}

export interface FeedbackItem {
  id: string;
  at: string;
  who: string;
  kind: string;
  body: string;
  done: boolean;
  /** 글 비밀번호가 걸려 있는가 — 그 글에만 지우기가 보인다 */
  haspin: boolean;
  /** 관리자 답변 — 없으면 null */
  reply: FeedbackReply | null;
}

export interface FeedbackInput {
  who: string;
  kind: FeedbackKind;
  body: string;
  pin: string;
  page: string;
}

type ListResult =
  | { ok: true; items: FeedbackItem[] }
  | { ok: false; off: boolean };
type ActionResult = { ok: true } | { ok: false; error: string };

const URL_FB = '/api/feedback';
const JSON_HEAD = { 'content-type': 'application/json' };

const MSG_SEND_FAIL = '전송에 실패했습니다.';
const MSG_DELETE_FAIL = '지우지 못했습니다.';

async function readJson(r: Response): Promise<Record<string, unknown> | null> {
  try {
    const j: unknown = await r.json();
    return j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function action(init: RequestInit, fallback: string): Promise<ActionResult> {
  try {
    const r = await fetch(URL_FB, init);
    const j = await readJson(r);
    if (j?.ok === true) return { ok: true };
    return { ok: false, error: typeof j?.error === 'string' && j.error ? j.error : fallback };
  } catch {
    return { ok: false, error: fallback };
  }
}

/** 답변은 본문이 글자일 때만 인정한다 — 모양이 이상한 응답이 화면을 깨지 않게 */
function normalizeItem(raw: unknown): FeedbackItem {
  const x = raw as Record<string, unknown>;
  const rp = x.reply as Record<string, unknown> | null | undefined;
  const reply =
    rp && typeof rp === 'object' && typeof rp.body === 'string' && rp.body
      ? { body: rp.body, at: typeof rp.at === 'string' ? rp.at : '' }
      : null;
  return { ...(x as unknown as FeedbackItem), reply };
}

/** 최신순 최대 100건. 보관함이 안 이어졌으면 `off`(워커의 off 응답 또는 503). */
export async function listFeedback(): Promise<ListResult> {
  try {
    const r = await fetch(URL_FB, { cache: 'no-store' });
    const j = await readJson(r);
    if (j?.off === true || r.status === 503) return { ok: false, off: true };
    if (!r.ok || !j || !Array.isArray(j.items)) return { ok: false, off: false };
    return { ok: true, items: j.items.map(normalizeItem) };
  } catch {
    return { ok: false, off: false };
  }
}

export function sendFeedback(input: FeedbackInput): Promise<ActionResult> {
  return action({ method: 'POST', headers: JSON_HEAD, body: JSON.stringify(input) }, MSG_SEND_FAIL);
}

/** 글 비밀번호로 지운다. 번호는 헤더가 아니라 본문으로 보낸다(헤더는 ISO-8859-1 밖 글자를 못 담는다). */
export function deleteFeedback(id: string, pin: string): Promise<ActionResult> {
  return action({ method: 'DELETE', headers: JSON_HEAD, body: JSON.stringify({ id, pin }) }, MSG_DELETE_FAIL);
}

/** 건수 줄 `n건 · 처리 전 m건` */
export function countLine(items: readonly FeedbackItem[]): string {
  return `${items.length}건 · 처리 전 ${items.filter((x) => !x.done).length}건`;
}
