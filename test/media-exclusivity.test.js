import { describe, it, expect, jest } from '@jest/globals';

// Test implementation of the media coordinator matching public/chat.js logic
class MediaCoordinator {
    constructor() {
        this.currentActiveMedia = null;
    }

    stopAllActiveMedia(exceptMedia = null) {
        if (this.currentActiveMedia && this.currentActiveMedia !== exceptMedia) {
            try {
                if (typeof this.currentActiveMedia.pause === 'function') {
                    this.currentActiveMedia.pause();
                }
            } catch (e) {
                console.warn('Error pausing active media:', e);
            }
            this.currentActiveMedia = null;
        }
    }

    registerActiveMedia(mediaController) {
        if (!mediaController) return;
        if (this.currentActiveMedia && this.currentActiveMedia !== mediaController) {
            this.stopAllActiveMedia(mediaController);
        }
        this.currentActiveMedia = mediaController;
    }

    getActiveMedia() {
        return this.currentActiveMedia;
    }
}

describe('Exclusive Media Playback Coordinator', () => {
    it('pauses currently playing voice note when a second voice note starts', () => {
        const coordinator = new MediaCoordinator();

        let voiceNote1Paused = false;
        let voiceNote1Icon = 'pause';

        const voiceNote1 = {
            id: 'voice_1',
            pause: () => {
                voiceNote1Paused = true;
                voiceNote1Icon = 'play';
            }
        };

        let voiceNote2Paused = false;
        let voiceNote2Icon = 'pause';

        const voiceNote2 = {
            id: 'voice_2',
            pause: () => {
                voiceNote2Paused = true;
                voiceNote2Icon = 'play';
            }
        };

        // Play voice note 1
        coordinator.registerActiveMedia(voiceNote1);
        expect(coordinator.getActiveMedia()).toBe(voiceNote1);
        expect(voiceNote1Paused).toBe(false);

        // Play voice note 2 in another chat or same chat
        coordinator.registerActiveMedia(voiceNote2);
        expect(voiceNote1Paused).toBe(true);
        expect(voiceNote1Icon).toBe('play');
        expect(coordinator.getActiveMedia()).toBe(voiceNote2);
        expect(voiceNote2Paused).toBe(false);
    });

    it('pauses playing voice note when a video in lightbox starts playing', () => {
        const coordinator = new MediaCoordinator();

        let voiceNotePaused = false;
        const voiceNote = {
            id: 'voice_note_msg',
            pause: () => {
                voiceNotePaused = true;
            }
        };

        let videoPaused = false;
        const videoController = {
            id: 'lightbox_video',
            pause: () => {
                videoPaused = true;
            }
        };

        coordinator.registerActiveMedia(voiceNote);
        expect(voiceNotePaused).toBe(false);

        // Video opened in lightbox
        coordinator.registerActiveMedia(videoController);
        expect(voiceNotePaused).toBe(true);
        expect(coordinator.getActiveMedia()).toBe(videoController);
    });

    it('pauses active media when user switches conversation or navigates back', () => {
        const coordinator = new MediaCoordinator();

        let voiceNotePaused = false;
        const voiceNote = {
            id: 'voice_note_chat_A',
            pause: () => {
                voiceNotePaused = true;
            }
        };

        coordinator.registerActiveMedia(voiceNote);
        expect(coordinator.getActiveMedia()).toBe(voiceNote);

        // User switches conversation (calls stopAllActiveMedia)
        coordinator.stopAllActiveMedia();

        expect(voiceNotePaused).toBe(true);
        expect(coordinator.getActiveMedia()).toBe(null);
    });

    it('pauses voice note when recording preview is played', () => {
        const coordinator = new MediaCoordinator();

        let voiceNotePaused = false;
        const voiceNote = {
            id: 'voice_msg',
            pause: () => {
                voiceNotePaused = true;
            }
        };

        let previewPaused = false;
        const previewController = {
            id: 'voice_preview',
            pause: () => {
                previewPaused = true;
            }
        };

        coordinator.registerActiveMedia(voiceNote);
        coordinator.registerActiveMedia(previewController);

        expect(voiceNotePaused).toBe(true);
        expect(coordinator.getActiveMedia()).toBe(previewController);
    });
});
