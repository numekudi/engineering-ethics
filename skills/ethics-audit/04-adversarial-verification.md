# 04 — 敵対的検証（Golden Subroutine の手順化）

監査の中核。Step 1 の各所見（`confirmed:false`）を、**それを棄却しようとする**反証
エージェントに掛ける。生き残ったものだけを `confirmed:true` にする。目的は誤検知＝
ethical grandstanding を採点に混ぜないこと。

## 出典: RINRI ライセンスの Golden Subroutine
> IF (you are angry) AND (you have not read the relevant code, specification, or
> context) AND (your primary goal is to win, not to improve anything) THEN do NOT post.

倫理を「議論に勝つ道具」にしないための自己点検。監査ではこれを各所見への攻撃として制度化
する。

## 反証エージェントへの指示（テンプレ）
各所見について、別コンテキストのエージェントを起動し、次を与える:
- 所見（itemId, severity, file, line, description, evidence, recommendation）。
- 該当ファイルの**実際のコード・文脈**（周辺行、関連設定、ドキュメント）。
- 綱領該当項目の全文（`principles --item N.MM`）。

反証エージェントの任務は「この所見を**棄却できるか**」を検討すること。次の観点で攻撃する:

1. **コードを読んだ上での指摘か** — evidence は実在し、その行は本当に主張どおりか。
   文脈（テストコード、サンプル、コメント、フラグで無効化 等）を見落としていないか。
2. **害の実在** — 抽象的な「良くない」ではなく、具体的なユーザー/公共の害があるか。
   誰がどう不利益を被るかを一文で言えるか。言えないなら棄却寄り。
3. **綱領項目との対応の妥当性** — その itemId は本当に該当するか。こじつけでないか。
4. **grandstanding 臭** — 設計上の正当な選択・合理的な意見の相違を「非倫理」と断じて
   いないか（RINRI: 「reasonable engineers can disagree」）。
5. **深刻度の妥当性** — `03-scoring-rubric.md` に照らし過大/過小でないか。

## 判定ルール
- **不確実なら棄却**（default to refuted）。確証ある害の証跡が無ければ `confirmed:false`。
- 生き残った所見は `confirmed:true` とし、必要なら severity を検証結果に合わせて補正する。
- 棄却した所見は**理由とともに記録**し、Step 4 のレポートに「棄却された主な指摘」として
  簡潔に残す（透明性。何を見て何を落としたかを開示する）。

## 強度の調整
- 「ざっと」なら各所見に反証1回。
- 「徹底的に／本気で」なら、重大所見（critical/high）に対し観点の異なる反証を2〜3体
  当て、過半数が棄却したら落とす（perspective-diverse verify）。

## 注意
- 反証は「無かったことにする」ためではなく「確度を上げる」ため。確たる害は残す。
- 逆に、対象への好悪や政治的立場で所見を作らない・消さないこと。判断軸は一貫して
  「公共の利益」と「証跡」。
