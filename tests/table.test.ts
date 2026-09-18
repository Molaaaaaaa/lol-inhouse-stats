import { describe, expect, it } from 'vitest';
import {
  FILTER_MIN, FOLD_MIN, FOLD_SHOW, barPct, cellText, colMax, compareValues,
  defaultDir, filterRows, nextSort, rowText, sortRows, type Col,
} from '../src/lib/table';

interface Row { name: string; wins: number | null; wr: number; champ?: string }

const ROWS: Row[] = [
  { name: '앙앙맹', wins: 3, wr: 0.6 },
  { name: 'Faker', wins: 7, wr: 0.7 },
  { name: '맹구', wins: null, wr: 0.5 },
  { name: '쌍둥이', wins: 5, wr: 0.55 },
];
const COLS: Col<Row>[] = [
  { k: 'name', h: '멤버' },
  { k: 'wins', h: '승', num: true, nullLast: true },
  { k: 'wr', h: '승률', num: true, fmt: (v) => `${Math.round(Number(v) * 100)}%` },
];
const names = (rs: Row[]) => rs.map((r) => r.name);

describe('compareValues', () => {
  it('숫자는 숫자로, 문자열은 한국어 사전순', () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues('10', 9)).toBeGreaterThan(0);     // 숫자가 하나라도 있으면 숫자 비교
    expect(compareValues('가', '나')).toBeLessThan(0);
    expect(compareValues('b', 'a')).toBeGreaterThan(0);
  });
  it('빈 값(null·undefined·NaN)은 가장 작다', () => {
    expect(compareValues(null, 0)).toBeLessThan(0);
    expect(compareValues(undefined, 'a')).toBeLessThan(0);
    expect(compareValues(NaN, -5)).toBeLessThan(0);
    expect(compareValues(null, undefined)).toBe(0);
  });
});

describe('sortRows', () => {
  it('키가 없으면 복사만 — 원본을 건드리지 않는다', () => {
    const out = sortRows(ROWS, null);
    expect(out).toEqual(ROWS);
    expect(out).not.toBe(ROWS);
  });
  it('내림차순(-1) 이 기본, 오름차순(1)', () => {
    expect(names(sortRows(ROWS, 'wr'))).toEqual(['Faker', '앙앙맹', '쌍둥이', '맹구']);
    expect(names(sortRows(ROWS, 'wr', 1))).toEqual(['맹구', '쌍둥이', '앙앙맹', 'Faker']);
  });
  it('빈 값: 기본은 가장 작은 값(내림차순 맨 아래·오름차순 맨 위), nullLast 면 방향과 무관하게 맨 아래', () => {
    expect(names(sortRows(ROWS, 'wins', -1)).at(-1)).toBe('맹구');
    expect(names(sortRows(ROWS, 'wins', 1))[0]).toBe('맹구');
    expect(names(sortRows(ROWS, 'wins', 1, true))).toEqual(['앙앙맹', '쌍둥이', 'Faker', '맹구']);
    expect(names(sortRows(ROWS, 'wins', -1, true))).toEqual(['Faker', '쌍둥이', '앙앙맹', '맹구']);
  });
  it('문자열 열은 사전순, 안정 정렬(같은 값은 들어온 순서)', () => {
    // 한글끼리는 가나다순. 한글·영문 사이 순서는 ICU 조합 규칙이라 단정하지 않는다
    expect(names(sortRows(ROWS, 'name', 1)).filter((n) => n !== 'Faker')).toEqual(['맹구', '쌍둥이', '앙앙맹']);
    expect(names(sortRows(ROWS, 'name', -1)).filter((n) => n !== 'Faker')).toEqual(['앙앙맹', '쌍둥이', '맹구']);
    const tie = [{ name: 'a', v: 1 }, { name: 'b', v: 1 }, { name: 'c', v: 2 }];
    expect(sortRows(tie, 'v', -1).map((r) => r.name)).toEqual(['c', 'a', 'b']);
  });
});

describe('defaultDir · nextSort', () => {
  it('낮을수록 좋은 열만 처음에 오름차순', () => {
    expect(defaultDir('deaths', ['deaths'])).toBe(1);
    expect(defaultDir('kills', ['deaths'])).toBe(-1);
    expect(defaultDir(undefined)).toBe(-1);
  });
  it('같은 열이면 반전, 다른 열이면 그 열의 기본 방향', () => {
    expect(nextSort({ k: 'wr', d: -1 }, 'wr')).toEqual({ k: 'wr', d: 1 });
    expect(nextSort({ k: 'wr', d: 1 }, 'wr')).toEqual({ k: 'wr', d: -1 });
    expect(nextSort({ k: 'wr', d: 1 }, 'wins')).toEqual({ k: 'wins', d: -1 });
    expect(nextSort({ k: null, d: -1 }, 'deaths', ['deaths'])).toEqual({ k: 'deaths', d: 1 });
  });
});

describe('cellText · rowText', () => {
  it('fmt 가 있으면 그것, 없으면 값 그대로, 빈 값은 빈 문자열', () => {
    expect(cellText(COLS[2]!, ROWS[0]!, 0)).toBe('60%');
    expect(cellText(COLS[0]!, ROWS[0]!, 0)).toBe('앙앙맹');
    expect(cellText(COLS[1]!, ROWS[2]!, 0)).toBe('');
  });
  it('행 글자는 숫자 열을 뺀다', () => {
    expect(rowText(ROWS[1]!, COLS, 0)).toBe('Faker ');
  });
});

describe('filterRows', () => {
  it('빈 질의는 전부(복사), 부분일치는 대소문자·공백 무시', () => {
    expect(filterRows(ROWS, '', COLS)).toEqual(ROWS);
    expect(filterRows(ROWS, '  ', COLS)).not.toBe(ROWS);
    expect(names(filterRows(ROWS, 'FAK', COLS))).toEqual(['Faker']);
    expect(names(filterRows(ROWS, '맹', COLS))).toEqual(['앙앙맹', '맹구']);
  });
  it('자음만 치면 초성으로 견준다', () => {
    expect(names(filterRows(ROWS, 'ㅇㅇㅁ', COLS))).toEqual(['앙앙맹']);
    expect(names(filterRows(ROWS, 'ㅆㄷ', COLS))).toEqual(['쌍둥이']);
  });
  it('숫자 열은 보지 않는다 — 5 를 쳐도 승 5 는 안 걸린다', () => {
    expect(filterRows(ROWS, '5', COLS)).toEqual([]);
  });
  it('fmt 결과(보이는 글자)로 견준다', () => {
    const cols: Col<Row>[] = [{ k: 'wr', h: '승률', fmt: (v) => (Number(v) > 0.6 ? '상위' : '보통') }];
    expect(names(filterRows(ROWS, '상위', cols))).toEqual(['Faker']);
  });
});

describe('막대', () => {
  it('colMax 는 열 최대값, 전부 0 이하면 아주 작은 양수', () => {
    expect(colMax(ROWS, 'wr')).toBe(0.7);
    expect(colMax(ROWS, 'wins')).toBe(7);
    expect(colMax([{ v: 0 }, { v: -1 }], 'v')).toBeGreaterThan(0);
    expect(colMax([], 'v')).toBeGreaterThan(0);
  });
  it('barPct 는 0~100 사이 소수 첫째 자리', () => {
    expect(barPct(0.35, 0.7)).toBe(50);
    expect(barPct(1, 3)).toBe(33.3);
    expect(barPct(-2, 3)).toBe(0);
    expect(barPct(9, 3)).toBe(100);
    expect(barPct(null, 3)).toBe(0);
  });
});

describe('문턱 상수', () => {
  it('접기 16·10, 거르기 20 — 브리프 값', () => {
    expect(FOLD_MIN).toBe(16);
    expect(FOLD_SHOW).toBe(10);
    expect(FILTER_MIN).toBe(20);
  });
});
