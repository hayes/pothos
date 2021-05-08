// @ts-nocheck
/* eslint-disable max-classes-per-file */
import { OutputRef, outputShapeKey } from '../types/index.ts';
import BaseTypeRef from './base.ts';
import { InterfaceParam, InterfaceTypeOptions, SchemaTypes } from '../index.ts';
export default class InterfaceRef<T> extends BaseTypeRef implements OutputRef {
    kind = "Interface" as const;
    [outputShapeKey]: T;
    constructor(name: string) {
        super("Interface", name);
    }
}
export class ImplementableInterfaceRef<Types extends SchemaTypes, Shape> extends InterfaceRef<Shape> {
    private builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;
    constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, name: string) {
        super(name);
        this.builder = builder;
    }
    implement<Interfaces extends InterfaceParam<Types>[]>(options: InterfaceTypeOptions<Types, ImplementableInterfaceRef<Types, Shape>, Shape, Interfaces>) {
        return this.builder.interfaceType(this, options);
    }
}
