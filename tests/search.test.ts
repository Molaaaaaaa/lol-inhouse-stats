import { describe, expect, it } from 'vitest';
import { cho, norm, searchHits } from '../src/lib/search';

const NAMES = ['앙앙맹', '맹구', '앙리', 'Faker', 'Mid King', '쌍둥이', '앙앙'].map((name) => ({ name }));

describe('norm', () => {
  it('소문자·공백 제거, 비어 있으면 빈 문자열', () => {
    expect(norm(' Mid King ')).toBe('midking');
    expect(norm(null)).toBe('');
    expect(norm(undefined)).toBe('');
  });
});

describe('cho', () => {
  it('한글 음절을 초성으로 — 쌍자음·모든 초성 위치가 맞아야 한다', () => {
    expect(cho('앙앙맹')).toBe('ㅇㅇㅁ');
    expect(cho('쌍둥이')).toBe('ㅆㄷㅇ');
    expect(cho('가힣')).toBe('ㄱㅎ');
  });
  it('음절이 아닌 글자(영문·숫자·자모)는 정규화만 하고 그대로 둔다', () => {
    expect(cho('Faker 1')).toBe('faker1');
    expect(cho('ㅇ앙')).toBe('ㅇㅇ');
  });
});

describe('searchHits', () => {
  it('자음만 친 질의는 초성으로 맞춘다 — ㅇㅇㅁ → 앙앙맹', () => {
    expect(searchHits('ㅇㅇㅁ', NAMES).map((c) => c.name)).toEqual(['앙앙맹']);
  });
  it('음절 질의는 부분일치 — 초성으로는 견주지 않는다', () => {
    expect(searchHits('앙맹', NAMES).map((c) => c.name)).toEqual(['앙앙맹']);
    // 음절 '맹' 이 섞였으니 부분일치인데 이름에 'ㅇ맹' 은 없다
    expect(searchHits('ㅇ맹', NAMES)).toEqual([]);
  });
  it('대소문자·공백을 무시한다', () => {
    expect(searchHits('MIDK', NAMES).map((c) => c.name)).toEqual(['Mid King']);
    expect(searchHits('fa ker', NAMES).map((c) => c.name)).toEqual(['Faker']);
  });
  it('앞에서 맞는 이름이 먼저, 같은 위치면 한글 사전순', () => {
    // '맹구' 는 0번째, '앙앙맹' 은 2번째에서 맞는다
    expect(searchHits('맹', NAMES).map((c) => c.name)).toEqual(['맹구', '앙앙맹']);
    // 'ㅇ' 은 앙리·앙앙·앙앙맹(0번째, 사전순) 다음 쌍둥이(ㅆㄷㅇ, 2번째)
    expect(searchHits('ㅇ', NAMES).map((c) => c.name)).toEqual(['앙리', '앙앙', '앙앙맹', '쌍둥이']);
  });
  it('빈 질의·공백만 → 빈 목록, 맞는 이름이 없어도 빈 목록', () => {
    expect(searchHits('', NAMES)).toEqual([]);
    expect(searchHits('   ', NAMES)).toEqual([]);
    expect(searchHits('zzz', NAMES)).toEqual([]);
  });
  it('후보 객체를 그대로 돌려준다 — 호출부가 얹은 키를 잃지 않는다', () => {
    const hit = searchHits('faker', [{ name: 'Faker', key: 'p3' }]);
    expect(hit).toEqual([{ name: 'Faker', key: 'p3' }]);
  });
  it('기본 12개까지, limit 으로 줄일 수 있다', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `멤버${String(i).padStart(2, '0')}` }));
    expect(searchHits('멤버', many)).toHaveLength(12);
    expect(searchHits('멤버', many, 3).map((c) => c.name)).toEqual(['멤버00', '멤버01', '멤버02']);
  });
});
