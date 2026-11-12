package app.gammama.scales;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Process;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

final class AudioSearch {
    private static final int MICROPHONE_PERMISSION = 60;
    private static final int AUDIO_FILE = 61;
    private static final int SAVE_RECORDING = 62;
    private static final long MAX_SEGMENT_MS = TonalAnalyzer.MAX_SECONDS * 1000L;
    private static final int MIN_SEGMENT_MS = 100;

    interface Listener {
        void onState(String phase, List<String> keys, String message, AudioFileInfo file, Analysis analysis);
    }

    interface WaveformListener {
        void onWaveform(float[] peaks, long durationMs, boolean complete, long processedMs);
    }

    interface RecordingListener {
        void onRecording(float[] peaks, long elapsedMs);
    }

    static final class Analysis {
        private final long fromMs;
        private final long toMs;
        private final List<MelodyAnalyzer.Note> notes;

        Analysis(long fromMs, long toMs, List<MelodyAnalyzer.Note> notes) {
            this.fromMs = fromMs;
            this.toMs = toMs;
            this.notes = notes;
        }

        JSONObject toJson() {
            JSONArray sequence = new JSONArray();
            for (MelodyAnalyzer.Note note : notes) {
                Map<String, Object> data = new HashMap<>();
                data.put("midi", note.midi);
                data.put("startMs", note.startMs);
                data.put("endMs", note.endMs);
                sequence.put(new JSONObject(data));
            }
            Map<String, Object> data = new HashMap<>();
            data.put("fromMs", fromMs);
            data.put("toMs", toMs);
            data.put("notes", sequence);
            return new JSONObject(data);
        }
    }

    private enum Phase { IDLE, PERMISSION, PICKING, RECORDING, ANALYZING, SAVE_PICKING, SAVING }

    private static final class Task {
        final AtomicBoolean stop = new AtomicBoolean();
        final AtomicBoolean cancelled = new AtomicBoolean();
    }

    private static final class Source {
        final Uri uri;
        final File recording;
        AudioFileInfo info;
        float[] waveform;
        long waveformProcessedMs;
        boolean waveformComplete;

        Source(Uri uri, File recording, AudioFileInfo info) {
            this.uri = uri;
            this.recording = recording;
            this.info = info;
        }
    }

    private final Activity activity;
    private final Context context;
    private final Listener listener;
    private final WaveformListener waveformListener;
    private final RecordingListener recordingListener;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService waveformWorker = Executors.newSingleThreadExecutor(runnable ->
            new Thread(() -> {
                Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND);
                runnable.run();
            }, "Audio waveform"));
    private Phase phase = Phase.IDLE;
    private Task task;
    private Source source;
    private AtomicBoolean waveformTask;
    private boolean waveformPaused;
    private List<String> keys = Collections.emptyList();
    private Analysis analysis;
    private String resultMessage = "";

    AudioSearch(Activity activity, Listener listener, WaveformListener waveformListener, RecordingListener recordingListener) {
        this.activity = activity;
        this.context = activity.getApplicationContext();
        this.listener = listener;
        this.waveformListener = waveformListener;
        this.recordingListener = recordingListener;
    }

    void recordOrStop() {
        if (phase == Phase.RECORDING) {
            stopRecording();
            return;
        }
        if (phase != Phase.IDLE) return;
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            phase = Phase.PERMISSION;
            emit("requesting", "");
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE_PERMISSION);
            return;
        }
        startRecording();
    }

    void onPermissionResult(int requestCode, int[] results) {
        if (requestCode != MICROPHONE_PERMISSION || phase != Phase.PERMISSION) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            startRecording();
        } else {
            phase = Phase.IDLE;
            emit("error", "audioPermissionDenied");
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
            emit("error", "audioPickerUnavailable");
        }
    }

    void onFileResult(int requestCode, int resultCode, Intent data) {
        Uri uri = resultCode == Activity.RESULT_OK && data != null ? data.getData() : null;
        if (requestCode == AUDIO_FILE && phase == Phase.PICKING) {
            if (uri == null) {
                phase = Phase.IDLE;
                emitCurrent();
            } else {
                openSource(uri);
            }
        } else if (requestCode == SAVE_RECORDING && phase == Phase.SAVE_PICKING) {
            if (uri == null) {
                phase = Phase.IDLE;
                emitCurrent();
            } else {
                writeRecording(uri);
            }
        }
    }

    void analyzeSharedFile(Uri uri) {
        clearTask();
        if (uri == null) {
            replaceSource(null);
            emit("error", "audioShareUnreadable");
            return;
        }
        openSource(uri);
    }

    private void openSource(Uri uri) {
        replaceSource(new Source(uri, null, null));
        startAnalysis(0, MAX_SEGMENT_MS);
    }

    private void startRecording() {
        replaceSource(null);
        Task current = new Task();
        task = current;
        phase = Phase.RECORDING;
        emit("recording", "");
        recordingListener.onRecording(new float[0], 0);
        worker.execute(() -> {
            if (current.cancelled.get()) return;
            File recording = null;
            try {
                recording = File.createTempFile("gammama-recording-", ".wav", context.getCacheDir());
                RecordingEnvelope envelope = AudioInput.record(recording, current.stop::get, current.cancelled::get,
                        (peaks, elapsed) -> activity.runOnUiThread(() -> {
                            if (task == current && phase == Phase.RECORDING) recordingListener.onRecording(peaks, elapsed);
                        }));
                if (current.cancelled.get()) return;
                long duration = envelope.elapsedMs();
                if (duration <= 0) throw new IOException("No recorded audio");
                String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date());
                AudioFileInfo info = AudioFileInfo.recording("Mama-Gamma-" + stamp + ".wav", recording.length(), duration);
                Source captured = new Source(Uri.fromFile(recording), recording, info);
                captured.waveform = envelope.overview();
                captured.waveformProcessedMs = duration;
                captured.waveformComplete = true;
                activity.runOnUiThread(() -> {
                    if (task != current) {
                        deleteRecording(captured.recording);
                        return;
                    }
                    replaceSource(captured);
                    startAnalysis(0, Math.min(duration, MAX_SEGMENT_MS));
                    emitWaveform(captured);
                });
                recording = null;
            } catch (IOException | RuntimeException error) {
                activity.runOnUiThread(() -> {
                    if (task != current) return;
                    clearTask();
                    emit("error", "audioMicrophoneError");
                });
            } finally {
                deleteRecording(recording);
            }
        });
    }

    private void stopRecording() {
        phase = Phase.ANALYZING;
        task.stop.set(true);
        emit("analyzing", "");
    }

    void analyzeSegment(double from, double to) {
        if (phase != Phase.IDLE) return;
        if (source == null) {
            emit("error", "audioNoSource");
            return;
        }
        if (!Double.isFinite(from) || !Double.isFinite(to) || from < 0 || to > Long.MAX_VALUE / 1000L
                || to - from < MIN_SEGMENT_MS || to - from > MAX_SEGMENT_MS) {
            emit("error", "audioSegmentInvalid");
            return;
        }
        long duration = source.info == null ? -1 : source.info.durationMs();
        long fromMs = Math.round(from);
        long toMs = duration >= 0 ? Math.min(Math.round(to), duration) : Math.round(to);
        if (toMs - fromMs < MIN_SEGMENT_MS) {
            emit("error", "audioSegmentInvalid");
            return;
        }
        startAnalysis(fromMs, toMs);
    }

    private void startAnalysis(long fromMs, long toMs) {
        cancelWaveform();
        Source target = source;
        AudioFileInfo info = target.info;
        Task current = new Task();
        task = current;
        phase = Phase.ANALYZING;
        emit("analyzing", "");
        worker.execute(() -> {
            if (current.cancelled.get()) return;
            try {
                AudioFileInfo metadata = info == null ? AudioFileInfo.read(context, target.uri) : info;
                publishInfo(current, target, metadata);
                TonalAnalyzer.Clip clip = AudioInput.decode(context, target.uri, fromMs, toMs, current.cancelled::get,
                        track -> publishInfo(current, target, target.recording == null ? metadata.withTrack(track) : metadata));
                if (current.cancelled.get()) return;
                List<String> foundKeys = TonalAnalyzer.estimate(clip, current.cancelled::get);
                List<MelodyAnalyzer.Note> notes = MelodyAnalyzer.estimate(clip, fromMs, current.cancelled::get);
                long availableEnd = clip == null ? toMs : Math.min(toMs, fromMs + clip.durationMs());
                String message = foundKeys.isEmpty() ? "audioTooFewNotes" : "";
                finishAnalysis(current, foundKeys, new Analysis(fromMs, availableEnd, notes), message);
            } catch (IOException | RuntimeException error) {
                finishAnalysis(current, Collections.emptyList(), null, "audioReadError");
            }
        });
    }

    private void publishInfo(Task current, Source target, AudioFileInfo metadata) {
        activity.runOnUiThread(() -> {
            if (task != current) return;
            target.info = metadata;
            emit("analyzing", "");
        });
    }

    private void finishAnalysis(Task current, List<String> found, Analysis result, String message) {
        activity.runOnUiThread(() -> {
            if (task != current) return;
            clearTask();
            keys = found;
            analysis = result;
            resultMessage = message;
            emitCurrent();
        });
    }

    void saveRecording() {
        if (phase != Phase.IDLE || source == null || source.recording == null) return;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("audio/wav")
                .putExtra(Intent.EXTRA_TITLE, source.info.name());
        try {
            phase = Phase.SAVE_PICKING;
            emit("saving", "");
            activity.startActivityForResult(intent, SAVE_RECORDING);
        } catch (ActivityNotFoundException error) {
            phase = Phase.IDLE;
            emit("error", "audioSaveError");
        }
    }

    private void writeRecording(Uri destination) {
        File recording = source.recording;
        Task current = new Task();
        task = current;
        phase = Phase.SAVING;
        worker.execute(() -> {
            boolean saved = false;
            try (OutputStream output = context.getContentResolver().openOutputStream(destination, "wt")) {
                if (output == null) throw new IOException("No output stream");
                Files.copy(recording.toPath(), output);
                output.flush();
                saved = true;
            } catch (IOException | RuntimeException error) {
                saved = false;
            }
            boolean complete = saved;
            activity.runOnUiThread(() -> {
                if (task != current) return;
                clearTask();
                emit(complete ? "saved" : "error", complete ? "audioRecordingSaved" : "audioSaveError");
                startWaveform();
            });
        });
    }

    void cancel() {
        if (phase == Phase.IDLE || phase == Phase.SAVING) return;
        clearTask();
        emitCurrent();
    }

    void clear() {
        clearTask();
        replaceSource(null);
        emitCurrent();
    }

    void restorePage() {
        switch (phase) {
            case PERMISSION: emit("requesting", ""); break;
            case PICKING: emit("choosing", ""); break;
            case RECORDING: emit("recording", ""); break;
            case ANALYZING: emit("analyzing", ""); break;
            case SAVE_PICKING:
            case SAVING: emit("saving", ""); break;
            case IDLE: if (source != null) emitCurrent(); break;
        }
        if (source != null && source.info != null && source.info.durationMs() > 0) {
            emitWaveform(source);
        }
    }

    void stopRecordingOnBackground() {
        if (phase == Phase.RECORDING) stopRecording();
    }

    void destroy() {
        clearTask();
        replaceSource(null);
        worker.shutdown();
        waveformWorker.shutdown();
    }

    private void replaceSource(Source next) {
        Source previous = source;
        cancelWaveform();
        source = next;
        keys = Collections.emptyList();
        analysis = null;
        resultMessage = "";
        waveformListener.onWaveform(new float[0], 0, true, 0);
        if (previous != null && previous.recording != null) worker.execute(() -> deleteRecording(previous.recording));
    }

    private static void deleteRecording(File recording) {
        if (recording == null) return;
        try {
            Files.deleteIfExists(recording.toPath());
        } catch (IOException ignored) {
            // The file remains in the app cache if cleanup fails.
        }
    }

    private void clearTask() {
        if (task != null) task.cancelled.set(true);
        task = null;
        phase = Phase.IDLE;
    }

    private void emitCurrent() {
        boolean found = !keys.isEmpty() || analysis != null && !analysis.notes.isEmpty();
        String status = found ? "done" : resultMessage.isEmpty() ? "idle" : "error";
        emit(status, resultMessage);
        startWaveform();
    }

    void pauseWaveform() {
        waveformPaused = true;
        cancelWaveform();
    }

    void resumeWaveform() {
        waveformPaused = false;
        startWaveform();
    }

    private void cancelWaveform() {
        if (waveformTask != null) waveformTask.set(true);
        waveformTask = null;
    }

    private void startWaveform() {
        if (waveformPaused || phase != Phase.IDLE || waveformTask != null || source == null
                || source.info == null || source.info.durationMs() <= 0 || source.waveformComplete) return;
        Source target = source;
        long duration = target.info.durationMs();
        AtomicBoolean cancelled = new AtomicBoolean();
        waveformTask = cancelled;
        emitWaveform(target);
        waveformWorker.execute(() -> {
            if (cancelled.get()) return;
            float[] peaks;
            try {
                peaks = AudioInput.waveform(context, target.uri, duration, cancelled::get,
                        (partial, processedMs) -> activity.runOnUiThread(() -> {
                            if (waveformTask != cancelled || source != target || processedMs < target.waveformProcessedMs) return;
                            target.waveform = partial;
                            target.waveformProcessedMs = processedMs;
                            emitWaveform(target);
                        }));
            } catch (IOException | RuntimeException error) {
                peaks = null;
            }
            float[] result = peaks;
            activity.runOnUiThread(() -> {
                if (waveformTask != cancelled || source != target) return;
                waveformTask = null;
                target.waveformComplete = true;
                if (result != null) {
                    target.waveform = result;
                    target.waveformProcessedMs = duration;
                }
                emitWaveform(target);
            });
        });
    }

    private void emitWaveform(Source target) {
        waveformListener.onWaveform(target.waveform == null ? new float[0] : target.waveform,
                target.info.durationMs(), target.waveformComplete, target.waveformProcessedMs);
    }

    private void emit(String phase, String message) {
        boolean analyzing = "analyzing".equals(phase);
        listener.onState(phase, analyzing ? Collections.emptyList() : keys, message,
                source == null ? null : source.info, analyzing ? null : analysis);
    }
}
