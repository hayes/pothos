// @ts-nocheck
/* eslint-disable max-classes-per-file */
import { OutputRef, outputShapeKey } from '../types/index.ts';
import BaseTypeRef from './base.ts';
import { InterfaceParam, ObjectTypeOptions, parentShapeKey, SchemaTypes } from '../index.ts';
export default class ObjectRef<T, P = T> extends BaseTypeRef implements OutputRef, GiraphQLSchemaTypes.ObjectRef<T, P> {
    override kind = "Object" as const;
    [outputShapeKey]: T;
    [parentShapeKey]: P;
    constructor(name: string) {
        super("Object", name);
    }
}
export class ImplementableObjectRef<Types extends SchemaTypes, Shape, Parent = Shape> extends ObjectRef<Shape, Parent> {
    private builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;
    constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, name: string) {
        super(name);
        this.builder = builder;
    }
    implement<Interfaces extends InterfaceParam<Types>[]>(options: ObjectTypeOptions<Types, ImplementableObjectRef<Types, Shape, Parent>, Parent, Interfaces>) {
        return this.builder.objectType(this, options);
    }
}
