# Tracing Plugin

This plugin adds hooks for tracing and logging resolver invocations. It also comes with a few
additional packages for integrating with various tracing providers including opentelemetry, New
Relic and Sentry.

## Usage

### Install

```bash
yarn add @pothos/plugin-tracing
```

### Setup

```typescript
import TracingPlugin, { wrapResolver, isRootField } from '@pothos/plugin-tracing';

const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
  tracing: {
    // Enable tracing for rootFields by default, other fields need to opt in
    default: (config) => isRootField(config),
    // Log resolver execution duration
    wrap: (resolver, options, config) =>
      wrapResolver(resolver, (error, duration) => {
        console.log(`Executed resolver ${config.parentType}.${config.name} in ${duration}ms`);
      }),
  },
});
```

### Overview

The Tracing plugin is designed to have very limited overhead, and uses a modular approach to cover a
wide variety of use cases.

The tracing plugin comes with a number of utility functions for implementing common patterns, and a
couple of provider specific modules that can be installed separately (described in more detail
below).

The primary interface to the tracing plugin consists of 3 parts:

1. A new `tracing` option is added to each field, for enabling or configuring tracing for that field
2. The `tracing.default` which is used as a fallback for any field that does not explicitly set its
   `tracing` options.
3. The `tracing.wrap` function, which takes a resolver, the tracing option for a field, and a field
   configuration object, and should return a wrapped/traced version of the resolver.

### Enabling tracing for a field

Enabling tracing on a field is as simple as setting the tracing option to `true`

```ts
builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: { name: t.arg.string() },
      // enable tracing
      tracing: true,
      resolve: (parent, { name }) => `hello, ${name || 'World'}`,
    }),
  }),
});
```

#### Custom tracing options

For more advanced tracing setups, you may want to allow fields to provide additional tracing
options. You can do this by customizing the `Tracing` generic in the builder.

```ts
import TracingPlugin, { wrapResolver, isRootField } from '@pothos/plugin-tracing';

export const builder = new SchemaBuilder<{
  // the `tracing` option can now be a boolean, or an object with a formatMessage function
  Tracing: boolean | { formatMessage: (duration: number) => string };
}>({
  plugins: [TracingPlugin],
  tracing: {
    // Using custom options in your tracer will be described below
    ...
  },
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: { name: t.arg.string() },
      // We can now use custom options when configuring tracing
      tracing: { formatMessage: (duration) => `It took ${duration}ms to say hello` },
      resolve: (parent, { name }) => `hello, ${name || 'World'}`,
    }),
  }),
});
```

### Enabling tracing by default

In most applications you won't want to configure tracing for each field. Instead you can use the
`tracing.default` to enable tracing for specific types of fields.

```ts
import TracingPlugin, { wrapResolver, isRootField } from '@pothos/plugin-tracing';

export const builder = new SchemaBuilder<{
  Tracing: boolean | { formatMessage: (duration: number) => string };
}>({
  plugins: [TracingPlugin],
  tracing: {
    // Here we enable tracing for root fields
    default: (config) => isRootField(config)
    wrap: (resolve) => resolve, // actual tracing wrappers will be described below
  },
});
```

There are a number of utility functions for detecting certain types of fields. For most applications
tracing every resolver will add significant overhead with very little benefit. The following
utilities exported by the tracing plugin can be used to determine which fields should have tracing
enabled by default.

- `isRootField`: Returns true for fields of the `Query`, `Mutation`, and `Subscription` types
- `isScalarField`: Returns true for fields that return Scalars, or lists of scalars
- `isEnumField`: Returns true for fields that return an Enum or list of Enums
- `isExposedField`: Returns true for fields defined with the `t.expose*` field builder methods, or
  fields that use the `defaultFieldResolver`.

### Implementing a tracer

Tracers work by wrapping the execution of resolver calls. The `tracing.wrap` function keeps this
process as minimal as possible by simply providing the resolver for a field, and expecting a wrapped
version of the resolver to be returned. Resolvers can throw errors or return promises, and correctly
handling these edge cases can be a little complicated so the tracing plugin also comes with some
helpers utilities to simplify this process.

`tracing.wrap` takes 3 arguments:

1. `resolver`: the resolver for a field
2. `options`: the tracing options for the field (set either on the field, or returned by
   `tracing.default`).
3. `fieldConfig`: A config object that describes the field being wrapped

```ts
export const builder = new SchemaBuilder<{
  Tracing: boolean | { formatMessage: (duration: number) => string };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver, options, config) =>
      wrapResolver(resolver, (error, duration) => {
        const message =
          typeof options === 'object'
            ? options.formatMessage(duration)
            : `Executed resolver ${config.parentType}.${config.name} in ${duration}ms`;

        console.log(message);
      }),
  },
});
```

The `wrapResolver` utility takes a resolver, and a `onEnd` callback, and returns a wrapped version
of the resolver that will call the callback with an error (or null) and the duration the resolver
took to complete.

The `runFunction` helper is similar, but rather than wrapping a resolver, will immediately execute a
function with no arguments. This can be useful for more complex use cases where you need access to
other resolver arguments, or want to add your own logic before the resolver begins executing.

```ts
export const builder = new SchemaBuilder<{
  Tracing: boolean | { formatMessage: (duration: number) => string };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config) || (!isScalarField(config) && !isEnumField(config)),
    wrap: (resolver, options) => (source, args, ctx, info) => {
      doSomethingFirst(args);

      return runFunction(
        () => resolver(source, args, ctx, info),
        (error, duration) => {
          console.log(
            `Executed resolver for ${info.parentType}.${info.fieldName} in ${duration}ms`,
          );
        },
      );
    },
  },
});
```

### Using resolver arguments in tracers

When defining tracing options for a field, you may want to pass some resolver args to your tracing
logic.

The follow example shows how arguments might be passed to a tracer to be attached to a span:

```ts
// Create a simple tracer that creates spans, and adds custom attributes if they are provided
export const builder = new SchemaBuilder<{
  Tracing: false | { attributes?: Record<string, unknown> };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => {
      if (isRootField(config)) {
        return {};
      }

      return false;
    },
    // The `tracing` options are passed as the second argument for wrap
    wrap: (resolver, options, fieldConfig) => (source, args, ctx, info) => {
      const span = tracer.createSpan();

      if (options.attributes) {
        span.setAttributes();
      }
      return runFunction(
        () => resolver(source, args, ctx, info),
        () => {
          span.end();
        },
      );
    },
  },
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: { name: t.arg.string() },
      // Pass this fields args as a custom attribute
      tracing: (root, args) => ({ attributes: { args } }),
      resolve: (root, { name }) => `hello, ${name || 'World'}`,
    }),
  }),
});
```

The `default` option can also return a function to access resolver arguments:

```ts
// Create a simple tracer that creates spans, and adds custom attributes if they are provided
export const builder = new SchemaBuilder<{
  Tracing: false | { attributes?: Record<string, unknown> };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => {
      if (isRootField(config)) {
        // For all root fields, add arguments as a custom attribute
        return (root, args) => ({ attributes: { args }});
      }

      // disable tracing for exposed fields
      if (isExposedField(config)) {
        return false
      }

      // Enable tracing, but don't add any attributes
      return {}
    },
    wrap: ...,
});
```

It is important to know that if a field uses a function to return its tracing option (either
directly on the field definition, or as a default) the behavior of the `wrap` function changes
slightly.

By default `wrap` is called for each field when the schema is built. For fields that return their
tracing option via a function, wrap will be called whenever the field is executed because the
tracing options are dependent on the resolver arguments.

For many uses cases this does not add a lot of overhead, but as a rule of thumb, it is always more
efficient to use tracing options that don't depend on the resolver value.

The above example could be re-designed slightly to improve tracing performance:

```ts
// Create a simple tracer that creates spans, and adds custom attributes if they are provided
export const builder = new SchemaBuilder<{
  Tracing: false | { includeArgs?: boolean };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => {
      if (isRootField(config)) {
        // For all root fields, add arguments as a custom attribute
        return { includeArgs: true }
      }

      return false
    },
    // Wrap is now only called once for each field at build time
    // since we don't depend on args to generate the tracing options
    wrap: (resolver, options, fieldConfig) => (source, args, ctx, info) => {
      const span = tracer.createSpan();

      if (options.includeArgs) {
        span.setAttributes({ args });
      }

      return runFunction(
        () => resolver(source, args, ctx, info),
        () => {
          span.end();
        },
      );
    },,
});
```

## Tracing integrations

### Opentelemetry

#### install

```bash
yarn add @pothos/tracing-opentelemetry @opentelemetry/semantic-conventions @opentelemetry/api
```

#### Basic usage

```ts
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isRootField } from '@pothos/plugin-tracing';
import { createOpenTelemetryWrapper } from '@pothos/tracing-opentelemetry';
import { tracer } from './tracer';

const createSpan = createOpenTelemetryWrapper(tracer, {
  includeSource: true,
});

export const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver, options) => createSpan(resolver, options),
  },
});
```

#### options

- `includeArgs`: default: `false`
- `includeSource`: default: `false`
- `ignoreError`: default: `false`
- `onSpan`: `(span, tracingOptions, parent, args, context, info) => void`

#### Adding custom attributes to spans

```ts
import { AttributeValue } from '@opentelemetry/api';
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isRootField } from '@pothos/plugin-tracing';
import { createOpenTelemetryWrapper } from '@pothos/tracing-opentelemetry';
import { tracer } from './tracer';

type TracingOptions = boolean | { attributes?: Record<string, AttributeValue> };

const createSpan = createOpenTelemetryWrapper<TracingOptions>(tracer, {
  includeSource: true,
  onSpan: (span, options) => {
    if (typeof options === 'object' && options.attributes) {
      span.setAttributes(options.attributes);
    }
  },
});

export const builder = new SchemaBuilder<{
  Tracing: TracingOptions;
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver, options) => createSpan(resolver, options),
  },
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: { name: t.arg.string() },
      tracing: (parent, { name }) => ({ attributes: { name } }),
      resolve: (parent, { name }) => `hello, ${name || 'World'}`,
    }),
  }),
});
```

#### Instrumenting the execution phase

The tracing plugin for Pothos only adds spans for resolvers. You may also want to capture additional
information about other parts of the graphql execution process.

This example uses GraphQL Yoga, by providing a custom envelop plugin that wraps the execution phase.
Many graphql server implementations have ways to wrap or replace the execution call, but will look
slightly different.

```ts
// eslint-disable-next-line simple-import-sort/imports
import { tracer } from './tracer'; // Tracer should be imported first if it handles additional instrumentation
import { print } from 'graphql';
import { createYoga, Plugin } from 'graphql-yoga';
import { createServer } from 'node:http';
import { AttributeNames, SpanNames } from '@pothos/tracing-opentelemetry';
import { schema } from './schema';

const tracingPlugin: Plugin = {
  onExecute: ({ setExecuteFn, executeFn }) => {
    setExecuteFn((options) =>
      tracer.startActiveSpan(
        SpanNames.EXECUTE,
        {
          attributes: {
            [AttributeNames.OPERATION_NAME]: options.operationName ?? undefined,
            [AttributeNames.SOURCE]: print(options.document),
          },
        },
        async (span) => {
          try {
            const result = await executeFn(options);

            return result;
          } catch (error) {
            span.recordException(error as Error);
            throw error;
          } finally {
            span.end();
          }
        },
      ),
    );
  },
};

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
});

const server = createServer(yoga);

server.listen(3000);
```

Envelop also provides its own opentelemetry plugin which can be used instead of a custom plugin like
the one shown above. The biggest drawback to this is the current version of `@envelop/opentelemetry`
does not track the parent/child relations of spans it creates.

```ts
import { provider } from './tracer'; // Tracer should be imported first if it handles additional instrumentation
import { useOpenTelemetry } from '@envelop/opentelemetry';
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

const yoga = createYoga({
  schema,
  plugins: [
    useOpenTelemetry(
      {
        // Disabling envelops resolver tracing is important to avoid duplicate spans
        resolvers: false,
        variables: false,
        result: false,
      },
      provider,
    ),
  ],
});

const server = createServer(yoga);

server.listen(3000);
```

#### Setting up a tracer

The following setup creates a very simple opentelemetry tracer that will log spans to the console.
Real applications will need to define exporters that match the opentelemetry backend you are using.

```ts
import { diag, DiagConsoleLogger, DiagLogLevel, trace } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

export const provider = new NodeTracerProvider({});
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.register();

registerInstrumentations({
  // Automatically create spans for http requests
  instrumentations: [new HttpInstrumentation({})],
});

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

export const tracer = trace.getTracer('graphql');
```

### Datadog

Datadog supports opentelemetry. To report traces to datadog, you will need to instrument your
application with an opentelemetry tracer, and configure your datadog agent to collect open telemetry
traces.

#### Creating a tracer that exports to datadog

```ts
import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'Pothos-OTEL-example',
  }),
});

provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new OTLPTraceExporter({
      // optionally set the opentelemetry collector endpoint if you are not using the default port
      // url: 'http://host:port',
    }),
  ),
);

provider.register();

registerInstrumentations({
  instrumentations: [new HttpInstrumentation({})],
});

export const tracer = trace.getTracer('graphql');
```

#### Configuring the datadog agent to collect open telemetry

Add the following to your datadog agent configuration

```yaml
otlp_config:
  receiver:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
```

### New Relic

#### install

```bash
yarn add @pothos/tracing-newrelic newrelic @types/newrelic
```

#### Basic usage

```ts
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isRootField } from '@pothos/plugin-tracing';
import { createNewrelicWrapper } from '@pothos/tracing-newrelic';

const wrapResolver = createNewrelicWrapper({
  includeArgs: true,
  includeSource: true,
});

export const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver) => wrapResolver(resolver),
  },
});
```

#### options

- `includeArgs`: default: `false`
- `includeSource`: default: `false`

#### Instrumenting the execution phase

The tracing plugin for Pothos only adds spans for resolvers. You may also want to capture additional
information about other parts of the graphql execution process.

This example uses GraphQL Yoga, by providing a custom envelop plugin that wraps the execution phase.
Many graphql server implementations have ways to wrap or replace the execution call, but will look
slightly different.

```ts
// eslint-disable-next-line simple-import-sort/imports
import newrelic from 'newrelic'; // newrelic must be imported first
import { print } from 'graphql';
import { createYoga, Plugin } from 'graphql-yoga';
import { createServer } from 'node:http';
import { AttributeNames } from '@pothos/tracing-newrelic';
import { schema } from './schema';

const tracingPlugin: Plugin = {
  onExecute: ({ args }) => {
    newrelic.addCustomAttributes({
      [AttributeNames.OPERATION_NAME]: args.operationName ?? '<unnamed operation>',
      [AttributeNames.SOURCE]: print(args.document),
    });
  },
};

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
});

const server = createServer(yoga);

server.listen(3000);
```

### Using the envelop newrelic plugin

Envelop has it's own plugin for newrelic that can be combined with the tracing plugin:

```ts
import { useNewRelic } from '@envelop/newrelic';
import { createServer } from 'graphql-yoga';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

const yoga = createYoga({
  schema,
  plugins: [
    useNewRelic({
      // Disable resolver tracking since this is covered by the pothos tracing plugin
      // If all resolvers are being traced, you could use the New Relic envelop plug instead of the pothos tracing plugin
      trackResolvers: false,
    }),
  ],
});

const server = createServer(yoga);

server.listen(3000);
```

### Sentry

#### install

```bash
yarn add @pothos/tracing-sentry @sentry/node @sentry/tracing
```

#### Basic usage

```ts
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isRootField } from '@pothos/plugin-tracing';
import { createSentryWrapper } from '@pothos/tracing-sentry';

const traceResolver = createSentryWrapper({
  includeArgs: true,
  includeSource: true,
});

export const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver, options) => traceResolver(resolver, options),
  },
});
```

#### options

- `includeArgs`: default: `false`
- `includeSource`: default: `false`
- `ignoreError`: default: `false`

#### Instrumenting the execution phase

The tracing plugin for Pothos only adds spans for resolvers. You may also want to capture additional
information about other parts of the graphql execution process.

This example uses GraphQL Yoga, by providing a custom envelop plugin that wraps the execution phase.
Many graphql server implementations have ways to wrap or replace the execution call, but will look
slightly different.

```ts
import '@sentry/tracing';
import { print } from 'graphql';
import { createYoga, Plugin } from 'graphql-yoga';
import { createServer } from 'node:http';
import { AttributeNames } from '@pothos/tracing-sentry';
import * as Sentry from '@sentry/node';
import { schema } from './schema';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1,
});

const tracingPlugin: Plugin = {
  onExecute: ({ setExecuteFn, executeFn }) => {
    setExecuteFn(async (options) => {
      const transaction = Sentry.startTransaction({
        op: 'graphql.execute',
        name: options.operationName ?? '<unnamed operation>',
        tags: {
          [AttributeNames.OPERATION_NAME]: options.operationName ?? undefined,
          [AttributeNames.SOURCE]: print(options.document),
        },
        data: {
          [AttributeNames.SOURCE]: print(options.document),
        },
      });
      Sentry.getCurrentHub().configureScope((scope) => scope.setSpan(transaction));

      try {
        const result = await executeFn(options);

        return result;
      } finally {
        transaction.finish();
      }
    });
  },
};

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
});

const server = createServer(yoga);

server.listen(3000);
```

### Using the envelop sentry plugin

Envelop has it's own plugin for Sentry that can be combined with the tracing plugin:

```ts
import { useSentry } from '@envelop/sentry';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import { schema } from './schema';

const yoga = createYoga({
  schema,
  plugins: [
    useSentry({
      // Disable resolver tracking since this is covered by the pothos tracing plugin
      // If all resolvers are being traced, you could use the Sentry envelop plug instead of the pothos tracing plugin
      trackResolvers: false,
    }),
  ],
});

const server = createServer(yoga);

server.listen(3000);
```

### AWS XRay

#### install

```bash
yarn add @pothos/tracing-xray aws-xray-sdk-core
```

#### Basic usage

```ts
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isEnumField, isRootField, isScalarField } from '@pothos/plugin-tracing';
import { createXRayWrapper } from '@pothos/tracing-xray';

const traceResolver = createXRayWrapper({
  includeArgs: true,
  includeSource: true,
});

export const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config) || (!isScalarField(config) && !isEnumField(config)),
    wrap: (resolver, options) => traceResolver(resolver, options),
  },
});
```

#### options

- `includeArgs`: default: `false`
- `includeSource`: default: `false`

#### Instrumenting the execution phase

The tracing plugin for Pothos only adds spans for resolvers. You may also want to capture additional
information about other parts of the graphql execution process.

This example uses GraphQL Yoga, by providing a custom envelop plugin that wraps the execution phase.
Many graphql server implementations have ways to wrap or replace the execution call, but will look
slightly different.

```ts
import AWSXRay from 'aws-xray-sdk-core';
import { print } from 'graphql';
import { createYoga, Plugin } from 'graphql-yoga';
import { createServer } from 'node:http';
import { AttributeNames, SpanNames } from '@pothos/tracing-xray';
import { schema } from './schema';

const tracingPlugin: Plugin = {
  onExecute: ({ setExecuteFn, executeFn }) => {
    setExecuteFn(async (options) => {
      const parent = new AWSXRay.Segment('parent');

      return AWSXRay.getNamespace().runAndReturn(() => {
        AWSXRay.setSegment(parent);

        return AWSXRay.captureAsyncFunc(
          SpanNames.EXECUTE,
          (segment) => {
            if (segment) {
              segment.addAttribute(
                AttributeNames.OPERATION_NAME,
                options.operationName ?? '<unnamed operation>',
              );
              segment.addAttribute(AttributeNames.SOURCE, print(options.document));
            }

            return executeFn(options);
          },
          parent,
        );
      });
    });
  },
};

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
});

const server = createServer(yoga);

server.listen(3000);
```
