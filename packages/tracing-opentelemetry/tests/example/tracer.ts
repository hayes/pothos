import { DiagConsoleLogger, DiagLogLevel, diag, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

export const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'Pothos-OTEL-example',
  }),
  spanProcessors: [
    process.env.DATADOG_EXPORT
      ? new SimpleSpanProcessor(new OTLPTraceExporter({}))
      : new SimpleSpanProcessor(new ConsoleSpanExporter()),
  ],
});

provider.register();

registerInstrumentations({
  instrumentations: [new HttpInstrumentation({})],
});

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

export const tracer = trace.getTracer('graphql');
