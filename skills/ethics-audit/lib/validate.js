/**
 * 実行時バリデータ（valibot 代替・実行時依存ゼロ）。
 *
 * JSON.parse 由来の値はこのモジュールの境界でのみ `unknown` として受け取り、
 * 明示的なガードで型付きに絞り込む。不正は握り潰さず ValidationError で fail loud する。
 * これは「信頼境界での unknown の正しい使い方」であり、型の逃げ道としての any/unknown ではない。
 */
import { SEVERITIES } from "./schema.js";
/** 検証失敗。どのパスで何が期待外れだったかを含める。 */
export class ValidationError extends Error {
    path;
    constructor(path, message) {
        super(`${path}: ${message}`);
        this.path = path;
        this.name = "ValidationError";
    }
}
/** プレーンオブジェクトかを判定する（配列・null を除く）。 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireRecord(value, path) {
    if (!isRecord(value))
        throw new ValidationError(path, "オブジェクトが必要です");
    return value;
}
function requireArray(value, path) {
    if (!Array.isArray(value))
        throw new ValidationError(path, "配列が必要です");
    return value;
}
function requireString(value, path) {
    if (typeof value !== "string")
        throw new ValidationError(path, "文字列が必要です");
    return value;
}
function requireNonEmptyString(value, path) {
    const s = requireString(value, path);
    if (s.length === 0)
        throw new ValidationError(path, "空文字は不可です");
    return s;
}
function requireNumber(value, path) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new ValidationError(path, "数値が必要です");
    }
    return value;
}
function requireBoolean(value, path) {
    if (typeof value !== "boolean")
        throw new ValidationError(path, "真偽値が必要です");
    return value;
}
function requireSeverity(value, path) {
    const s = requireString(value, path);
    const found = SEVERITIES.find((sev) => sev === s);
    if (found === undefined) {
        throw new ValidationError(path, `severity は ${SEVERITIES.join("|")} のいずれか`);
    }
    return found;
}
/** 項目ID "N.MM"（N=1..8, MM=2桁）の形式を検証する。 */
function requireItemId(value, path) {
    const s = requireString(value, path);
    if (!/^[1-8]\.\d{2}$/.test(s)) {
        throw new ValidationError(path, `項目IDは "N.MM" 形式が必要です（受領: ${s}）`);
    }
    return s;
}
function parsePrinciple(value, path) {
    const o = requireRecord(value, path);
    const number = requireNumber(o["number"], `${path}.number`);
    if (number < 1 || number > 8 || !Number.isInteger(number)) {
        throw new ValidationError(`${path}.number`, "原則番号は 1..8 の整数");
    }
    return {
        number,
        name: requireNonEmptyString(o["name"], `${path}.name`),
        statement: requireNonEmptyString(o["statement"], `${path}.statement`),
    };
}
function parseEthicsItem(value, path) {
    const o = requireRecord(value, path);
    const redFlagsRaw = requireArray(o["redFlags"], `${path}.redFlags`);
    return {
        id: requireItemId(o["id"], `${path}.id`),
        principle: requireNumber(o["principle"], `${path}.principle`),
        title: requireNonEmptyString(o["title"], `${path}.title`),
        text: requireNonEmptyString(o["text"], `${path}.text`),
        redFlags: redFlagsRaw.map((f, i) => requireNonEmptyString(f, `${path}.redFlags[${i}]`)),
    };
}
/** data/se-code.json をパースし CodeOfEthics として検証する。 */
export function parseCodeOfEthics(value) {
    const o = requireRecord(value, "$");
    const principlesRaw = requireArray(o["principles"], "$.principles");
    const itemsRaw = requireArray(o["items"], "$.items");
    const principles = principlesRaw.map((p, i) => parsePrinciple(p, `$.principles[${i}]`));
    const items = itemsRaw.map((it, i) => parseEthicsItem(it, `$.items[${i}]`));
    if (principles.length !== 8) {
        throw new ValidationError("$.principles", `原則は8個が必要です（受領: ${principles.length}）`);
    }
    // 全項目の principle 番号が実在する原則を指すことを保証する（整合性 fail loud）。
    const principleNumbers = new Set(principles.map((p) => p.number));
    for (const item of items) {
        if (!principleNumbers.has(item.principle)) {
            throw new ValidationError(`$.items（${item.id}）`, `未知の原則番号 ${item.principle}`);
        }
        if (Number(item.id.split(".")[0]) !== item.principle) {
            throw new ValidationError(`$.items（${item.id}）`, `IDの原則番号と principle が不一致`);
        }
    }
    return {
        version: requireNonEmptyString(o["version"], "$.version"),
        source: requireNonEmptyString(o["source"], "$.source"),
        principles,
        items,
    };
}
/** 単一 Finding をパースする。 */
function parseFinding(value, path) {
    const o = requireRecord(value, path);
    return {
        itemId: requireItemId(o["itemId"], `${path}.itemId`),
        severity: requireSeverity(o["severity"], `${path}.severity`),
        file: requireNonEmptyString(o["file"], `${path}.file`),
        line: requireNumber(o["line"], `${path}.line`),
        description: requireNonEmptyString(o["description"], `${path}.description`),
        evidence: requireString(o["evidence"], `${path}.evidence`),
        recommendation: requireNonEmptyString(o["recommendation"], `${path}.recommendation`),
        confirmed: requireBoolean(o["confirmed"], `${path}.confirmed`),
    };
}
/**
 * findings 入力をパースする。
 * トップレベルは Finding[] か、または { findings: Finding[] } のどちらも許容する
 * （エージェント出力のばらつきを吸収するが、中身の型は厳密に検証する）。
 */
export function parseFindings(value) {
    const arr = Array.isArray(value)
        ? value
        : isRecord(value)
            ? requireArray(value["findings"], "$.findings")
            : (() => {
                throw new ValidationError("$", "配列または { findings: [...] } が必要です");
            })();
    return arr.map((f, i) => parseFinding(f, `$[${i}]`));
}
const VERDICTS = ["合格", "要改善", "不適合"];
function requireVerdict(value, path) {
    const s = requireString(value, path);
    const found = VERDICTS.find((v) => v === s);
    if (found === undefined) {
        throw new ValidationError(path, `verdict は ${VERDICTS.join("|")} のいずれか`);
    }
    return found;
}
function parsePrincipleScore(value, path) {
    const o = requireRecord(value, path);
    return {
        principle: requireNumber(o["principle"], `${path}.principle`),
        name: requireNonEmptyString(o["name"], `${path}.name`),
        score: requireNumber(o["score"], `${path}.score`),
        findings: requireNumber(o["findings"], `${path}.findings`),
    };
}
/** score コマンドが出力した AuditResult をパース・検証する（tweet の入力用）。 */
export function parseAuditResult(value) {
    const o = requireRecord(value, "$");
    const principlesRaw = requireArray(o["principles"], "$.principles");
    const bySevRaw = requireRecord(o["bySeverity"], "$.bySeverity");
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const sev of SEVERITIES) {
        bySeverity[sev] = requireNumber(bySevRaw[sev], `$.bySeverity.${sev}`);
    }
    return {
        overall: requireNumber(o["overall"], "$.overall"),
        verdict: requireVerdict(o["verdict"], "$.verdict"),
        principles: principlesRaw.map((p, i) => parsePrincipleScore(p, `$.principles[${i}]`)),
        totalFindings: requireNumber(o["totalFindings"], "$.totalFindings"),
        bySeverity,
    };
}
