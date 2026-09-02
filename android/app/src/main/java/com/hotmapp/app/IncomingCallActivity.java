package com.hotmapp.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

public class IncomingCallActivity extends Activity {
    public static final String EXTRA_CALL_ACTION = "callAction";
    public static final String EXTRA_CALL_ID = "callId";
    public static final String EXTRA_CALLER_NAME = "callerName";
    public static final String ACTION_ACCEPT = "accept";
    public static final String ACTION_REJECT = "reject";
    private static final String TAG = "IncomingCallActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                    android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }

        setContentView(R.layout.activity_incoming_call);

        TextView callerText = findViewById(R.id.incomingCallerName);
        Button acceptButton = findViewById(R.id.acceptCallButton);
        Button rejectButton = findViewById(R.id.rejectCallButton);

        String callId = getIntent().getStringExtra(EXTRA_CALL_ID);
        String callerName = getIntent().getStringExtra(EXTRA_CALLER_NAME);
        String action = getIntent().getStringExtra(EXTRA_CALL_ACTION);

        callerText.setText(callerName != null ? callerName : "Incoming call");
        if (ACTION_ACCEPT.equals(action)) {
            handleCallDecision(callId, true);
        } else if (ACTION_REJECT.equals(action)) {
            handleCallDecision(callId, false);
        }

        acceptButton.setOnClickListener(v -> handleCallDecision(callId, true));
        rejectButton.setOnClickListener(v -> handleCallDecision(callId, false));
    }

    private void handleCallDecision(String callId, boolean accepted) {
        Log.d(TAG, "handleCallDecision callId=" + callId + " accepted=" + accepted);
        if (accepted) {
            Intent mainIntent = new Intent(this, MainActivity.class);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            mainIntent.putExtra("callAction", "accept");
            mainIntent.putExtra("callId", callId);
            startActivity(mainIntent);
        }

        try {
            android.app.NotificationManager notificationManager = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null && callId != null) {
                notificationManager.cancel(callId.hashCode());
            }
        } catch (Exception ignored) {}

        finish();
    }
}
