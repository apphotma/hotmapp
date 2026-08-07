import { isEditableTextMessage } from '../public/utils.js';

describe('message editability helpers', () => {
  it('allows recent text messages from the current user', () => {
    const msg = { id: '1', senderId: 'me', type: 'text', timestamp: Date.now() - 1000 };
    expect(isEditableTextMessage(msg, 'me')).toBe(true);
  });

  it('rejects messages older than the edit window', () => {
    const msg = { id: '2', senderId: 'me', type: 'text', timestamp: Date.now() - 16 * 60 * 1000 };
    expect(isEditableTextMessage(msg, 'me')).toBe(false);
  });

  it('accepts recent text messages with ISO string timestamps', () => {
    const msg = { id: '2b', senderId: 'me', type: 'text', timestamp: new Date(Date.now() - 1000).toISOString() };
    expect(isEditableTextMessage(msg, 'me')).toBe(true);
  });

  it('accepts own text messages even when the timestamp is missing', () => {
    const msg = { id: '3', senderId: 'me', type: 'text', text: 'hello' };
    expect(isEditableTextMessage(msg, 'me')).toBe(true);
  });

  it('rejects messages from other users', () => {
    const msg = { id: '4', senderId: 'other', type: 'text', timestamp: Date.now() - 1000 };
    expect(isEditableTextMessage(msg, 'me')).toBe(false);
  });

  it('treats text-like payloads without a type as editable', () => {
    const msg = { id: '5', senderId: 'me', text: 'hello', timestamp: Date.now() - 1000 };
    expect(isEditableTextMessage(msg, 'me')).toBe(true);
  });
});
