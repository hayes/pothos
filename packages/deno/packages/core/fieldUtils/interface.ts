// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import { FieldBuilder } from './builder.ts';
export class InterfaceFieldBuilder<Types extends SchemaTypes, ParentShape> extends FieldBuilder<Types, ParentShape, "Interface"> {
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
        super(builder, "Interface", "Interface");
    }
}
