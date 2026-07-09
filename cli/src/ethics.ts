/**
 * 綱領データ（data/se-code.json）のローダ。
 *
 * ビルド後、本モジュールは skills/ethics-audit/lib/ethics.js となり、
 * データは skills/ethics-audit/data/se-code.json に置かれる（相対 ../data/）。
 * import.meta.url を基準に解決するため、CWD に依存しない。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { CodeOfEthics } from "./schema.js";
import { parseCodeOfEthics } from "./validate.js";

/** 綱領JSONの絶対パスを import.meta.url 基準で解決する。 */
export function codeDataPath(): string {
  return fileURLToPath(new URL("../data/se-code.json", import.meta.url));
}

let cached: CodeOfEthics | undefined;

/** 綱領データを読み込み・検証して返す（プロセス内キャッシュ）。 */
export function loadCodeOfEthics(): CodeOfEthics {
  if (cached !== undefined) return cached;
  const raw = readFileSync(codeDataPath(), "utf8");
  const parsed: unknown = JSON.parse(raw);
  cached = parseCodeOfEthics(parsed);
  return cached;
}
