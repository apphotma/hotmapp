import { describe, it, expect } from '@jest/globals';

// Test isolation resolution logic matching public/chat.js
export const resolveChatId = (currentUserId, targetChatUid) => {
    if (!currentUserId || !targetChatUid) return null;
    return targetChatUid.startsWith('group_')
        ? targetChatUid
        : [currentUserId, targetChatUid].sort().join('_');
};

export const shouldDisplayMessageInActiveChat = (msg, activeChatId) => {
    if (!msg || !activeChatId) return false;
    // If message has an explicit chatId, it must match the active chat
    if (msg.chatId && msg.chatId !== activeChatId) {
        return false;
    }
    return true;
};

describe('Chat isolation and media upload targeting', () => {
    const userA = 'user_111';
    const userB = 'user_222';
    const userC = 'user_333';
    const groupChat = 'group_project_456';

    it('correctly resolves 1:1 chat IDs alphabetically regardless of sender/recipient order', () => {
        const chatId1 = resolveChatId(userA, userB);
        const chatId2 = resolveChatId(userB, userA);
        expect(chatId1).toBe('user_111_user_222');
        expect(chatId2).toBe('user_111_user_222');
    });

    it('correctly resolves group chat IDs', () => {
        const chatId = resolveChatId(userA, groupChat);
        expect(chatId).toBe('group_project_456');
    });

    it('allows message to display when message chatId matches active chatId', () => {
        const activeChatId = resolveChatId(userA, userB);
        const voiceNoteMessage = {
            id: 'msg_voice_1',
            chatId: activeChatId,
            type: 'audio',
            status: 'sending'
        };

        expect(shouldDisplayMessageInActiveChat(voiceNoteMessage, activeChatId)).toBe(true);
    });

    it('blocks message from displaying when user switched to another 1:1 conversation', () => {
        const chatWithB = resolveChatId(userA, userB);
        const chatWithC = resolveChatId(userA, userC);

        // Upload was started for User B
        const voiceNoteForB = {
            id: 'msg_voice_1',
            chatId: chatWithB,
            type: 'audio',
            status: 'sending'
        };

        // User is currently viewing Chat with User C
        expect(shouldDisplayMessageInActiveChat(voiceNoteForB, chatWithC)).toBe(false);
    });

    it('blocks message from displaying when user switched to a group chat', () => {
        const chatWithB = resolveChatId(userA, userB);

        const voiceNoteForB = {
            id: 'msg_voice_1',
            chatId: chatWithB,
            type: 'audio',
            status: 'sending'
        };

        // User is currently viewing a group chat
        expect(shouldDisplayMessageInActiveChat(voiceNoteForB, groupChat)).toBe(false);
    });
});
