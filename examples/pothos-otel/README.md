# Pothos Open Telemetry example

## Getting started

### 1. Run Zipkin in Docker

```bash
docker run -d -p 9411:9411 openzipkin/zipkin
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Start server

```bash
yarn start
```

### 4. Run a query

```graphql
{
  fastHello: hello(delay: 10)
  slowHello: hello(delay: 1000)
}
```

### 5. Have a look into Zipkin

Open [http://localhost:9411](http://localhost:9411) in the browser.
