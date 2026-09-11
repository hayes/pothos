import SchemaBuilder from '@pothos/core';

export interface Context {
  locale: 'en' | 'fr';
}

export const builder = new SchemaBuilder<{ Context: Context }>({});
