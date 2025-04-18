// @ts-nocheck
import { defaultFieldResolver } from 'https://cdn.skypack.dev/graphql?dts';
import type { ArgumentRef } from '../refs/arg.ts';
import { FieldRef } from '../refs/field.ts';
import type { FieldKind, InputFieldMap, PothosInputFieldConfig, Resolver, ShapeFromTypeParam, } from '../types/index.ts';
import type { FieldNullability, SchemaTypes, TypeParam } from '../types/index.ts';
import { typeFromParam } from '../utils/index.ts';
export class BaseFieldUtil<Types extends SchemaTypes, ParentShape, Kind extends FieldKind> {
    kind: Kind;
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[Kind];
    builder: PothosSchemaTypes.SchemaBuilder<Types>;
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, kind: Kind, graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[Kind]) {
        this.builder = builder;
        this.kind = kind;
        this.graphqlKind = graphqlKind;
    }
    protected createField<Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap = {}>(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    options: PothosSchemaTypes.FieldOptions<Types, ParentShape, Type, Nullable, Args, any, {}> & {
        resolve?: Resolver<unknown, {}, {}, unknown, unknown>;
    }): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, Kind> {
        const ref = new FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, Kind>(this.kind, (name, typeConfig) => {
            const args: Record<string, PothosInputFieldConfig<Types>> = {};
            if (options.args) {
                for (const [argName, arg] of Object.entries(options.args)) {
                    args[argName] = (arg as ArgumentRef<Types, unknown>).getConfig(argName, name, typeConfig);
                }
            }
            let { resolve } = options as {
                resolve?: (...argList: unknown[]) => unknown;
            };
            if (options.extensions?.pothosExposedField === name) {
                resolve = defaultFieldResolver as typeof resolve;
            }
            const { subscribe } = options as {
                subscribe?: (...argList: unknown[]) => unknown;
            };
            return {
                kind: this.kind as never,
                graphqlKind: typeConfig.graphqlKind as "Interface" | "Object",
                parentType: typeConfig.name,
                name,
                args,
                argMappers: [],
                type: typeFromParam(options.type, this.builder.configStore, options.nullable ?? this.builder.defaultFieldNullability),
                pothosOptions: options as never,
                extensions: {
                    pothosOriginalResolve: resolve,
                    pothosOriginalSubscribe: subscribe,
                    ...options.extensions,
                },
                description: options.description,
                deprecationReason: options.deprecationReason,
                resolve,
                subscribe,
            };
        });
        return ref;
    }
    protected exposeField<Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Name extends string & keyof ParentShape>(name: Name, { extensions, ...options }: PothosSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, {}, {}>): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, Kind> {
        return this.createField({
            ...options,
            extensions: {
                pothosExposedField: name,
                ...extensions,
            },
            resolve: (parent) => (parent as Record<string, never>)[name as string],
        });
    }
}
