import { describe, expect, it } from 'vitest';
import { lowerBetter, mDesc, mFmt, mLabel, type MetricMetaMap } from '../src/lib/metrics';

const meta: MetricMetaMap = {
  dpm: { label: '분당 딜', lane: false, fmt: '', desc: '분당 챔피언 피해량' },
  kp: { label: '킬 관여', lane: false, fmt: 'pct', desc: '' },
  first_death: { label: '첫 데스', lane: true, fmt: 'sec', desc: '처음 죽은 시각' },
  blank: { label: '', lane: false, fmt: '', desc: '' },
};
const lower = ['deaths', 'first_death'];

describe('mLabel — 표 머리·칩 이름은 metric_meta.label 만', () => {
  it('사전에 있으면 label', () => {
    expect(mLabel(meta, 'dpm')).toBe('분당 딜');
    expect(mLabel(meta, 'kp')).toBe('킬 관여');
  });
  it('사전에 없거나 사전이 아직 없으면 키 그대로', () => {
    expect(mLabel(meta, 'gold15')).toBe('gold15');
    expect(mLabel(undefined, 'dpm')).toBe('dpm');
    expect(mLabel(null, 'dpm')).toBe('dpm');
    expect(mLabel({}, 'dpm')).toBe('dpm');
  });
  it('label 이 빈 문자열이어도 키로 돌아간다 — 빈 표 머리를 만들지 않는다', () => {
    expect(mLabel(meta, 'blank')).toBe('blank');
  });
});

describe('mFmt / mDesc', () => {
  it('포맷 종류를 돌려주고 없으면 빈 문자열', () => {
    expect(mFmt(meta, 'kp')).toBe('pct');
    expect(mFmt(meta, 'first_death')).toBe('sec');
    expect(mFmt(meta, 'dpm')).toBe('');
    expect(mFmt(meta, 'nope')).toBe('');
    expect(mFmt(undefined, 'kp')).toBe('');
  });
  it('설명을 돌려주고 없으면 빈 문자열', () => {
    expect(mDesc(meta, 'dpm')).toBe('분당 챔피언 피해량');
    expect(mDesc(meta, 'kp')).toBe('');
    expect(mDesc(meta, 'nope')).toBe('');
    expect(mDesc(null, 'dpm')).toBe('');
  });
});

describe('lowerBetter', () => {
  it('목록에 있는 키만 true, 목록이 없으면 false', () => {
    expect(lowerBetter(lower, 'deaths')).toBe(true);
    expect(lowerBetter(lower, 'first_death')).toBe(true);
    expect(lowerBetter(lower, 'dpm')).toBe(false);
    expect(lowerBetter(undefined, 'deaths')).toBe(false);
    expect(lowerBetter(null, 'deaths')).toBe(false);
    expect(lowerBetter([], 'deaths')).toBe(false);
  });
});
