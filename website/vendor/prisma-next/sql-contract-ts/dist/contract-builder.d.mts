import { ColumnDefault, ColumnDefaultLiteralInputValue, Contract, ContractRelation, ExecutionMutationDefaultValue, StorageHashBase } from "@prisma-next/contract/types";
import { ContractWithTypeMaps, Index as Index$1, ReferentialAction, SqlStorage, StorageTypeInstance, TypeMaps } from "@prisma-next/sql-contract/types";
import { AuthoringArgumentDescriptor, AuthoringFieldNamespace, AuthoringFieldPresetDescriptor, AuthoringTypeConstructorDescriptor, AuthoringTypeNamespace } from "@prisma-next/framework-components/authoring";
import { ColumnTypeDescriptor, ForeignKeyDefaultsState } from "@prisma-next/contract-authoring";
import { CodecLookup } from "@prisma-next/framework-components/codec";
import { ExtensionPackRef, FamilyPackRef, TargetPackRef } from "@prisma-next/framework-components/components";

//#region src/contract-dsl.d.ts
type NamingStrategy = 'identity' | 'snake_case';
type NamingConfig = {
  readonly tables?: NamingStrategy;
  readonly columns?: NamingStrategy;
};
type NamedStorageTypeRef = string | StorageTypeInstance;
type NamedConstraintNameSpec<Name$1 extends string = string> = {
  readonly name: Name$1;
};
type ScalarFieldState<CodecId$1 extends string = string, TypeRef$1 extends NamedStorageTypeRef | undefined = undefined, Nullable$1 extends boolean = boolean, ColumnName extends string | undefined = string | undefined, IdSpec$1 extends NamedConstraintSpec | undefined = undefined, UniqueSpec$1 extends NamedConstraintSpec | undefined = undefined> = {
  readonly kind: 'scalar';
  readonly descriptor?: (ColumnTypeDescriptor & {
    readonly codecId: CodecId$1;
  }) | undefined;
  readonly typeRef?: TypeRef$1 | undefined;
  readonly nullable: Nullable$1;
  readonly columnName?: ColumnName | undefined;
  readonly default?: ColumnDefault | undefined;
  readonly executionDefault?: ExecutionMutationDefaultValue | undefined;
} & (IdSpec$1 extends NamedConstraintSpec ? {
  readonly id: IdSpec$1;
} : {
  readonly id?: undefined;
}) & (UniqueSpec$1 extends NamedConstraintSpec ? {
  readonly unique: UniqueSpec$1;
} : {
  readonly unique?: undefined;
});
type AnyScalarFieldState = {
  readonly kind: 'scalar';
  readonly descriptor?: (ColumnTypeDescriptor & {
    readonly codecId: string;
  }) | undefined;
  readonly typeRef?: NamedStorageTypeRef | undefined;
  readonly nullable: boolean;
  readonly columnName?: string | undefined;
  readonly default?: ColumnDefault | undefined;
  readonly executionDefault?: ExecutionMutationDefaultValue | undefined;
  readonly id?: NamedConstraintSpec | undefined;
  readonly unique?: NamedConstraintSpec | undefined;
};
type HasNamedConstraintId<State extends AnyScalarFieldState> = State extends ScalarFieldState<string, NamedStorageTypeRef | undefined, boolean, string | undefined, infer IdSpec, NamedConstraintSpec | undefined> ? IdSpec extends NamedConstraintSpec ? true : false : false;
type HasNamedConstraintUnique<State extends AnyScalarFieldState> = State extends ScalarFieldState<string, NamedStorageTypeRef | undefined, boolean, string | undefined, NamedConstraintSpec | undefined, infer UniqueSpec> ? UniqueSpec extends NamedConstraintSpec ? true : false : false;
type FieldSqlSpecForState<State extends AnyScalarFieldState> = {
  readonly column?: string;
} & (HasNamedConstraintId<State> extends true ? {
  readonly id?: NamedConstraintNameSpec;
} : Record<never, never>) & (HasNamedConstraintUnique<State> extends true ? {
  readonly unique?: NamedConstraintNameSpec;
} : Record<never, never>);
type ApplyFieldSqlSpec<State extends AnyScalarFieldState, Spec extends FieldSqlSpecForState<State>> = State extends ScalarFieldState<infer CodecId, infer TypeRef, infer Nullable, infer ColumnName, infer IdSpec, infer UniqueSpec> ? ScalarFieldState<CodecId, TypeRef, Nullable, Spec extends {
  readonly column: infer NextColumn extends string;
} ? NextColumn : ColumnName, Spec extends {
  readonly id: {
    readonly name: infer IdName extends string;
  };
} ? IdSpec extends NamedConstraintSpec ? NamedConstraintSpec<IdName> : IdSpec : IdSpec, Spec extends {
  readonly unique: {
    readonly name: infer UniqueName extends string;
  };
} ? UniqueSpec extends NamedConstraintSpec ? NamedConstraintSpec<UniqueName> : UniqueSpec : UniqueSpec> : never;
type GeneratedFieldSpec = {
  readonly type: ColumnTypeDescriptor;
  readonly typeParams?: Record<string, unknown>;
  readonly generated: ExecutionMutationDefaultValue;
};
declare class ScalarFieldBuilder<State extends AnyScalarFieldState = AnyScalarFieldState> {
  private readonly state;
  readonly __state: State;
  constructor(state: State);
  optional(): ScalarFieldBuilder<State extends ScalarFieldState<infer CodecId, infer TypeRef, boolean, infer ColumnName, infer IdSpec, infer UniqueSpec> ? ScalarFieldState<CodecId, TypeRef, true, ColumnName, IdSpec, UniqueSpec> : never>;
  column<ColumnName extends string>(name: ColumnName): ScalarFieldBuilder<State extends ScalarFieldState<infer CodecId, infer TypeRef, infer Nullable, string | undefined, infer IdSpec, infer UniqueSpec> ? ScalarFieldState<CodecId, TypeRef, Nullable, ColumnName, IdSpec, UniqueSpec> : never>;
  default(value: ColumnDefaultLiteralInputValue | ColumnDefault): ScalarFieldBuilder<State>;
  defaultSql(expression: string): ScalarFieldBuilder<State>;
  id<const Name$1 extends string | undefined = undefined>(options?: NamedConstraintSpec<Name$1>): ScalarFieldBuilder<State extends ScalarFieldState<infer CodecId, infer TypeRef, infer Nullable, infer ColumnName, NamedConstraintSpec | undefined, infer UniqueSpec> ? ScalarFieldState<CodecId, TypeRef, Nullable, ColumnName, NamedConstraintSpec<Name$1>, UniqueSpec> : never>;
  unique<const Name$1 extends string | undefined = undefined>(options?: NamedConstraintSpec<Name$1>): ScalarFieldBuilder<State extends ScalarFieldState<infer CodecId, infer TypeRef, infer Nullable, infer ColumnName, infer IdSpec, NamedConstraintSpec | undefined> ? ScalarFieldState<CodecId, TypeRef, Nullable, ColumnName, IdSpec, NamedConstraintSpec<Name$1>> : never>;
  sql<const Spec extends FieldSqlSpecForState<State>>(spec: Spec): ScalarFieldBuilder<ApplyFieldSqlSpec<State, Spec>>;
  build(): State;
}
declare function columnField<Descriptor extends ColumnTypeDescriptor>(descriptor: Descriptor): ScalarFieldBuilder<ScalarFieldState<Descriptor['codecId'], undefined, false, undefined>>;
declare function generatedField<Descriptor extends ColumnTypeDescriptor>(spec: GeneratedFieldSpec & {
  readonly type: Descriptor;
}): ScalarFieldBuilder<ScalarFieldState<Descriptor['codecId'], undefined, false, undefined>>;
declare function namedTypeField<TypeRef$1 extends string>(typeRef: TypeRef$1): ScalarFieldBuilder<ScalarFieldState<string, TypeRef$1, false, undefined>>;
declare function namedTypeField<TypeRef$1 extends StorageTypeInstance>(typeRef: TypeRef$1): ScalarFieldBuilder<ScalarFieldState<TypeRef$1['codecId'], TypeRef$1, false, undefined>>;
type RelationModelRefSource = 'string' | 'token' | 'lazyToken';
type TargetFieldRefSource = 'string' | 'token';
type EagerRelationModelName<ModelName$1 extends string = string, Source extends Exclude<RelationModelRefSource, 'lazyToken'> = Exclude<RelationModelRefSource, 'lazyToken'>> = {
  readonly kind: 'relationModelName';
  readonly source: Source;
  readonly modelName: ModelName$1;
};
type LazyRelationModelName<ModelName$1 extends string = string> = {
  readonly kind: 'lazyRelationModelName';
  readonly source: 'lazyToken';
  readonly resolve: () => ModelName$1;
};
type RelationModelSource<ModelName$1 extends string = string> = EagerRelationModelName<ModelName$1> | LazyRelationModelName<ModelName$1>;
type BelongsToRelation<ToModel$1 extends string = string, FromField$1 extends string | readonly string[] = string | readonly string[], ToField$1 extends string | readonly string[] = string | readonly string[], SqlSpec extends BelongsToRelationSqlSpec | undefined = undefined> = {
  readonly kind: 'belongsTo';
  readonly toModel: RelationModelSource<ToModel$1>;
  readonly from: FromField$1;
  readonly to: ToField$1;
  readonly sql?: SqlSpec;
};
type HasManyRelation<ToModel$1 extends string = string, ByField extends string | readonly string[] = string | readonly string[]> = {
  readonly kind: 'hasMany';
  readonly toModel: RelationModelSource<ToModel$1>;
  readonly by: ByField;
};
type HasOneRelation<ToModel$1 extends string = string, ByField extends string | readonly string[] = string | readonly string[]> = {
  readonly kind: 'hasOne';
  readonly toModel: RelationModelSource<ToModel$1>;
  readonly by: ByField;
};
type ManyToManyRelation<ToModel$1 extends string = string, ThroughModel extends string = string, FromField$1 extends string | readonly string[] = string | readonly string[], ToField$1 extends string | readonly string[] = string | readonly string[]> = {
  readonly kind: 'manyToMany';
  readonly toModel: RelationModelSource<ToModel$1>;
  readonly through: RelationModelSource<ThroughModel>;
  readonly from: FromField$1;
  readonly to: ToField$1;
};
type RelationState = BelongsToRelation<string, string | readonly string[], string | readonly string[], BelongsToRelationSqlSpec | undefined> | HasManyRelation | HasOneRelation | ManyToManyRelation;
type AnyRelationState = RelationState;
type AnyRelationBuilder = RelationBuilder<AnyRelationState>;
type ApplyBelongsToRelationSqlSpec<State extends RelationState, SqlSpec extends BelongsToRelationSqlSpec> = State extends BelongsToRelation<infer ToModel, infer FromField, infer ToField, BelongsToRelationSqlSpec | undefined> ? BelongsToRelation<ToModel, FromField, ToField, SqlSpec> : never;
declare class RelationBuilder<State extends RelationState = AnyRelationState> {
  private readonly state;
  readonly __state: State;
  constructor(state: State);
  sql<const SqlSpec extends BelongsToRelationSqlSpec>(this: State extends BelongsToRelation<string, string | readonly string[], string | readonly string[], BelongsToRelationSqlSpec | undefined> ? RelationBuilder<State> : never, spec: SqlSpec): RelationBuilder<ApplyBelongsToRelationSqlSpec<State, SqlSpec>>;
  build(): State;
}
type ColumnRef<FieldName$1 extends string = string> = {
  readonly kind: 'columnRef';
  readonly fieldName: FieldName$1;
};
type TargetFieldRef<ModelName$1 extends string = string, FieldName$1 extends string = string, Source extends TargetFieldRefSource = TargetFieldRefSource> = {
  readonly kind: 'targetFieldRef';
  readonly source: Source;
  readonly modelName: ModelName$1;
  readonly fieldName: FieldName$1;
};
type ModelTokenRefs<ModelName$1 extends string, Fields$1 extends Record<string, ScalarFieldBuilder>> = { readonly [K in keyof Fields$1]: TargetFieldRef<ModelName$1, K & string> };
type ConstraintOptions<Name$1 extends string | undefined = string | undefined> = {
  readonly name?: Name$1;
};
type IndexOptions<Name$1 extends string | undefined = string | undefined> = ConstraintOptions<Name$1> & {
  readonly using?: string;
  readonly config?: Record<string, unknown>;
};
type ForeignKeyOptions<Name$1 extends string | undefined = string | undefined> = ConstraintOptions<Name$1> & {
  readonly onDelete?: 'noAction' | 'restrict' | 'cascade' | 'setNull' | 'setDefault';
  readonly onUpdate?: 'noAction' | 'restrict' | 'cascade' | 'setNull' | 'setDefault';
  readonly constraint?: boolean;
  readonly index?: boolean;
};
type BelongsToRelationSqlSpec<Name$1 extends string | undefined = string | undefined> = {
  readonly fk?: ForeignKeyOptions<Name$1>;
};
type IdConstraint<FieldNames extends readonly string[] = readonly string[], Name$1 extends string | undefined = string | undefined> = {
  readonly kind: 'id';
  readonly fields: FieldNames;
  readonly name?: Name$1;
};
type UniqueConstraint<FieldNames extends readonly string[] = readonly string[]> = {
  readonly kind: 'unique';
  readonly fields: FieldNames;
  readonly name?: string;
};
type IndexConstraint<FieldNames extends readonly string[] = readonly string[], Name$1 extends string | undefined = string | undefined> = {
  readonly kind: 'index';
  readonly fields: FieldNames;
  readonly name?: Name$1;
  readonly using?: string;
  readonly config?: Record<string, unknown>;
};
type ForeignKeyConstraint<SourceFieldNames extends readonly string[] = readonly string[], TargetModelName extends string = string, TargetFieldNames extends readonly string[] = readonly string[], Name$1 extends string | undefined = string | undefined> = {
  readonly kind: 'fk';
  readonly fields: SourceFieldNames;
  readonly targetModel: TargetModelName;
  readonly targetFields: TargetFieldNames;
  readonly targetSource?: TargetFieldRefSource;
  readonly name?: Name$1;
  readonly onDelete?: 'noAction' | 'restrict' | 'cascade' | 'setNull' | 'setDefault';
  readonly onUpdate?: 'noAction' | 'restrict' | 'cascade' | 'setNull' | 'setDefault';
  readonly constraint?: boolean;
  readonly index?: boolean;
};
declare function createConstraintsDsl(): {
  ref: <ModelName$1 extends string, FieldName$1 extends string>(modelName: ModelName$1, fieldName: FieldName$1) => TargetFieldRef<ModelName$1, FieldName$1>;
  id: {
    <FieldName$1 extends string, Name$1 extends string | undefined = undefined>(field: ColumnRef<FieldName$1>, options?: NamedConstraintSpec<Name$1>): IdConstraint<readonly [FieldName$1], Name$1>;
    <FieldNames extends readonly string[], Name$1 extends string | undefined = undefined>(fields: { readonly [K in keyof FieldNames]: ColumnRef<FieldNames[K] & string> }, options?: NamedConstraintSpec<Name$1>): IdConstraint<FieldNames, Name$1>;
  };
  unique: {
    <FieldName$1 extends string>(field: ColumnRef<FieldName$1>, options?: ConstraintOptions): UniqueConstraint<readonly [FieldName$1]>;
    <FieldNames extends readonly string[]>(fields: { readonly [K in keyof FieldNames]: ColumnRef<FieldNames[K] & string> }, options?: ConstraintOptions): UniqueConstraint<FieldNames>;
  };
  index: {
    <FieldName$1 extends string, Name$1 extends string | undefined = undefined>(field: ColumnRef<FieldName$1>, options?: IndexOptions<Name$1>): IndexConstraint<readonly [FieldName$1], Name$1>;
    <FieldNames extends readonly string[], Name$1 extends string | undefined = undefined>(fields: { readonly [K in keyof FieldNames]: ColumnRef<FieldNames[K] & string> }, options?: IndexOptions<Name$1>): IndexConstraint<FieldNames, Name$1>;
  };
  foreignKey: {
    <SourceFieldName extends string, TargetModelName extends string, TargetFieldName extends string, Name$1 extends string | undefined = undefined>(field: ColumnRef<SourceFieldName>, target: TargetFieldRef<TargetModelName, TargetFieldName>, options?: ForeignKeyOptions<Name$1>): ForeignKeyConstraint<readonly [SourceFieldName], TargetModelName, readonly [TargetFieldName], Name$1>;
    <SourceFieldNames extends readonly string[], TargetModelName extends string, TargetFieldNames extends readonly string[], Name$1 extends string | undefined = undefined>(fields: { readonly [K in keyof SourceFieldNames]: ColumnRef<SourceFieldNames[K] & string> }, target: { readonly [K in keyof TargetFieldNames]: TargetFieldRef<TargetModelName, TargetFieldNames[K] & string> }, options?: ForeignKeyOptions<Name$1>): ForeignKeyConstraint<SourceFieldNames, TargetModelName, TargetFieldNames, Name$1>;
  };
};
type ConstraintsDsl = ReturnType<typeof createConstraintsDsl>;
type ModelAttributesSpec = {
  readonly id?: IdConstraint;
  readonly uniques?: readonly UniqueConstraint[];
};
type SqlStageSpec = {
  readonly table?: string;
  readonly indexes?: readonly IndexConstraint[];
  readonly foreignKeys?: readonly ForeignKeyConstraint[];
};
type FieldRefs<Fields$1 extends Record<string, ScalarFieldBuilder>> = { readonly [K in keyof Fields$1]: ColumnRef<K & string> };
type AttributeContext<Fields$1 extends Record<string, ScalarFieldBuilder>> = {
  readonly fields: FieldRefs<Fields$1>;
  readonly constraints: Pick<ConstraintsDsl, 'id' | 'unique'>;
};
type SqlContext<Fields$1 extends Record<string, ScalarFieldBuilder>> = {
  readonly cols: FieldRefs<Fields$1>;
  readonly constraints: Pick<ConstraintsDsl, 'index' | 'foreignKey' | 'ref'>;
};
type StageInput<Context, Spec> = Spec | ((context: Context) => Spec);
type StaticLiteralName<Name$1> = Name$1 extends string ? (string extends Name$1 ? never : Name$1) : never;
type NamedConstraintLiteralName<Constraint> = Constraint extends {
  readonly name?: infer Name;
} ? StaticLiteralName<Name> : never;
type DuplicateLiteralNames<Items extends readonly unknown[], Seen extends string = never, Duplicates extends string = never> = Items extends readonly [infer First, ...infer Rest extends readonly unknown[]] ? NamedConstraintLiteralName<First> extends infer Name extends string ? Name extends Seen ? DuplicateLiteralNames<Rest, Seen, Duplicates | Name> : DuplicateLiteralNames<Rest, Seen | Name, Duplicates> : DuplicateLiteralNames<Rest, Seen, Duplicates> : Duplicates;
type InlineIdLiteralName<Fields$1 extends Record<string, ScalarFieldBuilder>> = { readonly [FieldName in keyof Fields$1]: FieldStateOf<Fields$1[FieldName]> extends {
  readonly id: {
    readonly name?: infer Name;
  };
} ? StaticLiteralName<Name> : never }[keyof Fields$1];
type AttributeIdLiteralName<AttributesSpec extends ModelAttributesSpec | undefined> = AttributesSpec extends {
  readonly id?: {
    readonly name?: infer Name;
  };
} ? StaticLiteralName<Name> : never;
type ModelIdLiteralName<Fields$1 extends Record<string, ScalarFieldBuilder>, AttributesSpec extends ModelAttributesSpec | undefined> = [AttributeIdLiteralName<AttributesSpec>] extends [never] ? InlineIdLiteralName<Fields$1> : AttributeIdLiteralName<AttributesSpec>;
type SqlIndexes<SqlSpec extends SqlStageSpec> = SqlSpec extends {
  readonly indexes?: infer Indexes extends readonly unknown[];
} ? Indexes : readonly [];
type SqlForeignKeys<SqlSpec extends SqlStageSpec> = SqlSpec extends {
  readonly foreignKeys?: infer ForeignKeys extends readonly unknown[];
} ? ForeignKeys : readonly [];
type SqlNamedObjects<SqlSpec extends SqlStageSpec> = [...SqlIndexes<SqlSpec>, ...SqlForeignKeys<SqlSpec>];
type ValidateSqlStageSpec<Fields$1 extends Record<string, ScalarFieldBuilder>, AttributesSpec extends ModelAttributesSpec | undefined, SqlSpec extends SqlStageSpec> = [DuplicateLiteralNames<SqlNamedObjects<SqlSpec>>] extends [never] ? [Extract<ModelIdLiteralName<Fields$1, AttributesSpec>, NamedConstraintLiteralName<SqlNamedObjects<SqlSpec>[number]>>] extends [never] ? SqlSpec : never : never;
type ValidateAttributesStageSpec<Fields$1 extends Record<string, ScalarFieldBuilder>, SqlSpec extends SqlStageSpec | undefined, AttributesSpec extends ModelAttributesSpec> = SqlSpec extends SqlStageSpec ? [Extract<ModelIdLiteralName<Fields$1, AttributesSpec>, NamedConstraintLiteralName<SqlNamedObjects<SqlSpec>[number]>>] extends [never] ? AttributesSpec : never : AttributesSpec;
declare class ContractModelBuilder<ModelName$1 extends string | undefined, Fields$1 extends Record<string, ScalarFieldBuilder>, Relations extends Record<string, AnyRelationBuilder> = Record<never, never>, AttributesSpec extends ModelAttributesSpec | undefined = undefined, SqlSpec extends SqlStageSpec | undefined = undefined> {
  readonly stageOne: {
    readonly modelName?: ModelName$1;
    readonly fields: Fields$1;
    readonly relations: Relations;
  };
  readonly attributesFactory?: StageInput<AttributeContext<Fields$1>, AttributesSpec> | undefined;
  readonly sqlFactory?: StageInput<SqlContext<Fields$1>, SqlSpec> | undefined;
  readonly __name: ModelName$1;
  readonly __fields: Fields$1;
  readonly __relations: Relations;
  readonly __attributes: AttributesSpec;
  readonly __sql: SqlSpec;
  readonly refs: ModelName$1 extends string ? ModelTokenRefs<ModelName$1, Fields$1> : never;
  constructor(stageOne: {
    readonly modelName?: ModelName$1;
    readonly fields: Fields$1;
    readonly relations: Relations;
  }, attributesFactory?: StageInput<AttributeContext<Fields$1>, AttributesSpec> | undefined, sqlFactory?: StageInput<SqlContext<Fields$1>, SqlSpec> | undefined);
  ref<FieldName$1 extends keyof Fields$1 & string>(this: ModelName$1 extends string ? ContractModelBuilder<ModelName$1, Fields$1, Relations, AttributesSpec, SqlSpec> : never, fieldName: FieldName$1): TargetFieldRef<ModelName$1 & string, FieldName$1>;
  relations<const NextRelations extends Record<string, AnyRelationBuilder>>(relations: NextRelations): ContractModelBuilder<ModelName$1, Fields$1, Relations & NextRelations, AttributesSpec, SqlSpec>;
  attributes<const NextAttributesSpec extends ModelAttributesSpec>(specOrFactory: StageInput<AttributeContext<Fields$1>, ValidateAttributesStageSpec<Fields$1, SqlSpec, NextAttributesSpec>>): ContractModelBuilder<ModelName$1, Fields$1, Relations, NextAttributesSpec, SqlSpec>;
  sql<const NextSqlSpec extends SqlStageSpec>(specOrFactory: StageInput<SqlContext<Fields$1>, NextSqlSpec>): [ValidateSqlStageSpec<Fields$1, AttributesSpec, NextSqlSpec>] extends [never] ? ContractModelBuilder<ModelName$1, Fields$1, Relations, AttributesSpec, never> : ContractModelBuilder<ModelName$1, Fields$1, Relations, AttributesSpec, NextSqlSpec>;
  buildAttributesSpec(): AttributesSpec;
  buildSqlSpec(): SqlSpec;
}
type NamedModelTokenShape<ModelName$1 extends string = string, Fields$1 extends Record<string, ScalarFieldBuilder> = Record<string, ScalarFieldBuilder>> = {
  readonly stageOne: {
    readonly modelName?: ModelName$1;
    readonly fields: Fields$1;
  };
};
type AnyNamedModelToken = NamedModelTokenShape<string, Record<string, ScalarFieldBuilder>>;
type LazyNamedModelToken<Token$1 extends AnyNamedModelToken = AnyNamedModelToken> = () => Token$1;
type RelationFieldSelection<FieldName$1 extends string> = FieldName$1 | readonly FieldName$1[];
type RelationModelName<Target> = Target extends NamedModelTokenShape<infer ModelName extends string, Record<string, ScalarFieldBuilder>> ? ModelName : Target extends (() => infer Token) ? RelationModelName<Token> : never;
type RelationModelFieldNames<Target> = Target extends NamedModelTokenShape<string, infer Fields> ? keyof Fields & string : Target extends (() => infer Token) ? RelationModelFieldNames<Token> : never;
type ContractInput<Family extends FamilyPackRef<string> = FamilyPackRef<string>, Target extends TargetPackRef<'sql', string> = TargetPackRef<'sql', string>, Types extends Record<string, StorageTypeInstance> = Record<never, never>, Models extends Record<string, ContractModelBuilder<string | undefined, Record<string, ScalarFieldBuilder>, Record<string, AnyRelationBuilder>, ModelAttributesSpec | undefined, SqlStageSpec | undefined>> = Record<never, never>, ExtensionPacks extends Record<string, ExtensionPackRef<'sql', string>> | undefined = undefined, Capabilities extends Record<string, Record<string, boolean>> | undefined = undefined> = {
  readonly family: Family;
  readonly target: Target;
  readonly extensionPacks?: ExtensionPacks;
  readonly naming?: NamingConfig;
  readonly storageHash?: string;
  readonly foreignKeyDefaults?: ForeignKeyDefaultsState;
  readonly capabilities?: Capabilities;
  readonly types?: Types;
  readonly models?: Models;
  readonly codecLookup?: CodecLookup;
};
declare function model<const ModelName$1 extends string, Fields$1 extends Record<string, ScalarFieldBuilder>, Relations extends Record<string, AnyRelationBuilder> = Record<never, never>>(modelName: ModelName$1, input: {
  readonly fields: Fields$1;
  readonly relations?: Relations;
}): ContractModelBuilder<ModelName$1, Fields$1, Relations>;
declare function model<Fields$1 extends Record<string, ScalarFieldBuilder>, Relations extends Record<string, AnyRelationBuilder> = Record<never, never>>(input: {
  readonly fields: Fields$1;
  readonly relations?: Relations;
}): ContractModelBuilder<undefined, Fields$1, Relations>;
declare function belongsTo<Token$1 extends AnyNamedModelToken, FromField$1 extends string | readonly string[], ToField$1 extends RelationFieldSelection<RelationModelFieldNames<Token$1>>>(toModel: Token$1 | LazyNamedModelToken<Token$1>, options: {
  readonly from: FromField$1;
  readonly to: ToField$1;
}): RelationBuilder<BelongsToRelation<RelationModelName<Token$1>, FromField$1, ToField$1>>;
declare function belongsTo<ToModel$1 extends string, FromField$1 extends string | readonly string[], ToField$1 extends string | readonly string[]>(toModel: ToModel$1, options: {
  readonly from: FromField$1;
  readonly to: ToField$1;
}): RelationBuilder<BelongsToRelation<ToModel$1, FromField$1, ToField$1>>;
declare function hasMany<Token$1 extends AnyNamedModelToken, ByField extends RelationFieldSelection<RelationModelFieldNames<Token$1>>>(toModel: Token$1 | LazyNamedModelToken<Token$1>, options: {
  readonly by: ByField;
}): RelationBuilder<HasManyRelation<RelationModelName<Token$1>, ByField>>;
declare function hasMany<ToModel$1 extends string, ByField extends string | readonly string[]>(toModel: ToModel$1, options: {
  readonly by: ByField;
}): RelationBuilder<HasManyRelation<ToModel$1, ByField>>;
declare function hasOne<Token$1 extends AnyNamedModelToken, ByField extends RelationFieldSelection<RelationModelFieldNames<Token$1>>>(toModel: Token$1 | LazyNamedModelToken<Token$1>, options: {
  readonly by: ByField;
}): RelationBuilder<HasOneRelation<RelationModelName<Token$1>, ByField>>;
declare function hasOne<ToModel$1 extends string, ByField extends string | readonly string[]>(toModel: ToModel$1, options: {
  readonly by: ByField;
}): RelationBuilder<HasOneRelation<ToModel$1, ByField>>;
declare function manyToMany<ToToken extends AnyNamedModelToken, ThroughToken extends AnyNamedModelToken, FromField$1 extends RelationFieldSelection<RelationModelFieldNames<ThroughToken>>, ToField$1 extends RelationFieldSelection<RelationModelFieldNames<ThroughToken>>>(toModel: ToToken | LazyNamedModelToken<ToToken>, options: {
  readonly through: ThroughToken | LazyNamedModelToken<ThroughToken>;
  readonly from: FromField$1;
  readonly to: ToField$1;
}): RelationBuilder<ManyToManyRelation<RelationModelName<ToToken>, RelationModelName<ThroughToken>, FromField$1, ToField$1>>;
declare function manyToMany<ToModel$1 extends string, ThroughModel extends string, FromField$1 extends string | readonly string[], ToField$1 extends string | readonly string[]>(toModel: ToModel$1, options: {
  readonly through: ThroughModel;
  readonly from: FromField$1;
  readonly to: ToField$1;
}): RelationBuilder<ManyToManyRelation<ToModel$1, ThroughModel, FromField$1, ToField$1>>;
declare const rel: {
  belongsTo: typeof belongsTo;
  hasMany: typeof hasMany;
  hasOne: typeof hasOne;
  manyToMany: typeof manyToMany;
};
declare const field: {
  column: typeof columnField;
  generated: typeof generatedField;
  namedType: typeof namedTypeField;
};
type FieldStateOf<T> = T extends ScalarFieldBuilder<infer State> ? State : never;
type IdFieldNames<T> = T extends IdConstraint<infer FieldNames> ? FieldNames : readonly string[];
type AttributeStageIdFieldNames<T> = T extends {
  readonly id?: infer I;
} ? I extends IdConstraint ? IdFieldNames<I> : undefined : undefined;
//#endregion
//#region src/authoring-type-utils.d.ts
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends ((value: infer I) => void) ? I : never;
type NamedConstraintSpec<Name$1 extends string | undefined = string | undefined> = {
  readonly name?: Name$1;
};
type NamedConstraintState<Enabled extends boolean, Name$1 extends string | undefined = undefined> = Enabled extends true ? NamedConstraintSpec<Name$1> : undefined;
type OptionalObjectArgumentKeys<Properties$1 extends Record<string, AuthoringArgumentDescriptor>> = { readonly [K in keyof Properties$1]: Properties$1[K] extends {
  readonly optional: true;
} ? K : never }[keyof Properties$1];
type ObjectArgumentType<Properties$1 extends Record<string, AuthoringArgumentDescriptor>> = { readonly [K in Exclude<keyof Properties$1, OptionalObjectArgumentKeys<Properties$1>>]: ArgTypeFromDescriptor<Properties$1[K]> } & { readonly [K in OptionalObjectArgumentKeys<Properties$1>]?: ArgTypeFromDescriptor<Properties$1[K]> };
type ArgTypeFromDescriptor<Arg extends AuthoringArgumentDescriptor> = Arg extends {
  readonly kind: 'string';
} ? string : Arg extends {
  readonly kind: 'number';
} ? number : Arg extends {
  readonly kind: 'stringArray';
} ? readonly string[] : Arg extends {
  readonly kind: 'object';
  readonly properties: infer Properties extends Record<string, AuthoringArgumentDescriptor>;
} ? ObjectArgumentType<Properties> : never;
type TupleFromArgumentDescriptors<Args$1 extends readonly AuthoringArgumentDescriptor[]> = { readonly [K in keyof Args$1]: Args$1[K] extends AuthoringArgumentDescriptor ? ArgTypeFromDescriptor<Args$1[K]> : never };
type SupportsNamedConstraintOptions<Descriptor extends AuthoringFieldPresetDescriptor> = Descriptor['output'] extends {
  readonly id: true;
} ? true : Descriptor['output'] extends {
  readonly unique: true;
} ? true : false;
type ResolveTemplateValue<Template, Args$1 extends readonly unknown[]> = Template extends {
  readonly kind: 'arg';
  readonly index: infer Index extends number;
  readonly path?: infer Path extends readonly string[] | undefined;
  readonly default?: infer Default;
} ? ResolveTemplateArgValue<Args$1[Index], Path, Default, Args$1> : Template extends readonly unknown[] ? { readonly [K in keyof Template]: ResolveTemplateValue<Template[K], Args$1> } : Template extends Record<string, unknown> ? { readonly [K in keyof Template]: ResolveTemplateValue<Template[K], Args$1> } : Template;
type ResolveTemplatePathValue<Value, Path$1 extends readonly string[] | undefined> = Path$1 extends readonly [infer Segment extends string, ...infer Rest extends readonly string[]] ? Segment extends keyof NonNullable<Value> ? ResolveTemplatePathValue<NonNullable<Value>[Segment], Rest> : never : Value;
type ResolveTemplateDefaultValue<Value, Default$1, Args$1 extends readonly unknown[]> = Default$1 extends undefined ? Value : [Value] extends [never] ? ResolveTemplateValue<Default$1, Args$1> : undefined extends Value ? Exclude<Value, undefined> | ResolveTemplateValue<Default$1, Args$1> : Value;
type ResolveTemplateArgValue<Value, Path$1 extends readonly string[] | undefined, Default$1, Args$1 extends readonly unknown[]> = ResolveTemplateDefaultValue<ResolveTemplatePathValue<Value, Path$1>, Default$1, Args$1>;
type FieldBuilderFromPresetDescriptor<Descriptor extends AuthoringFieldPresetDescriptor, Args$1 extends readonly unknown[] = readonly [], ConstraintName extends string | undefined = undefined> = ScalarFieldBuilder<ScalarFieldState<ResolveTemplateValue<Descriptor['output']['codecId'], Args$1> extends string ? ResolveTemplateValue<Descriptor['output']['codecId'], Args$1> : string, undefined, ResolveTemplateValue<Descriptor['output']['nullable'], Args$1> extends true ? true : false, undefined, NamedConstraintState<ResolveTemplateValue<Descriptor['output']['id'], Args$1> extends true ? true : false, ConstraintName>, NamedConstraintState<ResolveTemplateValue<Descriptor['output']['unique'], Args$1> extends true ? true : false, ConstraintName>>>;
type FieldHelperFunctionWithoutNamedConstraint<Descriptor extends AuthoringFieldPresetDescriptor> = Descriptor extends {
  readonly args: infer Args extends readonly AuthoringArgumentDescriptor[];
} ? <const Params extends TupleFromArgumentDescriptors<Args>>(...args: Params) => FieldBuilderFromPresetDescriptor<Descriptor, Params> : () => FieldBuilderFromPresetDescriptor<Descriptor, readonly []>;
type FieldHelperFunctionWithNamedConstraint<Descriptor extends AuthoringFieldPresetDescriptor> = Descriptor extends {
  readonly args: infer Args extends readonly AuthoringArgumentDescriptor[];
} ? <const Params extends TupleFromArgumentDescriptors<Args>, const Name$1 extends string | undefined = undefined>(...args: [...params: Params, options?: NamedConstraintSpec<Name$1>]) => FieldBuilderFromPresetDescriptor<Descriptor, Params, Name$1> : <const Name$1 extends string | undefined = undefined>(options?: NamedConstraintSpec<Name$1>) => FieldBuilderFromPresetDescriptor<Descriptor, readonly [], Name$1>;
type FieldHelperFunction<Descriptor extends AuthoringFieldPresetDescriptor> = SupportsNamedConstraintOptions<Descriptor> extends true ? FieldHelperFunctionWithNamedConstraint<Descriptor> : FieldHelperFunctionWithoutNamedConstraint<Descriptor>;
type FieldHelpersFromNamespace<Namespace> = { readonly [K in keyof Namespace]: Namespace[K] extends AuthoringFieldPresetDescriptor ? FieldHelperFunction<Namespace[K]> : Namespace[K] extends Record<string, unknown> ? FieldHelpersFromNamespace<Namespace[K]> : never };
//#endregion
//#region src/composed-authoring-helpers.d.ts
type ExtractTypeNamespaceFromPack<Pack> = Pack extends {
  readonly authoring?: {
    readonly type?: infer Namespace extends AuthoringTypeNamespace;
  };
} ? Namespace : Record<never, never>;
type ExtractFieldNamespaceFromPack<Pack> = Pack extends {
  readonly authoring?: {
    readonly field?: infer Namespace extends AuthoringFieldNamespace;
  };
} ? Namespace : Record<never, never>;
type MergeExtensionTypeNamespaces<ExtensionPacks> = ExtensionPacks extends Record<string, unknown> ? keyof ExtensionPacks extends never ? Record<never, never> : UnionToIntersection<{ [K in keyof ExtensionPacks]: ExtractTypeNamespaceFromPack<ExtensionPacks[K]> }[keyof ExtensionPacks]> : Record<never, never>;
type MergeExtensionFieldNamespaces<ExtensionPacks> = ExtensionPacks extends Record<string, unknown> ? keyof ExtensionPacks extends never ? Record<never, never> : UnionToIntersection<{ [K in keyof ExtensionPacks]: ExtractFieldNamespaceFromPack<ExtensionPacks[K]> }[keyof ExtensionPacks]> : Record<never, never>;
type StorageTypeFromDescriptor<Descriptor extends AuthoringTypeConstructorDescriptor, Args$1 extends readonly unknown[]> = {
  readonly codecId: ResolveTemplateValue<Descriptor['output']['codecId'], Args$1>;
  readonly nativeType: ResolveTemplateValue<Descriptor['output']['nativeType'], Args$1>;
} & (Descriptor['output'] extends {
  readonly typeParams: infer TypeParams extends Record<string, unknown>;
} ? {
  readonly typeParams: ResolveTemplateValue<TypeParams, Args$1>;
} : Record<never, never>);
type TypeHelperFunction<Descriptor extends AuthoringTypeConstructorDescriptor> = Descriptor extends {
  readonly args: infer Args extends readonly AuthoringArgumentDescriptor[];
} ? <const Params extends TupleFromArgumentDescriptors<Args>>(...args: Params) => StorageTypeFromDescriptor<Descriptor, Params> : () => StorageTypeFromDescriptor<Descriptor, readonly []>;
type TypeHelpersFromNamespace<Namespace> = { readonly [K in keyof Namespace]: Namespace[K] extends AuthoringTypeConstructorDescriptor ? TypeHelperFunction<Namespace[K]> : Namespace[K] extends Record<string, unknown> ? TypeHelpersFromNamespace<Namespace[K]> : never };
type CoreFieldHelpers = Pick<typeof field, 'column' | 'generated' | 'namedType'>;
type ComposedAuthoringHelpers<Family extends FamilyPackRef<string>, Target extends TargetPackRef<'sql', string>, ExtensionPacks extends Record<string, ExtensionPackRef<'sql', string>> | undefined> = {
  readonly field: CoreFieldHelpers & FieldHelpersFromNamespace<ExtractFieldNamespaceFromPack<Family> & ExtractFieldNamespaceFromPack<Target> & MergeExtensionFieldNamespaces<ExtensionPacks>>;
  readonly model: typeof model;
  readonly rel: typeof rel;
  readonly type: TypeHelpersFromNamespace<ExtractTypeNamespaceFromPack<Family> & ExtractTypeNamespaceFromPack<Target> & MergeExtensionTypeNamespaces<ExtensionPacks>>;
};
//#endregion
//#region src/contract-types.d.ts
type ExtractCodecTypesFromPack<P> = P extends {
  __codecTypes?: infer C;
} ? C extends Record<string, {
  output: unknown;
}> ? C : Record<string, never> : Record<string, never>;
type MergeExtensionCodecTypes<Packs extends Record<string, unknown>> = UnionToIntersection<{ [K in keyof Packs]: ExtractCodecTypesFromPack<Packs[K]> }[keyof Packs]>;
type MergeExtensionCodecTypesSafe<Packs> = Packs extends Record<string, unknown> ? keyof Packs extends never ? Record<string, never> : MergeExtensionCodecTypes<Packs> : Record<string, never>;
type DefinitionExtensionPacks<Definition> = Definition extends {
  readonly extensionPacks?: infer Packs extends Record<string, ExtensionPackRef<'sql', string>>;
} ? Packs : Record<never, never>;
type DefinitionCapabilities<Definition> = Definition extends {
  readonly capabilities?: infer Capabilities extends Record<string, Record<string, boolean>>;
} ? Capabilities : undefined;
type DefinitionTargetId<Definition> = Definition extends {
  readonly target: TargetPackRef<'sql', infer Target>;
} ? Target : never;
type Present<T> = Exclude<T, undefined>;
type CodecTypesFromDefinition<Definition> = ExtractCodecTypesFromPack<Definition extends {
  readonly target: infer Target;
} ? Target : never> & MergeExtensionCodecTypesSafe<DefinitionExtensionPacks<Definition>>;
type DefinitionModels<Definition> = Definition extends {
  readonly models?: unknown;
} ? Present<Definition['models']> extends Record<string, unknown> ? Present<Definition['models']> : Record<never, never> : Record<never, never>;
type DefinitionTypes<Definition> = Definition extends {
  readonly types?: unknown;
} ? Present<Definition['types']> extends Record<string, StorageTypeInstance> ? Present<Definition['types']> : Record<never, never> : Record<never, never>;
type DefinitionTableNaming<Definition> = Definition extends {
  readonly naming?: {
    readonly tables?: infer Strategy extends string;
  };
} ? Strategy : undefined;
type DefinitionColumnNaming<Definition> = Definition extends {
  readonly naming?: {
    readonly columns?: infer Strategy extends string;
  };
} ? Strategy : undefined;
type FirstChar<S extends string> = S extends `${infer First}${string}` ? First : '';
type CharKind<C extends string> = C extends '' ? 'end' : C extends Lowercase<C> ? C extends Uppercase<C> ? 'other' : 'lower' : 'upper';
type ShouldInsertSnakeUnderscore<PrevKind extends 'start' | 'lower' | 'upper' | 'other' | 'end', Current$1 extends string, Next extends string> = CharKind<Current$1> extends 'upper' ? PrevKind extends 'start' ? false : PrevKind extends 'lower' | 'other' ? true : CharKind<Next> extends 'lower' ? true : false : false;
type SnakeCaseInternal<S extends string, PrevKind extends 'start' | 'lower' | 'upper' | 'other' | 'end' = 'start'> = S extends `${infer Current}${infer Rest}` ? `${ShouldInsertSnakeUnderscore<PrevKind, Current, FirstChar<Rest>> extends true ? '_' : ''}${Lowercase<Current>}${SnakeCaseInternal<Rest, CharKind<Current>>}` : '';
type SnakeCase<S extends string> = string extends S ? string : SnakeCaseInternal<S>;
type ApplyNamingType<Name$1 extends string, Strategy extends string | undefined> = string extends Name$1 ? string : Strategy extends 'snake_case' ? SnakeCase<Name$1> : Name$1;
type ModelNames<Definition> = keyof DefinitionModels<Definition> & string;
type ModelFields<Definition, ModelName$1 extends ModelNames<Definition>> = DefinitionModels<Definition>[ModelName$1] extends {
  readonly stageOne: {
    readonly fields: Record<string, ScalarFieldBuilder>;
  };
} ? DefinitionModels<Definition>[ModelName$1]['stageOne']['fields'] : Record<never, never>;
type ModelFieldNames<Definition, ModelName$1 extends ModelNames<Definition>> = keyof ModelFields<Definition, ModelName$1> & string;
type StagedModelRelations<Definition, ModelName$1 extends ModelNames<Definition>> = DefinitionModels<Definition>[ModelName$1] extends {
  readonly stageOne: {
    readonly relations: infer R;
  };
} ? R extends Record<string, unknown> ? R : Record<never, never> : Record<never, never>;
type StagedModelRelationNames<Definition, ModelName$1 extends ModelNames<Definition>> = keyof StagedModelRelations<Definition, ModelName$1> & string;
type ModelFieldState<Definition, ModelName$1 extends ModelNames<Definition>, FieldName$1 extends ModelFieldNames<Definition, ModelName$1>> = FieldStateOf<ModelFields<Definition, ModelName$1>[FieldName$1]>;
type ModelSql<Definition, ModelName$1 extends ModelNames<Definition>> = DefinitionModels<Definition>[ModelName$1] extends {
  readonly __sql: infer SqlSpec;
} ? SqlSpec : undefined;
type ModelAttributes<Definition, ModelName$1 extends ModelNames<Definition>> = DefinitionModels<Definition>[ModelName$1] extends {
  readonly __attributes: infer AttributesSpec;
} ? AttributesSpec : undefined;
type FieldDescriptorOf<FieldState> = Present<FieldState extends {
  readonly descriptor?: infer Descriptor;
} ? Descriptor : never>;
type FieldTypeRefOf<FieldState> = Present<FieldState extends {
  readonly typeRef?: infer TypeRef;
} ? TypeRef : never>;
type FieldNullableOf<FieldState> = FieldState extends {
  readonly nullable: infer Nullable extends boolean;
} ? Nullable : boolean;
type FieldColumnOverrideOf<FieldState> = Present<FieldState extends {
  readonly columnName?: infer ColumnName;
} ? ColumnName : never>;
type FieldInlineIdSpecOf<FieldState> = Present<FieldState extends {
  readonly id?: infer IdSpec;
} ? IdSpec : never>;
type DescriptorCodecId<Descriptor> = Descriptor extends {
  readonly codecId: infer CodecId extends string;
} ? CodecId : string;
type DescriptorNativeType<Descriptor> = Descriptor extends {
  readonly nativeType: infer NativeType extends string;
} ? NativeType : string;
type DescriptorTypeParams<Descriptor> = Descriptor extends {
  readonly typeParams: infer TypeParams extends Record<string, unknown>;
} ? TypeParams : undefined;
type DescriptorTypeRef<Descriptor> = Descriptor extends {
  readonly typeRef: infer TypeRef extends string;
} ? TypeRef : undefined;
type LookupNamedStorageTypeKeyByValue<Definition, TypeRef$1 extends StorageTypeInstance> = { [TypeName in keyof DefinitionTypes<Definition> & string]: [TypeRef$1] extends [DefinitionTypes<Definition>[TypeName]] ? [DefinitionTypes<Definition>[TypeName]] extends [TypeRef$1] ? TypeName : never : never }[keyof DefinitionTypes<Definition> & string];
type ResolveNamedStorageTypeKey<Definition, TypeRef$1> = TypeRef$1 extends string ? TypeRef$1 : TypeRef$1 extends StorageTypeInstance ? [LookupNamedStorageTypeKeyByValue<Definition, TypeRef$1>] extends [never] ? string : LookupNamedStorageTypeKeyByValue<Definition, TypeRef$1> : never;
type ResolveNamedStorageType<Definition, TypeRef$1> = ResolveNamedStorageTypeKey<Definition, TypeRef$1> extends infer TypeName extends string ? TypeName extends keyof DefinitionTypes<Definition> ? DefinitionTypes<Definition>[TypeName] : StorageTypeInstance : StorageTypeInstance;
type ResolveFieldDescriptor<Definition, FieldState> = [FieldDescriptorOf<FieldState>] extends [never] ? ResolveNamedStorageType<Definition, FieldTypeRefOf<FieldState>> : FieldDescriptorOf<FieldState>;
type ResolveFieldColumnTypeRef<Definition, FieldState> = [FieldTypeRefOf<FieldState>] extends [never] ? DescriptorTypeRef<FieldDescriptorOf<FieldState>> : ResolveNamedStorageTypeKey<Definition, FieldTypeRefOf<FieldState>>;
type ResolveFieldColumnTypeParams<Definition, FieldState> = [ResolveFieldColumnTypeRef<Definition, FieldState>] extends [string] ? undefined : DescriptorTypeParams<FieldDescriptorOf<FieldState>>;
type ModelTableName<Definition, ModelName$1 extends ModelNames<Definition>> = [Present<ModelSql<Definition, ModelName$1> extends {
  readonly table?: infer TableName;
} ? TableName : never>] extends [never] ? ApplyNamingType<ModelName$1, DefinitionTableNaming<Definition>> : Present<ModelSql<Definition, ModelName$1> extends {
  readonly table?: infer TableName;
} ? TableName : never> extends infer ExplicitTableName extends string ? ExplicitTableName : ApplyNamingType<ModelName$1, DefinitionTableNaming<Definition>>;
type ModelColumnName<Definition, ModelName$1 extends ModelNames<Definition>, FieldName$1 extends ModelFieldNames<Definition, ModelName$1>> = [FieldColumnOverrideOf<ModelFieldState<Definition, ModelName$1, FieldName$1>>] extends [never] ? ApplyNamingType<FieldName$1, DefinitionColumnNaming<Definition>> : FieldColumnOverrideOf<ModelFieldState<Definition, ModelName$1, FieldName$1>> extends infer ExplicitColumnName extends string ? ExplicitColumnName : ApplyNamingType<FieldName$1, DefinitionColumnNaming<Definition>>;
type FieldNamesToColumnNames<Definition, ModelName$1 extends ModelNames<Definition>, FieldNames extends readonly string[]> = FieldNames extends readonly [] ? readonly [] : FieldNames extends readonly [infer First extends ModelFieldNames<Definition, ModelName$1>, ...infer Rest extends readonly string[]] ? readonly [ModelColumnName<Definition, ModelName$1, First>, ...FieldNamesToColumnNames<Definition, ModelName$1, Rest>] : readonly string[];
type InlineIdFieldName<Definition, ModelName$1 extends ModelNames<Definition>> = { [FieldName in ModelFieldNames<Definition, ModelName$1>]: [FieldInlineIdSpecOf<ModelFieldState<Definition, ModelName$1, FieldName>>] extends [never] ? never : FieldName }[ModelFieldNames<Definition, ModelName$1>];
type InlineIdFieldNames<Definition, ModelName$1 extends ModelNames<Definition>> = [InlineIdFieldName<Definition, ModelName$1>] extends [never] ? undefined : readonly [InlineIdFieldName<Definition, ModelName$1>];
type InlineIdName<Definition, ModelName$1 extends ModelNames<Definition>> = { [FieldName in ModelFieldNames<Definition, ModelName$1>]: FieldInlineIdSpecOf<ModelFieldState<Definition, ModelName$1, FieldName>> extends {
  readonly name?: infer Name extends string;
} ? Name : never }[ModelFieldNames<Definition, ModelName$1>];
type AttributeIdFieldNames<Definition, ModelName$1 extends ModelNames<Definition>> = AttributeStageIdFieldNames<ModelAttributes<Definition, ModelName$1>>;
type AttributeIdName<Definition, ModelName$1 extends ModelNames<Definition>> = Present<ModelAttributes<Definition, ModelName$1> extends {
  readonly id?: {
    readonly name?: infer Name extends string;
  };
} ? Name : never>;
type ModelIdFieldNames<Definition, ModelName$1 extends ModelNames<Definition>> = [AttributeIdFieldNames<Definition, ModelName$1>] extends [undefined] ? InlineIdFieldNames<Definition, ModelName$1> : AttributeIdFieldNames<Definition, ModelName$1>;
type ModelIdName<Definition, ModelName$1 extends ModelNames<Definition>> = [AttributeIdName<Definition, ModelName$1>] extends [never] ? Present<InlineIdName<Definition, ModelName$1>> : AttributeIdName<Definition, ModelName$1>;
type StorageColumn<CodecId$1 extends string, Nullable$1 extends boolean, NativeType extends string, TypeRef$1 extends string | undefined = undefined, TypeParams$1 extends Record<string, unknown> | undefined = undefined> = {
  readonly nativeType: NativeType;
  readonly codecId: CodecId$1;
  readonly nullable: Nullable$1;
  readonly default?: ColumnDefault;
} & (TypeRef$1 extends string ? {
  readonly typeRef: TypeRef$1;
} : Record<string, never>) & (TypeParams$1 extends Record<string, unknown> ? {
  readonly typeParams: TypeParams$1;
} : Record<string, never>);
type ModelStorageColumn<Definition, ModelName$1 extends ModelNames<Definition>, FieldName$1 extends string> = FieldName$1 extends ModelFieldNames<Definition, ModelName$1> ? StorageColumn<DescriptorCodecId<ResolveFieldDescriptor<Definition, ModelFieldState<Definition, ModelName$1, FieldName$1>>>, FieldNullableOf<ModelFieldState<Definition, ModelName$1, FieldName$1>>, DescriptorNativeType<ResolveFieldDescriptor<Definition, ModelFieldState<Definition, ModelName$1, FieldName$1>>>, ResolveFieldColumnTypeRef<Definition, ModelFieldState<Definition, ModelName$1, FieldName$1>>, ResolveFieldColumnTypeParams<Definition, ModelFieldState<Definition, ModelName$1, FieldName$1>>> : never;
type BuiltModels<Definition> = { readonly [ModelName in ModelNames<Definition>]: {
  readonly storage: {
    readonly table: ModelTableName<Definition, ModelName>;
    readonly fields: { readonly [FieldName in ModelFieldNames<Definition, ModelName>]: {
      readonly column: ModelColumnName<Definition, ModelName, FieldName>;
    } };
  };
  readonly fields: { readonly [FieldName in ModelFieldNames<Definition, ModelName>]: {
    readonly nullable: ModelStorageColumn<Definition, ModelName, FieldName>['nullable'];
    readonly type: {
      readonly kind: 'scalar';
      readonly codecId: ModelStorageColumn<Definition, ModelName, FieldName>['codecId'];
    };
  } };
  readonly relations: { readonly [RelName in StagedModelRelationNames<Definition, ModelName>]: ContractRelation };
} };
type BuiltModelColumnMappings<Definition, ModelName$1 extends ModelNames<Definition>> = BuiltModels<Definition>[ModelName$1]['storage']['fields'];
type BuiltModelTableName<Definition, ModelName$1 extends ModelNames<Definition>> = BuiltModels<Definition>[ModelName$1]['storage']['table'];
type BuiltStorageTableColumns<Definition, ModelName$1 extends ModelNames<Definition>> = { readonly [FieldName in keyof BuiltModelColumnMappings<Definition, ModelName$1> & string as BuiltModelColumnMappings<Definition, ModelName$1>[FieldName]['column']]: ModelStorageColumn<Definition, ModelName$1, FieldName> };
type BuiltStorageTables<Definition> = { readonly [ModelName in ModelNames<Definition> as BuiltModelTableName<Definition, ModelName>]: {
  readonly columns: BuiltStorageTableColumns<Definition, ModelName>;
  readonly uniques: ReadonlyArray<{
    readonly columns: readonly string[];
    readonly name?: string;
  }>;
  readonly indexes: ReadonlyArray<Index$1>;
  readonly foreignKeys: ReadonlyArray<{
    readonly columns: readonly string[];
    readonly references: {
      readonly table: string;
      readonly columns: readonly string[];
    };
    readonly name?: string;
    readonly onDelete?: ReferentialAction;
    readonly onUpdate?: ReferentialAction;
    readonly constraint: boolean;
    readonly index: boolean;
  }>;
} & (ModelIdFieldNames<Definition, ModelName> extends readonly string[] ? {
  readonly primaryKey: {
    readonly columns: FieldNamesToColumnNames<Definition, ModelName, ModelIdFieldNames<Definition, ModelName>>;
    readonly name?: ModelIdName<Definition, ModelName>;
  };
} : Record<string, never>) };
type BuiltStorage<Definition> = {
  readonly storageHash: StorageHashBase<string>;
  readonly tables: BuiltStorageTables<Definition>;
  readonly types: DefinitionTypes<Definition>;
};
type FieldOutputType<Definition, ModelName$1 extends ModelNames<Definition>, FieldName$1 extends ModelFieldNames<Definition, ModelName$1>> = ModelStorageColumn<Definition, ModelName$1, FieldName$1> extends infer Col ? Col extends {
  readonly codecId: infer Id extends string;
} ? Id extends keyof CodecTypesFromDefinition<Definition> ? CodecTypesFromDefinition<Definition>[Id] extends {
  readonly output: infer O;
} ? Col extends {
  readonly nullable: true;
} ? O | null : O : unknown : unknown : unknown : unknown;
type FieldOutputTypes<Definition> = { readonly [ModelName in ModelNames<Definition>]: { readonly [FieldName in ModelFieldNames<Definition, ModelName>]: FieldOutputType<Definition, ModelName, FieldName> } };
type SqlContractResult<Definition> = ContractWithTypeMaps<Contract<BuiltStorage<Definition>, BuiltModels<Definition>> & {
  readonly target: DefinitionTargetId<Definition>;
  readonly targetFamily: 'sql';
} & {
  readonly extensionPacks: keyof DefinitionExtensionPacks<Definition> extends never ? Record<string, never> : DefinitionExtensionPacks<Definition>;
  readonly capabilities: DefinitionCapabilities<Definition> extends Record<string, Record<string, boolean>> ? DefinitionCapabilities<Definition> : Record<string, Record<string, boolean>>;
}, TypeMaps<CodecTypesFromDefinition<Definition>, Record<string, never>, Record<string, never>, FieldOutputTypes<Definition>>>;
//#endregion
//#region src/contract-definition.d.ts
interface FieldNode {
  readonly fieldName: string;
  readonly columnName: string;
  readonly descriptor: ColumnTypeDescriptor;
  readonly nullable: boolean;
  readonly default?: ColumnDefault;
  readonly executionDefault?: ExecutionMutationDefaultValue;
  readonly many?: boolean;
}
interface PrimaryKeyNode {
  readonly columns: readonly string[];
  readonly name?: string;
}
interface UniqueConstraintNode {
  readonly columns: readonly string[];
  readonly name?: string;
}
interface IndexNode {
  readonly columns: readonly string[];
  readonly name?: string;
  readonly using?: string;
  readonly config?: Record<string, unknown>;
}
interface ForeignKeyNode {
  readonly columns: readonly string[];
  readonly references: {
    readonly model: string;
    readonly table: string;
    readonly columns: readonly string[];
  };
  readonly name?: string;
  readonly onDelete?: ReferentialAction;
  readonly onUpdate?: ReferentialAction;
  readonly constraint?: boolean;
  readonly index?: boolean;
}
interface RelationNode {
  readonly fieldName: string;
  readonly toModel: string;
  readonly toTable: string;
  readonly cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
  readonly on: {
    readonly parentTable: string;
    readonly parentColumns: readonly string[];
    readonly childTable: string;
    readonly childColumns: readonly string[];
  };
  readonly through?: {
    readonly table: string;
    readonly parentColumns: readonly string[];
    readonly childColumns: readonly string[];
  };
}
interface ValueObjectFieldNode {
  readonly fieldName: string;
  readonly columnName: string;
  readonly valueObjectName: string;
  readonly nullable: boolean;
  readonly default?: ColumnDefault;
  readonly executionDefault?: ExecutionMutationDefaultValue;
  readonly many?: boolean;
}
interface ValueObjectNode {
  readonly name: string;
  readonly fields: readonly (FieldNode | ValueObjectFieldNode)[];
}
interface ModelNode {
  readonly modelName: string;
  readonly tableName: string;
  readonly fields: readonly (FieldNode | ValueObjectFieldNode)[];
  readonly id?: PrimaryKeyNode;
  readonly uniques?: readonly UniqueConstraintNode[];
  readonly indexes?: readonly IndexNode[];
  readonly foreignKeys?: readonly ForeignKeyNode[];
  readonly relations?: readonly RelationNode[];
}
interface ContractDefinition {
  readonly target: TargetPackRef<'sql', string>;
  readonly extensionPacks?: Record<string, ExtensionPackRef<'sql', string>>;
  readonly capabilities?: Record<string, Record<string, boolean>>;
  readonly storageHash?: string;
  readonly foreignKeyDefaults?: ForeignKeyDefaultsState;
  readonly storageTypes?: Record<string, StorageTypeInstance>;
  readonly models: readonly ModelNode[];
  readonly valueObjects?: readonly ValueObjectNode[];
}
//#endregion
//#region src/build-contract.d.ts
declare function buildSqlContractFromDefinition(definition: ContractDefinition, codecLookup?: CodecLookup): Contract<SqlStorage>;
//#endregion
//#region src/contract-builder.d.ts
type ModelLike = {
  readonly stageOne: {
    readonly modelName?: string;
    readonly fields: Record<string, ScalarFieldBuilder>;
    readonly relations: Record<string, RelationBuilder<RelationState>>;
  };
  readonly __attributes: ModelAttributesSpec | undefined;
  readonly __sql: SqlStageSpec | undefined;
  buildAttributesSpec(): ModelAttributesSpec | undefined;
  buildSqlSpec(): SqlStageSpec | undefined;
};
type ContractDefinition$1<Family extends FamilyPackRef<string>, Target extends TargetPackRef<'sql', string>, Types extends Record<string, StorageTypeInstance>, Models extends Record<string, ModelLike>, ExtensionPacks extends Record<string, ExtensionPackRef<'sql', string>> | undefined, Capabilities extends Record<string, Record<string, boolean>> | undefined, Naming extends ContractInput['naming'] | undefined, StorageHash extends string | undefined, ForeignKeyDefaults extends ForeignKeyDefaultsState | undefined> = {
  readonly family: Family;
  readonly target: Target;
  readonly extensionPacks?: ExtensionPacks;
  readonly naming?: Naming;
  readonly storageHash?: StorageHash;
  readonly foreignKeyDefaults?: ForeignKeyDefaults;
  readonly capabilities?: Capabilities;
  readonly types?: Types;
  readonly models?: Models;
  readonly codecLookup?: CodecLookup;
};
type ContractScaffold<Family extends FamilyPackRef<string>, Target extends TargetPackRef<'sql', string>, ExtensionPacks extends Record<string, ExtensionPackRef<'sql', string>> | undefined, Capabilities extends Record<string, Record<string, boolean>> | undefined, Naming extends ContractInput['naming'] | undefined, StorageHash extends string | undefined, ForeignKeyDefaults extends ForeignKeyDefaultsState | undefined> = {
  readonly family: Family;
  readonly target: Target;
  readonly extensionPacks?: ExtensionPacks;
  readonly naming?: Naming;
  readonly storageHash?: StorageHash;
  readonly foreignKeyDefaults?: ForeignKeyDefaults;
  readonly capabilities?: Capabilities;
  readonly codecLookup?: CodecLookup;
};
type ContractFactory<Family extends FamilyPackRef<string>, Target extends TargetPackRef<'sql', string>, Types extends Record<string, StorageTypeInstance>, Models extends Record<string, ModelLike>, ExtensionPacks extends Record<string, ExtensionPackRef<'sql', string>> | undefined> = (helpers: ComposedAuthoringHelpers<Family, Target, ExtensionPacks>) => {
  readonly types?: Types;
  readonly models?: Models;
};
declare function defineContract<const Family extends FamilyPackRef<string>, const Target extends TargetPackRef<'sql', string>, const Types extends Record<string, StorageTypeInstance> = Record<never, never>, const Models extends Record<string, ModelLike> = Record<never, never>, const ExtensionPacks extends Record<string, ExtensionPackRef<'sql', string>> | undefined = undefined, const Capabilities extends Record<string, Record<string, boolean>> | undefined = undefined, const Naming extends ContractInput['naming'] | undefined = undefined, const StorageHash extends string | undefined = undefined, const ForeignKeyDefaults extends ForeignKeyDefaultsState | undefined = undefined>(definition: ContractDefinition$1<Family, Target, Types, Models, ExtensionPacks, Capabilities, Naming, StorageHash, ForeignKeyDefaults>): SqlContractResult<ContractDefinition$1<Family, Target, Types, Models, ExtensionPacks, Capabilities, Naming, StorageHash, ForeignKeyDefaults>>;
declare function defineContract<const Family extends FamilyPackRef<string>, const Target extends TargetPackRef<'sql', string>, const Types extends Record<string, StorageTypeInstance> = Record<never, never>, const Models extends Record<string, ModelLike> = Record<never, never>, const ExtensionPacks extends Record<string, ExtensionPackRef<'sql', string>> | undefined = undefined, const Capabilities extends Record<string, Record<string, boolean>> | undefined = undefined, const Naming extends ContractInput['naming'] | undefined = undefined, const StorageHash extends string | undefined = undefined, const ForeignKeyDefaults extends ForeignKeyDefaultsState | undefined = undefined>(definition: ContractScaffold<Family, Target, ExtensionPacks, Capabilities, Naming, StorageHash, ForeignKeyDefaults>, factory: ContractFactory<Family, Target, Types, Models, ExtensionPacks>): SqlContractResult<ContractDefinition$1<Family, Target, Types, Models, ExtensionPacks, Capabilities, Naming, StorageHash, ForeignKeyDefaults>>;
//#endregion
export { type ComposedAuthoringHelpers, type ContractDefinition, type ContractInput, type ContractModelBuilder, type FieldNode, type ForeignKeyNode, type IndexNode, type ModelNode, type PrimaryKeyNode, type RelationNode, type ScalarFieldBuilder, type UniqueConstraintNode, buildSqlContractFromDefinition, defineContract, field, model, rel };
//# sourceMappingURL=contract-builder.d.mts.map