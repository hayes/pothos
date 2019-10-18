import { GraphQLEnumType, GraphQLEnumValueConfigMap, GraphQLEnumValueConfig } from 'graphql';
import BaseType from './base';
import { EnumTypeOptions, EnumValues, TypeMap } from './types';

export default class EnumType<
  Types extends TypeMap,
  Name extends string,
  Values extends EnumValues = EnumValues,
  Shape extends string = Values extends string[]
    ? Values[number]
    : Values extends { [s: number]: string }
    ? Values[keyof Values]
    : Extract<keyof Values, string>
> extends BaseType<Types, Name, Shape> {
  values: GraphQLEnumValueConfigMap;

  description?: string;

  kind: 'Enum' = 'Enum';

  constructor(name: Name, options: EnumTypeOptions<Values>) {
    super(name);

    this.values = Array.isArray(options.values)
      ? Object.fromEntries(options.values.map(key => [key, {}]))
      : Object.fromEntries(Object.entries(options.values)
          .map(([key, value]) => {
            if (value && typeof value === 'object') {
              return [key, value];
            }

            if (typeof value === 'string') {
              return [value, {}];
            }

            return null;
          })
          .filter(Boolean) as [string, GraphQLEnumValueConfig][]);

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
