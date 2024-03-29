// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import RootFieldBuilder from './root.ts';
export default class SubscriptionFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<Types, ParentShape, "Subscription"> {
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
        super("Subscription", builder, "Subscription", "Object");
    }
}
