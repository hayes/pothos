// @ts-nocheck
import { ImplementableObjectRef, type ObjectParam, ObjectRef, type SchemaTypes, } from '../core/index.ts';
import type { NodeRefOptions } from './types.ts';
import { addNodeProperties } from './utils/add-node-props.ts';
export const relayIDShapeKey = Symbol.for("Pothos.relayIDShapeKey");
export class NodeRef<Types extends SchemaTypes, T, P = T, IDShape = string> extends ObjectRef<Types, T, P> {
    [relayIDShapeKey]!: IDShape;
    parseId: ((id: string, ctx: object) => IDShape) | undefined;
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string, param: ObjectParam<Types>, options: NodeRefOptions<Types, T, P, IDShape>) {
        super(name);
        this.parseId = options.id.parse;
        addNodeProperties(name, builder, this, param, options);
    }
}
export class ImplementableNodeRef<Types extends SchemaTypes, T, P = T, IDShape = string> extends ImplementableObjectRef<Types, T, P> {
    parseId: ((id: string, ctx: object) => IDShape) | undefined;
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string, options: NodeRefOptions<Types, T, P, IDShape>) {
        super(builder, name);
        this.parseId = options.id.parse;
        addNodeProperties(name, builder, this, undefined, options);
    }
}
