import { GraphQLResolveInfo } from 'graphql';
import { GiraphQLOutputFieldConfig, SchemaTypes, MaybePromise, ResolveHooks } from '..';
import { SubscribeHooks } from '../types';

/**
 * @deprecated This will be replaced by by wrapResolve, wrapSubscribe, and wrapResolveType
 */
export default class BaseFieldWrapper<
  Types extends SchemaTypes,
  RequestData extends object = object,
  ParentData extends object = object
> {
  name: string;

  field: GiraphQLOutputFieldConfig<Types>;

  constructor(field: GiraphQLOutputFieldConfig<Types>, name: string) {
    this.name = name;
    this.field = field;
  }

  createRequestData?(context: object): MaybePromise<RequestData>;

  allowReuse?(
    requestData: RequestData,
    parentData: ParentData | null,
    parent: unknown,
    args: object,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ): MaybePromise<boolean>;

  beforeResolve?(
    requestData: RequestData,
    parentData: ParentData | null,
    parent: unknown,
    args: object,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ): MaybePromise<ResolveHooks<Types, ParentData>>;

  beforeSubscribe?(
    requestData: RequestData,
    parent: unknown,
    args: object,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<SubscribeHooks<Types, ParentData>>;
}
