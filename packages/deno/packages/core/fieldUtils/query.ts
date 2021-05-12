// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import RootFieldBuilder from './root.ts';
export default class QueryFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<Types, ParentShape, "Query"> {
    constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
        super("Query", builder, "Query", "Object");
    }
}
