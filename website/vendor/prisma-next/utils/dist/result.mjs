//#region src/result.ts
/**
* Result class that implements both Ok and NotOk variants.
*/
var ResultImpl = class ResultImpl {
	ok;
	_value;
	_failure;
	constructor(ok$1, valueOrFailure) {
		this.ok = ok$1;
		if (ok$1) this._value = valueOrFailure;
		else this._failure = valueOrFailure;
		Object.freeze(this);
	}
	get value() {
		if (!this.ok) throw new Error("Cannot access value on NotOk result");
		return this._value;
	}
	get failure() {
		if (this.ok) throw new Error("Cannot access failure on Ok result");
		return this._failure;
	}
	/**
	* Creates a successful result.
	*/
	static ok(value) {
		return new ResultImpl(true, value);
	}
	/**
	* Creates an unsuccessful result.
	*/
	static notOk(failure) {
		return new ResultImpl(false, failure);
	}
	/**
	* Asserts that this result is Ok and returns the value.
	* Throws if the result is NotOk.
	*/
	assertOk() {
		if (!this.ok) throw new Error("Expected Ok result but got NotOk");
		return this.value;
	}
	/**
	* Asserts that this result is NotOk and returns the failure.
	* Throws if the result is Ok.
	*/
	assertNotOk() {
		if (this.ok) throw new Error("Expected NotOk result but got Ok");
		return this.failure;
	}
};
/**
* Creates a successful result.
*/
function ok(value) {
	return ResultImpl.ok(value);
}
/**
* Creates an unsuccessful result.
*/
function notOk(failure) {
	return ResultImpl.notOk(failure);
}
/**
* Singleton for void success results.
* Use this for validation checks that don't produce a value.
*/
const OK_VOID = ResultImpl.ok(void 0);
/**
* Returns a successful void result.
* Use this for validation checks that don't produce a value.
*/
function okVoid() {
	return OK_VOID;
}

//#endregion
export { notOk, ok, okVoid };
//# sourceMappingURL=result.mjs.map