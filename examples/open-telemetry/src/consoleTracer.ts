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
