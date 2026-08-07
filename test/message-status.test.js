import { getMessageStatusIcon, isMessagePending, mergeMessageStatus } from '../public/message-status.js';

describe('message status helpers', () => {
  it('returns a clock icon for pending messages', () => {
    expect(getMessageStatusIcon('pending')).toBe('fa-clock');
  });

  it('detects pending status correctly', () => {
    expect(isMessagePending('pending')).toBe(true);
    expect(isMessagePending('sent')).toBe(false);
  });

  it('preserves newer message statuses and does not regress to older ones', () => {
    expect(mergeMessageStatus('sent', 'delivered')).toBe('delivered');
    expect(mergeMessageStatus('delivered', 'read')).toBe('read');
    expect(mergeMessageStatus('read', 'delivered')).toBe('read');
    expect(mergeMessageStatus('delivered', 'sent')).toBe('delivered');
    expect(mergeMessageStatus('pending', 'sent')).toBe('sent');
    expect(mergeMessageStatus('sent', 'notified')).toBe('notified');
    expect(mergeMessageStatus('notified', 'sent')).toBe('notified');
  });

  it('uses a distinct icon for notified messages', () => {
    expect(getMessageStatusIcon('notified')).toBe('fa-paper-plane');
  });
});
