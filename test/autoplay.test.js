import { describe, it, expect } from '@jest/globals';

// Test implementation of consecutive voice note lookup matching public/chat.js
export const getNextConsecutiveVoiceNoteId = (currentMsgId, messageList = []) => {
    if (!currentMsgId || !Array.isArray(messageList) || messageList.length === 0) return null;

    const idx = messageList.findIndex(m => m.id === currentMsgId);
    if (idx === -1 || idx >= messageList.length - 1) return null;

    const nextMsg = messageList[idx + 1];
    if (nextMsg && !nextMsg.deleted && nextMsg.type === 'audio') {
        return nextMsg.id;
    }

    return null;
};

describe('WhatsApp-style Consecutive Voice Note Autoplay Tests', () => {
    it('returns the next voice note ID when two voice notes are consecutive', () => {
        const messages = [
            { id: 'vn_1', type: 'audio', deleted: false },
            { id: 'vn_2', type: 'audio', deleted: false },
            { id: 'vn_3', type: 'audio', deleted: false }
        ];

        expect(getNextConsecutiveVoiceNoteId('vn_1', messages)).toBe('vn_2');
        expect(getNextConsecutiveVoiceNoteId('vn_2', messages)).toBe('vn_3');
    });

    it('returns null when a text message intercepts two voice notes', () => {
        const messages = [
            { id: 'vn_1', type: 'audio', deleted: false },
            { id: 'text_interception', type: 'text', deleted: false, text: 'Hello!' },
            { id: 'vn_2', type: 'audio', deleted: false }
        ];

        // Autoplay should NOT jump over the text message
        expect(getNextConsecutiveVoiceNoteId('vn_1', messages)).toBe(null);
    });

    it('returns null when an image or media message intercepts two voice notes', () => {
        const messages = [
            { id: 'vn_1', type: 'audio', deleted: false },
            { id: 'img_interception', type: 'image', deleted: false, url: 'photo.jpg' },
            { id: 'vn_2', type: 'audio', deleted: false }
        ];

        expect(getNextConsecutiveVoiceNoteId('vn_1', messages)).toBe(null);
    });

    it('returns null when the voice note is at the end of the chat', () => {
        const messages = [
            { id: 'vn_1', type: 'audio', deleted: false },
            { id: 'vn_2', type: 'audio', deleted: false }
        ];

        expect(getNextConsecutiveVoiceNoteId('vn_2', messages)).toBe(null);
    });

    it('returns null if the next message is deleted', () => {
        const messages = [
            { id: 'vn_1', type: 'audio', deleted: false },
            { id: 'vn_deleted', type: 'audio', deleted: true },
            { id: 'vn_3', type: 'audio', deleted: false }
        ];

        expect(getNextConsecutiveVoiceNoteId('vn_1', messages)).toBe(null);
    });
});
