/**
 * 技術者倫理 監査ハーネスの型定義。
 *
 * 綱領データ（CodeOfEthics）とエージェント産出物（Finding / ScanCandidate）、
 * および採点結果（AuditResult）の形をここで一元管理する。
 * 実行時の検証は validate.ts が担い、本ファイルは純粋な型のみを提供する。
 */
/** 深刻度の全値（検証・集約の反復に使う正準リスト）。 */
export const SEVERITIES = ["critical", "high", "medium", "low"];
