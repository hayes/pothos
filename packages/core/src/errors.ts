/* eslint-disable max-classes-per-file */

export class PothosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PothosError';
  }
}

export class PothosSchemaError extends PothosError {
  constructor(message: string) {
    super(message);
    this.name = 'PothosSchemaError';
  }
}

export class PothosValidationError extends PothosError {
  constructor(message: string) {
    super(message);
    this.name = 'PothosValidationError';
  }
}
