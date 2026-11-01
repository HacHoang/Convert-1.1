package vn.convert11.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SourceBrowserPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
