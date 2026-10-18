package com.hotmapp.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    public interface WebRtcPermissionCallback {
        void onResult(boolean allGranted);
    }

    private WebRtcPermissionCallback pendingWebRtcPermissionCallback;
    private ActivityResultLauncher<String[]> webrtcPermissionLauncher;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenSharePlugin.class);
        registerPlugin(WebRtcAudioPlugin.class);
        registerPlugin(PipPlugin.class);

        webrtcPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            result -> {
                boolean allGranted = true;
                for (Map.Entry<String, Boolean> entry : result.entrySet()) {
                    if (entry.getValue() == null || !entry.getValue()) {
                        allGranted = false;
                        break;
                    }
                }
                if (pendingWebRtcPermissionCallback != null) {
                    pendingWebRtcPermissionCallback.onResult(allGranted);
                    pendingWebRtcPermissionCallback = null;
                }
            }
        );

        super.onCreate(savedInstanceState);
        CallNotificationHelper.createCallChannel(this);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings settings = this.bridge.getWebView().getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            this.bridge.getWebView().setWebChromeClient(new CustomWebChromeClient(this.bridge));
        }

        // Pre-request Camera & Microphone permissions on startup so WebRTC never blocks during calls
        String[] requiredPermissions = new String[]{
            android.Manifest.permission.CAMERA,
            android.Manifest.permission.RECORD_AUDIO
        };
        requestWebRtcPermissions(requiredPermissions, null);
    }

    @Override
    public void onStart() {
        super.onStart();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings settings = this.bridge.getWebView().getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            this.bridge.getWebView().setWebChromeClient(new CustomWebChromeClient(this.bridge));
        }
    }

    @Override
    public void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    public void requestWebRtcPermissions(String[] permissions, WebRtcPermissionCallback callback) {
        this.pendingWebRtcPermissionCallback = callback;
        if (webrtcPermissionLauncher != null && permissions != null && permissions.length > 0) {
            webrtcPermissionLauncher.launch(permissions);
        } else if (callback != null) {
            callback.onResult(true);
        }
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (PipPlugin.isPipEnabled()) {
            PipPlugin.enterPip(this);
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, android.content.res.Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        PipPlugin.onPictureInPictureModeChanged(isInPictureInPictureMode);
    }

    @Override
    public void onPause() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N && isInPictureInPictureMode()) {
            super.onPause();
            // In PiP mode, ensure WebView continues playback and does not freeze
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().onResume();
            }
            return;
        }
        super.onPause();
    }
}

