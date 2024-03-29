// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import FieldBuilder from './builder.ts';
export default class ObjectFieldBuilder<Types extends SchemaTypes, ParentShape> extends FieldBuilder<Types, ParentShape, "Object"> {
    constructor(name: string, builder: PothosSchemaTypes.SchemaBuilder<Types>) {
        super(name, builder, "Object", "Object");
    }
}
