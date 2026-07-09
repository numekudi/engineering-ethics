---
name: ethics-audit
description: >
  リポジトリ全体を IEEE-CS/ACM ソフトウェア工学倫理綱領（8原則・80項目）とダークパターン
  観点で監査し、証跡付きで採点（合格/要改善/不適合）する。多エージェント敵対的監査により
  誤検知（ethical grandstanding）を検証で潰す。結果は自己監査のツイート下書きにできる。
  トリガー: 倫理監査, 技術者倫理チェック, ethics audit, 倫理チェック, /ethics-audit
allowed-tools: Read, Glob, Grep, Write, Agent, AskUserQuestion, Bash(node */lib/cli.js *), Bash(node lib/cli.js *)
license: MIT
---

# 技術者倫理 監査ハーネス（ethics-audit）

リポジトリが技術者倫理（IEEE-CS/ACM ソフトウェア工学倫理綱領 第5.2版）に本当に則して
いるかを、**実コードを読んだ上で・具体項目に照らして・敵対的に検証して**採点する。

## 思想（なぜこの手順か）

RINRI ライセンスの Golden Subroutine が戒めるとおり、倫理を実質の裏付けなく掲げる行為
（ethical grandstanding）は監査の敵である。本ハーネスは次を鉄則とする:

- **コードを読んでから判断する** — 印象ではなく `file:line` の証跡に基づく。
- **合否を出せる** — バッジのラバースタンプではなく、合格も不適合も出す。
- **誤検知を検証で潰す** — 各所見を反証エージェントが攻撃し、生き残りだけを確定する。
- **公共の利益が中心** — 迷ったら「最も権限の弱いユーザーがどう害されるか」で判断する。
- **自己評価の道具** — 他者糾弾ではなく、自リポの改善のために使う。

## CLI（決定論的スクリプト）

このスキルに同梱の `lib/cli.js`（Node.js・実行時依存ゼロ）を使う。以降 `<SKILL_DIR>` は
この SKILL.md があるディレクトリ。実行例:

```bash
node <SKILL_DIR>/lib/cli.js scan <repo-path>                 # ダークパターン等の候補検出
node <SKILL_DIR>/lib/cli.js principles --principle N          # 原則Nの項目を供給
node <SKILL_DIR>/lib/cli.js principles --item N.MM            # 単一項目を引く
node <SKILL_DIR>/lib/cli.js score --input findings.json       # 確定所見を採点
node <SKILL_DIR>/lib/cli.js tweet --input audit.json --label <名前>  # 共有下書き生成
```

出力は既定で JSON（`--format text` で人間可読）。エラーは stderr に JSON、exit 1。

## 監査フロー

番号順に、決定論部分は CLI、判断部分はエージェントに委ねる。対象パスが未指定なら
カレントリポジトリを対象にする。

### Step 0 — スコープ確定と候補収集（まずコードを読む）
1. 対象リポのファイル構成を `Glob`/`Read` で把握する。
2. `node <SKILL_DIR>/lib/cli.js scan <repo>` を実行し、候補（ScanCandidate[]）を得る。
   これは**判定ではなく候補**。以降の判断の出発点にすぎない。
3. `scan` はルール定義ファイル自体にも一致しうる（自己言及の誤検知）。対象リポの実体で
   判断すること。

### Step 1 — ファンアウト評価（8原則を分担）
`Agent` ツールで評価エージェントを 4〜5 体、並行起動する。各エージェントに:
- 担当原則の項目を `principles --principle N --format text` で渡す（推奨割当: A=原則1,3 /
  B=原則2,6 / C=原則4,5 / D=原則7,8）。
- 別途 **ダークパターン・ハンター**を1体、`02-dark-patterns.md` を渡して起動する。
- Step 0 の候補と、実コードを読む指示を与える。
- 評価観点は `01-principles.md`、深刻度基準は `03-scoring-rubric.md` を参照させる。

各エージェントは所見を **findings JSON** で返す。1件の形:
```json
{"itemId":"3.12","severity":"high","file":"src/log.ts","line":5,
 "description":"…","evidence":"該当コードの引用","recommendation":"…","confirmed":false}
```
この段階では `confirmed:false`（未検証）。証跡（file:line と evidence）を必須とし、
抽象的な非難は捨てさせる。

### Step 2 — 敵対的検証（反-grandstanding の中核）
`04-adversarial-verification.md` に従い、各所見に反証エージェントを割り当てる。
「実コード・文脈を読んだか？ これは grandstanding ではないか？ **不確実なら反証**」を
基準に REFUTE を試みる。生き残った所見のみ `confirmed:true` にする。棄却理由も記録する。

### Step 3 — 決定論的採点
確定所見を集めた findings JSON を一時ファイルに書き、
`node <SKILL_DIR>/lib/cli.js score --input <file>` で AuditResult（原則別0-100・加重総合・
判定）を得る。スコアは CLI が決定論的に算出する（人が忖度しない）。

### Step 4 — レポートとツイート下書き
1. `05-output-format.md` の様式で日本語レポートを提示する（総合・判定・原則別表・重大所見の
   `file:line` 引用と是正案・棄却された主な指摘）。
2. AuditResult JSON を保存し、
   `node <SKILL_DIR>/lib/cli.js tweet --input <audit.json> --label <リポ名> --format text` で
   共有下書き（本文＋intent URL、`#技術者倫理チェックskill`）を生成し提示する。
   **intent URL は CLI の出力を1行で・全文そのまま貼る（`...` で省略・途中改行・整形をしない）。**
   詳細は `05-output-format.md` の「intent URL を絶対に省略しない」を厳守する。
3. ツイートは**自リポの自己監査結果の共有**であることを明示する。他者を糾弾する用途には
   使わない（原則6・8／RINRI の精神）。

## 出力の約束
- すべての確定所見に綱領項目ID（例 `3.12`）と `file:line` 証跡を付す。
- critical 所見が1件でもあれば「合格」は出ない（`03-scoring-rubric.md`）。
- 監査は自リポ向け。第三者リポを一方的に採点・公開する用途には使わない。

## 関連
- 綱領本文の知識は `engineering-ethics` スキル（同リポ）を参照。
