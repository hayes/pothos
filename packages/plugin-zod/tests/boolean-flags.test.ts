import { createZodSchema } from '../src';

describe('boolean constraint flags', () => {
  it('treats a false tuple flag like a bare false flag on numbers', () => {
    const bare = createZodSchema({ type: 'number', positive: false }, true);
    const tuple = createZodSchema(
      { type: 'number', positive: [false, { message: 'disabled' }] },
      true,
    );

    expect(bare.safeParse(-1).success).toBe(true);
    expect(tuple.safeParse(-1).success).toBe(true);
  });

  it('treats a false tuple flag like a bare false flag on strings', () => {
    const bare = createZodSchema({ type: 'string', email: false }, true);
    const tuple = createZodSchema(
      { type: 'string', email: [false, { message: 'disabled' }] },
      true,
    );

    expect(bare.safeParse('not an email').success).toBe(true);
    expect(tuple.safeParse('not an email').success).toBe(true);
  });

  it('still enables constraints for a true tuple flag', () => {
    const validator = createZodSchema(
      { type: 'number', positive: [true, { message: 'must be positive' }] },
      true,
    );

    expect(validator.safeParse(-1).error?.issues[0].message).toBe('must be positive');
    expect(validator.safeParse(1).success).toBe(true);
  });
});
