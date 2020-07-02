export class ForbiddenError extends Error {
  code = 'FORBIDDEN';
  constructor(message: string) {
    super(message);

    Object.defineProperty(this, 'name', { value: 'ForbiddenError' });
  }
}
