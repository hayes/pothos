import { ZodError, type ZodFormattedError } from 'zod';
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

          // biome-ignore lint/suspicious/useAwait: <explanation>
          async function* gen() {
            yield 1;
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

  function flattenErrors(
    error: ZodFormattedError<unknown>,
    path: string[],
  ): { path: string[]; message: string }[] {
    const errors = error._errors.map((message) => ({
      path,
      message,
    }));

    Object.keys(error).forEach((key) => {
      if (key !== '_errors') {
        errors.push(
          ...flattenErrors((error as Record<string, unknown>)[key] as ZodFormattedError<unknown>, [
            ...path,
            key,
          ]),
        );
      }
    });

    return errors;
  }

  const ZodFieldError = builder
    .objectRef<{
      message: string;
      path: string[];
    }>('ZodFieldError')
    .implement({
      fields: (t) => ({
        message: t.exposeString('message'),
        path: t.exposeStringList('path'),
      }),
    });

  builder.objectType(ZodError, {
    name: 'ZodError',
    interfaces: [ErrorInterface],
    fields: (t) => ({
      fieldErrors: t.field({
        type: [ZodFieldError],
        resolve: (err) => flattenErrors(err.format(), []),
      }),
    }),
  });

  builder.queryField('fieldWIthValidation', (t) =>
    t.boolean({
      errors: {
        types: [ZodError],
        dataField: { name: 'result' },
      },
      args: {
        string: t.arg.string({
          validate: {
            type: 'string',
            minLength: 3,
          },
        }),
      },
      resolve: () => true,
    }),
  );

  builder.queryField('validation2', (t) =>
    t.boolean({
      errors: {
        types: [ZodError],
        dataField: { name: 'result' },
      },
      args: {
        stringList: t.arg.stringList({
          validate: {
            items: {
              type: 'string',
              minLength: 3,
            },
          },
        }),
      },
      validate: (_err) => false,
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
        }

        if (args.error) {
          throw new Error('Boom');
        }

        return gen();
      },
    }),
  }));

  return builder.toSchema();
}
