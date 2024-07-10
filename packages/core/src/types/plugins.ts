import type { BuildCache } from '../build-cache';
import type { BasePlugin } from '../plugins/plugin';
import type { SchemaTypes } from './schema-types';

export type PluginConstructorMap<Types extends SchemaTypes> = {
  [K in keyof PothosSchemaTypes.Plugins<SchemaTypes>]: new (
    buildCache: BuildCache<SchemaTypes>,
    name: K,
  ) => BasePlugin<Types> & PothosSchemaTypes.Plugins<Types>[K];
};

export type PluginMap<Types extends SchemaTypes> = {
  [K in keyof PluginConstructorMap<Types>]: InstanceType<PluginConstructorMap<Types>[K]>;
};

export type PluginName = keyof PluginConstructorMap<SchemaTypes>;
