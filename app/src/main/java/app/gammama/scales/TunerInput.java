package app.gammama.scales;

import android.annotation.SuppressLint;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class TunerInput {
    interface Listener {
        void onState(String state, double frequency);
    }

    private static final int SAMPLE_RATE = 44100;
    private static final int DOWNSAMPLE = 2;
    private static final int WINDOW = 4096;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Listener listener;
    private volatile int generation;
    private boolean running;

    TunerInput(Listener listener) {
        this.listener = listener;
    }

    void start() {
        if (running) return;
        running = true;
        int request = ++generation;
        listener.onState("starting", 0);
        worker.execute(() -> {
            synchronized (MicrophoneAccess.LOCK) {
                if (request != generation) return;
                try {
                    capture(request);
                } catch (RuntimeException error) {
                    report(request, "error", 0);
                }
            }
        });
    }

    boolean running() {
        return running;
    }

    void stop() {
        if (!running) return;
        running = false;
        generation++;
        listener.onState("idle", 0);
    }

    void destroy() {
        generation++;
        running = false;
        worker.shutdownNow();
    }

    private void report(int request, String state, double frequency) {
        main.post(() -> {
            if (request != generation) return;
            if ("error".equals(state)) running = false;
            listener.onState(state, frequency);
        });
    }

    @SuppressLint("MissingPermission") // MainActivity checks RECORD_AUDIO before starting.
    private void capture(int request) {
        int minimum = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT);
        if (minimum <= 0) throw new IllegalStateException("Unsupported tuner input format");
        short[] raw = new short[WINDOW / 2 * DOWNSAMPLE];
        AudioRecord recorder = new AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
                Math.max(minimum, raw.length * 4));
        try {
            if (request != generation) return;
            recorder.startRecording();
            if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                throw new IllegalStateException("Could not start tuner");
            }
            report(request, "listening", 0);
            readPitches(request, recorder, raw);
        } finally {
            try {
                if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) recorder.stop();
            } finally {
                recorder.release();
            }
        }
    }

    private void readPitches(int request, AudioRecord recorder, short[] raw) {
        float[] window = new float[WINDOW];
        int half = WINDOW / 2;
        boolean primed = false;
        double previous = 0;
        while (request == generation) {
            int offset = 0;
            while (offset < raw.length && request == generation) {
                int read = recorder.read(raw, offset, raw.length - offset, AudioRecord.READ_BLOCKING);
                if (read <= 0) throw new IllegalStateException("Could not read tuner input");
                offset += read;
            }
            if (request != generation) return;
            System.arraycopy(window, half, window, 0, half);
            for (int i = 0; i < half; i++) {
                int total = 0;
                for (int j = 0; j < DOWNSAMPLE; j++) total += raw[i * DOWNSAMPLE + j];
                window[half + i] = total / (32768f * DOWNSAMPLE);
            }
            if (primed) {
                double frequency = PitchDetector.estimate(window, window.length, recorder.getSampleRate() / (double) DOWNSAMPLE);
                if (frequency > 0 && previous > 0 && Math.abs(Math.log(frequency / previous)) < 0.035) {
                    frequency = 0.6 * frequency + 0.4 * previous;
                }
                report(request, "listening", frequency);
                previous = frequency;
            }
            primed = true;
        }
    }
}
