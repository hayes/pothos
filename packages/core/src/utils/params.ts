import { GraphQLOutputType, GraphQLNonNull, GraphQLList, GraphQLInputType } from 'graphql';
import { BuildCache, TypeParam, InputTypeParam, FieldNullability, FieldRequiredness } from '..';

export function typeFromNonListParam(
  param: Exclude<TypeParam<any>, [unknown]>,
  cache: BuildCache,
): GraphQLOutputType {
  const name = cache.configStore.getNameFromRef(param);

  return cache.getOutputType(name);
}

export function typeFromMaybeNullParam(
  param: Exclude<TypeParam, [unknown]>,
  cache: BuildCache,
  nullable: boolean,
): GraphQLOutputType {
  const type = typeFromNonListParam(param, cache);

  if (nullable) {
    return type;
  }

  return new GraphQLNonNull(type);
}

export function typeFromParam(
  param: TypeParam,
  cache: BuildCache,
  nullable: FieldNullability,
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
  const name = cache.configStore.getNameFromRef(param);

  return cache.getInputType(name);
}

export function inputTypeFromMaybeRequiredParam(
  param: Exclude<InputTypeParam, [unknown]>,
  cache: BuildCache,
  required: boolean,
): GraphQLInputType {
  const type = inputTypeFromNonListParam(param, cache);

  if (!required) {
    return type;
  }

  return new GraphQLNonNull(type);
}

export function inputTypeFromParam(
  param: InputTypeParam,
  cache: BuildCache,
  required: FieldRequiredness,
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

  return inputTypeFromMaybeRequiredParam(
    param as Exclude<typeof param, [unknown]>,
    cache,
    listRequired,
  );
}
