import { t as SqlitePlanTargetDetails } from "./planner-target-details-DTIFFx4L.mjs";
import "./shared-BNtoZqdo.mjs";
import { l as SqliteOpFactoryCall } from "./op-factory-call-BPPSCdTB.mjs";
import { SqlMigrationPlanOperation } from "@prisma-next/family-sql/control";

//#region src/core/migrations/render-ops.d.ts
type Op = SqlMigrationPlanOperation<SqlitePlanTargetDetails>;
declare function renderOps(calls: readonly SqliteOpFactoryCall[]): Op[];
//#endregion
export { renderOps };
//# sourceMappingURL=render-ops.d.mts.map