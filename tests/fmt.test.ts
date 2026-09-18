import { describe, expect, it } from 'vitest';
import {
  pct, sgn, num, kilo, kiloIf, kda,
  mmss, durKo, hourKo,
  dateKo, dateTimeKo, stampShort, stampFull,
  fmtValue, fmtMetric,
} from '../src/lib/fmt';
import type { MetricFmt, MetricMeta } from '../src/lib/data/types';

// 입력값은 실발행물(g02d21130, 2026-09-17)에서 뽑았다 — 옛 화면이 실제로 찍던 숫자다.
const meta = (fmt: MetricFmt): MetricMeta => ({ label: 'x', lane: false, fmt, desc: '' });
const META: Record<string, MetricMeta> = {
  kp: meta('pct'), longest_living: meta('sec'), total_dmg: meta('k'), dpm: meta(''),
};
// 날짜는 로컬 시각으로 만든다 — 시간대가 다른 기계(CI·개발자 PC)에서도 같은 글자가 나와야 한다.
const evening = new Date(2026, 8, 17, 20, 31, 54);
const morning = new Date(2026, 0, 5, 9, 7, 0);

describe('숫자', () => {
  it('pct — 비율 → 정수 퍼센트, null 은 0%', () => {
    expect(pct(0.484)).toBe('48%');
    expect(pct(0.5)).toBe('50%');
    expect(pct(1)).toBe('100%');
    expect(pct(0)).toBe('0%');
    expect(pct(null)).toBe('0%');
  });
  it('sgn — 양수에만 +, 기본 소수 3자리', () => {
    expect(sgn(0.12)).toBe('+0.120');
    expect(sgn(-0.05)).toBe('-0.050');
    expect(sgn(0)).toBe('0.000');
    expect(sgn(1.234, 2)).toBe('+1.23');
    expect(sgn(-3.456, 1)).toBe('-3.5');
  });
  it('num — 천단위, 문자열 기록값 통과, null 은 -', () => {
    expect(num(1234567)).toBe('1,234,567');
    expect(num(21622)).toBe('21,622');
    expect(num(612.7)).toBe('612.7');
    expect(num(612.7, 0)).toBe('613');
    expect(num(2.375, 2)).toBe('2.38');
    expect(num('+144')).toBe('+144');
    expect(num('30:13')).toBe('30:13');
    expect(num(null)).toBe('-');
    expect(num(undefined)).toBe('-');
  });
  it('kilo — 천 단위 축약, 절반은 올림', () => {
    expect(kilo(22450)).toBe('22.5K');
    expect(kilo(67094)).toBe('67.1K');
    expect(kilo(21622)).toBe('21.6K');
    expect(kilo(500)).toBe('0.5K');
    expect(kilo(null)).toBe('0.0K');
  });
  it('kiloIf — 1000 아래는 그대로', () => {
    expect(kiloIf(850)).toBe('850');
    expect(kiloIf(1000)).toBe('1.0K');
    expect(kiloIf(21622)).toBe('21.6K');
  });
  it('kda — K/D/A 세 값', () => {
    expect(kda(5, 2, 7)).toBe('5/2/7');
    expect(kda(0, 0, 0)).toBe('0/0/0');
    expect(kda(undefined, null, 3)).toBe('0/0/3');
  });
});

describe('시간(초)', () => {
  it('mmss — 초 → m:ss', () => {
    expect(mmss(1804)).toBe('30:04');
    expect(mmss(2496)).toBe('41:36');
    expect(mmss(914)).toBe('15:14');
    expect(mmss(1813)).toBe('30:13');
    expect(mmss(0)).toBe('0:00');
    expect(mmss(null)).toBe('0:00');
    expect(mmss(undefined)).toBe('0:00');
  });
  it('mmss — 소수 초는 먼저 반올림한다 (59.6 → 1:00, "0:60" 이 아니다)', () => {
    expect(mmss(59.6)).toBe('1:00');
    expect(mmss(1804.4)).toBe('30:04');
  });
  it('durKo — 초 → n분 ss초, 값 없음은 -', () => {
    expect(durKo(1686)).toBe('28분 06초');
    expect(durKo(2496)).toBe('41분 36초');
    expect(durKo(0)).toBe('-');
    expect(durKo(null)).toBe('-');
    expect(durKo(NaN)).toBe('-');
    expect(durKo(Infinity)).toBe('-');
    expect(durKo(1739.6)).toBe('29분 00초');
  });
  it('hourKo — 두 자리 시', () => {
    expect(hourKo(9)).toBe('09시');
    expect(hourKo(22)).toBe('22시');
    expect(hourKo(0)).toBe('00시');
  });
});

describe('날짜', () => {
  it('dateKo — 경기 ts(ms) → "월. 일."', () => {
    expect(dateKo(evening.getTime())).toBe('9. 17.');
    expect(dateKo(morning.getTime())).toBe('1. 5.');
    expect(dateKo(0)).toBe('');
    expect(dateKo(null)).toBe('');
    expect(dateKo(undefined)).toBe('');
  });
  it('dateTimeKo — 경기 목록 한 줄', () => {
    expect(dateTimeKo(evening.getTime())).toBe('9. 17. 오후 08:31');
    expect(dateTimeKo(morning.getTime())).toBe('1. 5. 오전 09:07');
    expect(dateTimeKo(0)).toBe('');
    expect(dateTimeKo(null)).toBe('');
  });
  it('stampShort — 발행 ISO → "M/D HH:mm", 못 읽으면 -', () => {
    expect(stampShort(evening.toISOString())).toBe('9/17 20:31');
    expect(stampShort(morning.toISOString())).toBe('1/5 09:07');
    expect(stampShort(evening.getTime())).toBe('9/17 20:31');
    expect(stampShort('')).toBe('-');
    expect(stampShort('not-a-date')).toBe('-');
    expect(stampShort(undefined)).toBe('-');
  });
  it('stampFull — 툴팁용 전체 시각, 못 읽으면 빈 문자열', () => {
    expect(stampFull(evening.toISOString())).toBe('2026. 9. 17. 오후 8:31:54');
    expect(stampFull('')).toBe('');
    expect(stampFull('not-a-date')).toBe('');
    expect(stampFull(null)).toBe('');
  });
});

describe('지표 서식', () => {
  it('fmtValue — fmt 코드별 분기', () => {
    expect(fmtValue('pct', 0.484)).toBe('48%');
    expect(fmtValue('sec', 1804)).toBe('30:04');
    expect(fmtValue('k', 22450)).toBe('22.5K');
    expect(fmtValue('', 1234)).toBe('1,234');
    expect(fmtValue('', 612.7)).toBe('612.7');
    expect(fmtValue('', '1234')).toBe('1,234');
  });
  it('fmtValue — 빈 값은 서식과 무관하게 -', () => {
    expect(fmtValue('pct', null)).toBe('-');
    expect(fmtValue('sec', undefined)).toBe('-');
    expect(fmtValue('k', '')).toBe('-');
    expect(fmtValue('', null)).toBe('-');
  });
  it('fmtMetric — metric_meta 에서 서식을 읽고, 없는 키는 천단위 숫자', () => {
    expect(fmtMetric('kp', 0.484, META)).toBe('48%');
    expect(fmtMetric('longest_living', 1804, META)).toBe('30:04');
    expect(fmtMetric('total_dmg', 22450, META)).toBe('22.5K');
    expect(fmtMetric('dpm', 612.7, META)).toBe('612.7');
    expect(fmtMetric('nope', 5000, META)).toBe('5,000');
    expect(fmtMetric('kp', 0.484, undefined)).toBe('0.484');   // meta 없이는 pct 인지 모른다
    expect(fmtMetric('kp', null, META)).toBe('-');
    expect(fmtMetric('kp', '', META)).toBe('-');
  });
});
