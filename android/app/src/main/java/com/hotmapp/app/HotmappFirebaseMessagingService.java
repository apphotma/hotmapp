package com.hotmapp.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

public class HotmappFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "HotmappFMSvc";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        android.os.PowerManager.WakeLock wakeLock = null;
        try {
            Log.d(TAG, "onMessageReceived: got message: " + remoteMessage.getMessageId());

            // Acquire temporary WakeLock to wake CPU / screen
            try {
                android.os.PowerManager powerManager = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
                if (powerManager != null) {
                    wakeLock = powerManager.newWakeLock(
                            android.os.PowerManager.FULL_WAKE_LOCK |
                            android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP |
                            android.os.PowerManager.ON_AFTER_RELEASE,
                            "hotmapp:incoming_push_wakelock");
                    wakeLock.acquire(10000); // 10 seconds timeout
                }
            } catch (Exception wakeEx) {
                Log.w(TAG, "Failed to acquire WakeLock: " + wakeEx.getMessage());
            }

            Map<String, String> data = remoteMessage.getData();
            if (data == null || data.isEmpty()) return;

            final String type = data.get("type");
            if ("incoming_call".equals(type) || "incoming-call".equals(type)) {
                showIncomingCallNotification(data);
                return;
            }

            final String ackUrl = data.get("ackUrl");
            final String deliveryToken = data.get("deliveryToken");
            final String deliveryExpiry = data.get("deliveryExpiry");
            final String chatId = data.get("chatId");
            final String messageId = data.get("messageId");
            final String recipientId = data.get("recipientId");

            Log.d(TAG, "FCM data payload: chatId=" + chatId + " messageId=" + messageId + " recipientId=" + recipientId);

            if (ackUrl != null && deliveryToken != null && deliveryExpiry != null && chatId != null && messageId != null && recipientId != null) {
                // Fire-and-forget POST to ack endpoint on a background thread
                new Thread(() -> {
                    HttpURLConnection conn = null;
                    try {
                        URL url = new URL(ackUrl);
                        conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                        conn.setConnectTimeout(5000);
                        conn.setReadTimeout(5000);
                        conn.setDoOutput(true);

                        JSONObject body = new JSONObject();
                        body.put("chatId", chatId);
                        body.put("messageId", messageId);
                        body.put("recipientId", recipientId);
                        body.put("deliveryToken", deliveryToken);
                        body.put("deliveryExpiry", deliveryExpiry);

                        byte[] out = body.toString().getBytes("UTF-8");
                        OutputStream stream = conn.getOutputStream();
                        stream.write(out);
                        stream.flush();
                        stream.close();

                        int resp = conn.getResponseCode();
                        Log.d(TAG, "ackDelivery response: " + resp + " for " + chatId + "/" + messageId);
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to POST ackDelivery: " + e.getMessage(), e);
                    } finally {
                        if (conn != null) conn.disconnect();
                    }
                }).start();
            } else {
                Log.d(TAG, "No ack payload present in data; skipping ack.");
            }

            // Show a notification for data-only messages.
            final String title = data.get("title") != null ? data.get("title") : "Hotmapp";
            final String body = data.get("body") != null ? data.get("body") : "You have a new message.";
            showNotification(title, body, data);
        } catch (Exception ex) {
            Log.w(TAG, "onMessageReceived error: " + ex.getMessage(), ex);
        }
    }

    private boolean isAppInForeground() {
        try {
            android.app.ActivityManager activityManager = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            if (activityManager == null) return false;
            java.util.List<android.app.ActivityManager.RunningAppProcessInfo> appProcesses = activityManager.getRunningAppProcesses();
            if (appProcesses == null) return false;
            final String packageName = getPackageName();
            for (android.app.ActivityManager.RunningAppProcessInfo appProcess : appProcesses) {
                if (appProcess.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND && appProcess.processName.equals(packageName)) {
                    return true;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "isAppInForeground error: " + e.getMessage());
        }
        return false;
    }

    private void showIncomingCallNotification(Map<String, String> data) {
        // If app is currently active in foreground, let the in-app WebRTC overlay handle it
        if (isAppInForeground()) {
            Log.d(TAG, "App is active in foreground; in-app WebRTC overlay will handle the call.");
            return;
        }

        String callerName = data.get("callerName");
        if (callerName == null) callerName = data.get("title");
        String callId = data.get("callId");
        if (callId == null) callId = data.get("senderId");

        CallNotificationHelper.createCallChannel(this);

        Intent fullScreenIntent = new Intent(this, MainActivity.class);
        fullScreenIntent.putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId);
        fullScreenIntent.putExtra(IncomingCallActivity.EXTRA_CALLER_NAME, callerName);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this,
                0,
                fullScreenIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent acceptIntent = new Intent(this, MainActivity.class);
        acceptIntent.putExtra(IncomingCallActivity.EXTRA_CALL_ACTION, IncomingCallActivity.ACTION_ACCEPT);
        acceptIntent.putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId);
        acceptIntent.putExtra(IncomingCallActivity.EXTRA_CALLER_NAME, callerName);
        acceptIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent acceptPendingIntent = PendingIntent.getActivity(
                this,
                1,
                acceptIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent rejectIntent = new Intent(this, IncomingCallReceiver.class);
        rejectIntent.putExtra(IncomingCallActivity.EXTRA_CALL_ACTION, IncomingCallActivity.ACTION_REJECT);
        rejectIntent.putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId);
        rejectIntent.putExtra(IncomingCallActivity.EXTRA_CALLER_NAME, callerName);

        PendingIntent rejectPendingIntent = PendingIntent.getBroadcast(
                this,
                2,
                rejectIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification notification = CallNotificationHelper.buildIncomingCallNotification(
                this,
                fullScreenPendingIntent,
                acceptPendingIntent,
                rejectPendingIntent,
                callerName);

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(callId != null ? callId.hashCode() : (int) System.currentTimeMillis(), notification);
        }
    }

    private void showNotification(String title, String body, Map<String, String> data) {
        String channelId = "hotmapp_messages";
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Hotmapp Messages", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Hotmapp incoming messages");
            channel.enableLights(true);
            channel.enableVibration(true);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setContentIntent(pendingIntent);

        if (notificationManager != null) {
            notificationManager.notify((int) System.currentTimeMillis(), notificationBuilder.build());
        }
    }
}
