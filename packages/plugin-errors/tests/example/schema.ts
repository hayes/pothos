import { ZodError, ZodFormattedError } from 'zod';
import builder from './builder';

const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

builder.objectType(Error, {
  name: 'BaseError',
  isTypeOf: (obj) => obj instanceof Error,
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
  isTypeOf: (obj) => obj instanceof LengthError,
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
      resolve: (parent, { name }) => {
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
      resolve: (parent, { name }) => {
        if (name.length < 5) {
          throw new LengthError(5);
        }

        return `hello, ${name || 'World'}`;
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
  isTypeOf: (obj) => obj instanceof ExtendedError,
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
    resolve: (parent, args) => {
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
    resolve: (parent, args) => {
      if (args.throw === 'other') {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
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
    resolve: (parent, args) => {
      if (args.throw === 'other') {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
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
  // eslint-disable-next-line no-underscore-dangle
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
  isTypeOf: (obj) => obj instanceof ZodError,
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
    validate: (err) => false,
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
    resolve: (root, args) => {
      if (args.shouldThrow) {
        throw new Error('Boom');
      }

      return {};
    },
  }),
);

const schema = builder.toSchema({});

export default schema;
