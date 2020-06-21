import { GraphQLResolveInfo, GraphQLFieldResolver } from 'graphql';
import { GiraphQLOutputFieldConfig, SchemaTypes, MaybePromise } from '..';
import { ResolveValueWrapper } from './resolve-wrapper';

export default abstract class BaseFieldWrapper<
  Types extends SchemaTypes,
  RequestData extends object = object,
  ParentData extends object = object
> {
  field: GiraphQLOutputFieldConfig<Types>;

  // TODO add plugable type?
  abstract name: string;

  constructor(field: GiraphQLOutputFieldConfig<Types>) {
    this.field = field;
  }

  abstract createRequestData?(context: object): MaybePromise<RequestData>;

  beforeResolve?(
    requestData: RequestData,
    parentData: ParentData | null,
    parent: unknown,
    args: object,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ): MaybePromise<{
    overwriteResolve?: GraphQLFieldResolver<unknown, Types['Context']>;
    onResolve?(value: unknown): MaybePromise<void>;
    onWrap?(child: unknown, index: number | null): MaybePromise<ParentData | null>;
    onWrappedResolve?(
      wrapped: ResolveValueWrapper | MaybePromise<ResolveValueWrapper | null>[],
    ): void;
  }>;

  beforeSubscribe?(
    requestData: RequestData,
    parent: unknown,
    args: object,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<{
    onSubscribe?(value: unknown): MaybePromise<void>;
    onWrap?(child: unknown): MaybePromise<ParentData | null>;
  }>;

  onInterfaceResolveType?(
    requestData: RequestData,
    parentData: ParentData | null,
    type: string,
    parent: unknown,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<void>;

  onUnionResolveType?(
    requestData: RequestData,
    parentData: ParentData | null,
    type: string,
    parent: unknown,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<void>;
}
