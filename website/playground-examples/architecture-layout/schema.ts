// src/schema.ts
import { builder } from './builder';
import './schema/user';

builder.queryType({});

export const schema = builder.toSchema();
