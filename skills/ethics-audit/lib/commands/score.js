/**
 * score コマンド: 確定 findings を決定論的に集約し AuditResult を算出する。
 *
 * 設計方針:
 * - 採点対象は confirmed===true の所見のみ（敵対的検証を通ったもの）。
 * - 各原則は 100 から減点方式。深刻度ごとに固定重みで引き、0 で下げ止まる。
 * - 総合は原則スコアの加重平均。「公共の利益が中心」ゆえ原則1・3を重くする。
 * - critical 所見が1件でもあれば「合格」は出さない（ラバースタンプ防止）。
 * すべて純粋関数で再現可能にし、テスト可能にする。
 */
import { SEVERITIES } from "../schema.js";
/** 深刻度ごとの減点（対象原則の 100 点満点から引く点数）。 */
export const SEVERITY_PENALTY = {
    critical: 50,
    high: 22,
    medium: 9,
    low: 3,
};
/** 原則ごとの総合重み（合計 1.00）。公共性(1)・製品(3)を重くする。 */
export const PRINCIPLE_WEIGHT = {
    1: 0.22, // 公共性
    2: 0.1, // 顧客ならびに雇用者
    3: 0.18, // 製品
    4: 0.12, // 判断
    5: 0.1, // 管理
    6: 0.1, // 専門職
    7: 0.08, // 職業上の同僚
    8: 0.1, // 自己の向上
};
/** 合格の総合スコア下限。 */
export const PASS_THRESHOLD = 80;
/** 要改善の総合スコア下限（これ未満は不適合）。 */
export const REVIEW_THRESHOLD = 55;
/** 所見の項目IDから原則番号（1..8）を取り出す。 */
function principleOf(finding) {
    return Number(finding.itemId.split(".")[0]);
}
/** 深刻度別の件数を数える。 */
function countBySeverity(findings) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings)
        counts[f.severity] += 1;
    return counts;
}
/** 総合スコアと critical 有無から判定を導く。 */
function decideVerdict(overall, hasCritical) {
    if (hasCritical) {
        // critical があれば合格は不可。総合が要改善域なら要改善、それ未満は不適合。
        return overall >= REVIEW_THRESHOLD ? "要改善" : "不適合";
    }
    if (overall >= PASS_THRESHOLD)
        return "合格";
    if (overall >= REVIEW_THRESHOLD)
        return "要改善";
    return "不適合";
}
/**
 * findings を集約して AuditResult を返す純粋関数。
 * confirmed===true のみを採点に用いる。
 */
export function aggregate(findings, ethics) {
    const confirmed = findings.filter((f) => f.confirmed);
    const principles = ethics.principles.map((p) => {
        const own = confirmed.filter((f) => principleOf(f) === p.number);
        const penalty = own.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
        const score = Math.max(0, 100 - penalty);
        return { principle: p.number, name: p.name, score, findings: own.length };
    });
    // 加重平均（重みが定義されない原則は 0 扱い＝実質全原則に重みあり）。
    const weightedSum = principles.reduce((sum, ps) => sum + ps.score * (PRINCIPLE_WEIGHT[ps.principle] ?? 0), 0);
    const weightTotal = principles.reduce((sum, ps) => sum + (PRINCIPLE_WEIGHT[ps.principle] ?? 0), 0);
    const overall = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
    const bySeverity = countBySeverity(confirmed);
    const verdict = decideVerdict(overall, bySeverity.critical > 0);
    return {
        overall,
        verdict,
        principles,
        totalFindings: confirmed.length,
        bySeverity,
    };
}
/** AuditResult を人間可読テキストに整形する。 */
export function formatAuditText(result) {
    const lines = [];
    lines.push("## 技術者倫理 監査結果");
    lines.push("");
    lines.push(`総合スコア: ${result.overall}/100 　判定: ${result.verdict}`);
    lines.push(`確定所見: ${result.totalFindings}件（` +
        SEVERITIES.map((s) => `${s} ${result.bySeverity[s]}`).join(" / ") +
        "）");
    lines.push("");
    lines.push("| 原則 | スコア | 確定所見 |");
    lines.push("|------|-------|---------|");
    for (const p of result.principles) {
        lines.push(`| ${p.principle}. ${p.name} | ${p.score}/100 | ${p.findings} |`);
    }
    return lines.join("\n");
}
