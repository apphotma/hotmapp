import { shouldAdvanceToDelivered } from '../functions/message-status-utils.cjs';

describe('delivery receipt fallback helper', () => {
  test('advances sent messages to delivered when they are still pending or sent', () => {
    expect(shouldAdvanceToDelivered('pending')).toBe(true);
    expect(shouldAdvanceToDelivered('sent')).toBe(true);
    expect(shouldAdvanceToDelivered('delivered')).toBe(false);
    expect(shouldAdvanceToDelivered('read')).toBe(false);
  });
});
