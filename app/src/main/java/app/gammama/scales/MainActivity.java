package app.gammama.scales;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.ContextThemeWrapper;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String INDEX = ORIGIN + "/index.html";
    private static final int LIGHT_BACKGROUND = Color.rgb(243, 244, 233);
    private static final int DARK_BACKGROUND = Color.rgb(16, 19, 25);
    private static final String THEME = "theme";

    private FrameLayout frame;
    private ContextThemeWrapper webContext;
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        frame = new FrameLayout(this);
        if (Build.VERSION.SDK_INT >= 35) {
            getWindow().setDecorFitsSystemWindows(false);
            frame.setOnApplyWindowInsetsListener((view, insets) -> {
                var safe = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout());
                int keyboard = insets.getInsets(WindowInsets.Type.ime()).bottom;
                view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard));
                return WindowInsets.CONSUMED;
            });
        }

        String mode = getPreferences(MODE_PRIVATE).getString(THEME, "system");
        webContext = new ContextThemeWrapper(this, controlsStyle(isDark(mode)));
        webView = new WebView(webContext);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setBlockNetworkLoads(true);
        webView.addJavascriptInterface(new AppearanceBridge(), "GammaMamaAppearance");
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !INDEX.equals(request.getUrl().toString());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String path = request.getUrl().getPath();
                String mimeType = mimeType(path);
                if (mimeType != null && (ORIGIN + path).equals(request.getUrl().toString())) {
                    try {
                        return new WebResourceResponse(mimeType, "UTF-8", getAssets().open(path.substring(1)));
                    } catch (IOException ignored) {
                        // Return a local 404 for a missing packaged asset.
                    }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                        Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
        });

        frame.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(frame);
        applyAppearance(mode);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
        webView.loadUrl(INDEX);
    }

    private boolean systemDark() {
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    private boolean isDark(String mode) {
        return "dark".equals(mode) || ("system".equals(mode) && systemDark());
    }

    private static int controlsStyle(boolean dark) {
        return dark ? R.style.GammamaDarkControls : R.style.GammamaBaseTheme;
    }

    private void applyAppearance(String mode) {
        boolean dark = isDark(mode);
        int background = dark ? DARK_BACKGROUND : LIGHT_BACKGROUND;
        frame.setBackgroundColor(background);
        webView.setBackgroundColor(background);
        webContext.setTheme(controlsStyle(dark));

        Window window = getWindow();
        window.setBackgroundDrawable(new ColorDrawable(background));
        if (Build.VERSION.SDK_INT < 35) {
            window.setStatusBarColor(background);
            window.setNavigationBarColor(background);
        }
        if (Build.VERSION.SDK_INT >= 30) {
            int lightBars = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            window.getInsetsController().setSystemBarsAppearance(dark ? 0 : lightBars, lightBars);
        } else {
            View decor = window.getDecorView();
            int lightBars = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            int flags = decor.getSystemUiVisibility() & ~lightBars;
            decor.setSystemUiVisibility(dark ? flags : flags | lightBars);
        }
    }

    public final class AppearanceBridge {
        @JavascriptInterface
        public String themeMode() {
            return getPreferences(MODE_PRIVATE).getString(THEME, "system");
        }

        @JavascriptInterface
        public boolean systemDark() {
            return MainActivity.this.systemDark();
        }

        @JavascriptInterface
        public void setThemeMode(String mode) {
            if (!"system".equals(mode) && !"light".equals(mode) && !"dark".equals(mode)) return;
            runOnUiThread(() -> {
                if (isDestroyed()) return;
                if (!mode.equals(themeMode())) getPreferences(MODE_PRIVATE).edit().putString(THEME, mode).apply();
                applyAppearance(mode);
            });
        }

        @JavascriptInterface
        public void setScaleFullscreen(boolean fullscreen) {
            runOnUiThread(() -> {
                if (!isDestroyed()) applyFullscreen(fullscreen);
            });
        }
    }

    private void applyFullscreen(boolean fullscreen) {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = window.getInsetsController();
            if (fullscreen) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.systemBars());
            } else {
                controller.show(WindowInsets.Type.systemBars());
            }
        } else {
            View decor = window.getDecorView();
            int immersive = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION;
            int flags = decor.getSystemUiVisibility() & ~immersive;
            decor.setSystemUiVisibility(fullscreen ? flags | immersive : flags);
        }
    }

    @Override
    public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        if (webView == null) {
            finish();
            return;
        }
        webView.evaluateJavascript("(() => { const dialog = document.querySelector('dialog[open]');"
                + " if (dialog) { dialog.close(); return true; }"
                + " return typeof closeScaleView === 'function' && closeScaleView(); })()", closed -> {
            if (!"true".equals(closed) && !isDestroyed()) finish();
        });
    }

    private static String mimeType(String path) {
        if (path == null) return null;
        switch (path) {
            case "/index.html": return "text/html";
            case "/styles.css": return "text/css";
            case "/scales.js":
            case "/chords.js":
            case "/settings.js":
            case "/fretboard.js":
            case "/app.js": return "text/javascript";
            default: return null;
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            ((ViewGroup) webView.getParent()).removeView(webView);
            webView.destroy();
        }
        super.onDestroy();
    }
}
