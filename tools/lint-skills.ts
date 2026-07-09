/**
 * CI 用リンタ（dev 専用・配布外）: スキルの構造と綱領データの健全性を検証する。
 *
 * 実行: node --experimental-strip-types tools/lint-skills.ts
 * 依存: node 組み込みのみ（cross-source import を避け strip-types で直接実行可能にする）。
 * 深いスキーマ検証は cli の `npm test`（data.test.ts / parseCodeOfEthics）が担う。
 * ここではスキル・レベルの不変条件（frontmatter・必須ファイル・件数）を素早く落とす。
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const skillsDir = fileURLToPath(new URL("../skills", import.meta.url));

const errors: string[] = [];
const fail = (msg: string): void => {
  errors.push(msg);
};

/** SKILL.md 冒頭の YAML frontmatter から必須キーの有無をざっくり確認する。 */
function checkFrontmatter(skillName: string, path: string): void {
  const text = readFileSync(path, "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) {
    fail(`${skillName}: SKILL.md に frontmatter (--- で囲む) がありません`);
    return;
  }
  const body = m[1] ?? "";
  for (const key of ["name", "description"]) {
    const re = new RegExp(`^${key}\\s*:\\s*\\S`, "m");
    if (!re.test(body)) fail(`${skillName}: frontmatter に ${key} がありません`);
  }
  const nameMatch = /^name\s*:\s*(.+)$/m.exec(body);
  if (nameMatch && nameMatch[1]?.trim() !== skillName) {
    fail(`${skillName}: frontmatter の name (${nameMatch[1]?.trim()}) がディレクトリ名と不一致`);
  }
}

/** ethics-audit スキルの必須ファイルと綱領データの件数を検証する。 */
function checkEthicsAudit(dir: string): void {
  const required = [
    "01-principles.md",
    "02-dark-patterns.md",
    "03-scoring-rubric.md",
    "04-adversarial-verification.md",
    "05-output-format.md",
    "lib/cli.js",
    "data/se-code.json",
  ];
  for (const rel of required) {
    if (!existsSync(join(dir, rel))) fail(`ethics-audit: 必須ファイル欠落 ${rel}`);
  }

  const dataPath = join(dir, "data/se-code.json");
  if (!existsSync(dataPath)) return;
  const parsed: unknown = JSON.parse(readFileSync(dataPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    fail("ethics-audit: se-code.json がオブジェクトではありません");
    return;
  }
  const record = parsed as Record<string, unknown>;
  const principles = record["principles"];
  const items = record["items"];
  if (!Array.isArray(principles) || principles.length !== 8) {
    fail(`ethics-audit: principles は8個が必要（${Array.isArray(principles) ? principles.length : "非配列"}）`);
  }
  if (!Array.isArray(items) || items.length !== 80) {
    fail(`ethics-audit: items は80個が必要（${Array.isArray(items) ? items.length : "非配列"}）`);
  }
}

function main(): void {
  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const skills = entries.filter((e) => e.isDirectory());
  if (skills.length === 0) fail("skills/ にスキルがありません");

  for (const skill of skills) {
    const dir = join(skillsDir, skill.name);
    const skillMd = join(dir, "SKILL.md");
    if (!existsSync(skillMd)) {
      fail(`${skill.name}: SKILL.md がありません`);
      continue;
    }
    checkFrontmatter(skill.name, skillMd);
    if (skill.name === "ethics-audit") checkEthicsAudit(dir);
  }

  if (errors.length > 0) {
    process.stderr.write(`lint-skills: ${errors.length} 件の問題\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exit(1);
  }
  process.stdout.write(`lint-skills: OK（スキル ${skills.length} 件）\n`);
}

main();
