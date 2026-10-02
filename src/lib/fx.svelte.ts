/**
 * 수식 줄(FormulaBar) 전역 상태 — 화면이 "지금 선택된 것의 계산 근거" 를 여기에 쓴다.
 *
 * 예: 멤버 시트 행 선택 → `=승률(6/10) → 60%`
 *     순위 표 행 선택 → `=승률(탑 6/6) → 100% · 신뢰성 61%`
 * 비어 있으면 FormulaBar 가 안내문을 보인다. 화면(섹션)이 바뀌면 App 이 비운다 —
 * 지난 화면의 근거가 새 화면 위에 남아 있으면 거짓말이 되기 때문이다.
 */
export const fx = $state({ text: '' });

export function setFx(text: string): void {
  fx.text = text;
}

export function clearFx(): void {
  fx.text = '';
}
