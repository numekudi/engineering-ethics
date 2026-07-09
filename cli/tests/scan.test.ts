import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanRepository, SCAN_RULES } from "../src/commands/scan.js";

/** 一時リポを作り、ダークパターンを仕込んで走査する。 */
function withTempRepo(files: Record<string, string>, fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "ethics-scan-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const abs = join(root, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, content, "utf8");
    }
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("TLS 検証無効化を critical で検出する", () => {
  withTempRepo({ "src/http.ts": "const a = { rejectUnauthorized: false };" }, (root) => {
    const r = scanRepository(root);
    const hit = r.candidates.find((c) => c.rule === "tls-verification-disabled");
    assert.ok(hit, "tls ルールが一致すべき");
    assert.equal(hit.severity, "critical");
    assert.equal(hit.itemId, "1.03");
  });
});

test("退会導線の隠蔽を検出する", () => {
  withTempRepo(
    { "ui.html": '<button class="cancel" style="display: none">退会</button>' },
    (root) => {
      const r = scanRepository(root);
      assert.ok(r.candidates.some((c) => c.rule === "cancel-flow-hidden"));
    },
  );
});

test("個人情報のログ出力を検出する", () => {
  withTempRepo({ "log.js": "console.log('user password:', password)" }, (root) => {
    const r = scanRepository(root);
    assert.ok(r.candidates.some((c) => c.rule === "personal-data-logged"));
  });
});

test("node_modules は走査しない", () => {
  withTempRepo(
    {
      "node_modules/pkg/index.js": "eval('x')",
      "clean.ts": "export const ok = 1;",
    },
    (root) => {
      const r = scanRepository(root);
      assert.ok(!r.candidates.some((c) => c.file.includes("node_modules")));
    },
  );
});

test("問題のないコードは候補ゼロ", () => {
  withTempRepo({ "clean.ts": "export const add = (a: number, b: number) => a + b;" }, (root) => {
    const r = scanRepository(root);
    assert.equal(r.candidates.length, 0);
    assert.equal(r.filesScanned, 1);
  });
});

test("全ルールの itemId は N.MM 形式", () => {
  for (const rule of SCAN_RULES) {
    assert.match(rule.itemId, /^[1-8]\.\d{2}$/, `${rule.id} の itemId`);
  }
});
