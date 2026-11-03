import { resolveStorageTable } from '@prisma/orm-family-sql/contract/resolve-storage-table';
import { type Codec, readContractValue } from '@prisma/orm-framework/components/codec';
import { canonicalStringify } from '@prisma/orm-framework/utils/canonical-stringify';
import type { AnyContract } from '../types/models.js';
import type { PrismaNextExecutionContext } from '../types/plugin-options.js';
import { fieldStorage } from './contract.js';

/** A column codec. Cursors, node IDs and loader keys hold values in its stored JSON form. */
interface ColumnCodec {
  encode(value: unknown): unknown;
  decode(stored: unknown): unknown;
  /** Equal for values the column's data type holds equal, such as the decimals 0.5 and 0.50. */
  key(value: unknown): string;
}

type CodecContext = Pick<PrismaNextExecutionContext<AnyContract>, 'contractCodecs'>;

export type FieldCodecs = (field: string) => ColumnCodec;

/** For a column the registry has no codec for: values are stored and compared as they are. */
const rawCodec: ColumnCodec = {
  encode: (value) => value,
  decode: (stored) => stored,
  key: (value) => canonicalStringify(value),
};

/** The field's column codec. A registry may map no codec to a column, which gets `rawCodec`. */
export function getColumnCodec(
  contract: AnyContract,
  context: CodecContext,
  modelKey: string,
  field: string,
): ColumnCodec {
  const storage = fieldStorage(contract, modelKey, field);
  if (!storage) {
    return rawCodec;
  }
  const { namespaceId, column } = storage;
  const codec = context.contractCodecs.forColumn(namespaceId, storage.table, column) as
    | Codec
    | undefined;
  if (!codec) {
    return rawCodec;
  }
  const table = resolveStorageTable(contract.storage, storage.table, namespaceId)?.table;
  const typeParams = (table?.columns[column] as { typeParams?: unknown } | undefined)?.typeParams;
  const encode = (value: unknown) => codec.dataType.toContract(codec.toDataTypeValue(value));
  return {
    encode,
    decode: (stored) => readContractValue(codec, stored as never, typeParams),
    key: (value) => {
      const stored = encode(value);
      return codec.dataType.equalityKey?.(stored) ?? canonicalStringify(stored);
    },
  };
}
