import SchemaBuilder from '@giraphql/core';
import DataloaderPlugin from '../../src';

export default new SchemaBuilder({
  plugins: [DataloaderPlugin],
});
