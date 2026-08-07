export const resolveActiveSellerId = ({ activeChatUid, activeConversationUid = null, currentUserId = null, shopSellerId = null } = {}) => {
  const rawActiveUid = activeChatUid || activeConversationUid || shopSellerId || currentUserId;
  if (!rawActiveUid || rawActiveUid === 'undefined' || rawActiveUid === 'null') {
    return currentUserId || null;
  }

  return String(rawActiveUid).trim();
};
