import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCodeOfEthics } from "../src/validate.js";

/** 生成済みの綱領データを直接読み、スキーマ・件数・整合性を検証する。 */
const dataPath = fileURLToPath(
  new URL("../../skills/ethics-audit/data/se-code.json", import.meta.url),
);
const ethics = parseCodeOfEthics(JSON.parse(readFileSync(dataPath, "utf8")));

test("原則は8個", () => {
  assert.equal(ethics.principles.length, 8);
  assert.deepEqual(
    ethics.principles.map((p) => p.number),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
});

test("項目は80個（5.2版の正確な件数）", () => {
  assert.equal(ethics.items.length, 80);
});

test("原則ごとの項目数が綱領5.2版と一致する", () => {
  const expected: Record<number, number> = { 1: 8, 2: 9, 3: 15, 4: 6, 5: 12, 6: 13, 7: 8, 8: 9 };
  for (const [num, count] of Object.entries(expected)) {
    const actual = ethics.items.filter((it) => it.principle === Number(num)).length;
    assert.equal(actual, count, `原則${num}の項目数`);
  }
});

test("全項目IDが一意で N.MM 形式", () => {
  const seen = new Set<string>();
  for (const it of ethics.items) {
    assert.match(it.id, /^[1-8]\.\d{2}$/);
    assert.ok(!seen.has(it.id), `重複ID: ${it.id}`);
    seen.add(it.id);
  }
});

test("各項目の text は非空、title は text の接頭", () => {
  for (const it of ethics.items) {
    assert.ok(it.text.length > 0, `${it.id} text`);
    const head = it.title.replace(/…$/, "");
    assert.ok(it.text.startsWith(head), `${it.id} title は text の接頭であるべき`);
  }
});
