#!/usr/bin/env node
/**
 * 技術者倫理 監査ハーネス CLI（決定論的スクリプト）。
 *
 * サブコマンド:
 *   principles  綱領（8原則・88項目）を照会する
 *   scan        リポジトリを走査しダークパターン等の候補を検出する
 *   score       確定 findings を集約し採点する（AuditResult を出力）
 *   tweet       AuditResult から共有用ツイート下書きを生成する
 *
 * 規約: 既定は JSON 出力（--format text で人間可読）。エラーは stderr へ
 * {"error","code"} の JSON を出し exit 1。成功時 exit 0。
 */
import { readFileSync } from "node:fs";
import { runPrinciples } from "./commands/principles.js";
import { runScan } from "./commands/scan.js";
import { aggregate, formatAuditText } from "./commands/score.js";
import { buildTweet, formatTweet } from "./commands/tweet.js";
import { loadCodeOfEthics } from "./ethics.js";
import { parseAuditResult, parseFindings } from "./validate.js";
/** `--key value` / `--flag` / `-k value` 形式を解析する。 */
function parseFlags(argv) {
    const positional = [];
    const named = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === undefined)
            continue;
        if (token.startsWith("--")) {
            const key = token.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith("-")) {
                named[key] = next;
                i += 1;
            }
            else {
                named[key] = true;
            }
        }
        else if (token.startsWith("-") && token.length > 1) {
            const key = token.slice(1);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith("-")) {
                named[key] = next;
                i += 1;
            }
            else {
                named[key] = true;
            }
        }
        else {
            positional.push(token);
        }
    }
    return { _: positional, ...named };
}
/** フラグから文字列値を取り出す（無ければ undefined）。 */
function strFlag(flags, ...keys) {
    for (const key of keys) {
        const v = flags[key];
        if (typeof v === "string")
            return v;
    }
    return undefined;
}
/** --format を解決する（既定 json）。不正値は fail loud。 */
function resolveFormat(flags) {
    const f = strFlag(flags, "format", "f");
    if (f === undefined || f === "json")
        return "json";
    if (f === "text")
        return "text";
    throw new CliError(`--format は json|text のいずれか（受領: ${f}）`, "BAD_FORMAT");
}
/** 終了コード付きの利用者向けエラー。 */
class CliError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "CliError";
    }
}
/** --input FILE、無ければ標準入力から JSON テキストを読む。 */
function readInput(flags) {
    const file = strFlag(flags, "input", "i");
    if (file !== undefined)
        return readFileSync(file, "utf8");
    // 標準入力（パイプ）を同期読み取り。fd 0。
    try {
        return readFileSync(0, "utf8");
    }
    catch {
        throw new CliError("入力がありません（--input FILE か標準入力で JSON を渡してください）", "NO_INPUT");
    }
}
const HELP = `技術者倫理 監査ハーネス CLI

使い方: node cli.js <command> [options]

commands:
  principles [--principle N] [--item N.MM] [--format json|text]
  scan <repo-path> [--format json|text]
  score [--input findings.json] [--format json|text]   (標準入力可)
  tweet [--input audit.json] [--label 名前] [--format json|text]  (標準入力可)

共通: --format json（既定）| text`;
/** 各サブコマンドを実行し、標準出力に書く文字列を返す。 */
function dispatch(flags) {
    const command = flags._[0];
    const format = resolveFormat(flags);
    switch (command) {
        case "principles": {
            const principleRaw = strFlag(flags, "principle", "p");
            const principle = principleRaw !== undefined ? Number(principleRaw) : undefined;
            if (principle !== undefined && (!Number.isInteger(principle) || principle < 1 || principle > 8)) {
                throw new CliError("--principle は 1..8 の整数", "BAD_PRINCIPLE");
            }
            const item = strFlag(flags, "item");
            return runPrinciples({
                ...(principle !== undefined ? { principle } : {}),
                ...(item !== undefined ? { item } : {}),
            }, format);
        }
        case "scan": {
            const root = flags._[1];
            if (root === undefined)
                throw new CliError("scan には <repo-path> が必要です", "NO_PATH");
            return runScan(root, format);
        }
        case "score": {
            const findings = parseFindings(JSON.parse(readInput(flags)));
            const ethics = loadCodeOfEthics();
            const result = aggregate(findings, ethics);
            return format === "json" ? JSON.stringify(result, null, 2) : formatAuditText(result);
        }
        case "tweet": {
            const result = parseAuditResult(JSON.parse(readInput(flags)));
            const label = strFlag(flags, "label");
            const draft = buildTweet(result, label !== undefined ? { label } : {});
            return formatTweet(draft, format);
        }
        case undefined:
        case "help":
        case "--help":
            return HELP;
        default:
            throw new CliError(`未知のコマンド: ${command}`, "UNKNOWN_COMMAND");
    }
}
function main() {
    const flags = parseFlags(process.argv.slice(2));
    try {
        const out = dispatch(flags);
        process.stdout.write(out.endsWith("\n") ? out : `${out}\n`);
        return 0;
    }
    catch (err) {
        const code = err instanceof CliError ? err.code : "ERROR";
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${JSON.stringify({ error: message, code })}\n`);
        return 1;
    }
}
process.exit(main());
