package app.gammama.scales;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

final class AudioSearch {
    private static final int MICROPHONE_PERMISSION = 60;
    private static final int AUDIO_FILE = 61;

    interface Listener {
        void onState(String phase, List<String> keys, String message, AudioFileInfo file);
    }

    private enum Phase { IDLE, PERMISSION, PICKING, RECORDING, ANALYZING }

    private static final class Task {
        final AtomicBoolean stop = new AtomicBoolean();
        final AtomicBoolean cancelled = new AtomicBoolean();
    }

    private final Activity activity;
    private final Listener listener;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private Phase phase = Phase.IDLE;
    private Task task;

    AudioSearch(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
    }

    void recordOrStop() {
        if (phase == Phase.RECORDING) {
            phase = Phase.ANALYZING;
            task.stop.set(true);
            emit("analyzing", "");
            return;
        }
        if (phase != Phase.IDLE) return;
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            phase = Phase.PERMISSION;
            emit("requesting", "");
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE_PERMISSION);
            return;
        }
        start(null);
    }

    void onPermissionResult(int requestCode, int[] results) {
        if (requestCode != MICROPHONE_PERMISSION || phase != Phase.PERMISSION) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            start(null);
        } else {
            phase = Phase.IDLE;
            emit("error", "Для записи нужен доступ к микрофону. Можно выбрать аудиофайл.");
        }
    }

    void pickFile() {
        if (phase != Phase.IDLE) return;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*")
                .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"audio/*", "application/mp4", "application/x-m4a", "video/mp4"})
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            phase = Phase.PICKING;
            emit("choosing", "");
            activity.startActivityForResult(intent, AUDIO_FILE);
        } catch (ActivityNotFoundException error) {
            phase = Phase.IDLE;
            emit("error", "На устройстве недоступен выбор аудиофайлов.");
        }
    }

    void onFileResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != AUDIO_FILE || phase != Phase.PICKING) return;
        Uri uri = resultCode == Activity.RESULT_OK && data != null ? data.getData() : null;
        if (uri == null) {
            phase = Phase.IDLE;
            emit("idle", "");
        } else {
            start(uri);
        }
    }

    void analyzeSharedFile(Uri uri) {
        clearTask();
        if (uri == null) {
            emit("error", "Не удалось открыть переданный аудиофайл.");
            return;
        }
        start(uri);
    }

    private void start(Uri uri) {
        Task current = new Task();
        task = current;
        boolean microphone = uri == null;
        phase = microphone ? Phase.RECORDING : Phase.ANALYZING;
        emit(microphone ? "recording" : "analyzing", "");
        worker.execute(() -> {
            try {
                if (current.cancelled.get()) return;
                TonalAnalyzer.Clip clip = microphone
                        ? AudioInput.record(current.stop::get, current.cancelled::get)
                        : decodeFile(current, uri);
                if (current.cancelled.get()) return;
                if (microphone) activity.runOnUiThread(() -> {
                    if (task == current && phase == Phase.RECORDING) {
                        phase = Phase.ANALYZING;
                        emit("analyzing", "");
                    }
                });
                List<String> keys = TonalAnalyzer.estimate(clip, current.cancelled::get);
                finish(current, keys, "В этом фрагменте мало различимых нот. Попробуй запись с несколькими нотами или аккордами.");
            } catch (IOException | RuntimeException error) {
                finish(current, Collections.emptyList(), microphone ? "Не удалось записать звук с микрофона."
                        : "Не удалось прочитать аудио. Попробуй MP3, WAV или M4A с кодеком AAC.");
            }
        });
    }

    private TonalAnalyzer.Clip decodeFile(Task current, Uri uri) throws IOException {
        Context context = activity.getApplicationContext();
        AudioFileInfo file = AudioFileInfo.read(context, uri);
        publishFile(current, file);
        if (current.cancelled.get()) return null;
        return AudioInput.decode(context, uri, current.cancelled::get, track -> publishFile(current, file.withTrack(track)));
    }

    private void publishFile(Task current, AudioFileInfo file) {
        activity.runOnUiThread(() -> {
            if (task == current) listener.onState("analyzing", Collections.emptyList(), "", file);
        });
    }

    private void finish(Task current, List<String> keys, String emptyMessage) {
        activity.runOnUiThread(() -> {
            if (task != current) return;
            task = null;
            phase = Phase.IDLE;
            listener.onState(keys.isEmpty() ? "error" : "done", keys, keys.isEmpty() ? emptyMessage : "", null);
        });
    }

    void cancel() {
        if (phase == Phase.IDLE) return;
        clearTask();
        emit("idle", "");
    }

    void stopRecordingOnBackground() {
        if (phase == Phase.RECORDING) cancel();
    }

    void destroy() {
        clearTask();
        worker.shutdownNow();
    }

    private void clearTask() {
        if (task != null) task.cancelled.set(true);
        task = null;
        phase = Phase.IDLE;
    }

    private void emit(String phase, String message) {
        listener.onState(phase, Collections.emptyList(), message, null);
    }
}
