import { GraphQLEnumType, GraphQLEnumValueConfigMap, GraphQLEnumValueConfig } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import BaseInputType from './base-input';

export default class EnumType extends BaseInputType {
  values: GraphQLEnumValueConfigMap;

  description?: string;

  kind: 'Enum' = 'Enum';

  options: GiraphQLSchemaTypes.EnumTypeOptions;

  constructor(name: string, options: GiraphQLSchemaTypes.EnumTypeOptions) {
    super(name);

    this.options = options;

    this.values = Array.isArray(options.values)
      ? fromEntries(options.values.map((key) => [key, {}]))
      : fromEntries(
          Object.entries(options.values)
            .map(([key, value]) => {
              if (value && typeof value === 'object') {
                return [key, value];
              }

              if (typeof value === 'string') {
                return [value, {}];
              }

              return null;
            })
            .filter(Boolean) as [string, GraphQLEnumValueConfig][],
        );

    this.description = options.description;
  }

  buildType() {
    return new GraphQLEnumType({
      description: this.description,
      name: this.typename,
      values: this.values,
      extensions: this.options.extensions,
    });
  }
}
