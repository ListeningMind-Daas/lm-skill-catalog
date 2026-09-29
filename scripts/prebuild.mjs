// 빌드 전 카탈로그 데이터 준비.
//  · dev: scripts/build_catalog.py 로 data/catalog.json · public/raw 를 새로 만든다 (python3 · PyYAML · git 필요)
//  · 발행본(Vercel): data/PREBUILT 가 있으면 담겨 온 데이터를 그대로 쓴다 — 빌드 머신에 python·dev 저장소가 없어도 된다
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (existsSync("data/PREBUILT")) {
  if (!existsSync("data/catalog.json")) {
    console.error("data/PREBUILT 인데 data/catalog.json 이 없다 — 발행본이 깨졌다");
    process.exit(1);
  }
  console.log("catalog: 발행본에 담긴 데이터를 쓴다 (data/PREBUILT)");
  process.exit(0);
}
const r = spawnSync("python3", ["scripts/build_catalog.py"], { stdio: "inherit" });
process.exit(r.status ?? 1);
