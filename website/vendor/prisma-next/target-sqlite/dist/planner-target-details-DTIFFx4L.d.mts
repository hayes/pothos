//#region src/core/migrations/planner-target-details.d.ts
type OperationClass = 'table' | 'column' | 'primaryKey' | 'unique' | 'index' | 'foreignKey';
interface SqlitePlanTargetDetails {
  readonly schema: string;
  readonly objectType: OperationClass;
  readonly name: string;
  readonly table?: string;
}
declare function buildTargetDetails(objectType: OperationClass, name: string, table?: string): SqlitePlanTargetDetails;
//#endregion
export { buildTargetDetails as n, SqlitePlanTargetDetails as t };
//# sourceMappingURL=planner-target-details-DTIFFx4L.d.mts.map