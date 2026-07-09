/**
 * 生成ツール（dev 専用・配布外）: rinri の se-code-jpn.md から
 * skills/ethics-audit/data/se-code.json を生成する。
 *
 * 実行: npm run gen  （node --experimental-strip-types で本ファイルを直接実行）
 * 依存: node 組み込みのみ。schema からは型のみ import（strip-types で消える）。
 *
 * 綱領本文は ACM/IEEE-CS の著作物（内容改変不可）。text はそのまま転記し、
 * title と redFlags のみ監査支援のためこちらで付与する。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CodeOfEthics, EthicsItem, Principle } from "../schema.js";

const VERSION = "5.2";
const SOURCE = "https://www.acm.org/binaries/content/assets/code-of-ethics/se-code-jpn.pdf";

/**
 * 監査補助のレッドフラグ（キュレーション）。高シグナルな項目にのみ付与する。
 * 近年のダークパターン事例（退会妨害・誤解を招く無料表示・無同意計測 等）に対応させる。
 */
const RED_FLAGS: Readonly<Record<string, readonly string[]>> = {
  "1.02": ["自社/自分の利益のためにユーザーの不利益を放置している"],
  "1.03": [
    "退会・解約・データ削除の導線が不当に困難／隠されている",
    "安全性やプライバシーを損なう挙動を「承認」している",
  ],
  "1.04": ["既知のリスクをユーザー・関係者に開示していない"],
  "1.06": [
    "「無料」等の表示が自動課金・条件を十分開示せず誤解を招く",
    "confirmshaming など拒否選択肢を貶める文言がある",
  ],
  "1.07": ["障害・環境・経済的弱者のアクセスを不当に妨げている"],
  "2.05": ["秘密情報・認証情報をハードコード／不適切に露出している"],
  "3.10": ["テスト・検査が不十分／エラーを握り潰している"],
  "3.12": [
    "同意なくトラッキング・個人情報収集を行っている",
    "個人情報・機微情報をログ等に露出している",
  ],
  "3.13": ["不正・非倫理的に取得したデータを使用している"],
  "5.12": ["倫理的懸念を表明した者を不利益に扱う設計・運用がある"],
  "6.07": ["ソフトウェアの特性について誤解を招く説明をしている"],
  "6.08": ["既知のエラーを報告・修正せず放置している"],
  "8.07": ["不適切な偏見により特定の利用者を不公正に扱っている"],
};

/** 本文から短い見出しを作る（最初の一文、長ければ切り詰め）。 */
function makeTitle(text: string): string {
  const first = text.split("。")[0] ?? text;
  return first.length <= 24 ? first : `${first.slice(0, 24)}…`;
}

/** markdown をパースして原則と項目を抽出する。 */
function parse(markdown: string): CodeOfEthics {
  const lines = markdown.split(/\r?\n/);
  const principles: Principle[] = [];
  const items: EthicsItem[] = [];

  let currentPrinciple = 0;
  let awaitingStatement = false;
  // 継続行を畳み込むための、直近の可変項目バッファ。
  let pendingId: string | undefined;
  let pendingPrinciple = 0;
  let pendingText = "";

  const flush = (): void => {
    if (pendingId === undefined) return;
    const text = pendingText.trim();
    items.push({
      id: pendingId,
      principle: pendingPrinciple,
      title: makeTitle(text),
      text,
      redFlags: RED_FLAGS[pendingId] ?? [],
    });
    pendingId = undefined;
    pendingText = "";
  };

  for (const line of lines) {
    const principleHead = /^###\s*原則\s*(\d+)\s*[—–-]\s*(.+?)\s*$/.exec(line);
    if (principleHead) {
      flush();
      currentPrinciple = Number(principleHead[1]);
      principles.push({
        number: currentPrinciple,
        name: (principleHead[2] ?? "").trim(),
        statement: "",
      });
      awaitingStatement = true;
      continue;
    }

    // 原則見出し直後の最初の blockquote を statement として採用する。
    const quote = /^>\s*(.+?)\s*$/.exec(line);
    if (quote && awaitingStatement && principles.length > 0) {
      principles[principles.length - 1] = {
        ...principles[principles.length - 1]!,
        statement: (quote[1] ?? "").trim(),
      };
      awaitingStatement = false;
      continue;
    }

    const itemHead = /^-\s*\*\*(\d\.\d{2})\*\*\s*(.*)$/.exec(line);
    if (itemHead) {
      flush();
      pendingId = itemHead[1];
      pendingPrinciple = currentPrinciple;
      pendingText = (itemHead[2] ?? "").trim();
      continue;
    }

    // 継続行（インデントされた本文の折り返し）を現在の項目に連結する。
    if (pendingId !== undefined && /^\s{2,}\S/.test(line)) {
      pendingText += line.trim();
      continue;
    }

    // 項目本文の途中でない空行/その他はバッファを確定させる。
    if (pendingId !== undefined && line.trim() === "") {
      // 空行では確定しない（次項目/見出しで flush）。折り返しの間に空行は無い前提。
      continue;
    }
  }
  flush();

  return { version: VERSION, source: SOURCE, principles, items };
}

function main(): void {
  const srcArg = process.argv[2];
  const srcPath = srcArg ?? fileURLToPath(
    new URL("../../../../rinri/docs/se-code-jpn.md", import.meta.url),
  );
  const outPath = fileURLToPath(
    new URL("../../../skills/ethics-audit/data/se-code.json", import.meta.url),
  );

  const markdown = readFileSync(srcPath, "utf8");
  const code = parse(markdown);

  // 生成物の健全性を fail loud で確認する。
  if (code.principles.length !== 8) {
    throw new Error(`原則が8個ではありません: ${code.principles.length}（source: ${srcPath}）`);
  }
  // 綱領5.2版の項目数は 80（P1:8 P2:9 P3:15 P4:6 P5:12 P6:13 P7:8 P8:9）。
  if (code.items.length !== 80) {
    throw new Error(`項目が80個ではありません: ${code.items.length}（source: ${srcPath}）`);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(code, null, 2)}\n`, "utf8");
  process.stdout.write(
    `生成完了: ${outPath}\n原則 ${code.principles.length} / 項目 ${code.items.length}\n`,
  );
}

main();
