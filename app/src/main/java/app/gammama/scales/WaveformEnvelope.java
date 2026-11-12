package app.gammama.scales;

import java.util.function.BiConsumer;

final class WaveformEnvelope {
    static final int BINS = 1024;
    private static final long UPDATE_INTERVAL_MS = 200;
    private final long durationMs;
    private final float[] peaks = new float[BINS];
    private final BiConsumer<float[], Long> onProgress;
    private long nextUpdate;

    WaveformEnvelope(long durationMs) {
        this(durationMs, null);
    }

    WaveformEnvelope(long durationMs, BiConsumer<float[], Long> onProgress) {
        if (durationMs <= 0) throw new IllegalArgumentException("Waveform duration must be positive");
        this.durationMs = durationMs;
        this.onProgress = onProgress;
    }

    void add(long frame, int rate, float peak) {
        if (!Float.isFinite(peak) || peak <= 0) return;
        int bin = Math.min(BINS - 1, (int) (frame * (1000.0 * BINS / durationMs) / rate));
        peaks[bin] = Math.max(peaks[bin], Math.min(1, peak));
    }

    void reportProgress(long frame, int rate, long nowMs) {
        if (onProgress == null || frame <= 0 || nowMs < nextUpdate) return;
        nextUpdate = nowMs + UPDATE_INTERVAL_MS;
        long processedMs = Math.min(durationMs, Math.round(frame * 1000.0 / rate));
        onProgress.accept(finish(), processedMs);
    }

    float[] finish() {
        return normalize(peaks.clone());
    }

    static float[] normalize(float[] bins) {
        float maximum = 0;
        for (float peak : bins) maximum = Math.max(maximum, peak);
        if (maximum > 0) {
            for (int bin = 0; bin < bins.length; bin++) {
                // Compress the visual range so quiet notes remain visible beside louder peaks.
                bins[bin] = (float) Math.sqrt(bins[bin] / maximum);
            }
        }
        return bins;
    }
}
