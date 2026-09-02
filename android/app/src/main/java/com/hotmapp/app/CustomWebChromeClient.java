package com.hotmapp.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class CustomWebChromeClient extends BridgeWebChromeClient {
    private final Bridge bridge;

    public CustomWebChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        if (request == null) return;

        Activity activity = bridge.getActivity();
        if (activity == null || activity.isFinishing()) {
            request.deny();
            return;
        }

        activity.runOnUiThread(() -> {
            List<String> neededPermissions = new ArrayList<>();
            for (String res : request.getResources()) {
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        neededPermissions.add(Manifest.permission.RECORD_AUDIO);
                    }
                } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        neededPermissions.add(Manifest.permission.CAMERA);
                    }
                }
            }

            if (neededPermissions.isEmpty()) {
                try {
                    request.grant(request.getResources());
                } catch (Exception e) {
                    request.deny();
                }
            } else if (activity instanceof MainActivity) {
                ((MainActivity) activity).requestWebRtcPermissions(neededPermissions.toArray(new String[0]), allGranted -> {
                    activity.runOnUiThread(() -> {
                        if (allGranted) {
                            try {
                                request.grant(request.getResources());
                            } catch (Exception e) {
                                request.deny();
                            }
                        } else {
                            request.deny();
                        }
                    });
                });
            } else {
                try {
                    request.grant(request.getResources());
                } catch (Exception e) {
                    request.deny();
                }
            }
        });
    }
}

