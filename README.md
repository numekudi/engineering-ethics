[![技術者倫理 遵守済み](https://img.shields.io/badge/%E6%8A%80%E8%A1%93%E8%80%85%E5%80%AB%E7%90%86-%E9%81%B5%E5%AE%88%E6%B8%88%E3%81%BF-0a0a0a?style=for-the-badge&labelColor=ffffff)](https://技術者倫理.com)

# engineering-ethics

技術者倫理（IEEE-CS/ACM ソフトウェア工学倫理綱領 第5.2版）のための Claude Code スキル集。

- **engineering-ethics** — 綱領（8原則・80項目）の知識スキル。開発中に倫理を参照する。
- **ethics-audit** — リポジトリを綱領＋ダークパターン観点で**監査・採点**するハーネス。

## なぜ「監査」なのか

上のバッジのような「遵守済み」表示は、それ自体は**自己申告**にすぎない。RINRI ライセンスが
戒める *ethical grandstanding*（実質の裏付けなく倫理を掲げる行為）に陥りうる。
`ethics-audit` は、綱領の具体項目に照らし、**実コードを読んだ上で・敵対的に検証して**採点する
ことで、その自己申告を「監査で確かめられるもの」に近づける。他者糾弾ではなく、**自リポの
自己評価と改善**のための道具である。

## 使い方

```
gh skill install numekudi/engineering-ethics
```

Claude Code で「**倫理監査**」または「**技術者倫理チェック**」と伝えると、`ethics-audit`
スキルが起動する。フロー:

1. リポジトリ全体を走査し、ダークパターン等の**候補**を決定論的に検出（Golden Subroutine =
   まずコードを読む）。
2. 8原則を分担する評価エージェント＋ダークパターン・ハンターが、実コードを読んで所見化。
3. 各所見を**反証エージェント**が攻撃し、生き残りだけを確定（誤検知＝grandstanding を排除）。
4. 確定所見を決定論的に採点し、**合格／要改善／不適合**を判定。
5. 証跡付きレポートと、自己監査結果の**ツイート下書き**（`#技術者倫理チェックskill`）を提示。

判定は「critical 所見が1件でもあれば合格にしない」など、ラバースタンプにならない設計。

## 構成

```
skills/
  engineering-ethics/   綱領の知識スキル
  ethics-audit/         監査ハーネス（SKILL.md + 01–05 + data/ + lib/）
    lib/                配布実体（Node.js・実行時依存ゼロの .js。cli/ から生成）
    data/se-code.json   綱領データ（rinri の se-code-jpn.md から生成）
cli/                    開発ソース（TypeScript・配布物には含めない）
tools/lint-skills.ts    CI 用リンタ
```

## 開発

決定論的スクリプトは `cli/` の TypeScript（strict）。ビルドは `skills/ethics-audit/lib` へ
出力し、その `.js`（実行時依存ゼロ）を配布実体としてコミットする。

```bash
cd cli
npm install
npm run gen        # ../rinri/docs/se-code-jpn.md → data/se-code.json を再生成
npm run build      # src → ../skills/ethics-audit/lib（.js を生成・コミット対象）
npm run typecheck  # strict 型チェック（src / gen / tests）
npm test           # ユニットテスト（node --test / tsx）
```

## 出典・ライセンス

- 綱領原典: [ソフトウェア工学の倫理ならびに専門技術者実務綱領（ACM・日本語訳 PDF）](https://www.acm.org/binaries/content/assets/code-of-ethics/se-code-jpn.pdf)（© 1999 IEEE/ACM・日本語訳 村田 潔）
- 綱領データと反-grandstanding の思想は [EdamAme-x/rinri](https://github.com/EdamAme-x/rinri) を参考にしている。
- 本リポジトリのコードは MIT License。
