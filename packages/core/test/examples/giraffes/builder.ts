import SchemaBuilder from '../../../src';

interface Giraffe {
  name: string;
  birthday: Date;
  heightInMeters: number;
}

const builder = new SchemaBuilder<{
  Objects: {
    Giraffe: Giraffe;
  };
}>({});

export default builder;
