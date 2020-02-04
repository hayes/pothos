import { GraphQLObjectType } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import BaseType from './base';
import { FieldMap, RootName } from '../types';
import BasePlugin from '../plugin';
import BuildCache from '../build-cache';
import RootFieldBuilder from '../fieldUtils/root';

export default class RootType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends RootName
> extends BaseType<Types['Root']> {
  kind: 'Root' = 'Root';

  description?: string;

  options: GiraphQLSchemaTypes.RootTypeOptions<Types, RootName>;

  constructor(name: Name, options: GiraphQLSchemaTypes.RootTypeOptions<Types, Name>) {
    super(name);

    this.options = options;
  }

  getFields(): FieldMap {
    if (!this.options.shape) {
      return {};
    }

    return this.options.shape(new RootFieldBuilder(this.typename));
  }

  buildType(cache: BuildCache, plugins: BasePlugin[]): GraphQLObjectType {
    return new GraphQLObjectType({
      name: String(this.typename),
      description: this.description,
      fields: () =>
        fromEntries(
          Object.entries(cache.getFields(this.typename)).map(([key, field]) => [
            key,
            field.build(key, cache, plugins),
          ]),
        ),
      extensions: this.options.extensions,
    });
  }
}
