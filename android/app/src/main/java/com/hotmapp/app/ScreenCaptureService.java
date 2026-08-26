package com.hotmapp.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class ScreenCaptureService extends Service {
    private static final String TAG = "ScreenCaptureService";
    private static final String CHANNEL_ID = "hotmapp_screen_capture_channel";
    private static final int NOTIFICATION_ID = 9001;

    public static final String ACTION_START = "com.hotmapp.app.ACTION_START";
    public static final String ACTION_STOP = "com.hotmapp.app.ACTION_STOP";

    public interface FrameCallback {
        void onFrame(String base64Jpeg);
        void onStopped();
    }

    public static int pendingResultCode = 0;
    public static Intent pendingData = null;
    public static FrameCallback frameCallback = null;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private HandlerThread handlerThread;
    private Handler backgroundHandler;
    private boolean isCapturing = false;
    private long lastFrameTime = 0;
    private static final long FRAME_INTERVAL_MS = 66; // ~15 FPS target for high efficiency & WebRTC stability

    @Override
    public void onCreate() {
        super.onCreate();
        handlerThread = new HandlerThread("ScreenCaptureThread");
        handlerThread.start();
        backgroundHandler = new Handler(handlerThread.getLooper());
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_START.equals(action)) {
            startCapture();
        } else if (ACTION_STOP.equals(action)) {
            stopCapture();
            stopSelf();
        }

        return START_NOT_STICKY;
    }

    private void startCapture() {
        // 1. MUST start foreground service with mediaProjection type on Android 14+ before creating projection
        Notification notification = createNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        MediaProjectionManager projectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (projectionManager == null || pendingData == null) {
            Log.e(TAG, "MediaProjectionManager or pendingData is null");
            stopSelf();
            return;
        }

        try {
            // 2. Initialize MediaProjection instance
            mediaProjection = projectionManager.getMediaProjection(pendingResultCode, pendingData);
            if (mediaProjection == null) {
                Log.e(TAG, "Failed to obtain MediaProjection instance");
                stopSelf();
                return;
            }

            // 3. MANDATORY ON ANDROID 14: Must register Callback BEFORE creating VirtualDisplay
            mediaProjection.registerCallback(new MediaProjection.Callback() {
                @Override
                public void onStop() {
                    super.onStop();
                    Log.i(TAG, "MediaProjection system onStop callback received");
                    stopCapture();
                }
            }, backgroundHandler);

            DisplayMetrics metrics = getResources().getDisplayMetrics();
            int screenWidth = (metrics != null && metrics.widthPixels > 0) ? metrics.widthPixels : 720;
            int screenHeight = (metrics != null && metrics.heightPixels > 0) ? metrics.heightPixels : 1280;
            int density = (metrics != null && metrics.densityDpi > 0) ? metrics.densityDpi : DisplayMetrics.DENSITY_DEFAULT;

            // Target transmission resolution (e.g. 480p width with native aspect ratio)
            int targetWidth = 480;
            int targetHeight = (int) (480.0f * ((float) screenHeight / (float) screenWidth));
            if (targetWidth % 2 != 0) targetWidth++;
            if (targetHeight % 2 != 0) targetHeight++;

            final int captureWidth = targetWidth;
            final int captureHeight = targetHeight;

            imageReader = ImageReader.newInstance(captureWidth, captureHeight, PixelFormat.RGBA_8888, 3);
            
            // 4. Create VirtualDisplay with ImageReader surface
            virtualDisplay = mediaProjection.createVirtualDisplay(
                    "HotmappScreenCapture",
                    captureWidth,
                    captureHeight,
                    density,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    imageReader.getSurface(),
                    null,
                    backgroundHandler
            );

            isCapturing = true;

            imageReader.setOnImageAvailableListener(reader -> {
                if (!isCapturing) return;

                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image == null) return;

                    long now = System.currentTimeMillis();
                    if (now - lastFrameTime < FRAME_INTERVAL_MS) {
                        return; // Throttle to target FPS
                    }
                    lastFrameTime = now;

                    Image.Plane[] planes = image.getPlanes();
                    if (planes == null || planes.length == 0) return;

                    Image.Plane plane = planes[0];
                    ByteBuffer buffer = plane.getBuffer();
                    int pixelStride = plane.getPixelStride();
                    int rowStride = plane.getRowStride();

                    Bitmap bitmap = Bitmap.createBitmap(captureWidth, captureHeight, Bitmap.Config.ARGB_8888);

                    if (rowStride == captureWidth * pixelStride) {
                        buffer.rewind();
                        bitmap.copyPixelsFromBuffer(buffer);
                    } else {
                        ByteBuffer cleanBuffer = ByteBuffer.allocateDirect(captureWidth * captureHeight * 4);
                        byte[] rowBytes = new byte[captureWidth * pixelStride];
                        for (int y = 0; y < captureHeight; y++) {
                            int offset = y * rowStride;
                            if (offset + rowBytes.length <= buffer.capacity()) {
                                buffer.position(offset);
                                buffer.get(rowBytes, 0, rowBytes.length);
                                cleanBuffer.put(rowBytes);
                            }
                        }
                        cleanBuffer.rewind();
                        bitmap.copyPixelsFromBuffer(cleanBuffer);
                    }

                    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 50, outputStream);
                    bitmap.recycle();

                    byte[] jpegBytes = outputStream.toByteArray();
                    String base64Jpeg = Base64.encodeToString(jpegBytes, Base64.NO_WRAP);

                    if (frameCallback != null) {
                        frameCallback.onFrame(base64Jpeg);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Error processing screen frame: " + e.getMessage());
                } finally {
                    if (image != null) {
                        try { image.close(); } catch (Exception ignored) {}
                    }
                }
            }, backgroundHandler);

            Log.i(TAG, "MediaProjection screen capture successfully initialized");
        } catch (Exception e) {
            Log.e(TAG, "Error configuring MediaProjection", e);
            stopSelf();
        }
    }

    private void stopCapture() {
        isCapturing = false;
        if (frameCallback != null) {
            frameCallback.onStopped();
        }
        if (virtualDisplay != null) {
            try { virtualDisplay.release(); } catch (Exception ignored) {}
            virtualDisplay = null;
        }
        if (imageReader != null) {
            try { imageReader.close(); } catch (Exception ignored) {}
            imageReader = null;
        }
        if (mediaProjection != null) {
            try { mediaProjection.stop(); } catch (Exception ignored) {}
            mediaProjection = null;
        }
        pendingData = null;
        pendingResultCode = 0;
    }

    @Override
    public void onDestroy() {
        stopCapture();
        if (handlerThread != null) {
            handlerThread.quitSafely();
            handlerThread = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Screen Sharing Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active screen sharing status during video calls");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("HOTMAPP Screen Share")
                .setContentText("You are sharing your screen in a call")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }
}
