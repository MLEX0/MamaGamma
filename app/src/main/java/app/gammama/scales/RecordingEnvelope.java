package app.gammama.scales;

import java.util.Arrays;

final class RecordingEnvelope {
    private static final int BAR_MS = 20;
    private static final int LIVE_BARS = 120;
    private final int framesPerBar;
    private final int sampleRate;
    private final float[] peaks;
    private int frames;

    RecordingEnvelope(int sampleRate, int maxFrames) {
        this.sampleRate = sampleRate;
        framesPerBar = Math.max(1, sampleRate * BAR_MS / 1000);
        peaks = new float[(maxFrames + framesPerBar - 1) / framesPerBar];
    }

    void add(short sample) {
        int bin = frames++ / framesPerBar;
        peaks[bin] = Math.max(peaks[bin], Math.abs(sample) / 32768f);
    }

    long elapsedMs() {
        return Math.round(frames * 1000.0 / sampleRate);
    }

    float[] liveBars() {
        int count = (frames + framesPerBar - 1) / framesPerBar;
        return Arrays.copyOfRange(peaks, Math.max(0, count - LIVE_BARS), count);
    }

    float[] overview() {
        float[] result = new float[WaveformEnvelope.BINS];
        if (frames == 0) return result;
        for (int bin = 0; bin < result.length; bin++) {
            int firstFrame = (int) ((long) bin * frames / result.length);
            int lastFrame = (int) (((long) (bin + 1) * frames - 1) / result.length);
            for (int bar = firstFrame / framesPerBar; bar <= lastFrame / framesPerBar; bar++) {
                result[bin] = Math.max(result[bin], peaks[bar]);
            }
        }
        return WaveformEnvelope.normalize(result);
    }
}
