import{F as e,I as t,J as n,K as r,L as i,N as a,P as o,W as s,X as c,Y as l,Z as u,at as d,nt as f,rt as p,tt as m}from"./index-7qCFR3Cv.js";import{i as h,m as g,s as _,t as v,v as y}from"./DataTable-CZCYLrgg.js";var b=i(`<div class="cuts svelte-uigxh0"><!></div>`),x=i(`<section class="cpf svelte-uigxh0" aria-labelledby="cpf-h"><h2 id="cpf-h" class="cap svelte-uigxh0">티어 계산식</h2> <p class="note svelte-uigxh0">점수는 둘이 한 쌍으로 움직입니다. 롤이 MMR 과 LP 를 나눈 것과 같은 구조입니다.</p> <pre class="fml svelte-uigxh0"> </pre> <h3 class="cap svelte-uigxh0"><span class="stp svelte-uigxh0">1</span>이 판에 쓰는 실력 — 실제로 선 라인 기준</h3> <pre class="fml svelte-uigxh0"> </pre> <p class="note svelte-uigxh0"> </p> <h3 class="cap svelte-uigxh0"><span class="stp svelte-uigxh0">2</span>이길 확률 — 팀 대 팀, 다섯 명이 같은 값</h3> <pre class="fml svelte-uigxh0">E = 1 ÷ (1 + 10^((상대 팀 평균 실력 − 우리 팀 평균 실력) ÷ 400))</pre> <p class="note svelte-uigxh0">개인 대 상대 팀으로 재지 않습니다. 밸런스를 맞춘 방에서 강한 멤버는 개인 기대치가 0.8 이어도
      팀이 반반이라 50% 만 이기고, 그 어긋남이 판수에 비례해 점수를 흘려보냅니다. 결과를 정하는 것은 팀 합뿐입니다.</p> <h3 class="cap svelte-uigxh0"><span class="stp svelte-uigxh0">3</span>기여도 — 라인 안에서, 팀 안에서</h3> <pre class="fml svelte-uigxh0"> </pre> <p class="note svelte-uigxh0">라인 안에서 재는 이유: 딜 비중·킬 관여는 라인을 심하게 탑니다. 라인 보정 없이 재면 기여도가
      실력이 아니라 라인을 재고, 딜 비중이 낮은 라인은 판마다 점수를 잃습니다. 팀 안에서 합이 0 이라 차등은
      팀 안에서만 재분배되고 총점은 새지 않습니다.</p> <h3 class="cap svelte-uigxh0"><span class="stp svelte-uigxh0">4</span>MMR 갱신 — 정확성 담당</h3> <pre class="fml svelte-uigxh0"> </pre> <p class="note svelte-uigxh0">기여 보정을 곱하지 않고 더하는 이유: 곱하면 진 경기를 캐리한 멤버가 더 잃습니다. 더하면 잘한
      멤버는 이길 때 더 받고 져도 덜 잃습니다. 판이 쌓일수록 K 를 줄이는 것은 승패의 잡음이 덜 쌓이게 하기 위해서입니다.</p> <h3 class="cap svelte-uigxh0"><span class="stp svelte-uigxh0">5</span> </h3> <pre class="fml svelte-uigxh0"> </pre> <p class="note svelte-uigxh0"> </p> <p class="note svelte-uigxh0"> </p> <h3 class="cap svelte-uigxh0"><span class="stp svelte-uigxh0">6</span>티어 — CP 에 눈금을 그은 것</h3> <pre class="fml svelte-uigxh0"> </pre> <!> <p class="note svelte-uigxh0"> </p> <p class="note svelte-uigxh0"> </p> <p class="note svelte-uigxh0"> </p></section>`);function S(i,S){p(S,!0);let C=m(()=>S.data?.cp_constants),w=m(()=>S.data?.metric_meta),T=m(()=>_(S.data)),E=m(()=>s(C)?.placement_games??0),D=m(()=>s(C)?.tier_points??0),O=m(()=>s(C)?(1-s(C).e_clamp).toFixed(3):``),k=[`kp`,`dmg_share`,`kda_n`],A=m(()=>{let e=s(C)?.contrib_weights;return e?k.map(t=>`${t===`kda_n`?`ln(1+KDA)`:g(s(w),t)} ${Math.round((e[t]??0)*100)}%`).join(` · `):``}),j=m(()=>s(C)?s(C).k_decay_half?`${s(C).k_norm} 에서 시작해 ${s(C).k_decay_half}판마다 절반, 최소 ${s(C).k_min}`:`${s(C).k_norm} 고정`:``),M=m(()=>s(T).filter(e=>e.cp!=null).map(e=>e.cp).join(` · `)),N=m(()=>s(T).map((e,t)=>{let n=t>0?s(T)[t-1]?.cp??null:null,r=e.cp==null?n==null?`전체`:`${n-1} 이하`:n==null?`${e.cp} 이상`:`${e.cp}~${n-1}`;return{name:e.name,idx:t+1,range:r,note:e.open_top?`상한 없음`:e.cp==null?`최하위`:``}})),P=[{k:`name`,h:`티어`,cls:e=>`t${e.idx}`,sortable:!1},{k:`range`,h:`CP`,num:!0,sortable:!1},{k:`note`,h:`비고`,sortable:!1}],F=`MIDDLE`;var I=t(),L=l(I),R=e=>{h(e,{text:`아직 계산식을 표시할 데이터가 없습니다.`})},z=t=>{var i=x(),l=u(n(i),4),f=c(l),p=u(l,4),m=c(p),h=u(p,2),g=c(h),_=u(h,10),S=c(_),w=u(_,6),k=c(w),I=u(w,4),L=u(n(I));d(I);var R=u(I,2),z=c(R),B=u(R,2),V=c(B),H=u(B,2),U=c(H),W=u(H,4),G=c(W),K=u(W,2),q=t=>{var r=b(),i=n(r);v(i,{get rows(){return s(N)},get cols(){return P},caption:`티어 컷`,rowNumbers:!1,compact:!0}),d(r),e(t,r)};a(K,e=>{s(N).length&&e(q)});var J=u(K,2),Y=c(J),X=u(J,2),Z=c(X),Q=u(X,2),$=c(Q);d(i),r((e,t,n,r)=>{o(f,`MMR   숨은 추정치입니다. 증거만큼 움직이며, 다음 판 승률 계산과 CP 를 끌어당기는 기준점으로 씁니다.
CP    보이는 점수입니다. 이기면 +${s(C).cp_min??``}~${s(C).cp_max??``}, 지면 −${s(C).cp_min??``}~${s(C).cp_max??``} 로 규칙적입니다.
티어   CP 를 ${s(D)??``}점 단위로 나눈 것입니다. 그래서 CP 와 티어는 어긋나지 않습니다.`),o(m,`실력 = MMR + 라인 편차(그 판의 라인)
라인 편차 = (n × 관측 + ${s(C).lane_prior_k??``} × 사전값) ÷ (n + ${s(C).lane_prior_k??``})      n = 그 라인 판수
  관측 = (그 라인 잔차 평균 − 전체 잔차 평균) × ${s(C).dev_scale??``} 을 ±${s(C).dev_cap??``} 로 자름
  사전값 = 0 (주 라인) / ${s(C).off_lane_prior??``} (그 외)`),o(g,`${e??``}이 주 라인인 멤버가 ${t??``}로 출전하면 ${n??``} 실력으로 계산합니다.
      n/(n+${s(C).lane_prior_k??``}) 는 라인 배치 ${s(C).lane_prior_k??``}판입니다. 1판짜리 라인이 실력처럼 보이면 안 되기 때문입니다.
      주 라인의 사전값이 0 인 이유: 전체 MMR 자체가 대부분 주 라인에서 만들어진 숫자라, 거기에도 벌점을 걸면
      다섯 라인이 전부 자기 CP 아래로 내려갑니다.`),o(S,`재료 = ${s(A)??``}
각 재료를 그 라인의 평균·표준편차로 z 화   (기준값은 n/(n+${s(C).lane_base_k??``}) 로 수축)
기여도 = 1 + ${s(C).contrib_z_scale??``} × (z − 팀 평균 z)   를 ${s(C).contrib_lo??``}~${s(C).contrib_hi??``} 로 자름
기여 보정 = (기여도 − 1) × ${s(C).perf_w??``}   ← 팀 안에서 합이 0`),o(k,`ΔMMR = K × ((결과 − E) + 기여 보정)      결과 = 승 1 / 패 0
K = ${s(C).k_place??``} (배치 ${s(E)??``}판 동안) → ${s(j)??``}`),o(L,`CP 갱신 — 한 판에 ${s(C).cp_min??``}~${s(C).cp_max??``}`),o(z,`ec = E 를 ${s(C).e_clamp??``}~${s(O)??``} 로 자름
기본 폭 = ${s(C).cp_size??``} × (1 − ec)  (이길 때)   /   ${s(C).cp_size??``} × ec  (질 때)
gap = ((MMR − CP) ÷ ${s(C).cp_gap_div??``}) 을 ±${s(C).cp_gap_cap??``} 로 자름
보정 = gap + 기여 보정 × ${s(C).cp_adj_w??``}
이기면  ΔCP = +(기본 폭 + 보정) 을 ${s(C).cp_min??``}~${s(C).cp_max??``} 로 자름
지면    ΔCP = −(기본 폭 − 보정) 을 ${s(C).cp_min??``}~${s(C).cp_max??``} 로 자름`),o(V,`${s(C).cp_size??``} 와 ${s(C).e_clamp??``} 는 정한 값이 아니라 유도된 값입니다. 점수 총합이 흘러가지 않으려면
      이길 때 얻는 값과 질 때 잃는 값의 합이 ${s(C).cp_min??``}+${s(C).cp_max??``}=${s(C).cp_size??``} 로 고정돼야 하고, 두 값이
      ${s(C).cp_min??``}~${s(C).cp_max??``} 안에 있으려면 E 가 ${s(C).e_clamp??``}~${s(O)??``} 안이어야 합니다. 불리한 판을 이기면
      ${s(C).cp_max??``} 에 가깝게, 유리한 판을 이기면 ${s(C).cp_min??``} 에 가깝게 받습니다.`),o(U,`gap 이 롤의 'LP 가 MMR 을 따라가는' 장치입니다. CP 가 MMR 보다 뒤처져 있으면 판마다 최대
      ±${s(C).cp_gap_cap??``} 씩 더 얹어 따라붙게 합니다.`),o(G,`티어 = CP 가 어느 ${s(D)??``}점 칸에 있는가       티어 점수 = 그 칸 안에서 몇 점인가
배치 ${s(E)??``}판을 마치기 전에는 티어를 표시하지 않습니다 (그 구간은 K=${s(C).k_place??``} 라 크게 흔들립니다)`),o(Y,`경계가 ${s(M)??``} 인 이유: 점수 총합이 보존되어 방 평균이 ${s(C).cp_base??``} 에 고정되므로, 평균인 멤버가
      가운데 티어의 한가운데에 오게 놓았습니다. 경계를 ${s(C).cp_base??``} 에 두면 방의 절반이 영원히 경계 위에서
      오르내립니다. 승급 보호(버퍼)는 일부러 없습니다. 넣으면 'CP 는 높은데 티어는 낮은' 역전이 생깁니다.
      대신 경계 근처의 오르내림은 숨기지 않고 다음 티어까지 몇 점으로 드러냅니다.`),o(Z,`1티어는 ${s(D)-1}점을 넘어갑니다. 위가 없으니 자를 이유가 없습니다. 위로 갈수록 오르기 힘든 것은
      따로 규칙 없이 이미 그렇습니다. 유리한 쪽은 이겨도 ${s(C).cp_min??``} 에 가깝게 받고 져도 ${s(C).cp_max??``} 에 가깝게
      잃습니다. 마지막 티어는 0점에서 멈추되 보이는 점수만 멈춥니다. 속까지 막으면 그 멤버를 이긴 쪽에 점수가
      새로 생겨 전체가 부풉니다.`),o($,`왜 ${s(T).length??``}단계인가: 판이 쌓여도 점수 폭은 약 400 근처에서 멈춥니다. 티어 하나가 운과
      구분되려면 그만한 폭이 필요하니 400÷${s(D)??``}≈${r??``}단계가 이 방의 해상도입니다.
      더 잘게 나누면 한 판 두고 티어가 바뀌는 일이 대부분이 됩니다. 그것은 티어가 아니라 점수판입니다.`)},[()=>y(`UTILITY`),()=>y(F),()=>y(F),()=>Math.round(400/(s(D)||100))]),e(t,i)};a(L,e=>{s(C)?e(z,-1):e(R)}),e(i,I),f()}export{S as t};