import { FieldRequiredness, InputFieldBuilder, ObjectRef, SchemaTypes } from '@pothos/core';
import { GlobalIDInputFieldOptions, GlobalIDListInputFieldOptions } from './types';

type DefaultSchemaTypes = PothosSchemaTypes.ExtendDefaultTypes<{}>;

const inputFieldBuilder = InputFieldBuilder.prototype as PothosSchemaTypes.InputFieldBuilder<
  DefaultSchemaTypes,
  'Arg' | 'InputObject'
>;

inputFieldBuilder.globalIDList = function globalIDList<Req extends FieldRequiredness<['ID']>>(
  {
    for: forTypes,
    ...options
  }: GlobalIDListInputFieldOptions<DefaultSchemaTypes, Req, 'Arg' | 'InputObject'> = {} as never,
) {
  return this.idList({
    ...options,
    extensions: {
      ...options.extensions,
      isRelayGlobalID: true,
      relayGlobalIDFor:
        (
          (forTypes && (Array.isArray(forTypes) ? forTypes : [forTypes])) as ObjectRef<
            SchemaTypes,
            unknown
          >[]
        )?.map((type: ObjectRef<SchemaTypes, unknown>) => ({
          typename: this.builder.configStore.getTypeConfig(type).name,
          parseId: 'parseId' in type ? type.parseId : undefined,
        })) ?? null,
    },
  }) as never;
};

inputFieldBuilder.globalID = function globalID<Req extends boolean>(
  {
    for: forTypes,
    ...options
  }: GlobalIDInputFieldOptions<DefaultSchemaTypes, Req, 'Arg' | 'InputObject'> = {} as never,
) {
  return this.id({
    ...options,
    extensions: {
      ...options.extensions,
      isRelayGlobalID: true,
      relayGlobalIDFor:
        (
          (forTypes && (Array.isArray(forTypes) ? forTypes : [forTypes])) as ObjectRef<
            SchemaTypes,
            unknown
          >[]
        )?.map((type: ObjectRef<SchemaTypes, unknown>) => ({
          typename: this.builder.configStore.getTypeConfig(type).name,
          parseId: 'parseId' in type ? type.parseId : undefined,
        })) ?? null,
    },
  }) as never;
};

inputFieldBuilder.connectionArgs = function connectionArgs() {
  return {
    before: this.field({
      ...this.builder.options.relay?.beforeArgOptions,
      type: this.builder.options.relay?.cursorType ?? 'String',
      required: false,
    }),
    after: this.field({
      ...this.builder.options.relay?.afterArgOptions,
      type: this.builder.options.relay?.cursorType ?? 'String',
      required: false,
    }),
    first: this.field({
      ...this.builder.options.relay?.firstArgOptions,
      type: 'Int',
      required: false,
    }),
    last: this.field({
      ...this.builder.options.relay?.lastArgOptions,
      type: 'Int',
      required: false,
    }),
  };
};
