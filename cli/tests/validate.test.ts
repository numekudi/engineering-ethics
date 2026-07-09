import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAuditResult,
  parseFindings,
  ValidationError,
} from "../src/validate.js";

const VALID_FINDING = {
  itemId: "3.12",
  severity: "high",
  file: "src/log.ts",
  line: 5,
  description: "個人情報ログ",
  evidence: "console.log(password)",
  recommendation: "マスクする",
  confirmed: true,
};

test("parseFindings: 配列形式を受理する", () => {
  const out = parseFindings([VALID_FINDING]);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.itemId, "3.12");
});

test("parseFindings: { findings: [...] } 形式も受理する", () => {
  const out = parseFindings({ findings: [VALID_FINDING] });
  assert.equal(out.length, 1);
});

test("parseFindings: 不正な項目IDは ValidationError", () => {
  assert.throws(
    () => parseFindings([{ ...VALID_FINDING, itemId: "9.99" }]),
    ValidationError,
  );
  assert.throws(
    () => parseFindings([{ ...VALID_FINDING, itemId: "3.1" }]),
    (e: unknown) => e instanceof ValidationError && e.path.includes("itemId"),
  );
});

test("parseFindings: 不正な severity は ValidationError", () => {
  assert.throws(
    () => parseFindings([{ ...VALID_FINDING, severity: "fatal" }]),
    ValidationError,
  );
});

test("parseFindings: confirmed 欠落は ValidationError", () => {
  const { confirmed, ...noConfirmed } = VALID_FINDING;
  void confirmed;
  assert.throws(() => parseFindings([noConfirmed]), ValidationError);
});

test("parseFindings: トップレベルが数値なら ValidationError", () => {
  assert.throws(() => parseFindings(42), ValidationError);
});

test("parseAuditResult: 正常系を復元できる", () => {
  const audit = {
    overall: 83,
    verdict: "要改善",
    principles: [{ principle: 1, name: "公共性", score: 28, findings: 2 }],
    totalFindings: 3,
    bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
  };
  const out = parseAuditResult(audit);
  assert.equal(out.overall, 83);
  assert.equal(out.verdict, "要改善");
  assert.equal(out.bySeverity.critical, 1);
});

test("parseAuditResult: 不正な verdict は ValidationError", () => {
  assert.throws(
    () =>
      parseAuditResult({
        overall: 50,
        verdict: "PASS",
        principles: [],
        totalFindings: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      }),
    ValidationError,
  );
});
