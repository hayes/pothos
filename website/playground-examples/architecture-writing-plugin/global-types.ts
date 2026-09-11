import type { SchemaTypes } from '@pothos/core';
import type { ObserverPlugin } from './plugin';

// #region declarations
declare global {
  namespace PothosSchemaTypes {
    interface Plugins<Types extends SchemaTypes> {
      architectureObserver: ObserverPlugin<Types>;
    }

    interface SchemaBuilderOptions<Types extends SchemaTypes> {
      logLabel?: string;
    }
  }
}
// #endregion declarations
