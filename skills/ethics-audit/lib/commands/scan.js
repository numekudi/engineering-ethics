/**
 * scan コマンド: リポジトリを横断し、綱領違反の「候補」を決定論的に検出する。
 *
 * 重要: ここで出るのは判定ではなく候補（ScanCandidate）である。
 * Golden Subroutine の精神に従い、最終判断はエージェントが実コード・文脈を読んで行う。
 * scan は「まずコードを機械的に洗い出す」土台であり、特にサイゼリヤCLI／バンダイ
 * チャンネル不正退会に代表される "ユーザーに害を与える設計"（ダークパターン）を狙う。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
/**
 * 検出ルール群。ダークパターン・反ユーザ設計・安全性/秘密情報の毀損を中心に据える。
 * 過検出を許容し（候補なので）、エージェント側の敵対的検証で棄却させる方針。
 */
export const SCAN_RULES = [
    {
        id: "cancel-flow-hidden",
        itemId: "1.03",
        severity: "high",
        pattern: /(cancel|unsubscribe|退会|解約|解除).{0,40}(display:\s*none|visibility:\s*hidden|hidden|disabled|aria-hidden)/i,
        note: "退会・解約導線を隠蔽/無効化している疑い（ダークパターン）",
    },
    {
        id: "misleading-free",
        itemId: "1.06",
        severity: "high",
        pattern: /(無料|free).{0,24}(ただし|但し|自動(的)?に|automatically).{0,24}(課金|請求|charge|billed|subscription)/i,
        note: "誤解を招く「無料」表示（自動課金の不十分な開示）",
    },
    {
        id: "confirmshaming",
        itemId: "1.06",
        severity: "medium",
        pattern: /(いいえ[、,]?\s*(私|わたし)は|no,?\s*i\s*(don'?t|do not)\s*want).{0,40}(得|節約|save|割引|discount)/i,
        note: "confirmshaming（拒否選択肢を貶める文言）の疑い",
    },
    {
        id: "prechecked-optin",
        itemId: "3.12",
        severity: "medium",
        pattern: /(opt[-_]?in|consent|同意|購読|newsletter|メルマガ).{0,48}(checked|defaultChecked|checked:\s*true|value:\s*true)/i,
        note: "オプトインの事前チェック（同意の擬制）の疑い",
    },
    {
        id: "tls-verification-disabled",
        itemId: "1.03",
        severity: "critical",
        pattern: /(rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|verify\s*=\s*False|InsecureSkipVerify\s*:\s*true|CURLOPT_SSL_VERIFYPEER\s*,\s*(0|false))/,
        note: "TLS/証明書検証の無効化（安全性の毀損）",
    },
    {
        id: "hardcoded-secret",
        itemId: "2.05",
        severity: "high",
        pattern: /\b(api[_-]?key|secret|password|passwd|token|access[_-]?key)\b\s*[:=]\s*['"][A-Za-z0-9_\-./+]{16,}['"]/i,
        note: "秘密情報のハードコード（秘密性の毀損）",
    },
    {
        id: "personal-data-logged",
        itemId: "3.12",
        severity: "high",
        pattern: /(console\.log|logger\.\w+|print|println|System\.out)\s*\([^)]*\b(password|passwd|credit\s*card|カード番号|マイナンバー|ssn|email)\b/i,
        note: "個人情報・機微情報のログ出力（プライバシー侵害）",
    },
    {
        id: "dynamic-eval",
        itemId: "3.05",
        severity: "medium",
        pattern: /\beval\s*\(|new\s+Function\s*\(|child_process[\s\S]{0,20}\.exec\s*\(/,
        note: "eval / 動的コード実行（不適切な手法・攻撃面の拡大）",
    },
    {
        id: "swallowed-error",
        itemId: "3.10",
        severity: "low",
        pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
        note: "空 catch（エラーの握り潰し・fail loud 違反）",
    },
];
/** 走査から除外するディレクトリ名。 */
const SKIP_DIRS = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "vendor",
    ".next",
    ".cache",
]);
/** テキストとして走査する拡張子。 */
const TEXT_EXT = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".rb", ".go", ".rs", ".java", ".kt", ".php", ".c", ".cc", ".cpp", ".cs",
    ".html", ".htm", ".vue", ".svelte", ".css", ".scss",
    ".json", ".yaml", ".yml", ".toml", ".md", ".txt", ".sh", ".env",
]);
/** 1ファイルの上限バイト数（巨大/生成物を避ける）。 */
const MAX_FILE_BYTES = 512 * 1024;
function hasTextExt(path) {
    const dot = path.lastIndexOf(".");
    if (dot < 0)
        return false;
    return TEXT_EXT.has(path.slice(dot).toLowerCase());
}
/** 走査対象ファイルを再帰収集する。 */
function collectFiles(root) {
    const out = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name))
                    continue;
                walk(join(dir, entry.name));
            }
            else if (entry.isFile() && hasTextExt(entry.name)) {
                out.push(join(dir, entry.name));
            }
        }
    };
    walk(root);
    return out;
}
/** 1ファイルにルール群を適用して候補を返す。 */
function scanFile(root, absPath) {
    const size = statSync(absPath).size;
    if (size > MAX_FILE_BYTES)
        return [];
    const rel = relative(root, absPath) || absPath;
    const lines = readFileSync(absPath, "utf8").split(/\r?\n/);
    const candidates = [];
    lines.forEach((line, i) => {
        for (const rule of SCAN_RULES) {
            if (rule.pattern.test(line)) {
                candidates.push({
                    rule: rule.id,
                    itemId: rule.itemId,
                    severity: rule.severity,
                    file: rel,
                    line: i + 1,
                    evidence: line.trim().slice(0, 200),
                    note: rule.note,
                });
            }
        }
    });
    return candidates;
}
/** リポジトリ root を走査して候補一覧を返す。 */
export function scanRepository(root) {
    const files = collectFiles(root);
    const candidates = [];
    for (const file of files) {
        candidates.push(...scanFile(root, file));
    }
    return { root, filesScanned: files.length, candidates };
}
/** scan 結果を人間可読テキストに整形する。 */
export function formatScanText(result) {
    const lines = [];
    lines.push(`# scan: ${result.root}`);
    lines.push(`走査ファイル数: ${result.filesScanned} / 候補: ${result.candidates.length}`);
    lines.push("");
    lines.push("※ これらは候補であり判定ではありません。実コードを読んで確定/棄却してください。");
    for (const c of result.candidates) {
        lines.push("");
        lines.push(`- [${c.severity}] ${c.file}:${c.line} （項目 ${c.itemId} / ${c.rule}）`);
        lines.push(`    ${c.note}`);
        lines.push(`    > ${c.evidence}`);
    }
    return lines.join("\n");
}
/** scan サブコマンドの本体。 */
export function runScan(root, format) {
    const result = scanRepository(root);
    return format === "json" ? JSON.stringify(result, null, 2) : formatScanText(result);
}
