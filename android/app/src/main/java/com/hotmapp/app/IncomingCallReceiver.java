package com.hotmapp.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class IncomingCallReceiver extends BroadcastReceiver {
    private static final String TAG = "IncomingCallReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            if (intent == null) return;
            String callAction = intent.getStringExtra(IncomingCallActivity.EXTRA_CALL_ACTION);
            String callId = intent.getStringExtra(IncomingCallActivity.EXTRA_CALL_ID);
            String callerName = intent.getStringExtra(IncomingCallActivity.EXTRA_CALLER_NAME);
            Log.d(TAG, "IncomingCallReceiver received action=" + callAction + " callId=" + callId);

            Intent activityIntent = new Intent(context, IncomingCallActivity.class);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            activityIntent.putExtra(IncomingCallActivity.EXTRA_CALL_ACTION, callAction);
            activityIntent.putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId);
            activityIntent.putExtra(IncomingCallActivity.EXTRA_CALLER_NAME, callerName);
            context.startActivity(activityIntent);
        } catch (Exception ex) {
            Log.w(TAG, "Failed to handle incoming call action: " + ex.getMessage(), ex);
        }
    }
}
