package com.hotmapp.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenShare")
public class ScreenSharePlugin extends Plugin {
    private static final String TAG = "ScreenSharePlugin";

    @PluginMethod
    public void start(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is null");
            return;
        }

        MediaProjectionManager projectionManager = (MediaProjectionManager) activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (projectionManager == null) {
            call.reject("MediaProjectionManager not supported on this device");
            return;
        }

        try {
            Intent captureIntent = projectionManager.createScreenCaptureIntent();
            startActivityForResult(call, captureIntent, "screenCaptureResult");
        } catch (Exception e) {
            Log.e(TAG, "Error starting screen capture intent", e);
            call.reject("Failed to initiate screen capture: " + e.getMessage());
        }
    }

    @ActivityCallback
    public void screenCaptureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Screen sharing permission was denied by user");
            return;
        }

        try {
            Context context = getContext();
            
            ScreenCaptureService.pendingResultCode = result.getResultCode();
            ScreenCaptureService.pendingData = result.getData();
            ScreenCaptureService.frameCallback = new ScreenCaptureService.FrameCallback() {
                @Override
                public void onFrame(String base64Jpeg) {
                    JSObject ret = new JSObject();
                    ret.put("frame", base64Jpeg);
                    notifyListeners("screenFrame", ret);
                }

                @Override
                public void onStopped() {
                    notifyListeners("screenStopped", new JSObject());
                }
            };

            Intent serviceIntent = new Intent(context, ScreenCaptureService.class);
            serviceIntent.setAction(ScreenCaptureService.ACTION_START);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start ScreenCaptureService", e);
            call.reject("Failed to start screen capture service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, ScreenCaptureService.class);
            serviceIntent.setAction(ScreenCaptureService.ACTION_STOP);
            context.startService(serviceIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping screen capture service", e);
            call.reject("Failed to stop screen capture: " + e.getMessage());
        }
    }
}
