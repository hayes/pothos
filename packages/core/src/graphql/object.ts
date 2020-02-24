import { GraphQLObjectType } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import BaseType from './base';
import { FieldMap, InterfaceName } from '../types';
import FieldBuilder from '../fieldUtils/builder';
import BuildCache from '../build-cache';
import { InterfaceType } from '..';
import { BasePlugin } from '../plugins';

export default class ObjectType<Types extends GiraphQLSchemaTypes.TypeInfo> extends BaseType<{}> {
  kind: 'Object' = 'Object';

  description?: string;

  interfaces: string[];

  options:
    | GiraphQLSchemaTypes.ObjectTypeOptions<any, any>
    | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<any, any, any>;

  constructor(
    name: string,
    options:
      | GiraphQLSchemaTypes.ObjectTypeOptions<Types, any>
      | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<Types, any, []>,
  ) {
    super(name);

    if (name === 'Query' || name === 'Mutation' || name === 'Subscription') {
      throw new Error(`Invalid object name ${name} use .create${name}Type() instead`);
    }

    this.options = options;

    this.description = options.description;
    this.interfaces = (options.implements ?? []).map(iface =>
      typeof iface === 'string'
        ? iface
        : (iface as InterfaceType<Types, InterfaceName<Types>>).typename,
    );
  }

  getFields(): FieldMap {
    if (!this.options.shape) {
      return {};
    }

    return this.options.shape(new FieldBuilder(this.typename));
  }

  buildType(cache: BuildCache, plugin: Required<BasePlugin>): GraphQLObjectType {
    return new GraphQLObjectType({
      name: String(this.typename),
      description: this.description,
      interfaces: () => this.interfaces.map(type => cache.getEntryOfType(type, 'Interface').built),
      fields: () =>
        fromEntries(
          Object.entries(cache.getFields(this.typename)).map(([key, field]) => [
            key,
            field.build(key, cache, plugin),
          ]),
        ),
      extensions: this.options.extensions,
    });
  }
}
