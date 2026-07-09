/**
 * 技術者倫理 監査ハーネスの型定義。
 *
 * 綱領データ（CodeOfEthics）とエージェント産出物（Finding / ScanCandidate）、
 * および採点結果（AuditResult）の形をここで一元管理する。
 * 実行時の検証は validate.ts が担い、本ファイルは純粋な型のみを提供する。
 */

/** 所見の深刻度。採点時の減点重みに対応する。 */
export type Severity = "critical" | "high" | "medium" | "low";

/** 深刻度の全値（検証・集約の反復に使う正準リスト）。 */
export const SEVERITIES: readonly Severity[] = ["critical", "high", "medium", "low"];

/** 最終判定。critical 所見があれば「合格」は出ない（score.ts 参照）。 */
export type Verdict = "合格" | "要改善" | "不適合";

/** 綱領の1原則（全8原則）。 */
export interface Principle {
  /** 原則番号 1..8 */
  readonly number: number;
  /** 原則名（例: 公共性） */
  readonly name: string;
  /** 原則の宣言文 */
  readonly statement: string;
}

/** 綱領の1項目（1.01 〜 8.09 の全88項目）。 */
export interface EthicsItem {
  /** 項目ID（例: "1.03"） */
  readonly id: string;
  /** 所属する原則番号 1..8 */
  readonly principle: number;
  /** 項目の短い見出し（本文先頭から生成） */
  readonly title: string;
  /** 項目の全文 */
  readonly text: string;
  /** この項目への違反を示唆する兆候（監査補助・キュレーション。無い項目は空配列） */
  readonly redFlags: readonly string[];
}

/** 綱領データ全体。data/se-code.json の実体。 */
export interface CodeOfEthics {
  /** 綱領の版（例: "5.2"） */
  readonly version: string;
  /** 出典URL */
  readonly source: string;
  readonly principles: readonly Principle[];
  readonly items: readonly EthicsItem[];
}

/**
 * 監査所見。評価エージェントが産出し、敵対的検証を経て confirmed が確定する。
 * score.ts は confirmed===true のみを採点対象にする。
 */
export interface Finding {
  /** 違反した綱領項目ID（例: "3.12"） */
  readonly itemId: string;
  readonly severity: Severity;
  /** 証跡ファイルパス */
  readonly file: string;
  /** 証跡の行番号。0 は「特定行なし／横断的」を表す */
  readonly line: number;
  /** 何が問題かの説明 */
  readonly description: string;
  /** コード・文言の引用（証跡本体） */
  readonly evidence: string;
  /** 是正案 */
  readonly recommendation: string;
  /** 敵対的検証（Golden Subroutine）を通過したか */
  readonly confirmed: boolean;
}

/**
 * scan コマンドが出す候補。決定論的ヒューリスティックの検出結果であり、
 * それ自体は判定ではない。エージェントが実コードを読んで Finding に昇格・棄却する。
 */
export interface ScanCandidate {
  /** 検出ルールID */
  readonly rule: string;
  /** 対応すると推定される綱領項目ID */
  readonly itemId: string;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  /** 一致した行の抜粋 */
  readonly evidence: string;
  /** ルールが疑う内容の説明 */
  readonly note: string;
}

/** 原則単位の採点。 */
export interface PrincipleScore {
  readonly principle: number;
  readonly name: string;
  /** 0..100 */
  readonly score: number;
  /** この原則に紐づく確定所見数 */
  readonly findings: number;
}

/** 監査の最終採点結果。tweet コマンドの入力にもなる。 */
export interface AuditResult {
  /** 総合スコア 0..100（原則スコアの加重平均） */
  readonly overall: number;
  readonly verdict: Verdict;
  readonly principles: readonly PrincipleScore[];
  /** 確定所見の総数 */
  readonly totalFindings: number;
  /** 深刻度別の確定所見数 */
  readonly bySeverity: Readonly<Record<Severity, number>>;
}
