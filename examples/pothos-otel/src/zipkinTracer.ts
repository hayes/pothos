import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  trace,
} from '@opentelemetry/api'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin'
import { Plugin } from '@graphql-yoga/node'
import { AttributeNames, SpanNames } from '@pothos/tracing-opentelemetry'
import { print } from 'graphql'
import { AttributeValue } from '@opentelemetry/api'

export const provider = new NodeTracerProvider({})
provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new ZipkinExporter({
      serviceName: 'pothos-wroclaw',
    })
  )
)
provider.register()

registerInstrumentations({
  // Automatically create spans for http requests
  instrumentations: [new HttpInstrumentation({})],
})

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)

export const tracer = trace.getTracer('graphql')

export const tracingPlugin: Plugin = {
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
            const result = await executeFn(options)

            return result
          } catch (error) {
            span.recordException(error as Error)
            throw error
          } finally {
            span.end()
          }
        }
      )
    )
  },
}

export type TracingOptions =
  | boolean
  | { attributes?: Record<string, AttributeValue> }
