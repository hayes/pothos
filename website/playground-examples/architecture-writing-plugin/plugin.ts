import './global-types';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLFieldResolver } from 'graphql';

// #region plugin
export class ObserverPlugin<Types extends SchemaTypes> extends BasePlugin<
  Types,
  { resolveCount: number }
> {
  createRequestData(_context: Types['Context']) {
    return { resolveCount: 0 };
  }

  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    _fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return (parent, args, context, info) => {
      const data = this.requestData(context);
      data.resolveCount += 1;
      console.log(
        `${this.builder.options.logLabel}: ${info.parentType}.${info.fieldName} (${data.resolveCount})`,
      );
      return resolver(parent, args, context, info);
    };
  }
}
// #endregion plugin

// #region registration
export const pluginName = 'architectureObserver';
SchemaBuilder.registerPlugin(pluginName, ObserverPlugin);
// #endregion registration
