import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  PRINCIPLE_WEIGHT,
  SEVERITY_PENALTY,
} from "../src/commands/score.js";
import type { CodeOfEthics, Finding } from "../src/schema.js";

/** aggregate は ethics.principles の {number,name} だけを使うため最小構成で足りる。 */
const ETHICS: CodeOfEthics = {
  version: "5.2",
  source: "test",
  principles: [
    { number: 1, name: "公共性", statement: "" },
    { number: 2, name: "顧客ならびに雇用者", statement: "" },
    { number: 3, name: "製品", statement: "" },
    { number: 4, name: "判断", statement: "" },
    { number: 5, name: "管理", statement: "" },
    { number: 6, name: "専門職", statement: "" },
    { number: 7, name: "職業上の同僚", statement: "" },
    { number: 8, name: "自己の向上", statement: "" },
  ],
  items: [],
};

function finding(over: Partial<Finding>): Finding {
  return {
    itemId: "1.01",
    severity: "medium",
    file: "x.ts",
    line: 1,
    description: "d",
    evidence: "e",
    recommendation: "r",
    confirmed: true,
    ...over,
  };
}

test("重み合計は 1.00", () => {
  const sum = Object.values(PRINCIPLE_WEIGHT).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights sum=${sum}`);
});

test("未確定(confirmed=false)の所見は採点対象外", () => {
  const r = aggregate([finding({ confirmed: false, severity: "critical" })], ETHICS);
  assert.equal(r.totalFindings, 0);
  assert.equal(r.overall, 100);
  assert.equal(r.verdict, "合格");
});

test("原則スコアは深刻度の減点で下がり0で下げ止まる", () => {
  const r = aggregate(
    [
      finding({ itemId: "1.03", severity: "critical" }), // -50
      finding({ itemId: "1.06", severity: "high" }), // -22
      finding({ itemId: "1.01", severity: "critical" }), // -50 → floor 0
    ],
    ETHICS,
  );
  const p1 = r.principles.find((p) => p.principle === 1);
  assert.ok(p1);
  assert.equal(p1.score, 0, "50+22+50=122 減点 → 0 で下げ止まる");
  assert.equal(p1.findings, 3);
});

test("critical があれば総合が高くても合格にはならない", () => {
  const r = aggregate([finding({ itemId: "1.03", severity: "critical" })], ETHICS);
  assert.ok(r.overall >= 80, `overall=${r.overall}`);
  assert.equal(r.verdict, "要改善");
  assert.equal(r.bySeverity.critical, 1);
});

test("所見ゼロは満点で合格", () => {
  const r = aggregate([], ETHICS);
  assert.equal(r.overall, 100);
  assert.equal(r.verdict, "合格");
});

test("深刻度別集計が一致する", () => {
  const r = aggregate(
    [
      finding({ severity: "high" }),
      finding({ severity: "high" }),
      finding({ severity: "low" }),
    ],
    ETHICS,
  );
  assert.deepEqual(r.bySeverity, { critical: 0, high: 2, medium: 0, low: 1 });
});

test("減点定数の大小関係は critical>high>medium>low", () => {
  assert.ok(
    SEVERITY_PENALTY.critical > SEVERITY_PENALTY.high &&
      SEVERITY_PENALTY.high > SEVERITY_PENALTY.medium &&
      SEVERITY_PENALTY.medium > SEVERITY_PENALTY.low,
  );
});
