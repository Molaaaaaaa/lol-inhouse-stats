/**
 * 발행물을 로드한 직후 한 번에 소독한다.
 *
 * 옛 단일 파일은 innerHTML 로 그렸기 때문에 `&<>"'\`` 를 **엔티티로 바꿨다.** Svelte 는 텍스트를
 * 렌더할 때 스스로 escape 하므로 같은 방식을 쓰면 `&amp;` 가 화면에 그대로 보인다(이중 escape).
 * 그래서 여기서는 마크업이 될 수 있는 글자를 **제거**한다 — `{@html}` 를 어디서 쓰든 안전하고,
 * 롤 닉네임에 `<`·`>`·백틱은 원래 못 들어간다(라이엇 제한). 서버 이름 등 임의 문자열이 잘릴 수는
 * 있지만 그건 화면 한 글자 손실이지 스크립트 주입이 아니다.
 */
const STRIP = /[<>`]/g;

export function cleanString(s: string): string {
  return s.replace(STRIP, '');
}

/** 재귀적으로 문자열만 소독한다. 숫자·불리언·null 은 그대로. */
export function sanitize<T>(v: T): T {
  if (typeof v === 'string') return cleanString(v) as T;
  if (Array.isArray(v)) return v.map(sanitize) as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v)) o[k] = sanitize((v as Record<string, unknown>)[k]);
    return o as T;
  }
  return v;
}

/** 데이터 파일명·키(길드 슬러그, 경기 슬러그, 멤버 키)는 이 모양만 허용한다 — URL 조립에 쓴다. */
export const safeId = (s: unknown): s is string => /^[A-Za-z0-9_-]{1,64}$/.test(String(s));

/** ddragon 이미지 URL 에 넣는 챔피언 id 는 영숫자만 — 그 외는 이미지를 생략한다(URL 주입 방지). */
export const safeChamp = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9]+$/.test(s);
