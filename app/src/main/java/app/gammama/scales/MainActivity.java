package app.gammama.scales;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.List;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String INDEX = ORIGIN + "/index.html";
    private static final int LIGHT_BACKGROUND = Color.rgb(246, 244, 250);
    private static final int DARK_BACKGROUND = Color.rgb(19, 18, 27);
    private static final String THEME = "theme";

    private FrameLayout frame;
    private ContextThemeWrapper webContext;
    private WebView webView;
    private boolean scaleFullscreen;
    private int orientationBeforeFullscreen;
    private AudioSearch audioSearch;
    private boolean audioPageReady;
    private Intent pendingAudioShare;

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
        audioSearch = new AudioSearch(this, this::sendAudioState);
        webView.addJavascriptInterface(new AudioBridge(), "MamaGammaAudio");
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
        if (savedInstanceState == null) receiveAudioShare(getIntent());
        webView.loadUrl(INDEX);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        receiveAudioShare(intent);
    }

    private void receiveAudioShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        pendingAudioShare = intent;
        openPendingAudioShare();
    }

    private void openPendingAudioShare() {
        if (!audioPageReady || pendingAudioShare == null) return;
        Intent share = pendingAudioShare;
        pendingAudioShare = null;
        webView.evaluateJavascript("openSharedAudio();", null);
        audioSearch.analyzeSharedFile(sharedContentUri(share));
    }

    @SuppressWarnings("deprecation")
    private static Uri sharedContentUri(Intent share) {
        try {
            Parcelable stream = share.getParcelableExtra(Intent.EXTRA_STREAM);
            if (stream instanceof Uri && ContentResolver.SCHEME_CONTENT.equals(((Uri) stream).getScheme())) {
                return (Uri) stream;
            }
            ClipData clip = share.getClipData();
            if (clip != null && clip.getItemCount() > 0) {
                Uri uri = clip.getItemAt(0).getUri();
                if (uri != null && ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())) return uri;
            }
        } catch (RuntimeException ignored) {
            // Treat malformed extras from another app as an unreadable share.
        }
        return null;
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
        public String appVersion() {
            return BuildConfig.VERSION_NAME;
        }

        @JavascriptInterface
        public String systemLanguageTags() {
            return getResources().getConfiguration().getLocales().toLanguageTags();
        }

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
                if (isDestroyed() || scaleFullscreen == fullscreen) return;
                scaleFullscreen = fullscreen;
                if (fullscreen) {
                    orientationBeforeFullscreen = getRequestedOrientation();
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                } else {
                    setRequestedOrientation(orientationBeforeFullscreen);
                }
                applyFullscreen(fullscreen);
            });
        }
    }

    public final class AudioBridge {
        @JavascriptInterface
        public void ready() {
            runOnUiThread(() -> {
                if (isDestroyed()) return;
                audioPageReady = true;
                openPendingAudioShare();
            });
        }

        @JavascriptInterface
        public void recordOrStop() {
            runOnUiThread(() -> { if (!isDestroyed()) audioSearch.recordOrStop(); });
        }

        @JavascriptInterface
        public void pickFile() {
            runOnUiThread(() -> { if (!isDestroyed()) audioSearch.pickFile(); });
        }

        @JavascriptInterface
        public void cancel() {
            runOnUiThread(() -> { if (!isDestroyed()) audioSearch.cancel(); });
        }
    }

    private void sendAudioState(String phase, List<String> keys, String message, AudioFileInfo file) {
        if (webView == null || isDestroyed()) return;
        String metadata = file == null ? "null" : file.toJson().toString()
                .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
        webView.evaluateJavascript("if (window.updateAudioSearch) window.updateAudioSearch("
                + JSONObject.quote(phase) + "," + new JSONArray(keys) + "," + JSONObject.quote(message)
                + "," + metadata + ");", null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        audioSearch.onPermissionResult(requestCode, grantResults);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        audioSearch.onFileResult(requestCode, resultCode, data);
    }

    @Override
    protected void onStop() {
        audioSearch.stopRecordingOnBackground();
        super.onStop();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && scaleFullscreen) applyFullscreen(true);
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
        webView.evaluateJavascript("(() => {"
                + " if (typeof dismissDialog === 'function' && dismissDialog()) return true;"
                + " if (typeof dismissScaleView === 'function' && dismissScaleView()) return true;"
                + " return typeof cancelAudioSearch === 'function' && cancelAudioSearch(); })()", closed -> {
            if (!"true".equals(closed) && !isDestroyed()) finish();
        });
    }

    private static String mimeType(String path) {
        if (path == null) return null;
        switch (path) {
            case "/index.html": return "text/html";
            case "/styles.css":
            case "/piano.css": return "text/css";
            case "/brand.svg": return "image/svg+xml";
            case "/startup.js":
            case "/locale-ui.js":
            case "/locale-search.js":
            case "/i18n.js":
            case "/notation.js":
            case "/scales.js":
            case "/progressions.js":
            case "/chords.js":
            case "/settings.js":
            case "/note-audio.js":
            case "/fretboard.js":
            case "/piano.js":
            case "/history.js":
            case "/app.js": return "text/javascript";
            default: return null;
        }
    }

    @Override
    protected void onDestroy() {
        audioSearch.destroy();
        if (webView != null) {
            ((ViewGroup) webView.getParent()).removeView(webView);
            webView.destroy();
        }
        super.onDestroy();
    }
}
