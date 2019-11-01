import { GraphQLInputObjectType, GraphQLInputFieldConfigMap } from 'graphql';
import fromEntries from 'object.fromentries';
import { InputFields, TypeMap } from './types';
import TypeStore from './store';
import BaseType from './base';
import { buildArg } from './utils';

export default class InputObjectType<
  Types extends TypeMap,
  Shape,
  Fields extends InputFields<Types>,
  Name extends string
> extends BaseType<Types, Name, Shape> {
  kind: 'InputObject' = 'InputObject';

  fields: Fields;

  constructor(name: Name, options: { fields: Fields }) {
    super(name);

    this.fields = options.fields;
  }

  buildFields(store: TypeStore<Types>): GraphQLInputFieldConfigMap {
    return fromEntries(
      Object.keys(this.fields).map(key => {
        const field = this.fields[key];
        return [
          key,
          {
            description:
              typeof field !== 'object' || field instanceof BaseType
                ? undefined
                : field.description,
            required:
              typeof field !== 'object' || field instanceof BaseType
                ? false
                : field.required || false,
            type: buildArg(field, store),
          },
        ];
      }),
    );
  }

  buildType(store: TypeStore<Types>) {
    return new GraphQLInputObjectType({
      name: this.typename,
      fields: () => this.buildFields(store),
    });
  }
}
