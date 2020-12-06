export class BadRequestError extends Error {
  code = 'BADREQUEST';

  constructor(message: string) {
    super(message);

    this.name = 'BadRequestError';

    Object.defineProperty(this, 'name', { value: 'BadRequest' });
  }
}
