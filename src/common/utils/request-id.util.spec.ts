import { generateRequestId, isValidRequestId } from './request-id.util';

describe('request id generation', () => {
  it('generates unique ids', () => {
    const a = generateRequestId();
    const b = generateRequestId();
    expect(a).not.toBe(b);
    expect(isValidRequestId(a)).toBe(true);
  });

  it('rejects empty or oversized values', () => {
    expect(isValidRequestId('')).toBe(false);
    expect(isValidRequestId('a'.repeat(200))).toBe(false);
    expect(isValidRequestId('valid-request.id_1')).toBe(true);
  });
});
