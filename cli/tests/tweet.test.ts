import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTweet, HASHTAG } from "../src/commands/tweet.js";
import type { AuditResult } from "../src/schema.js";

const RESULT: AuditResult = {
  overall: 83,
  verdict: "要改善",
  principles: [
    { principle: 1, name: "公共性", score: 28, findings: 2 },
    { principle: 3, name: "製品", score: 91, findings: 1 },
    { principle: 2, name: "顧客ならびに雇用者", score: 100, findings: 0 },
  ],
  totalFindings: 3,
  bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
};

test("本文にハッシュタグ・総合・判定を含む", () => {
  const { text } = buildTweet(RESULT);
  assert.ok(text.includes(HASHTAG));
  assert.ok(text.includes("83/100"));
  assert.ok(text.includes("要改善"));
});

test("最も課題の大きい原則を要注力として挙げる", () => {
  const { text } = buildTweet(RESULT);
  assert.ok(text.includes("公共性"), "最小スコアの原則1が出るべき");
  assert.ok(!text.includes("製品（91"), "スコアの高い原則は要注力に出ない");
});

test("label を与えると本文に反映される", () => {
  const { text } = buildTweet(RESULT, { label: "myrepo" });
  assert.ok(text.includes("myrepo"));
});

test("intent URL は本文を URL エンコードして含む", () => {
  const { text, url } = buildTweet(RESULT);
  assert.ok(url.startsWith("https://twitter.com/intent/tweet?text="));
  assert.equal(url, `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
});

test("満点(所見ゼロ)なら要注力行は出ない", () => {
  const perfect: AuditResult = {
    overall: 100,
    verdict: "合格",
    principles: [{ principle: 1, name: "公共性", score: 100, findings: 0 }],
    totalFindings: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
  };
  const { text } = buildTweet(perfect);
  assert.ok(!text.includes("要注力"));
  assert.ok(text.includes("合格"));
});
