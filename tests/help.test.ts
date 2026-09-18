import { describe, expect, it } from 'vitest';
import { HELP, baseSampleText, helpText, isHelpKey, type HelpPayload } from '../src/lib/help';
import type { Baseline } from '../src/lib/data/types';

// `inhouse/terms.py` 의 BANNED·EXEMPT 를 그대로 옮겼다. 파이썬 검사는 발행된 site/index.html 만
// 보므로, 소스 단계에서 같은 규칙으로 먼저 잡는다. terms.py 를 고치면 여기도 맞춘다.
const BANNED: Readonly<Record<string, string>> = {
  '궁합': '시너지', '판 수': '판수', '바텀': '원딜', '서포터': '서폿', '레이팅': 'MMR', '스탯': '능력치',
  '선수': '멤버', '볼 멤버': '멤버 선택', '고르면': '선택하면', '고르세요': '선택하세요', '같이 뛴': '함께 뛴',
  '안 뛴': '미출전', '폈다': '펼침', '접었다': '접힘', '빠져 있습니다': '제외', '그리지 못': '표시할 수 없',
  '낼 만': '산정할',
};
// 금지어가 다른 뜻으로 들어가는 자리 — 역할 설명이지 라인 이름이 아니다.
const EXEMPT: Readonly<Record<string, readonly string[]>> = { '서포터': ['서포터와 정글러'] };
const EMOJI = /\p{Extended_Pictographic}/u;

function bannedIn(text: string): string[] {
  return Object.keys(BANNED).filter((bad) =>
    text.includes(bad) && !(EXEMPT[bad] ?? []).some((ex) => text.includes(ex)));
}

const baseline: Baseline = {
  roles: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'],
  tiers: ['GOLD', 'MASTER'], tier_ko: { GOLD: '골드', MASTER: '마스터' },
  quantiles: [0.1, 0.5, 0.9], games: { GOLD: 10000, MASTER: 2345 }, patch_min: '15.1',
  metrics: {},
};
const payloads: readonly HelpPayload[] = [{ baseline: null }, { baseline }];
const KEYS = Object.keys(HELP);

describe('HELP 사전', () => {
  it('옛 사전의 항목 수를 그대로 옮겼다', () => {
    expect(KEYS).toHaveLength(23);
  });

  it('전 항목(키·본문)에 금지어와 이모지가 없다', () => {
    for (const key of KEYS) {
      expect(bannedIn(key), key).toEqual([]);
      expect(EMOJI.test(key), key).toBe(false);
      for (const p of payloads) {
        const txt = helpText(key, p);
        expect(txt.length, key).toBeGreaterThan(0);
        expect(bannedIn(txt), key).toEqual([]);
        expect(EMOJI.test(txt), key).toBe(false);
      }
    }
  });

  it('본문은 textContent 로 꽂히므로 마크업 글자와 앞뒤 공백이 없다', () => {
    for (const key of KEYS) {
      const txt = helpText(key, { baseline });
      expect(txt, key).not.toMatch(/[<>]/);
      expect(txt, key).toBe(txt.trim());
    }
  });

  it('금지어 규칙 자체가 잡는지 — 대체어가 있는 말은 걸리고, 예외 문맥은 넘어간다', () => {
    expect(bannedIn('탑·정글·바텀')).toEqual(['바텀']);
    expect(bannedIn('서포터와 정글러를 구분')).toEqual([]);
    expect(bannedIn('서포터 라인')).toEqual(['서포터']);
  });
});

describe('helpText', () => {
  it('문자열 항목은 그대로, 없는 키·빈 키는 빈 문자열', () => {
    expect(helpText('CP')).toBe(HELP.CP);
    expect(helpText('없는키')).toBe('');
    expect(helpText('')).toBe('');
    expect(helpText(undefined)).toBe('');
    expect(helpText(null)).toBe('');
    expect(isHelpKey('MMR')).toBe(true);
    expect(isHelpKey('toString')).toBe(false);   // 프로토타입 키는 사전 항목이 아니다
  });

  it('기준선은 payload 의 표본 크기·패치를 글에 넣는다 — 상수를 박지 않는다', () => {
    expect(helpText('기준선', { baseline })).toContain('솔랭 표본(12,345판, 패치 15.1 이후)');
    expect(helpText('기준선', { baseline: null })).toContain('솔랭 표본(솔랭 표본)');
    expect(helpText('기준선')).toBe(helpText('기준선', { baseline: null }));
  });
});

describe('baseSampleText', () => {
  it('games 는 티어별 dict 라 합쳐 쓰고, 패치가 있으면 붙인다', () => {
    expect(baseSampleText(baseline)).toBe('12,345판, 패치 15.1 이후');
    expect(baseSampleText({ ...baseline, patch_min: '' })).toBe('12,345판');
    expect(baseSampleText({ ...baseline, games: {} })).toBe('솔랭 표본, 패치 15.1 이후');
    expect(baseSampleText(null)).toBe('솔랭 표본');
    expect(baseSampleText(undefined)).toBe('솔랭 표본');
  });
  it('숫자가 아닌 값은 0 으로 보고 넘어간다', () => {
    const g = { GOLD: '7', MASTER: 'x' } as unknown as Record<string, number>;
    expect(baseSampleText({ ...baseline, games: g, patch_min: '' })).toBe('7판');
  });
});
