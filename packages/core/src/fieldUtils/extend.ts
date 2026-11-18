import { fieldBuilderCloneKey } from '../types/index.js';
import type { BaseFieldUtil } from './base.js';

export type FieldOptionsMapper = (options: Record<string, unknown>) => Record<string, unknown>;

/** `createField` is protected on field builders. */
interface CreateFieldAccess {
  createField: (options: Record<string, unknown>) => unknown;
}

/**
 * Returns a copy of `parent` that passes the options of every field it creates through
 * `mapOptions`. Extensions stack: the latest one maps the options first, and copies of an
 * extended builder keep the extension.
 */
export function extendFieldBuilder<
  // biome-ignore lint/suspicious/noExplicitAny: any field builder
  Builder extends BaseFieldUtil<any, any, any>,
>(parent: Builder, mapOptions: FieldOptionsMapper): Builder {
  const builder = parent[fieldBuilderCloneKey]();
  const parentCreateField = (parent as unknown as CreateFieldAccess).createField;

  (builder as unknown as CreateFieldAccess).createField = function createField(options) {
    return parentCreateField.call(this, mapOptions(options));
  };

  builder[fieldBuilderCloneKey] = () => extendFieldBuilder(parent, mapOptions);

  return builder;
}
