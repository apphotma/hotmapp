import { resolveActiveSellerId } from '../public/shop-seller-utils.js';

describe('resolveActiveSellerId', () => {
  it('prefers the active chat uid when one is available', () => {
    expect(resolveActiveSellerId({ activeChatUid: 'seller-1', currentUserId: 'me' })).toBe('seller-1');
  });

  it('falls back to the active conversation element uid when the chat state is not yet updated', () => {
    expect(resolveActiveSellerId({ activeChatUid: null, activeConversationUid: 'seller-2', currentUserId: 'me' })).toBe('seller-2');
  });

  it('uses a known shop seller id when chat state is not ready', () => {
    expect(resolveActiveSellerId({ activeChatUid: null, currentUserId: null, shopSellerId: 'seller-3' })).toBe('seller-3');
  });

  it('uses the current user uid as the last fallback', () => {
    expect(resolveActiveSellerId({ activeChatUid: null, currentUserId: 'me' })).toBe('me');
  });
});
