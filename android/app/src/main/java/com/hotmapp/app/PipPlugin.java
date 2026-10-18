package com.hotmapp.app;

import android.app.Activity;
import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.util.Log;
import android.util.Rational;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

@CapacitorPlugin(name = "PipPlugin")
public class PipPlugin extends Plugin {
    private static final String TAG = "PipPlugin";
    public static final String ACTION_PIP_END_CALL = "com.hotmapp.app.ACTION_PIP_END_CALL";

    private static PipPlugin instance;
    private static boolean isPipEnabled = false;
    private static Rational currentAspectRatio = new Rational(9, 16);
    private BroadcastReceiver pipActionReceiver;

    @Override
    public void load() {
        super.load();
        instance = this;
        registerActionReceiver();
    }

    private synchronized void registerActionReceiver() {
        if (pipActionReceiver != null) return;
        pipActionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                String action = intent.getAction();
                if (ACTION_PIP_END_CALL.equals(action)) {
                    Log.d(TAG, "PiP action end call received from floating window");
                    JSObject data = new JSObject();
                    data.put("action", "endCall");
                    notifyListeners("pipAction", data);
                }
            }
        };

        try {
            IntentFilter filter = new IntentFilter(ACTION_PIP_END_CALL);
            Context context = getContext();
            if (context != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    context.registerReceiver(pipActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
                } else {
                    context.registerReceiver(pipActionReceiver, filter);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to register pipActionReceiver", e);
        }
    }

    public static boolean isPipEnabled() {
        return isPipEnabled;
    }

    public static void updatePipParams(Activity activity, boolean enabled, int num, int den) {
        if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            if (num > 0 && den > 0) {
                float ratio = (float) num / (float) den;
                // Android rational aspect ratio must be between 1/2.39 (0.4184) and 2.39
                if (ratio >= 0.4184f && ratio <= 2.39f) {
                    currentAspectRatio = new Rational(num, den);
                }
            }

            PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
            builder.setAspectRatio(currentAspectRatio);

            if (enabled) {
                ArrayList<RemoteAction> actions = new ArrayList<>();
                Intent endIntent = new Intent(ACTION_PIP_END_CALL);
                endIntent.setPackage(activity.getPackageName());
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent endPendingIntent = PendingIntent.getBroadcast(activity, 9091, endIntent, flags);
                Icon endIcon = Icon.createWithResource(activity, R.drawable.ic_call_end);
                RemoteAction endAction = new RemoteAction(endIcon, "End Call", "End Call", endPendingIntent);
                actions.add(endAction);
                builder.setActions(actions);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(enabled);
            }

            activity.setPictureInPictureParams(builder.build());
            Log.d(TAG, "setPictureInPictureParams updated, enabled=" + enabled);
        } catch (Exception e) {
            Log.w(TAG, "Failed to update PictureInPictureParams: " + e.getMessage());
        }
    }

    public static boolean enterPip(Activity activity) {
        if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        try {
            PackageManager pm = activity.getPackageManager();
            if (!pm.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) {
                return false;
            }

            PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
            builder.setAspectRatio(currentAspectRatio);

            if (isPipEnabled) {
                ArrayList<RemoteAction> actions = new ArrayList<>();
                Intent endIntent = new Intent(ACTION_PIP_END_CALL);
                endIntent.setPackage(activity.getPackageName());
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent endPendingIntent = PendingIntent.getBroadcast(activity, 9091, endIntent, flags);
                Icon endIcon = Icon.createWithResource(activity, R.drawable.ic_call_end);
                RemoteAction endAction = new RemoteAction(endIcon, "End Call", "End Call", endPendingIntent);
                actions.add(endAction);
                builder.setActions(actions);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(isPipEnabled);
            }

            return activity.enterPictureInPictureMode(builder.build());
        } catch (Exception e) {
            Log.e(TAG, "enterPictureInPictureMode error", e);
            return false;
        }
    }

    public static void onPictureInPictureModeChanged(boolean isInPictureInPictureMode) {
        if (instance != null) {
            JSObject ret = new JSObject();
            ret.put("isInPip", isInPictureInPictureMode);
            instance.notifyListeners("pipModeChanged", ret);
        }
    }

    @PluginMethod
    public void isPipSupported(PluginCall call) {
        Context context = getContext();
        boolean supported = false;
        if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            supported = context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
        }
        JSObject ret = new JSObject();
        ret.put("supported", supported);
        call.resolve(ret);
    }

    @PluginMethod
    public void setPipMode(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        int num = call.getInt("aspectRatioNumerator", 9);
        int den = call.getInt("aspectRatioDenominator", 16);

        isPipEnabled = enabled;
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> updatePipParams(activity, enabled, num, den));
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void enterPip(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is null");
            return;
        }
        activity.runOnUiThread(() -> {
            boolean success = enterPip(activity);
            JSObject ret = new JSObject();
            ret.put("success", success);
            call.resolve(ret);
        });
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (pipActionReceiver != null) {
            try {
                Context context = getContext();
                if (context != null) context.unregisterReceiver(pipActionReceiver);
            } catch (Exception ignored) {}
            pipActionReceiver = null;
        }
        if (instance == this) {
            instance = null;
        }
    }
}
