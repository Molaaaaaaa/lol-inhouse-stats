import { describe, expect, it } from 'vitest';
import { LANE_KO, LANE_SEQ, isLaneId, laneIdx, laneKo } from '../src/lib/lanes';

describe('lanes', () => {
  it('라인 5개, 표기는 terms.py CANON — 원딜·서폿', () => {
    expect(LANE_SEQ).toEqual(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']);
    expect(Object.keys(LANE_KO)).toHaveLength(5);
    expect(LANE_KO.BOTTOM).toBe('원딜');
    expect(LANE_KO.UTILITY).toBe('서폿');
    for (const l of LANE_SEQ) expect(LANE_KO[l]).toBeTruthy();
  });
  it('laneKo — 아는 키는 표기, 모르는 키는 그대로, 비면 ?', () => {
    expect(laneKo('TOP')).toBe('탑');
    expect(laneKo('BOTTOM')).toBe('원딜');
    expect(laneKo('NONE')).toBe('NONE');
    expect(laneKo('')).toBe('?');
    expect(laneKo(null)).toBe('?');
    expect(laneKo(undefined)).toBe('?');
  });
  it('laneIdx — 표시 순서, 모르는 라인은 맨 뒤(9)', () => {
    expect(laneIdx('TOP')).toBe(0);
    expect(laneIdx('UTILITY')).toBe(4);
    expect(laneIdx('NONE')).toBe(9);
    expect(laneIdx(null)).toBe(9);
    const sorted = ['UTILITY', 'TOP', 'NONE', 'MIDDLE'].sort((a, b) => laneIdx(a) - laneIdx(b));
    expect(sorted).toEqual(['TOP', 'MIDDLE', 'UTILITY', 'NONE']);
  });
  it('isLaneId — 문자열 라인 키만 참, 프로토타입 키는 거짓', () => {
    expect(isLaneId('JUNGLE')).toBe(true);
    expect(isLaneId('jungle')).toBe(false);
    expect(isLaneId('toString')).toBe(false);
    expect(isLaneId(3)).toBe(false);
    expect(isLaneId(null)).toBe(false);
  });
});
