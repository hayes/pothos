import SchemaBuilder from '@pothos/core';
import PrismaNextPlugin from '@pothos/plugin-prisma-next';
import RelayPlugin from '@pothos/plugin-relay';
import type { Contract } from './contract';
import contractJson from './contract.json';

// `PrismaNextContract` threads the emitted contract through every plugin
// method — model names, relation names, column types, and row shapes
// flow from this single generic. Without it, the plugin's helper types
// collapse onto a sentinel that explains what to configure.
export const builder = new SchemaBuilder<{
  PrismaNextContract: Contract;
}>({
  plugins: [PrismaNextPlugin, RelayPlugin],
  relay: {},
  prismaNext: { contract: contractJson as Contract },
});
