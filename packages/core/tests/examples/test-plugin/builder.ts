import SchemaBuilder from '../../../src';
import TestPlugin from './plugin';

const builder = new SchemaBuilder({
  plugins: [TestPlugin],
});

export default builder;
