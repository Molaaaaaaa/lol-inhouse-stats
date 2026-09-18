/**
 * 화면 서식 — 숫자·시간·날짜를 글자로 바꾸는 함수는 전부 여기서 나온다.
 *
 * 옛 단일 파일(legacy/index.html)에는 같은 m:ss 가 다섯 벌 있었다(mmss·mm·mmss2·인라인·fmtDur).
 * 셋은 정수 입력에서 결과가 같았고, mmss2 는 0 을 '' 로, fmtDur 는 "n분 ss초" 로 냈다.
 * 여기서는 형식이 다른 것만 함수로 남기고(mmss·durKo) 0 처리는 호출 쪽이 거른다 —
 * 옛 mmss2 도 실제로는 `if(o.dur)` 뒤에서만 불려 빈 문자열 가지는 죽어 있었다.
 *
 * 반환값은 **텍스트**다. 옛 코드는 innerHTML 에 넣었지만 Svelte 는 텍스트로 넣으므로
 * 마크업을 품은 문자열을 여기서 만들면 그대로 화면에 글자로 찍힌다.
 */
import type { MetricFmt, MetricMeta } from '$lib/data/types';

export type Num = number | null | undefined;

// 옛 코드는 브라우저 기본 로캘(toLocaleString())을 썼다. 테스트(node)와 실제 화면이
// 갈라지지 않게 ko-KR 로 못 박는다 — 천단위 구분은 en-US 와 같아 화면은 안 바뀐다.
const LOCALE = 'ko-KR';
const pad2 = (n: number): string => String(n).padStart(2, '0');

// ── 숫자 ─────────────────────────────────────────────────────────────

/** 비율(0~1) → "48%". null 은 0% (옛 pct 와 같다 — 표에서 '-' 를 원하면 호출 쪽이 거른다). */
export function pct(x: Num): string {
  return ((x ?? 0) * 100).toFixed(0) + '%';
}

/**
 * 부호 붙은 소수 — 시너지·델타 칸. 양수에만 '+' 가 붙고 0 은 "0.000" 이다(옛 sgn).
 * 옛 검산표(renderMathMmr)만 `>=0` 로 0 에도 '+' 를 붙였는데, 정확히 0 인 델타는
 * 실데이터에 없어 합쳤다.
 */
export function sgn(x: Num, digits = 3): string {
  const n = Number(x ?? 0);
  return (n > 0 ? '+' : '') + n.toFixed(digits);
}

/** 천단위 구분. 문자열 기록값("+144"·"30:13")은 그대로 통과, null 은 '-'. digits 를 주면 소수 자리를 고정한다. */
export function num(v: number | string | null | undefined, digits?: number): string {
  if (v == null) return '-';
  if (typeof v !== 'number') return v;
  return digits == null
    ? v.toLocaleString(LOCALE)
    : v.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * 천 단위 축약 — 딜·골드처럼 자릿수가 긴 값. 22450 → "22.5K". 1000 아래도 "0.5K" 로 낸다.
 * 옛 코드의 `(v/1000).toFixed(1)` 은 22450 을 "22.4K" 로 냈다(22.45 가 이진수로 22.449…).
 * 정수를 먼저 반올림하면 딱 절반인 값이 사람이 기대하는 쪽으로 간다.
 */
export function kilo(v: Num): string {
  return (Math.round(Number(v ?? 0) / 100) / 10).toFixed(1) + 'K';
}

/** 1000 이상만 축약한다 — 멤버 상세의 부가 기록(물리 피해 850 을 "0.9K" 로 뭉개지 않게). */
export function kiloIf(v: Num): string {
  const n = Number(v ?? 0);
  return n >= 1000 ? kilo(n) : String(n);
}

/** K/D/A 세 값 → "5/2/7". 비율 KDA 는 백엔드가 누적으로 계산해 보내므로 여기서 나누지 않는다. */
export function kda(k: Num, d: Num, a: Num): string {
  return `${k ?? 0}/${d ?? 0}/${a ?? 0}`;
}

// ── 시간(초) ─────────────────────────────────────────────────────────

/** 초 → "m:ss". 1804 → "30:04". 소수·null·NaN 은 반올림·0 으로 받는다(옛 mmss). */
export function mmss(sec: Num): string {
  const n = Math.round(Number(sec) || 0);
  return `${Math.floor(n / 60)}:${pad2(n % 60)}`;
}

/**
 * 초 → "28분 06초" — 개요 KPI 의 평균 경기 시간. 0·null·NaN 은 '-' (값이 없는 KPI 칸).
 * 옛 fmtDur 는 `n%60` 을 나중에 반올림해 59.6초가 "60초" 가 될 수 있었다 — 먼저 반올림한다.
 */
export function durKo(sec: Num): string {
  const raw = Number(sec);
  if (!raw || !isFinite(raw)) return '-';
  const n = Math.round(raw);
  return `${Math.floor(n / 60)}분 ${pad2(n % 60)}초`;
}

/** 시각(0~23) → "09시" — 시간대 표·막대 툴팁. */
export function hourKo(h: number): string {
  return pad2(h) + '시';
}

// ── 날짜 ─────────────────────────────────────────────────────────────

/** 경기 ts(ms epoch) 나 발행 timestamp(ISO) 를 Date 로. 못 읽으면 null. */
function toDate(x: number | string | null | undefined): Date | null {
  if (x == null || x === '' || x === 0) return null;
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d;
}

/** 경기 날짜 "9. 17." — 기록 카드·검산표. 값이 없으면 ''(줄 자체를 빼는 자리). */
export function dateKo(ts: number | string | null | undefined): string {
  const d = toDate(ts);
  return d ? d.toLocaleDateString(LOCALE, { month: 'numeric', day: 'numeric' }) : '';
}

/** 경기 시각 "9. 17. 오후 08:31" — 경기 목록 한 줄. 값이 없으면 ''. */
export function dateTimeKo(ts: number | string | null | undefined): string {
  const d = toDate(ts);
  return d
    ? d.toLocaleString(LOCALE, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
}

/**
 * 발행 시각 "9/17 20:31" — 개요 KPI 의 '전적 업데이트'. 값이 없으면 '-'(KPI 값 칸이라 비울 수 없다).
 * toLocaleString('ko-KR') 은 "2026. 9. 17. 오후 8:31:54" 를 줘서 25px 굵은 글씨로 쓰면 폰에서
 * 네 줄로 접히고 그리드 행이 95 → 173px 로 뛰었다(실측). 그래서 짧게 적고 정확한 시각은
 * stampFull 로 title 에 남긴다.
 */
export function stampShort(x: number | string | null | undefined): string {
  const d = toDate(x);
  if (!d) return '-';
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 발행 시각 전체 "2026. 9. 17. 오후 8:31:54" — 툴팁용. 값이 없으면 ''(툴팁을 안 단다). */
export function stampFull(x: number | string | null | undefined): string {
  const d = toDate(x);
  return d ? d.toLocaleString(LOCALE) : '';
}

// ── 지표 레지스트리 서식 ─────────────────────────────────────────────

/** fmt 코드 하나로 값을 찍는다 — 지표 키 없이 fmt 만 아는 표 열에서 쓴다. */
export function fmtValue(fmt: MetricFmt, v: number | string | null | undefined): string {
  if (v == null || v === '') return '-';
  if (fmt === 'pct') return pct(Number(v));
  if (fmt === 'sec') return mmss(Number(v));
  if (fmt === 'k') return kilo(Number(v));
  return Number(v).toLocaleString(LOCALE);
}

/**
 * 지표 키로 값을 찍는다. 서식은 발행물의 metric_meta 에서만 읽는다 — 화면에 'pct' 를 따로
 * 적어 두면 백엔드가 지표 서식을 바꿀 때 어긋난다. meta 에 없는 키는 천단위 숫자.
 */
export function fmtMetric(
  key: string,
  v: number | string | null | undefined,
  meta: Record<string, MetricMeta> | null | undefined,
): string {
  return fmtValue(meta?.[key]?.fmt ?? '', v);
}
