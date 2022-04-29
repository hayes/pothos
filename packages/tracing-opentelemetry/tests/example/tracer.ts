import { diag, DiagConsoleLogger, DiagLogLevel, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'Pothos-OTEL-example',
  }),
});

if (process.env.DATADOG_EXPORT) {
  provider.addSpanProcessor(new SimpleSpanProcessor(new OTLPTraceExporter({})));
} else {
  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
}

provider.register();

registerInstrumentations({
  instrumentations: [new HttpInstrumentation({})],
});

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

export const tracer = trace.getTracer('graphql');
