import { printSchema } from 'graphql';
import starwarsSchema from './examples/starwars/schema';

console.log(printSchema(starwarsSchema));
