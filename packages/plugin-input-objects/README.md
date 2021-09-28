# Input Object Plugin for GiraphQL

The Input Object Plugin provides a way to define input objects
for fields, following a standardised naming and structure.

## Usage

### Install

```bash
yarn add @giraphql/plugin-input-objects
```

### Setup

```typescript
import InputObjectsPlugin from '@giraphql/plugin-input-objects';
const builder = new SchemaBuilder({
  plugins: [InputObjectsPlugin],
});
```

### Example

```typescript
import SchemaBuilder from '@giraphql/core';
import InputObjectsPlugin from '@giraphql/plugin-input-objects';

const builder = new SchemaBuilder({
  plugins: [InputObjectsPlugin],
});

// TODO
```

## Limitations

TODO
