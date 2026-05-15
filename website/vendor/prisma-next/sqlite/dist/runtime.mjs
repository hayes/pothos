import sqliteAdapter from "@prisma-next/adapter-sqlite/runtime";
import sqliteDriver from "@prisma-next/driver-sqlite/runtime";
import { emptyCodecLookup } from "@prisma-next/framework-components/codec";
import { instantiateExecutionStack } from "@prisma-next/framework-components/execution";
import { sql } from "@prisma-next/sql-builder/runtime";
import { validateContract } from "@prisma-next/sql-contract/validate";
import { orm } from "@prisma-next/sql-orm-client";
import { createExecutionContext, createRuntime, createSqlExecutionStack } from "@prisma-next/sql-runtime";
import sqliteTarget from "@prisma-next/target-sqlite/runtime";

//#region src/runtime/binding.ts
function resolveSqliteBinding(input) {
	return {
		kind: "path",
		path: input.path
	};
}
function resolveOptionalSqliteBinding(options) {
	if (options.path === void 0) return;
	return {
		kind: "path",
		path: options.path
	};
}

//#endregion
//#region src/runtime/sqlite.ts
function resolveContract(options) {
	return validateContract("contractJson" in options && options.contractJson !== void 0 ? options.contractJson : options.contract, emptyCodecLookup);
}
function sqlite(options) {
	const contract = resolveContract(options);
	let binding = resolveOptionalSqliteBinding(options);
	const stack = createSqlExecutionStack({
		target: sqliteTarget,
		adapter: sqliteAdapter,
		driver: sqliteDriver,
		extensionPacks: options.extensions ?? []
	});
	const context = createExecutionContext({
		contract,
		stack
	});
	const sql$1 = sql({ context });
	let runtimeInstance;
	let runtimeDriver;
	let driverConnected = false;
	let connectPromise;
	let backgroundConnectError;
	const connectDriver = async (resolvedBinding) => {
		if (driverConnected) return;
		if (!runtimeDriver) throw new Error("SQLite runtime driver missing");
		if (connectPromise) return connectPromise;
		connectPromise = runtimeDriver.connect(resolvedBinding).then(() => {
			driverConnected = true;
		}).catch((err) => {
			backgroundConnectError = err;
			connectPromise = void 0;
			throw err;
		});
		return connectPromise;
	};
	const getRuntime = () => {
		if (backgroundConnectError !== void 0) throw backgroundConnectError;
		if (runtimeInstance) return runtimeInstance;
		const stackInstance = instantiateExecutionStack(stack);
		const driverDescriptor = stack.driver;
		if (!driverDescriptor) throw new Error("Driver descriptor missing from execution stack");
		const driver = driverDescriptor.create();
		runtimeDriver = driver;
		if (binding !== void 0) connectDriver(binding).catch(() => void 0);
		runtimeInstance = createRuntime({
			stackInstance,
			context,
			driver,
			verify: options.verify ?? {
				mode: "onFirstUse",
				requireMarker: false
			},
			...options.middleware ? { middleware: options.middleware } : {}
		});
		return runtimeInstance;
	};
	return {
		sql: sql$1,
		orm: orm({
			context,
			runtime: {
				execute(plan) {
					return getRuntime().execute(plan);
				},
				connection() {
					return getRuntime().connection();
				}
			}
		}),
		context,
		stack,
		async connect(bindingInput) {
			if (driverConnected || connectPromise) throw new Error("SQLite client already connected");
			backgroundConnectError = void 0;
			if (bindingInput !== void 0) binding = resolveSqliteBinding(bindingInput);
			if (binding === void 0) throw new Error("SQLite binding not configured. Pass path to sqlite(...) or call db.connect({ path }).");
			const runtime = getRuntime();
			if (driverConnected) return runtime;
			await connectDriver(binding);
			return runtime;
		},
		runtime() {
			return getRuntime();
		}
	};
}

//#endregion
export { sqlite as default };
//# sourceMappingURL=runtime.mjs.map