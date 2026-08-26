package com.hotmapp.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        this.bridge.getWebView().setWebChromeClient(new CustomWebChromeClient(this.bridge));
    }
}
