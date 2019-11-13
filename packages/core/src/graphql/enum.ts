import { GraphQLEnumType, GraphQLEnumValueConfigMap, GraphQLEnumValueConfig } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import BaseType from './base';
import { EnumValues, ShapeFromEnumValues } from '../types';

export default class EnumType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends string,
  Values extends EnumValues = EnumValues,
  Shape extends string = ShapeFromEnumValues<Values>
> extends BaseType<Types, Name, Shape> {
  values: GraphQLEnumValueConfigMap;

  description?: string;

  kind: 'Enum' = 'Enum';

  options: GiraphQLSchemaTypes.EnumTypeOptions<EnumValues>;

  constructor(name: Name, options: GiraphQLSchemaTypes.EnumTypeOptions<Values>) {
    super(name);

    this.options = options;

    this.values = Array.isArray(options.values)
      ? fromEntries(options.values.map(key => [key, {}]))
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
    });
  }
}
