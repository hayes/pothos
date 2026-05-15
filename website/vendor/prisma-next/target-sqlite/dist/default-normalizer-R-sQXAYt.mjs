//#region src/core/default-normalizer.ts
const NULL_PATTERN = /^NULL$/i;
const INTEGER_PATTERN = /^-?\d+$/;
const REAL_PATTERN = /^-?\d+\.\d+(?:[eE][+-]?\d+)?$/;
const HEX_PATTERN = /^0[xX][\dA-Fa-f]+$/;
const STRING_LITERAL_PATTERN = /^'((?:[^']|'')*)'$/;
function isNumericLiteral(value) {
	return INTEGER_PATTERN.test(value) || REAL_PATTERN.test(value) || HEX_PATTERN.test(value);
}
/**
* Strips a single matched wrapping pair of outer parens from `s`. Conservative:
* only strips when the leading `(` is matched by the trailing `)` (so
* `(a) + (b)` is returned unchanged). Mirrors SQLite's own
* `pragma_table_info.dflt_value` normalization for expression defaults, and
* is shared with the recreate-table postcheck builder so both sides agree
* on the canonical form.
*/
function stripOuterParens(s) {
	if (!s.startsWith("(") || !s.endsWith(")")) return s;
	let depth = 0;
	for (let i = 0; i < s.length; i++) if (s[i] === "(") depth += 1;
	else if (s[i] === ")") {
		depth -= 1;
		if (depth === 0 && i < s.length - 1) return s;
	}
	return s.slice(1, -1);
}
function parseSqliteDefault(rawDefault, nativeType) {
	let trimmed = rawDefault.trim();
	while (true) {
		const stripped = stripOuterParens(trimmed).trim();
		if (stripped === trimmed) break;
		trimmed = stripped;
	}
	const lower = trimmed.toLowerCase();
	if (lower === "current_timestamp" || lower === "datetime('now')" || lower === "datetime(\"now\")") return {
		kind: "function",
		expression: "now()"
	};
	if (NULL_PATTERN.test(trimmed)) return {
		kind: "literal",
		value: null
	};
	if (isNumericLiteral(trimmed)) {
		const num = Number(trimmed);
		if (!Number.isFinite(num)) return void 0;
		if (nativeType?.toLowerCase() === "integer" && !Number.isSafeInteger(num)) return {
			kind: "literal",
			value: trimmed
		};
		return {
			kind: "literal",
			value: num
		};
	}
	const stringMatch = trimmed.match(STRING_LITERAL_PATTERN);
	if (stringMatch?.[1] !== void 0) return {
		kind: "literal",
		value: stringMatch[1].replace(/''/g, "'")
	};
	return {
		kind: "function",
		expression: trimmed
	};
}

//#endregion
export { stripOuterParens as n, parseSqliteDefault as t };
//# sourceMappingURL=default-normalizer-R-sQXAYt.mjs.map