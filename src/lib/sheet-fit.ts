/**
 * 표가 래퍼에 들어가는지, 안 들어가면 오른쪽 경계 너머로 잘린 머리 칸이 몇 개인지 잰다 — DataTable 과
 * SheetCaption(자체 격자를 쓰는 멤버 세부 지표·경기 상세)이 같은 잣대를 쓴다.
 */

/** 2px 이하 넘침은 맞는 것으로 본다 — 360px 에서 열 min-content 합이 336.56 → 337 로 1px 넘쳐 sticky 머리를
 *  잃고 '열 1개 더 →' 가 거짓으로 떴다(실측). overflow visible 이면 그 1px 은 본문 여백에 들어가 문서는 안 넘친다 */
const FIT_SLACK = 2;

interface SheetFit {
  fit: boolean;
  /** 오른쪽 경계 너머로 잘린 머리 칸 수(숨긴 .lo 열은 너비 0 이라 세지 않는다). 맞으면 0 */
  cut: number;
  tableH: number;
}

/** s = 가로 스크롤 래퍼(.sheet), t = 그 안의 표 */
export function measureSheet(s: HTMLElement, t: HTMLTableElement): SheetFit {
  const fit = t.offsetWidth - s.clientWidth <= FIT_SLACK;
  const tableH = t.offsetHeight;
  if (fit) return { fit, cut: 0, tableH };
  const edge = s.scrollLeft + s.clientWidth + 1 + FIT_SLACK;
  let cut = 0;
  for (const th of t.querySelectorAll<HTMLElement>('thead th')) {
    if (th.offsetWidth > 0 && th.offsetLeft + th.offsetWidth > edge) cut++;
  }
  return { fit, cut, tableH };
}
