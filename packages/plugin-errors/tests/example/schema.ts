import { InputValidationError, type StandardSchemaV1 } from '@pothos/plugin-validation';
import * as z from 'zod';
import type { Builder } from './builder';

export function createSchema(builder: Builder) {
  const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
    fields: (t) => ({
      message: t.exposeString('message'),
    }),
  });

  builder.objectType(Error, {
    name: 'BaseError',
    interfaces: [ErrorInterface],
  });

  class LengthError extends Error {
    minLength: number;

    constructor(minLength: number) {
      super(`string length should be at least ${minLength}`);

      this.minLength = minLength;
      this.name = 'LengthError';
    }
  }

  builder.objectType(LengthError, {
    name: 'LengthError',
    interfaces: [ErrorInterface],
    fields: (t) => ({
      minLength: t.exposeInt('minLength'),
    }),
  });

  builder.mutationType({});

  builder.queryType({
    fields: (t) => ({
      // Simple error handling just using base error class
      hello: t.string({
        errors: {},
        args: {
          name: t.arg.string({ required: true }),
        },
        resolve: (_parent, { name }) => {
          if (!name.startsWith(name.slice(0, 1).toUpperCase())) {
            throw new Error('name must be capitalized');
          }

          return `hello, ${name || 'World'}`;
        },
      }),
      // Handling custom errors
      helloWithMinLength: t.string({
        errors: {
          types: [LengthError],
        },
        args: {
          name: t.arg.string({ required: true }),
        },
        resolve: (_parent, { name }) => {
          if (name.length < 5) {
            throw new LengthError(5);
          }

          return `hello, ${name || 'World'}`;
        },
      }),
    }),
  });

  builder.subscriptionType({
    fields: (t) => ({
      // Simple error handling just using base error class
      test: t.int({
        errors: {},
        nullable: true,
        args: {
          errorOnSubscribe: t.arg.boolean(),
          errorInIterable: t.arg.boolean(),
          errorOnResolve: t.arg.boolean(),
          returnNull: t.arg.boolean(),
        },
        subscribe: (_, { errorOnSubscribe, errorInIterable, returnNull }) => {
          if (errorOnSubscribe) {
            throw new Error('error on subscribe');
          }

          if (returnNull) {
            return null as never;
          }

          return gen();

          async function* gen() {
            yield await 1;
            if (errorInIterable) {
              throw new Error('error on subscribe');
            }
            yield 2;
            yield 3;

            return null;
          }
        },
        resolve: (val, { errorOnResolve }) => {
          if (errorOnResolve) {
            throw new Error('error on resolve');
          }

          return val;
        },
      }),
    }),
  });

  class ExtendedError extends Error {
    errorCode = 123;

    constructor(message: string) {
      super(message);
      this.name = 'ExtendedError';
    }
  }

  class Extended2Error extends Error {
    errorCode = 123;

    constructor(message: string) {
      super(message);
      this.name = 'Extended2Error';
    }
  }

  class OtherError {
    message: string;

    constructor(message: string) {
      this.message = message;
    }
  }

  builder.objectType(ExtendedError, {
    name: 'ExtendedError',
    interfaces: [ErrorInterface],
    isTypeOf: (obj) => obj instanceof ExtendedError,
    fields: (t) => ({
      message: t.exposeString('message'),
      code: t.exposeInt('errorCode'),
    }),
  });

  builder.objectType(Extended2Error, {
    name: 'Extended2Error',
    interfaces: [ErrorInterface],
    fields: (t) => ({
      message: t.exposeString('message'),
      code: t.exposeInt('errorCode'),
    }),
  });

  builder.queryFields((t) => ({
    simpleError: t.string({
      args: {
        throw: t.arg.boolean(),
      },
      errors: {
        types: [Error],
      },
      resolve: (_parent, args) => {
        if (args.throw) {
          throw new Error('Error from simpleError field');
        }

        return 'ok';
      },
    }),
    errorReturned: t.string({
      args: {
        shouldFail: t.arg.boolean(),
      },
      errors: {
        types: [ValidationError],
      },
      resolve: (_parent, args) => {
        if (args.shouldFail) {
          return new ValidationError('Returned error', 'field') as never;
        }

        return 'success';
      },
    }),
    extendedError: t.string({
      nullable: true,
      args: {
        throw: t.arg.string(),
      },
      errors: {
        types: [Extended2Error, Error, ExtendedError],
      },
      resolve: (_parent, args) => {
        if (args.throw === 'other') {
          throw new OtherError('Error from extendedError');
        }

        if (args.throw === 'extended') {
          throw new ExtendedError('Error from extendedError');
        }

        if (args.throw === 'extended2') {
          throw new Extended2Error('Error from extendedError');
        }

        if (args.throw) {
          throw new Error('Error from extendedError');
        }

        return 'ok';
      },
    }),
    extendedErrorList: t.stringList({
      nullable: {
        items: true,
        list: true,
      },
      args: {
        throw: t.arg.string(),
      },
      errors: {
        types: [Extended2Error, Error, ExtendedError],
      },
      resolve: (_parent, args) => {
        if (args.throw === 'other') {
          throw new OtherError('Error from extendedError');
        }

        if (args.throw === 'extended') {
          throw new ExtendedError('Error from extendedError');
        }

        if (args.throw === 'extended2') {
          throw new Extended2Error('Error from extendedError');
        }

        if (args.throw) {
          throw new Error('Error from extendedError');
        }

        return ['ok'];
      },
    }),
  }));

  const InputValidationIssue = builder
    .objectRef<StandardSchemaV1.Issue>('InputValidationIssue')
    .implement({
      fields: (t) => ({
        message: t.exposeString('message'),
        path: t.stringList({
          resolve: (issue) => issue.path?.map((p) => String(p)),
        }),
      }),
    });

  builder.objectType(InputValidationError, {
    name: 'InputValidationError',
    interfaces: [ErrorInterface],
    fields: (t) => ({
      issues: t.field({
        type: [InputValidationIssue],
        resolve: (err) => err.issues,
      }),
    }),
  });

  builder.queryField('fieldWithValidation', (t) =>
    t.boolean({
      errors: {
        types: [InputValidationError],
        dataField: { name: 'result' },
      },
      args: {
        string: t.arg.string({
          validate: z.string().min(3, 'Too short'),
        }),
      },
      resolve: () => true,
    }),
  );

  builder.queryField('validation2', (t) =>
    t.boolean({
      errors: {
        types: [InputValidationError],
        dataField: { name: 'result' },
      },
      args: {
        stringList: t.arg.stringList({
          validate: z.array(z.string().min(3, 'Too short')),
        }),
      },
      validate: z.unknown().refine(() => false, { message: 'Always fails' }),
      resolve: () => true,
    }),
  );

  const DirectResult = builder.objectRef<{}>('DirectResult').implement({
    fields: (t) => ({
      id: t.id({ resolve: () => 123 }),
    }),
  });

  builder.queryField('directResult', (t) =>
    t.field({
      type: DirectResult,
      errors: {
        directResult: true,
      },
      args: {
        shouldThrow: t.arg.boolean(),
      },
      resolve: (_root, args) => {
        if (args.shouldThrow) {
          throw new Error('Boom');
        }

        return {};
      },
    }),
  );

  builder.queryFields((t) => ({
    itemErrors: t.field({
      type: [DirectResult],
      nullable: {
        items: true,
        list: false,
      },
      itemErrors: {},
      resolve: () => {
        return [
          {
            id: 123,
          },
          new Error('Boom'),
        ];
      },
    }),
    itemErrorsDirectResult: t.field({
      type: [DirectResult],
      nullable: {
        items: true,
        list: false,
      },
      itemErrors: {
        directResult: true,
      },
      resolve: () => {
        return [
          {
            id: 123,
          },
          new Error('Boom'),
        ];
      },
    }),
    itemErrorsWithFieldErrors: t.field({
      type: [DirectResult],
      nullable: {
        items: true,
        list: false,
      },
      args: {
        shouldThrow: t.arg.boolean(),
      },
      errors: {},
      itemErrors: {},
      resolve: (_root, args) => {
        if (args.shouldThrow) {
          throw new Error('Boom');
        }

        return [
          {
            id: 123,
          },
          new Error('Boom'),
        ];
      },
    }),
    asyncItemErrors: t.field({
      type: [DirectResult],
      nullable: {
        items: false,
        list: true,
      },
      errors: {},
      itemErrors: {},
      args: {
        error: t.arg.boolean(),
      },
      resolve: (_, args) => {
        const gen = async function* () {
          yield {
            id: 123,
          };
          await new Promise((resolve) => setTimeout(resolve, 10));
          yield new Error('Boom');
          await new Promise((resolve) => setTimeout(resolve, 10));
          yield {
            id: 456,
          };
          throw new Error('Boom');
        };

        if (args.error) {
          throw new Error('Boom');
        }

        return gen();
      },
    }),
  }));

  const CreateUserSuccess = builder
    .objectRef<{ id: string; name: string }>('CreateUserSuccess')
    .implement({
      isTypeOf: (obj) =>
        typeof obj === 'object' &&
        obj !== null &&
        !(obj instanceof Error) &&
        'name' in obj &&
        !('updatedFields' in obj),
      fields: (t) => ({
        id: t.exposeString('id'),
        name: t.exposeString('name'),
      }),
    });

  const UpdateUserSuccess = builder
    .objectRef<{ id: string; updatedFields: string[] }>('UpdateUserSuccess')
    .implement({
      isTypeOf: (obj) => typeof obj === 'object' && obj !== null && 'updatedFields' in obj,
      fields: (t) => ({
        id: t.exposeString('id'),
        updatedFields: t.exposeStringList('updatedFields'),
      }),
    });

  class ValidationError extends Error {
    field: string;
    constructor(message: string, field: string) {
      super(message);
      this.field = field;
      this.name = 'ValidationError';
    }
  }

  class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }

  builder.objectType(ValidationError, {
    name: 'ValidationError',
    interfaces: [ErrorInterface],
    isTypeOf: (value) => value instanceof ValidationError,
    fields: (t) => ({
      field: t.exposeString('field'),
    }),
  });

  builder.objectType(NotFoundError, {
    name: 'NotFoundError',
    interfaces: [ErrorInterface],
    isTypeOf: (value) => value instanceof NotFoundError,
    fields: () => ({}),
  });

  builder.mutationFields((t) => ({
    testErrorUnion: t.errorUnionField({
      types: [CreateUserSuccess, UpdateUserSuccess, ValidationError, NotFoundError],
      args: {
        action: t.arg.string({ required: true }),
        shouldFail: t.arg.string(),
      },
      resolve: (_root, args) => {
        if (args.shouldFail === 'validation') {
          return new ValidationError('Invalid input', 'name');
        }
        if (args.shouldFail === 'notFound') {
          return new NotFoundError('User not found');
        }
        if (args.action === 'create') {
          return { id: '123', name: 'New User' };
        }
        return { id: '123', updatedFields: ['name', 'email'] };
      },
    }),
    testErrorUnionThrow: t.errorUnionField({
      types: [CreateUserSuccess, ValidationError, NotFoundError],
      args: {
        shouldFail: t.arg.string({ required: true }),
      },
      resolve: (_root, args) => {
        if (args.shouldFail === 'validation') {
          throw new ValidationError('Thrown validation error', 'email');
        }
        if (args.shouldFail === 'notFound') {
          throw new NotFoundError('Thrown not found error');
        }
        return { id: '456', name: 'Thrown Success' };
      },
    }),
    testErrorUnionList: t.errorUnionListField({
      types: [CreateUserSuccess, ValidationError],
      args: {
        includeError: t.arg.boolean({ required: true }),
      },
      resolve: (_root, args) => {
        return [
          { id: '1', name: 'User 1' },
          ...(args.includeError ? [new ValidationError('List error', 'item')] : []),
          { id: '2', name: 'User 2' },
        ];
      },
    }),
    testErrorUnionListIterable: t.errorUnionListField({
      types: [CreateUserSuccess, ValidationError],
      args: {
        includeError: t.arg.boolean({ required: true }),
      },
      resolve: (_root, args) => {
        function* gen() {
          yield { id: '1', name: 'User 1' };
          if (args.includeError) {
            yield new ValidationError('Iterable error', 'item');
          }
          yield { id: '2', name: 'User 2' };
        }
        return gen();
      },
    }),
    testErrorUnionListAsyncIterable: t.errorUnionListField({
      types: [CreateUserSuccess, ValidationError],
      args: {
        includeError: t.arg.boolean({ required: true }),
        throwError: t.arg.boolean({ required: true }),
      },
      resolve: (_root, args) => {
        async function* gen() {
          yield await Promise.resolve({ id: '1', name: 'User 1' });
          if (args.includeError) {
            yield new ValidationError('Async iterable error', 'item');
          }
          yield { id: '2', name: 'User 2' };
          if (args.throwError) {
            throw new ValidationError('Thrown from async iterable', 'thrown');
          }
        }
        return gen();
      },
    }),
    testErrorUnionListThrow: t.errorUnionListField({
      types: [CreateUserSuccess, ValidationError],
      args: {
        shouldThrow: t.arg.boolean({ required: true }),
      },
      resolve: (_root, args) => {
        if (args.shouldThrow) {
          throw new ValidationError('Thrown from list resolver', 'thrown');
        }
        return [{ id: '1', name: 'User 1' }];
      },
    }),
    testErrorUnionCustomResolveType: t.errorUnionField({
      types: [CreateUserSuccess, ValidationError, NotFoundError],
      union: {
        resolveType: (parent) => {
          if (parent instanceof ValidationError) {
            return 'ValidationError';
          }
          if (parent instanceof NotFoundError) {
            return 'NotFoundError';
          }
          return 'CreateUserSuccess';
        },
      },
      args: {
        type: t.arg.string({ required: true }),
      },
      resolve: (_root, args) => {
        if (args.type === 'validation') {
          return new ValidationError('Custom resolve type validation', 'custom');
        }
        if (args.type === 'notFound') {
          return new NotFoundError('Custom resolve type not found');
        }
        return { id: '789', name: 'Custom Resolve Type User' };
      },
    }),
    testErrorUnionListCustomResolveType: t.errorUnionListField({
      types: [CreateUserSuccess, ValidationError],
      union: {
        resolveType: (parent) => {
          if (parent instanceof ValidationError) {
            return 'ValidationError';
          }
          return 'CreateUserSuccess';
        },
      },
      args: {
        includeError: t.arg.boolean({ required: true }),
      },
      resolve: (_root, args) => {
        const results: Array<ValidationError | { id: string; name: string }> = [
          { id: '1', name: 'User 1' },
          ...(args.includeError ? [new ValidationError('Custom list error', 'customItem')] : []),
          { id: '2', name: 'User 2' },
        ];
        return results;
      },
    }),
    testErrorUnionThrowNonError: t.errorUnionField({
      types: [CreateUserSuccess, ValidationError],
      resolve: () => {
        throw 'string error';
      },
    }),
    testErrorUnionNullable: t.errorUnionField({
      types: [CreateUserSuccess, ValidationError],
      nullable: true,
      args: {
        returnNull: t.arg.boolean({ required: true }),
      },
      resolve: (_root, args) => {
        if (args.returnNull) {
          return null;
        }
        return { id: '123', name: 'Nullable Test User' };
      },
    }),
    testErrorUnionWithDefaultTypes: t.errorUnionField({
      types: [CreateUserSuccess],
      args: {
        shouldThrowDefault: t.arg.boolean({ required: true }),
      },
      resolve: (_root, args) => {
        if (args.shouldThrowDefault) {
          throw new Error('Default error type from builder');
        }
        return { id: '456', name: 'Default Types Test User' };
      },
    }),
    testErrorUnionListWithErrors: t.errorUnionListField({
      types: [CreateUserSuccess, ValidationError],
      errors: { types: [NotFoundError] },
      args: {
        throwNotFound: t.arg.boolean(),
        includeItemError: t.arg.boolean({ required: true }),
      },
      resolve: (_root, args) => {
        if (args.throwNotFound) {
          throw new NotFoundError('List resolver threw NotFound');
        }
        return [
          { id: '1', name: 'User 1' },
          ...(args.includeItemError ? [new ValidationError('Item error', 'item')] : []),
          { id: '2', name: 'User 2' },
        ];
      },
    }),
  }));

  return builder.toSchema();
}
