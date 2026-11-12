package app.gammama.scales;

final class PitchDetector {
    private PitchDetector() {}

    // YIN period search using a cumulative mean-normalized difference function.
    static double estimate(float[] samples, int count, double sampleRate) {
        if (count < 128 || count > samples.length || !Double.isFinite(sampleRate) || sampleRate <= 0) return 0;
        double sum = 0;
        double energy = 0;
        for (int i = 0; i < count; i++) {
            sum += samples[i];
            energy += samples[i] * samples[i];
        }
        double mean = sum / count;
        if (energy / count - mean * mean < 0.00000324) return 0;

        int shortest = Math.max(2, (int) Math.floor(sampleRate / 1800));
        int longest = Math.min(count / 2 - 1, (int) Math.ceil(sampleRate / 30));
        if (longest <= shortest) return 0;
        int comparisonLength = count - longest - 1;
        double[] differences = new double[longest + 2];
        double[] normalized = new double[differences.length];
        normalized[0] = 1;
        double cumulative = 0;
        for (int lag = 1; lag < differences.length; lag++) {
            double difference = 0;
            for (int i = 0; i < comparisonLength; i++) {
                double delta = samples[i] - samples[i + lag];
                difference += delta * delta;
            }
            differences[lag] = difference;
            cumulative += difference;
            normalized[lag] = cumulative > 0 ? difference * lag / cumulative : 1;
        }

        int period = -1;
        for (int lag = shortest; lag <= longest; lag++) {
            if (normalized[lag] > 0.2 || normalized[lag] > normalized[lag - 1]
                    || normalized[lag] > normalized[lag + 1]) continue;
            period = lag;
            break;
        }
        if (period < 0) return 0;

        // Prefer a stronger fundamental when an overtone caused the first shallow minimum.
        if (period >= 20 && 2 * period - 2 <= longest) {
            int doublePeriod = Math.min(longest, 2 * period);
            for (int lag = 2 * period - 2; lag <= Math.min(longest, 2 * period + 2); lag++) {
                if (normalized[lag] < normalized[doublePeriod]) doublePeriod = lag;
            }
            if (normalized[doublePeriod] < normalized[period] - 0.045) period = doublePeriod;
        }
        double previous = differences[period - 1];
        double middle = differences[period];
        double next = differences[period + 1];
        double curvature = previous - 2 * middle + next;
        double offset = curvature > 0 ? 0.5 * (previous - next) / curvature : 0;
        double hz = sampleRate / (period + Math.max(-0.5, Math.min(0.5, offset)));
        return hz >= 30 && hz <= 1800 ? hz : 0;
    }
}
