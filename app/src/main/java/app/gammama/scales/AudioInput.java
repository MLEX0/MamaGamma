package app.gammama.scales;

import android.annotation.SuppressLint;
import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.SystemClock;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

final class AudioInput {
    private AudioInput() {}

    @SuppressLint("MissingPermission") // The recording controller checks RECORD_AUDIO before starting.
    static TonalAnalyzer.Clip record(BooleanSupplier stop, BooleanSupplier cancelled) throws IOException {
        if (stop.getAsBoolean() || cancelled.getAsBoolean()) return null;
        int rate = 44100;
        int minimum = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (minimum <= 0) throw new IOException("Unsupported microphone format");
        short[] block = new short[2048];
        AudioRecord recorder = new AudioRecord(MediaRecorder.AudioSource.MIC, rate, AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT, Math.max(minimum, block.length * 4));
        try {
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) throw new IOException("Microphone unavailable");
            recorder.startRecording();
            if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IOException("Recording did not start");
            TonalAnalyzer.Clip clip = new TonalAnalyzer.Clip(recorder.getSampleRate());
            long deadline = SystemClock.elapsedRealtime() + TonalAnalyzer.MAX_SECONDS * 1000L;
            while (!stop.getAsBoolean() && !cancelled.getAsBoolean() && !clip.full()
                    && SystemClock.elapsedRealtime() < deadline) {
                int read = recorder.read(block, 0, block.length, AudioRecord.READ_BLOCKING);
                if (read < 0) throw new IOException("Microphone read failed");
                for (int i = 0; i < read; i++) clip.add(block[i] / 32768f);
            }
            return clip;
        } finally {
            try {
                if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) recorder.stop();
            } finally {
                recorder.release();
            }
        }
    }

    static TonalAnalyzer.Clip decode(Context context, Uri uri, BooleanSupplier cancelled,
            Consumer<MediaFormat> onTrack) throws IOException {
        MediaExtractor extractor = new MediaExtractor();
        try {
            extractor.setDataSource(context, uri, null);
            for (int track = 0; track < extractor.getTrackCount(); track++) {
                MediaFormat format = extractor.getTrackFormat(track);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime == null || !mime.startsWith("audio/")) continue;
                onTrack.accept(format);
                extractor.selectTrack(track);
                if ("audio/raw".equals(mime)) return readPcm(extractor, format, cancelled);
                return decodeTrack(extractor, format, mime, cancelled);
            }
            throw new IOException("No audio track");
        } finally {
            extractor.release();
        }
    }

    private static TonalAnalyzer.Clip readPcm(MediaExtractor extractor, MediaFormat format,
            BooleanSupplier cancelled) throws IOException {
        PcmReader reader = new PcmReader(format);
        ByteBuffer block = ByteBuffer.allocateDirect(256 * 1024);
        while (!cancelled.getAsBoolean() && !reader.clip.full()) {
            block.clear();
            int read = extractor.readSampleData(block, 0);
            if (read < 0) break;
            block.position(0);
            block.limit(read);
            reader.read(block);
            if (!extractor.advance()) break;
        }
        return reader.clip;
    }

    private static TonalAnalyzer.Clip decodeTrack(MediaExtractor extractor, MediaFormat format, String mime,
            BooleanSupplier cancelled) throws IOException {
        MediaCodec decoder = MediaCodec.createDecoderByType(mime);
        try {
            decoder.configure(format, null, null, 0);
            decoder.start();
            boolean inputFinished = false;
            PcmReader reader = null;
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            long lastProgress = SystemClock.elapsedRealtime();
            while (!cancelled.getAsBoolean() && (reader == null || !reader.clip.full())) {
                if (!inputFinished) {
                    int index = decoder.dequeueInputBuffer(10000);
                    if (index >= 0) {
                        ByteBuffer buffer = decoder.getInputBuffer(index);
                        if (buffer == null) throw new IOException("Decoder input missing");
                        int read = extractor.readSampleData(buffer, 0);
                        inputFinished = read < 0;
                        decoder.queueInputBuffer(index, 0, Math.max(0, read), inputFinished ? 0 : extractor.getSampleTime(),
                                inputFinished ? MediaCodec.BUFFER_FLAG_END_OF_STREAM : 0);
                        if (!inputFinished) extractor.advance();
                        lastProgress = SystemClock.elapsedRealtime();
                    }
                }
                int index = decoder.dequeueOutputBuffer(info, 10000);
                if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    if (reader == null) reader = new PcmReader(decoder.getOutputFormat());
                    lastProgress = SystemClock.elapsedRealtime();
                } else if (index >= 0) {
                    try {
                        if (info.size > 0 && (info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                            if (reader == null) reader = new PcmReader(decoder.getOutputFormat(index));
                            ByteBuffer buffer = decoder.getOutputBuffer(index);
                            if (buffer == null) throw new IOException("Decoder output missing");
                            buffer.limit(info.offset + info.size);
                            buffer.position(info.offset);
                            reader.read(buffer);
                        }
                    } finally {
                        decoder.releaseOutputBuffer(index, false);
                    }
                    if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) break;
                    lastProgress = SystemClock.elapsedRealtime();
                }
                if (SystemClock.elapsedRealtime() - lastProgress > 5000) throw new IOException("Audio decoder stalled");
            }
            return reader == null ? null : reader.clip;
        } finally {
            decoder.release();
        }
    }

    private static final class PcmReader {
        final TonalAnalyzer.Clip clip;
        private final int channels;
        private final int encoding;
        private final int frameBytes;

        PcmReader(MediaFormat format) throws IOException {
            channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
            encoding = format.containsKey(MediaFormat.KEY_PCM_ENCODING) ? format.getInteger(MediaFormat.KEY_PCM_ENCODING)
                    : AudioFormat.ENCODING_PCM_16BIT;
            int sampleBytes;
            switch (encoding) {
                case AudioFormat.ENCODING_PCM_8BIT: sampleBytes = 1; break;
                case AudioFormat.ENCODING_PCM_16BIT: sampleBytes = 2; break;
                case AudioFormat.ENCODING_PCM_24BIT_PACKED: sampleBytes = 3; break;
                case AudioFormat.ENCODING_PCM_32BIT:
                case AudioFormat.ENCODING_PCM_FLOAT: sampleBytes = 4; break;
                default: throw new IOException("Unsupported PCM encoding");
            }
            if (channels < 1 || channels > 32) throw new IOException("Invalid channel count");
            frameBytes = channels * sampleBytes;
            clip = new TonalAnalyzer.Clip(format.getInteger(MediaFormat.KEY_SAMPLE_RATE));
        }

        void read(ByteBuffer buffer) {
            buffer.order(ByteOrder.LITTLE_ENDIAN);
            while (buffer.remaining() >= frameBytes && !clip.full()) {
                float sample = 0;
                for (int channel = 0; channel < channels; channel++) {
                    switch (encoding) {
                        case AudioFormat.ENCODING_PCM_8BIT: sample += ((buffer.get() & 255) - 128) / 128f; break;
                        case AudioFormat.ENCODING_PCM_16BIT: sample += buffer.getShort() / 32768f; break;
                        case AudioFormat.ENCODING_PCM_24BIT_PACKED:
                            int value = (buffer.get() & 255) | ((buffer.get() & 255) << 8) | (buffer.get() << 16);
                            sample += value / 8388608f;
                            break;
                        case AudioFormat.ENCODING_PCM_32BIT: sample += buffer.getInt() / 2147483648f; break;
                        default: sample += buffer.getFloat();
                    }
                }
                clip.add(sample / channels);
            }
        }
    }
}
