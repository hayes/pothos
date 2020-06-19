import { GraphQLOutputType, GraphQLNonNull, GraphQLList, GraphQLInputType } from 'graphql';
import {
  BuildCache,
  TypeParam,
  InputTypeParam,
  FieldNullability,
  FieldRequiredness,
  SchemaTypes,
  OutputType,
  InputType,
} from '..';

export function typeFromNonListParam(
  param: Exclude<TypeParam<any>, [unknown]>,
  cache: BuildCache,
): GraphQLOutputType {
  return cache.getOutputType(param as OutputType<SchemaTypes>);
}

export function typeFromMaybeNullParam<Types extends SchemaTypes>(
  param: Exclude<TypeParam<Types>, [unknown]>,
  cache: BuildCache,
  nullable: boolean,
): GraphQLOutputType {
  const type = typeFromNonListParam(param, cache);

  if (nullable) {
    return type;
  }

  return new GraphQLNonNull(type);
}

export function typeFromParam<Types extends SchemaTypes>(
  param: TypeParam<Types>,
  cache: BuildCache,
  nullable: FieldNullability<[unknown]>,
): GraphQLOutputType {
  const itemNullable = typeof nullable === 'object' ? nullable.items : false;
  const listNullable = typeof nullable === 'object' ? nullable.list : !!nullable;

  if (Array.isArray(param)) {
    const itemType = typeFromMaybeNullParam(
      param[0] as Exclude<typeof param, [unknown]>,
      cache,
      itemNullable,
    );
    const listType = new GraphQLList(itemType);

    if (listNullable) {
      return listType;
    }

    return new GraphQLNonNull(listType);
  }

  return typeFromMaybeNullParam(param as Exclude<typeof param, [unknown]>, cache, listNullable);
}

export function inputTypeFromNonListParam(
  param: Exclude<InputTypeParam<any>, [unknown]>,
  cache: BuildCache,
): GraphQLInputType {
  return cache.getInputType(param as InputType<SchemaTypes>);
}

export function inputTypeFromMaybeRequiredParam<Types extends SchemaTypes>(
  param: InputType<Types>,
  cache: BuildCache,
  required: boolean,
): GraphQLInputType {
  const type = inputTypeFromNonListParam(param, cache);

  if (!required) {
    return type;
  }

  return new GraphQLNonNull(type);
}

export function inputTypeFromParam<Types extends SchemaTypes>(
  param: InputTypeParam<Types>,
  cache: BuildCache,
  required: FieldRequiredness<[unknown]>,
): GraphQLInputType {
  const itemRequired = typeof required === 'object' ? required.items : true;
  const listRequired = typeof required === 'object' ? required.list : !!required;

  if (Array.isArray(param)) {
    const itemType = inputTypeFromMaybeRequiredParam(
      param[0] as Exclude<typeof param, [unknown]>,
      cache,
      itemRequired,
    );
    const listType = new GraphQLList(itemType);

    if (!listRequired) {
      return listType;
    }

    return new GraphQLNonNull(listType);
  }

  return inputTypeFromMaybeRequiredParam(param, cache, listRequired);
}
