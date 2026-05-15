import { t as ifDefined } from "./defined-CV9lG7rM.mjs";

//#region src/redact-db-url.ts
/**
* Redacts a database connection URL to a minimal metadata object.
*
* Parsing errors are ignored and result in an empty object so callers never
* leak raw URLs when the input is malformed.
*/
function redactDatabaseUrl(url) {
	try {
		const parsed = new URL(url);
		const database = parsed.pathname?.replace(/^\//, "") || void 0;
		return {
			...ifDefined("host", parsed.hostname || void 0),
			...ifDefined("port", parsed.port || void 0),
			...ifDefined("database", database),
			...ifDefined("username", parsed.username || void 0)
		};
	} catch {
		return {};
	}
}

//#endregion
export { redactDatabaseUrl };
//# sourceMappingURL=redact-db-url.mjs.map