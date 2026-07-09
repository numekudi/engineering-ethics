/**
 * tweet コマンド: 監査結果のサマリーを X（Twitter）へ共有する下書きを生成する。
 *
 * 位置づけ: これは「自リポの自己監査結果の自己開示」であり、他者を糾弾する道具ではない
 * （RINRI ライセンスの反-grandstanding の精神／原則6・8「自己の向上」に一致）。
 * 生成物はツイート本文と intent URL のみ。実際の投稿はユーザーが URL を開いて行う。
 */
/** 固定ハッシュタグ。 */
export const HASHTAG = "#技術者倫理チェックskill";
/** 判定に対応する絵文字（視認性のため）。 */
function verdictEmoji(result) {
    switch (result.verdict) {
        case "合格":
            return "✅";
        case "要改善":
            return "🛠️";
        case "不適合":
            return "🚧";
    }
}
/** 最も課題の大きい原則（スコア最小。同点は原則番号が小さい方）を返す。 */
function worstPrinciple(result) {
    if (result.principles.length === 0)
        return undefined;
    return [...result.principles].sort((a, b) => a.score - b.score || a.principle - b.principle)[0];
}
/** AuditResult からツイート本文と intent URL を組み立てる純粋関数。 */
export function buildTweet(result, input = {}) {
    const head = input.label !== undefined && input.label.length > 0
        ? `${input.label} の技術者倫理 自己監査`
        : "技術者倫理 自己監査の結果";
    const lines = [];
    lines.push(`${verdictEmoji(result)} ${head}`);
    lines.push(`総合 ${result.overall}/100・判定: ${result.verdict}`);
    const worst = worstPrinciple(result);
    if (worst !== undefined && worst.score < 100) {
        lines.push(`要注力: ${worst.principle}.${worst.name}（${worst.score}/100）`);
    }
    lines.push(HASHTAG);
    const text = lines.join("\n");
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    return { text, url };
}
/** tweet サブコマンドの本体。JSON なら {text,url}、text なら本文＋URLを返す。 */
export function formatTweet(draft, format) {
    if (format === "json")
        return JSON.stringify(draft, null, 2);
    return `${draft.text}\n\n--- 投稿URL ---\n${draft.url}`;
}
