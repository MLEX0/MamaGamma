package app.gammama.scales;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.function.BooleanSupplier;

final class TonalAnalyzer {
    static final int MAX_SECONDS = 20;
    private static final int SIZE = 8192;
    private static final int HOP = SIZE / 4;
    // Krumhansl–Kessler probe-tone profiles, starting on the tonic.
    private static final double[] MAJOR = {6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88};
    private static final double[] MINOR = {6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17};

    private TonalAnalyzer() {}

    static final class Clip {
        final float[] samples;
        private final int decimation;
        final double rate;
        int size;
        private int pending;
        private float sum;

        Clip(int inputRate) {
            if (inputRate <= 0 || inputRate > 384000) throw new IllegalArgumentException("Invalid sample rate");
            decimation = Math.max(1, inputRate / 12000);
            rate = (double) inputRate / decimation;
            samples = new float[(int) (rate * MAX_SECONDS)];
        }

        void add(float sample) {
            if (full()) return;
            if (Float.isFinite(sample)) sum += Math.max(-1, Math.min(1, sample));
            if (++pending == decimation) {
                samples[size++] = sum / decimation;
                pending = 0;
                sum = 0;
            }
        }

        boolean full() {
            return size == samples.length;
        }

        long durationMs() {
            return Math.round(1000 * size / rate);
        }
    }

    private static final class Peak {
        final double hz;
        final double magnitude;

        Peak(double hz, double magnitude) {
            this.hz = hz;
            this.magnitude = magnitude;
        }
    }

    private static final class Candidate {
        final String id;
        final double score;

        Candidate(String id, double score) {
            this.id = id;
            this.score = score;
        }
    }

    static List<String> estimate(Clip clip, BooleanSupplier cancelled) {
        if (clip == null || clip.size < clip.rate * 1.25) return new ArrayList<>();
        double[] real = new double[SIZE];
        double[] imaginary = new double[SIZE];
        double[] window = new double[SIZE];
        for (int i = 0; i < SIZE; i++) window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (SIZE - 1));
        double[] chroma = new double[12];
        double[] bass = new double[12];
        double[] ending = new double[12];
        int tonalFrames = 0;
        int tailStart = (int) (clip.size - Math.min(clip.rate * 2.5, clip.size * 0.25));

        for (int offset = 0; offset + SIZE <= clip.size; offset += HOP) {
            if (cancelled.getAsBoolean()) return new ArrayList<>();
            double energy = 0;
            for (int i = 0; i < SIZE; i++) {
                double sample = clip.samples[offset + i];
                energy += sample * sample;
                real[i] = sample * window[i];
            }
            if (energy / SIZE < 0.000004) continue;
            Arrays.fill(imaginary, 0);
            fft(real, imaginary);
            List<Peak> peaks = spectralPeaks(real, imaginary, clip.rate);
            if (peaks.isEmpty()) continue;
            tonalFrames++;
            double total = 0;
            for (Peak peak : peaks) total += peak.magnitude;
            double frameWeight = Math.pow(energy / SIZE, 0.25);
            for (Peak peak : peaks) {
                int midi = (int) Math.round(69 + 12 * Math.log(peak.hz / 440) / Math.log(2));
                int note = Math.floorMod(midi, 12);
                double weight = frameWeight * peak.magnitude / total;
                chroma[note] += weight;
                if (peak.hz < 245) bass[note] += weight;
                if (offset + SIZE / 2 >= tailStart) ending[note] += weight;
            }
        }

        double max = Arrays.stream(chroma).max().orElse(0);
        int distinct = 0;
        for (double weight : chroma) if (weight > max * 0.10) distinct++;
        if (tonalFrames < 4 || distinct < 3) return new ArrayList<>();
        return rank(chroma, bass, ending);
    }

    private static List<Peak> spectralPeaks(double[] real, double[] imaginary, double rate) {
        int low = Math.max(2, (int) Math.ceil(36 * SIZE / rate));
        int high = Math.min(SIZE / 2 - 2, (int) (1800 * SIZE / rate));
        double strongest = 0;
        double energy = 0;
        for (int bin = low - 1; bin <= high + 1; bin++) {
            real[bin] = Math.hypot(real[bin], imaginary[bin]);
            strongest = Math.max(strongest, real[bin]);
            energy += real[bin] * real[bin];
        }
        List<Peak> peaks = new ArrayList<>();
        if (strongest * strongest < energy * 0.025) return peaks;
        double peakEnergy = 0;
        for (int bin = low; bin <= high; bin++) {
            double center = real[bin];
            if (center < strongest * 0.12 || center <= real[bin - 1] || center <= real[bin + 1]) continue;
            peakEnergy += center * center;
            double left = Math.log(real[bin - 1] + 1e-12);
            double right = Math.log(real[bin + 1] + 1e-12);
            double shift = 0.5 * (left - right) / (left - 2 * Math.log(center) + right);
            double hz = (bin + shift) * rate / SIZE;
            if (!isOvertone(peaks, hz, center)) peaks.add(new Peak(hz, center));
        }
        if (peakEnergy < energy * 0.34) peaks.clear();
        return peaks;
    }

    private static boolean isOvertone(List<Peak> peaks, double hz, double magnitude) {
        for (Peak lower : peaks) {
            double ratio = hz / lower.hz;
            long harmonic = Math.round(ratio);
            if (harmonic >= 2 && harmonic <= 8 && Math.abs(ratio - harmonic) < 0.035
                    && magnitude < lower.magnitude * 0.8) return true;
        }
        return false;
    }

    private static List<String> rank(double[] chroma, double[] bass, double[] ending) {
        double maxBass = Math.max(1e-9, Arrays.stream(bass).max().orElse(0));
        double maxEnding = Math.max(1e-9, Arrays.stream(ending).max().orElse(0));
        List<Candidate> candidates = new ArrayList<>(24);
        for (int root = 0; root < 12; root++) {
            double tonicEvidence = 0.12 * bass[root] / maxBass + 0.07 * ending[root] / maxEnding;
            candidates.add(new Candidate(root + "-major", correlation(chroma, MAJOR, root) + tonicEvidence));
            candidates.add(new Candidate(root + "-minor", correlation(chroma, MINOR, root) + tonicEvidence));
        }
        candidates.sort(Comparator.comparingDouble((Candidate item) -> item.score).reversed());
        double best = candidates.get(0).score;
        List<String> keys = new ArrayList<>(3);
        if (best < 0.52) return keys;
        for (int i = 0; i < 3; i++) {
            Candidate candidate = candidates.get(i);
            if (candidate.score >= Math.max(0.48, best - 0.27)) keys.add(candidate.id);
        }
        return keys;
    }

    private static double correlation(double[] chroma, double[] profile, int root) {
        double mean = Arrays.stream(chroma).average().orElse(0);
        double profileMean = Arrays.stream(profile).average().orElse(0);
        double numerator = 0;
        double energy = 0;
        double profileEnergy = 0;
        for (int i = 0; i < 12; i++) {
            double a = chroma[(i + root) % 12] - mean;
            double b = profile[i] - profileMean;
            numerator += a * b;
            energy += a * a;
            profileEnergy += b * b;
        }
        return energy > 0 ? numerator / Math.sqrt(energy * profileEnergy) : 0;
    }

    private static void fft(double[] real, double[] imaginary) {
        for (int i = 1, j = 0; i < SIZE; i++) {
            int bit = SIZE >> 1;
            while ((j & bit) != 0) {
                j ^= bit;
                bit >>= 1;
            }
            j ^= bit;
            if (i < j) {
                double saved = real[i];
                real[i] = real[j];
                real[j] = saved;
            }
        }
        for (int width = 2; width <= SIZE; width *= 2) {
            double cosine = Math.cos(-2 * Math.PI / width);
            double sine = Math.sin(-2 * Math.PI / width);
            for (int block = 0; block < SIZE; block += width) {
                double wr = 1;
                double wi = 0;
                for (int i = block; i < block + width / 2; i++) {
                    int other = i + width / 2;
                    double r = real[other] * wr - imaginary[other] * wi;
                    double im = real[other] * wi + imaginary[other] * wr;
                    real[other] = real[i] - r;
                    imaginary[other] = imaginary[i] - im;
                    real[i] += r;
                    imaginary[i] += im;
                    double next = wr * cosine - wi * sine;
                    wi = wi * cosine + wr * sine;
                    wr = next;
                }
            }
        }
    }
}
