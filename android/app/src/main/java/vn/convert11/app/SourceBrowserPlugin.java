package vn.convert11.app;

import android.app.Dialog;
import android.graphics.Color;
import android.net.Uri;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

/** Isolated reader: remote pages never receive the Capacitor JavaScript bridge. */
@CapacitorPlugin(name = "SourceBrowser")
public class SourceBrowserPlugin extends Plugin {
    private Dialog dialog;
    private WebView reader;
    private PluginCall pending;

    private boolean allowed(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value);
        return ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
            && uri.getHost() != null && uri.getUserInfo() == null;
    }

    @PluginMethod public void open(PluginCall call) {
        String url = call.getString("url");
        if (!allowed(url)) { call.reject("URL trang không hợp lệ."); return; }
        getActivity().runOnUiThread(() -> {
            if (pending != null) { call.reject("Trình duyệt đang mở."); return; }
            pending = call;
            dialog = new Dialog(getActivity(), android.R.style.Theme_Material_NoActionBar);
            LinearLayout root = new LinearLayout(getActivity());
            root.setOrientation(LinearLayout.VERTICAL);
            root.setBackgroundColor(Color.rgb(24, 27, 31));
            TextView address = new TextView(getActivity());
            address.setTextColor(Color.WHITE); address.setTextSize(12);
            address.setPadding(16, 16, 16, 8); address.setText(url);
            root.addView(address);
            TextView hint = new TextView(getActivity());
            hint.setText("Xác minh nếu được yêu cầu, rồi bấm Lấy nội dung.");
            hint.setTextColor(Color.LTGRAY); hint.setTextSize(12); hint.setPadding(16, 0, 16, 8);
            root.addView(hint);
            LinearLayout tools = new LinearLayout(getActivity());
            root.addView(tools);
            reader = new WebView(getActivity());
            WebSettings settings = reader.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            settings.setSupportMultipleWindows(false);
            CookieManager.getInstance().setAcceptCookie(true);
            CookieManager.getInstance().setAcceptThirdPartyCookies(reader, true);
            // No addJavascriptInterface, bridge, file chooser, downloads or popup windows.
            reader.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return !allowed(request.getUrl().toString());
                }
                @Override public void onPageFinished(WebView view, String currentUrl) {
                    address.setText(currentUrl);
                }
            });
            addButton(tools, "Quay lại", () -> { if (reader.canGoBack()) reader.goBack(); });
            addButton(tools, "Tải lại", () -> reader.reload());
            addButton(tools, "Lấy nội dung", () -> capture(hint));
            addButton(tools, "Đóng", () -> finish(null));
            root.addView(reader, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
            dialog.setContentView(root);
            dialog.setOnCancelListener(ignored -> finish(null));
            dialog.show();
            Window window = dialog.getWindow();
            if (window != null) window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            reader.loadUrl(url);
        });
    }

    private void addButton(LinearLayout row, String title, Runnable action) {
        Button button = new Button(getActivity());
        button.setText(title); button.setTextSize(11); button.setAllCaps(false);
        button.setPadding(2, 0, 2, 0); button.setMinWidth(0); button.setMinimumWidth(0);
        button.setOnClickListener(ignored -> action.run());
        row.addView(button, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
    }

    private void capture(TextView hint) {
        if (reader == null) return;
        reader.evaluateJavascript("JSON.stringify({url:location.href,html:document.documentElement.outerHTML})", raw -> {
            if (pending == null) return;
            try {
                String decoded = new JSONArray("[" + raw + "]").getString(0);
                JSONObject data = new JSONObject(decoded);
                String html = data.getString("html"), url = data.getString("url");
                if (!allowed(url) || html.length() > 8000000) throw new Exception();
                JSObject result = new JSObject(); result.put("url", url); result.put("html", html);
                finish(result);
            } catch (Exception error) { hint.setText("Không đọc được trang hoặc trang quá lớn. Hãy tải lại rồi thử lại."); }
        });
    }

    private void finish(JSObject result) {
        PluginCall call = pending; pending = null;
        if (reader != null) { reader.stopLoading(); reader.destroy(); reader = null; }
        if (dialog != null) { dialog.dismiss(); dialog = null; }
        CookieManager.getInstance().flush();
        if (call != null) {
            if (result == null) call.reject("Đã đóng trình duyệt, chưa lấy nội dung.", "BROWSER_CANCELLED");
            else call.resolve(result);
        }
    }

    @PluginMethod public void close(PluginCall call) {
        getActivity().runOnUiThread(() -> { finish(null); call.resolve(); });
    }
    @Override protected void handleOnDestroy() { finish(null); }
}
