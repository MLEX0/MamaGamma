package app.gammama.scales;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;

final class MelodyAnalyzer {
    private static final int SILENCE = -1;

    private MelodyAnalyzer() {}

    static final class Note {
        final int midi;
        final long startMs;
        final long endMs;

        Note(int midi, long startMs, long endMs) {
            this.midi = midi;
            this.startMs = startMs;
            this.endMs = endMs;
        }
    }

    static List<Note> estimate(TonalAnalyzer.Clip clip, long originMs, BooleanSupplier cancelled) {
        List<Note> notes = new ArrayList<>();
        if (clip == null || clip.durationMs() < 65) return notes;
        int hop = Math.max(1, (int) Math.round(clip.rate * 0.03));
        int halfWindow = Math.max(1, (int) Math.round(clip.rate * 0.07));
        int frames = (clip.size + hop - 1) / hop;
        int[] pitches = new int[frames];
        float[] frame = new float[halfWindow * 2];

        for (int i = 0; i < frames; i++) {
            if (cancelled.getAsBoolean()) return new ArrayList<>();
            int center = i * hop + hop / 2;
            int from = Math.max(0, center - halfWindow);
            int to = Math.min(clip.size, center + halfWindow);
            System.arraycopy(clip.samples, from, frame, 0, to - from);
            double hz = PitchDetector.estimate(frame, to - from, clip.rate);
            int midi = hz > 0 ? (int) Math.round(69 + 12 * Math.log(hz / 440) / Math.log(2)) : SILENCE;
            pitches[i] = midi >= 0 && midi < 128 ? midi : SILENCE;
        }

        int[] stable = pitches.clone();
        for (int i = 1; i < frames - 1; i++) {
            // Remove one-hop pitch or silence glitches between identical notes.
            if (pitches[i - 1] == pitches[i + 1]) stable[i] = pitches[i - 1];
        }

        int start = 0;
        for (int end = 1; end <= frames; end++) {
            if (end < frames && stable[start] == stable[end]) continue;
            if (stable[start] != SILENCE && end - start >= 2) {
                long fromMs = originMs + Math.round(1000.0 * start * hop / clip.rate);
                long toMs = originMs + Math.min(clip.durationMs(), Math.round(1000.0 * end * hop / clip.rate));
                notes.add(new Note(stable[start], fromMs, toMs));
            }
            start = end;
        }
        return notes;
    }
}
