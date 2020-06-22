import { GraphQLResolveInfo } from 'graphql';
import { GiraphQLOutputFieldConfig, SchemaTypes, MaybePromise, ResolveHooks } from '..';

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
  ): boolean;

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
  ): MaybePromise<{
    onSubscribe?(value: unknown): MaybePromise<void>;
    onValue?(child: unknown): MaybePromise<ParentData | null>;
  }>;
}
