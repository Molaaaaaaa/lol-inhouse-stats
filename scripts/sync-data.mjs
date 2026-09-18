// 개발용: main 워크트리(../site/data — 야간 발행이 쓰는 곳)의 발행 JSON 을 public/data 로 복사한다.
// 전환 뒤에는 publish 가 public/data 에 직접 쓰므로 이 스크립트는 필요 없어진다.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../site/data');
const dst = resolve(here, '../public/data');
if (!existsSync(src)) {
  console.error(`원본이 없습니다: ${src}`);
  process.exit(1);
}
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log(`복사 완료: ${src} → ${dst}`);
