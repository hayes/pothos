import { Type } from '@nestjs/common';

export type GraphqlContext = {
  get: <T>(provider: string | symbol | Function | Type<T>) => T;
};
