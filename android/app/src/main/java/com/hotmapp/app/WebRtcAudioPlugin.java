package com.hotmapp.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WebRtcAudio")
public class WebRtcAudioPlugin extends Plugin {
    private static final String TAG = "WebRtcAudioPlugin";
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        if (context != null) {
            audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        }
    }

    @PluginMethod
    public void setCallAudioMode(PluginCall call) {
        try {
            if (audioManager == null) {
                Context context = getContext();
                if (context != null) {
                    audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
                }
            }

            if (audioManager != null) {
                boolean isVideo = call.getBoolean("isVideo", false);
                boolean speaker = call.getBoolean("speaker", isVideo);

                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build();

                    audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                            .setAudioAttributes(playbackAttributes)
                            .setAcceptsDelayedFocusGain(true)
                            .setOnAudioFocusChangeListener(focusChange -> Log.d(TAG, "Audio focus changed: " + focusChange))
                            .build();

                    audioManager.requestAudioFocus(audioFocusRequest);
                } else {
                    audioManager.requestAudioFocus(
                            null,
                            AudioManager.STREAM_VOICE_CALL,
                            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
                    );
                }

                audioManager.setSpeakerphoneOn(speaker);
                Log.d(TAG, "Set MODE_IN_COMMUNICATION, speakerphone=" + speaker);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error in setCallAudioMode", e);
            call.reject("Failed to set call audio mode: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setSpeakerphoneOn(PluginCall call) {
        try {
            if (audioManager != null) {
                boolean enabled = call.getBoolean("enabled", true);
                audioManager.setSpeakerphoneOn(enabled);
                Log.d(TAG, "setSpeakerphoneOn: " + enabled);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error in setSpeakerphoneOn", e);
            call.reject("Failed to set speakerphone: " + e.getMessage());
        }
    }

    @PluginMethod
    public void resetAudioMode(PluginCall call) {
        try {
            if (audioManager != null) {
                audioManager.setSpeakerphoneOn(false);
                audioManager.setMode(AudioManager.MODE_NORMAL);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest);
                    audioFocusRequest = null;
                } else {
                    audioManager.abandonAudioFocus(null);
                }

                Log.d(TAG, "Reset to MODE_NORMAL");
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error in resetAudioMode", e);
            call.reject("Failed to reset audio mode: " + e.getMessage());
        }
    }
}
