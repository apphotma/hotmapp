package com.hotmapp.app;

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
        try {
            Log.d(TAG, "onMessageReceived: got message: " + remoteMessage.getMessageId());

            Map<String, String> data = remoteMessage.getData();
            if (data == null || data.isEmpty()) return;

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
