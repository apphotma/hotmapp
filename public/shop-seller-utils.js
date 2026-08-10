export const resolveActiveSellerId = ({ activeChatUid, activeConversationUid = null, currentUserId = null, shopSellerId = null } = {}) => {
  const rawActiveUid = shopSellerId || activeChatUid || activeConversationUid || currentUserId;
  if (!rawActiveUid || rawActiveUid === 'undefined' || rawActiveUid === 'null') {
    return currentUserId || null;
  }

  return String(rawActiveUid).trim();
};
