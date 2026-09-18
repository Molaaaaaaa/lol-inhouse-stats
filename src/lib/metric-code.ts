/**
 * 지표 설명(metric_meta.desc)에 **실제로 들어 있는** 대회식 코드(GD10 · CSM · XPD15)만 뽑는다.
 *
 * 코드 판(CodePlate)은 이 값이 비어 있지 않을 때만 라벨 옆에 붙는다. 없는 코드를 지어내지 않는다 —
 * 설명에 코드가 없으면 그 지표는 대회 표기가 없는 것이고, 빈 판을 붙이면 "이건 뭐지"만 남는다.
 *
 * 규칙(실데이터 69개 지표로 확인, 2026-09-19):
 *  1. "대회 지표는 CSM 입니다" 처럼 **'대회 지표' 뒤에 오는 코드**가 있으면 그것. 발행 쪽 설명은
 *     전부 이 문형이다(CSD10·CSD15·CSM·GD10·GD15·VSPM·XPD10·XPD15).
 *  2. 없으면 정규식 `\b[A-Z]{2,5}\d{0,2}\b` 의 첫 매치 — 단 **맨몸 두 글자(CS·XP·KP)는 제외**한다.
 *     그냥 첫 매치를 쓰면 "10분 시점 CS." 의 CS 가 판이 되고, "1분당 CS(…). 대회 지표는 CSM" 은
 *     CSM 대신 CS 를 준다(실측: 13개 중 8개가 틀렸다). 두 글자는 단위어이지 대회 코드가 아니다.
 *
 * `metrics.ts` 는 건드리지 않는다 — 발행물 위에서만 읽는 순수 조회 모듈이라 여기 규칙을 섞지 않는다.
 */
const CODE = /\b[A-Z]{2,5}\d{0,2}\b/g;
const ANCHORED = /대회 지표[^A-Za-z]{0,6}([A-Z]{2,5}\d{0,2})\b/;
const BARE_TWO = /^[A-Z]{2}$/;

/** desc 에서 대회식 코드 하나. 없으면 ''(판을 안 붙이는 신호). */
export function metricCode(desc: string | null | undefined): string {
  const s = desc ?? '';
  const a = ANCHORED.exec(s);
  if (a) return a[1]!;
  for (const m of s.matchAll(CODE)) if (!BARE_TWO.test(m[0])) return m[0];
  return '';
}
