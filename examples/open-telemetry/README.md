# Pothos Open Telemetry example

## Getting started

### 1. Run Zipkin in Docker

```bash
docker run -d -p 9411:9411 openzipkin/zipkin
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start server

```bash
pnpm start
```

### 4. Run a query

Open [http://localhost:4000/graphql](http://localhost:4000/graphql) and send this query:

```graphql
{
  fastHello: hello(delay: 10)
  slowHello: hello(delay: 1000)
}
```

### 5. Have a look into Zipkin

Open [http://localhost:9411](http://localhost:9411) in the browser.
