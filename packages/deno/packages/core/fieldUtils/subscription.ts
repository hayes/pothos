// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import { RootFieldBuilder } from './root.ts';
export class SubscriptionFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<Types, ParentShape, "Subscription"> {
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
        super(builder, "Subscription", "Object");
    }
}
