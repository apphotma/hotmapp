package com.hotmapp.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

public class CustomWebChromeClient extends BridgeWebChromeClient {
    private Bridge bridge;

    public CustomWebChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        // Check if camera and mic permissions are already granted at the OS level
        boolean hasCamera = ContextCompat.checkSelfPermission(
            bridge.getActivity(),
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED;

        boolean hasMic = ContextCompat.checkSelfPermission(
            bridge.getActivity(),
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED;

        if (hasCamera && hasMic) {
            // Automatically grant the WebView permission request to support screen sharing
            request.grant(request.getResources());
        } else {
            // Delegate to Capacitor's default client to handle system permission requests
            super.onPermissionRequest(request);
        }
    }
}
