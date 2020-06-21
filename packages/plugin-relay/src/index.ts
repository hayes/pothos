import SchemaBuilder, {
  SchemaTypes,
  BasePlugin,
  RootFieldBuilder,
  FieldKind,
  ObjectRef,
} from '@giraphql/core';
import './global-types';
import { ConnectionShape, PageInfoShape } from './types';

export * from './utils';

export default class RelayPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}

SchemaBuilder.registerPlugin('GiraphQLRelay', RelayPlugin);

function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}

const schemaBuilderProto: GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes> = SchemaBuilder.prototype;
const fieldBuilderProto: GiraphQLSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind> =
  RootFieldBuilder.prototype;

const pageInfoRefMap = new WeakMap<
  GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
  ObjectRef<PageInfoShape>
>();

schemaBuilderProto.pageInfoRef = function pageInfoRef() {
  if (pageInfoRefMap.has(this)) {
    return pageInfoRefMap.get(this)!;
  }

  const ref = new ObjectRef<PageInfoShape>('PageInfo');

  pageInfoRefMap.set(this, ref);

  this.objectType(ref, {
    fields: (t) => ({
      hasNextPage: t.exposeBoolean('hasNextPage', {}),
      hasPreviousPage: t.exposeBoolean('hasPreviousPage', {}),
      startCursor: t.exposeString('startCursor', { nullable: true }),
      endCursor: t.exposeBoolean('endCursor', { nullable: true }),
    }),
  });

  return ref;
};

fieldBuilderProto.connection = function connection(
  { type, ...fieldOptions },
  connectionOptions,
  edgeOptions,
) {
  const placeholderRef = this.builder.objectRef<ConnectionShape<unknown>>('Unnamed connection');

  const fieldRef = this.field({
    ...fieldOptions,
    type: placeholderRef,
    resolve: fieldOptions.resolve as never,
  });

  this.builder.configStore.onFieldUse(fieldRef, (fieldConfig) => {
    const connectionName =
      connectionOptions.name ||
      `${this.typename}${capitalize(fieldConfig.name)}${
        fieldConfig.name.toLowerCase().endsWith('connection') ? '' : 'Connection'
      }`;
    const connectionRef = this.builder.objectRef<ConnectionShape<unknown>>(connectionName);
    const edgeName = edgeOptions.name || `${connectionName}Edge`;
    const edgeRef = this.builder.objectRef<{
      cursor: string;
      node: unknown;
    }>(edgeName);

    this.builder.objectType(connectionRef, {
      fields: (t) => ({
        pageInfo: t.field({
          type: this.builder.pageInfoRef(),
          resolve: (parent) => parent.pageInfo,
        }),
        edges: t.field({
          type: [edgeRef],
          resolve: (parent) => parent.edges,
        }),
      }),
    });

    this.builder.configStore.associateRefWithName(placeholderRef, connectionName);

    this.builder.objectType(edgeRef, {
      fields: (t) => ({
        node: t.field({
          type,
          resolve: (parent) => parent.node as never,
        }),
        cursor: t.exposeString('cursor', {}),
      }),
    });
  });

  return fieldRef;
};
