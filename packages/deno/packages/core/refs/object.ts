// @ts-nocheck
/* eslint-disable max-classes-per-file */
import { InterfaceParam, ObjectTypeOptions, OutputRef, outputShapeKey, parentShapeKey, PothosMutationTypeConfig, PothosObjectTypeConfig, PothosQueryTypeConfig, PothosSubscriptionTypeConfig, SchemaTypes, } from '../types/index.ts';
import { TypeRefWithFields } from './base-with-fields.ts';
export type ObjectLikeConfig = PothosMutationTypeConfig | PothosObjectTypeConfig | PothosQueryTypeConfig | PothosSubscriptionTypeConfig;
export class ObjectRef<Types extends SchemaTypes, T, P = T> extends TypeRefWithFields<Types, ObjectLikeConfig> implements OutputRef, PothosSchemaTypes.ObjectRef<Types, T, P> {
    override kind = "Object" as const;
    $inferType!: T;
    [outputShapeKey]!: T;
    [parentShapeKey]!: P;
    constructor(name: string, config?: ObjectLikeConfig) {
        super("Object", name, config);
    }
}
export class ImplementableObjectRef<Types extends SchemaTypes, Shape, Parent = Shape> extends ObjectRef<Types, Shape, Parent> {
    builder: PothosSchemaTypes.SchemaBuilder<Types>;
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string) {
        super(name);
        this.builder = builder;
    }
    implement<Interfaces extends InterfaceParam<Types>[]>(options: Omit<ObjectTypeOptions<Types, ImplementableObjectRef<Types, Shape, Parent>, Parent, Interfaces>, "name">): PothosSchemaTypes.ObjectRef<Types, Shape, Parent> {
        return this.builder.objectType(this, options as ObjectTypeOptions<Types, ImplementableObjectRef<Types, Shape, Parent>, Parent, Interfaces>);
    }
}
