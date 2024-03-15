// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import { RootFieldBuilder } from './root.ts';
export class QueryFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<Types, ParentShape, "Query"> {
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
        super(builder, "Query", "Object");
    }
}
