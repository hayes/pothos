// @ts-nocheck
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { PothosSchemaError } from './errors.ts';
import { BaseTypeRef } from './refs/base.ts';
import { InputObjectRef } from './refs/input-object.ts';
import { InterfaceRef } from './refs/interface.ts';
import { MutationRef } from './refs/mutation.ts';
import { ObjectRef } from './refs/object.ts';
import { QueryRef } from './refs/query.ts';
import { SubscriptionRef } from './refs/subscription.ts';
import type { ConfigurableRef, FieldMap, GraphQLFieldKind, InputFieldMap, InputRef, OutputType, PothosFieldConfig, PothosTypeConfig, SchemaTypes, } from './types/index.ts';
export class ConfigStore<Types extends SchemaTypes> {
    typeConfigs = new Map<string, PothosTypeConfig>();
    private fields = new Map<string, Map<string, PothosFieldConfig<Types>>>();
    private refs = new Set<BaseTypeRef<Types>>();
    private implementors = new Map<string, BaseTypeRef<Types>>();
    private pendingActions: (() => void)[] = [];
    private paramAssociations = new Map<unknown, unknown>();
    private pendingTypeConfigResolutions = new Map<unknown, ((config: PothosTypeConfig, ref: BaseTypeRef<Types>) => void)[]>();
    private pending = true;
    private builder: PothosSchemaTypes.SchemaBuilder<Types>;
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
        this.builder = builder;
    }
    addFields(param: ConfigurableRef<Types>, fields: () => FieldMap) {
        this.onTypeConfig(param, (config, ref) => {
            if (!(ref instanceof InterfaceRef ||
                ref instanceof ObjectRef ||
                ref instanceof QueryRef ||
                ref instanceof MutationRef ||
                ref instanceof SubscriptionRef)) {
                throw new PothosSchemaError(`Can not add fields to ${ref} because it is not an object`);
            }
            ref.addFields(fields);
        });
    }
    addInputFields(param: ConfigurableRef<Types>, fields: () => InputFieldMap) {
        this.onTypeConfig(param, (config, ref) => {
            if (!(ref instanceof InputObjectRef)) {
                throw new PothosSchemaError(`Can not add fields to ${ref} because it is not an input object`);
            }
            ref.addFields(fields);
        });
    }
    associateParamWithRef<T>(param: ConfigurableRef<Types>, ref: BaseTypeRef<Types, T> | string) {
        const resolved = this.resolveParamAssociations(ref);
        this.paramAssociations.set(param, resolved);
        const pendingResolutions = this.pendingTypeConfigResolutions.get(param) ?? [];
        if (pendingResolutions.length > 0) {
            if (typeof resolved === "string" && this.typeConfigs.has(resolved)) {
                pendingResolutions.forEach((cb) => {
                    const config = this.typeConfigs.get(resolved)!;
                    cb(config, this.implementors.get(config.name)!);
                });
            }
            else {
                pendingResolutions.forEach((cb) => {
                    this.onTypeConfig(resolved as ConfigurableRef<Types>, cb);
                });
            }
        }
        this.pendingTypeConfigResolutions.delete(param);
    }
    onTypeConfig(param: ConfigurableRef<Types>, onConfig: (config: PothosTypeConfig, ref: BaseTypeRef<Types>) => void) {
        const resolved = this.resolveParamAssociations(param);
        if (typeof resolved === "string" && this.typeConfigs.has(resolved)) {
            const config = this.typeConfigs.get(resolved)!;
            onConfig(config, this.implementors.get(config.name)!);
        }
        else {
            if (!this.pendingTypeConfigResolutions.has(resolved)) {
                this.pendingTypeConfigResolutions.set(resolved, []);
            }
            this.pendingTypeConfigResolutions.get(resolved)!.push(onConfig);
        }
    }
    onTypeConfigOfKind<Kind extends PothosTypeConfig["kind"]>(param: ConfigurableRef<Types>, kind: Kind, onConfig: (config: PothosTypeConfig & {
        kind: Kind;
    }) => void) {
        this.onTypeConfig(param, (config) => {
            if (config.kind !== kind) {
                throw new PothosSchemaError(`Expected ${this.describeRef(param)} to be of kind ${kind} but it is of kind ${config.kind}`);
            }
            onConfig(config as PothosTypeConfig & {
                kind: Kind;
            });
        });
    }
    addTypeRef<T extends PothosTypeConfig>(ref: BaseTypeRef<Types, T>) {
        if (this.refs.has(ref as BaseTypeRef<Types>)) {
            return;
        }
        if (!this.pending) {
            ref.prepareForBuild();
        }
        this.refs.add(ref as BaseTypeRef<Types>);
        ref.onConfig((config) => {
            const implementor = this.implementors.get(config.name);
            if (implementor && implementor !== ref) {
                throw new PothosSchemaError(`Duplicate typename: Another type with name ${config.name} already exists.`);
            }
            if (!implementor) {
                this.implementors.set(config.name, ref as BaseTypeRef<Types>);
                this.associateParamWithRef(ref as BaseTypeRef<Types>, config.name);
                if (ref instanceof ObjectRef ||
                    ref instanceof InterfaceRef ||
                    ref instanceof InputObjectRef) {
                    if (!this.fields.has(config.name)) {
                        this.fields.set(config.name, new Map());
                    }
                    this.onPrepare(() => {
                        (ref as InputObjectRef<Types, unknown> | InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>).onField((fieldName, field) => {
                            const fields = this.fields.get(config.name)!;
                            if (fields.has(fieldName)) {
                                throw new PothosSchemaError(`Duplicate field ${fieldName} on ${config.name}`);
                            }
                            fields.set(fieldName, field.getConfig(fieldName, this.typeConfigs.get(config.name) ?? config));
                        });
                    });
                }
            }
            this.typeConfigs.set(config.name, config);
            if (this.pendingTypeConfigResolutions.has(config.name)) {
                const cbs = this.pendingTypeConfigResolutions.get(config.name)!;
                cbs.forEach((cb) => void cb(config, ref as BaseTypeRef<Types>));
            }
            this.pendingTypeConfigResolutions.delete(config.name);
        });
    }
    subscribeToFields(ref: BaseTypeRef<Types>) { }
    hasImplementation(typeName: string) {
        return this.typeConfigs.has(typeName);
    }
    hasConfig(ref: ConfigurableRef<Types> | string) {
        const resolved = this.resolveParamAssociations(ref);
        if (typeof resolved !== "string" || !this.typeConfigs.has(resolved)) {
            return false;
        }
        return true;
    }
    getTypeConfig<T extends PothosTypeConfig["kind"]>(ref: ConfigurableRef<Types> | string, kind?: T) {
        const resolved = this.resolveParamAssociations(ref);
        if (typeof resolved !== "string" || !this.typeConfigs.has(resolved)) {
            throw new PothosSchemaError(`${this.describeRef(ref)} has not been implemented`);
        }
        const config = this.typeConfigs.get(resolved)!;
        if (kind && config.graphqlKind !== kind) {
            throw new PothosSchemaError(`Expected ref to resolve to a ${kind} type, but got ${config.kind}`);
        }
        return config as Extract<PothosTypeConfig, {
            kind: T;
        }>;
    }
    getInputTypeRef(param: ConfigurableRef<Types> | string) {
        const resolved = this.resolveParamAssociations(param);
        if (param instanceof BaseTypeRef) {
            if (param.kind !== "InputObject" && param.kind !== "Enum" && param.kind !== "Scalar") {
                throw new PothosSchemaError(`Expected ${this.describeRef(param)} to be an input type but got ${param.kind}`);
            }
            return param as unknown as InputRef;
        }
        if (typeof resolved === "string" && this.typeConfigs.has(resolved)) {
            const ref = this.implementors.get(resolved)!;
            if (ref instanceof BaseTypeRef) {
                if (ref.kind !== "InputObject" && ref.kind !== "Enum" && ref.kind !== "Scalar") {
                    throw new PothosSchemaError(`Expected ${this.describeRef(ref)} to be an input type but got ${ref.kind}`);
                }
                return ref as unknown as InputRef;
            }
        }
        throw new PothosSchemaError(`${this.describeRef(param)} has not been implemented`);
    }
    getOutputTypeRef(param: ConfigurableRef<Types> | string) {
        const resolved = this.resolveParamAssociations(param);
        if (param instanceof BaseTypeRef) {
            if (param.kind === "InputObject" || param.kind === "InputList") {
                throw new PothosSchemaError(`Expected ${param.name} to be an output type but got ${param.kind}`);
            }
            return param as unknown as OutputType<Types>;
        }
        if (typeof resolved === "string" && this.typeConfigs.has(resolved)) {
            const ref = this.implementors.get(resolved)!;
            if (ref instanceof BaseTypeRef) {
                if (ref.kind === "InputObject" || ref.kind === "InputList") {
                    throw new PothosSchemaError(`Expected ${ref.name} to be an output type but got ${ref.kind}`);
                }
                return ref as unknown as OutputType<Types>;
            }
        }
        throw new PothosSchemaError(`${this.describeRef(param)} has not been implemented`);
    }
    getFields<T extends GraphQLFieldKind>(name: string, kind?: T): Map<string, Extract<PothosFieldConfig<Types>, {
        graphqlKind: T;
    }>> {
        const typeConfig = this.getTypeConfig(name);
        if (!this.fields.has(name)) {
            this.fields.set(name, new Map());
        }
        const fields = this.fields.get(name)!;
        if (kind && typeConfig.graphqlKind !== kind) {
            throw new PothosSchemaError(`Expected ${name} to be a ${kind} type, but found ${typeConfig.graphqlKind}`);
        }
        return fields as Map<string, Extract<PothosFieldConfig<Types>, {
            graphqlKind: T;
        }>>;
    }
    prepareForBuild() {
        this.pending = false;
        for (const ref of this.refs) {
            ref.prepareForBuild();
        }
        const { pendingActions } = this;
        this.pendingActions = [];
        pendingActions.forEach((fn) => void fn());
        if (this.pendingTypeConfigResolutions.size > 0) {
            throw new PothosSchemaError(`Missing implementations for some references (${[
                ...this.pendingTypeConfigResolutions.keys(),
            ]
                .map((ref) => this.describeRef(ref as ConfigurableRef<Types>))
                .join(", ")}).`);
        }
    }
    onPrepare(cb: () => void) {
        if (this.pending) {
            this.pendingActions.push(cb);
        }
        else {
            cb();
        }
    }
    private resolveParamAssociations(param: unknown) {
        let current = this.paramAssociations.get(param);
        while (current && this.paramAssociations.has(current)) {
            current = this.paramAssociations.get(current)!;
        }
        return current ?? param;
    }
    private describeRef(ref: unknown): string {
        if (typeof ref === "string") {
            return ref;
        }
        if (ref && ref.toString !== {}.toString) {
            return String(ref);
        }
        // eslint-disable-next-line func-names
        if (typeof ref === "function" && ref.name !== function () { }.name) {
            return `function ${ref.name}`;
        }
        return `<unnamed ref or enum>`;
    }
}
