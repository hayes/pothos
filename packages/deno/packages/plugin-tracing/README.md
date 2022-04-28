# Tracing Plugin for Pothos

## Usage

### Install

```bash
yarn add @pothos/plugin-tracing
```

### Setup

```typescript
import SchemaBuilder from '@pothos/core';
import TracingPlugin from '@pothos/plugin-tracing';

const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
});
```
