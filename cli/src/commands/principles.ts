/**
 * principles コマンド: 綱領（8原則・88項目）を照会する。
 *
 * 監査フローの Step 1 で、各評価エージェントに担当原則の項目群を供給するために使う。
 * --principle N で原則を絞り、--item ID で単一項目を引く。
 */

import type { CodeOfEthics, EthicsItem } from "../schema.js";
import { loadCodeOfEthics } from "../ethics.js";

export interface PrinciplesQuery {
  /** 原則番号 1..8 で絞る（未指定なら全件） */
  readonly principle?: number;
  /** 項目ID（例 "3.12"）で単一項目を引く */
  readonly item?: string;
}

/** 照会結果（JSON 出力の実体）。 */
export interface PrinciplesResult {
  readonly version: string;
  readonly source: string;
  readonly items: readonly EthicsItem[];
}

/** クエリに従って綱領項目を絞り込む純粋関数。 */
export function queryPrinciples(
  ethics: CodeOfEthics,
  query: PrinciplesQuery,
): PrinciplesResult {
  let items: readonly EthicsItem[] = ethics.items;
  if (query.principle !== undefined) {
    items = items.filter((it) => it.principle === query.principle);
  }
  if (query.item !== undefined) {
    items = items.filter((it) => it.id === query.item);
  }
  return { version: ethics.version, source: ethics.source, items };
}

/** 照会結果を人間可読テキストに整形する。 */
export function formatPrinciplesText(ethics: CodeOfEthics, result: PrinciplesResult): string {
  const nameByNumber = new Map(ethics.principles.map((p) => [p.number, p.name]));
  const lines: string[] = [];
  let currentPrinciple = -1;
  for (const it of result.items) {
    if (it.principle !== currentPrinciple) {
      currentPrinciple = it.principle;
      lines.push("");
      lines.push(`### 原則 ${it.principle} — ${nameByNumber.get(it.principle) ?? ""}`);
    }
    lines.push(`- ${it.id} ${it.text}`);
    for (const rf of it.redFlags) {
      lines.push(`    ⚠ レッドフラグ: ${rf}`);
    }
  }
  return lines.join("\n").trimStart();
}

/** principles サブコマンドの本体。整形済み文字列を返す。 */
export function runPrinciples(query: PrinciplesQuery, format: "json" | "text"): string {
  const ethics = loadCodeOfEthics();
  const result = queryPrinciples(ethics, query);
  if (result.items.length === 0) {
    throw new Error("該当する綱領項目がありません（--principle / --item を確認してください）");
  }
  return format === "json"
    ? JSON.stringify(result, null, 2)
    : formatPrinciplesText(ethics, result);
}
