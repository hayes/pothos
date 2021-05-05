import './global-types.ts';
import { GiraphQLOutputFieldConfig, SchemaTypes } from '../core/index.ts';
import { FieldSubscriber } from './types.ts';
import { GiraphQLSmartSubscriptionsPlugin } from './index.ts';
export function getFieldSubscribe<Types extends SchemaTypes>(field: GiraphQLOutputFieldConfig<Types>, plugin: GiraphQLSmartSubscriptionsPlugin<Types>) {
    if (field.graphqlKind === "Object" &&
        field.kind !== "Mutation" &&
        field.kind !== "Subscription") {
        return field.giraphqlOptions.subscribe as FieldSubscriber<Types>;
    }
    if (field.kind === "Subscription" && plugin.smartSubscriptionsToQueryField.has(field.name)) {
        return plugin.smartSubscriptionsToQueryField.get(field.name)!
            .subscribe as FieldSubscriber<Types>;
    }
    return null;
}
