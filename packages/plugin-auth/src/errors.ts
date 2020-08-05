export class ForbiddenError extends Error {
  code = 'FORBIDDEN';

  constructor(message: string) {
    super(message);

    this.name = 'ForbiddenError';

    Object.defineProperty(this, 'name', { value: 'ForbiddenError' });
  }
}
