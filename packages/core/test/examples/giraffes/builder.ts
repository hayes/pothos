import SchemaBuilder from '../../../src';
import { Diet } from './enums';

export class Animal {
  diet: Diet;

  constructor(diet: Diet) {
    this.diet = diet;
  }
}

export class Giraffe extends Animal {
  name: string;
  birthday: Date;
  heightInMeters: number;

  constructor(name: string, birthday: Date, heightInMeters: number) {
    super(Diet.HERBIVOROUS);

    this.name = name;
    this.birthday = birthday;
    this.heightInMeters = heightInMeters;
  }
}

const builder = new SchemaBuilder<{
  Objects: {
    Giraffe: Giraffe;
  };
}>({});

export default builder;
