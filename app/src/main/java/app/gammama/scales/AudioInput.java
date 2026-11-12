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

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

final class AudioInput {
    private static final int MAX_RECORDING_SECONDS = 120;
    private static final long DECODER_PREROLL_US = 200_000;

    private AudioInput() {}

    static RecordingEnvelope record(File target, BooleanSupplier stop, BooleanSupplier cancelled,
            BiConsumer<float[], Long> onRecording) throws IOException {
        synchronized (MicrophoneAccess.LOCK) {
            return recordWav(target, stop, cancelled, onRecording);
        }
    }

    @SuppressLint("MissingPermission") // The recording controller checks RECORD_AUDIO before starting.
    private static RecordingEnvelope recordWav(File target, BooleanSupplier stop, BooleanSupplier cancelled,
            BiConsumer<float[], Long> onRecording) throws IOException {
        int rate = 44100;
        if (stop.getAsBoolean() || cancelled.getAsBoolean()) return new RecordingEnvelope(rate, 0);
        int minimum = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (minimum <= 0) throw new IOException("Unsupported microphone format");
        short[] block = new short[2048];
        AudioRecord recorder = new AudioRecord(MediaRecorder.AudioSource.MIC, rate, AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT, Math.max(minimum, block.length * 4));
        try (RandomAccessFile wav = new RandomAccessFile(target, "rw")) {
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) throw new IOException("Microphone unavailable");
            recorder.startRecording();
            if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IOException("Recording did not start");
            int sampleRate = recorder.getSampleRate();
            int maxFrames = sampleRate * MAX_RECORDING_SECONDS;
            RecordingEnvelope envelope = new RecordingEnvelope(sampleRate, maxFrames);
            int frames = 0;
            byte[] encoded = new byte[block.length * 2];
            wav.seek(44);
            long deadline = SystemClock.elapsedRealtime() + MAX_RECORDING_SECONDS * 1000L;
            long nextUpdate = 0;
            while (!stop.getAsBoolean() && !cancelled.getAsBoolean() && frames < maxFrames
                    && SystemClock.elapsedRealtime() < deadline) {
                int read = recorder.read(block, 0, Math.min(block.length, maxFrames - frames), AudioRecord.READ_BLOCKING);
                if (read < 0) throw new IOException("Microphone read failed");
                for (int i = 0; i < read; i++) {
                    encoded[2 * i] = (byte) block[i];
                    encoded[2 * i + 1] = (byte) (block[i] >> 8);
                    envelope.add(block[i]);
                }
                wav.write(encoded, 0, read * 2);
                frames += read;
                long now = SystemClock.elapsedRealtime();
                if (read > 0 && now >= nextUpdate) {
                    nextUpdate = now + 80;
                    onRecording.accept(envelope.liveBars(), envelope.elapsedMs());
                }
            }
            wav.seek(0);
            ByteBuffer header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
            header.putInt(0x46464952).putInt(36 + frames * 2).putInt(0x45564157); // RIFF, WAVE
            header.putInt(0x20746d66).putInt(16).putShort((short) 1).putShort((short) 1); // fmt, PCM mono
            header.putInt(sampleRate).putInt(sampleRate * 2).putShort((short) 2).putShort((short) 16);
            header.putInt(0x61746164).putInt(frames * 2); // data
            wav.write(header.array());
            return envelope;
        } finally {
            try {
                if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) recorder.stop();
            } finally {
                recorder.release();
            }
        }
    }

    static TonalAnalyzer.Clip decode(Context context, Uri uri, long fromMs, long toMs, BooleanSupplier cancelled,
            Consumer<MediaFormat> onTrack) throws IOException {
        PcmReader reader = read(context, uri, fromMs, toMs, cancelled, onTrack, null);
        return reader == null ? null : reader.clip;
    }

    static float[] waveform(Context context, Uri uri, long durationMs, BooleanSupplier cancelled,
            BiConsumer<float[], Long> onProgress) throws IOException {
        WaveformEnvelope waveform = new WaveformEnvelope(durationMs, onProgress);
        read(context, uri, 0, durationMs, cancelled, track -> {}, waveform);
        return waveform.finish();
    }

    private static PcmReader read(Context context, Uri uri, long fromMs, long toMs, BooleanSupplier cancelled,
            Consumer<MediaFormat> onTrack, WaveformEnvelope waveform) throws IOException {
        MediaExtractor extractor = new MediaExtractor();
        try {
            extractor.setDataSource(context, uri, null);
            for (int track = 0; track < extractor.getTrackCount(); track++) {
                MediaFormat format = extractor.getTrackFormat(track);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime == null || !mime.startsWith("audio/")) continue;
                onTrack.accept(format);
                extractor.selectTrack(track);
                long startUs = fromMs * 1000;
                long endUs = toMs * 1000;
                boolean pcm = "audio/raw".equals(mime);
                if (startUs > 0) {
                    long seekUs = pcm ? startUs : Math.max(0, startUs - DECODER_PREROLL_US);
                    extractor.seekTo(seekUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);
                }
                if (pcm) return readPcm(extractor, format, startUs, endUs, cancelled, waveform);
                return decodeTrack(extractor, format, mime, startUs, endUs, cancelled, waveform);
            }
            throw new IOException("No audio track");
        } finally {
            extractor.release();
        }
    }

    private static PcmReader readPcm(MediaExtractor extractor, MediaFormat format,
            long startUs, long endUs, BooleanSupplier cancelled, WaveformEnvelope waveform) throws IOException {
        PcmReader reader = new PcmReader(format, startUs, endUs, waveform);
        ByteBuffer block = ByteBuffer.allocateDirect(256 * 1024);
        while (!cancelled.getAsBoolean() && !reader.done()) {
            block.clear();
            int read = extractor.readSampleData(block, 0);
            if (read < 0) break;
            block.position(0);
            block.limit(read);
            reader.read(block, extractor.getSampleTime());
            if (!extractor.advance()) break;
        }
        return reader;
    }

    private static PcmReader decodeTrack(MediaExtractor extractor, MediaFormat format, String mime,
            long startUs, long endUs, BooleanSupplier cancelled, WaveformEnvelope waveform) throws IOException {
        MediaCodec decoder = MediaCodec.createDecoderByType(mime);
        try {
            decoder.configure(format, null, null, 0);
            decoder.start();
            boolean inputFinished = false;
            PcmReader reader = null;
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            long lastProgress = SystemClock.elapsedRealtime();
            while (!cancelled.getAsBoolean() && (reader == null || !reader.done())) {
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
                    if (reader == null) reader = new PcmReader(decoder.getOutputFormat(), startUs, endUs, waveform);
                    lastProgress = SystemClock.elapsedRealtime();
                } else if (index >= 0) {
                    try {
                        if (info.size > 0 && (info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                            if (reader == null) reader = new PcmReader(decoder.getOutputFormat(index), startUs, endUs, waveform);
                            ByteBuffer buffer = decoder.getOutputBuffer(index);
                            if (buffer == null) throw new IOException("Decoder output missing");
                            buffer.limit(info.offset + info.size);
                            buffer.position(info.offset);
                            reader.read(buffer, info.presentationTimeUs);
                        }
                    } finally {
                        decoder.releaseOutputBuffer(index, false);
                    }
                    if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) break;
                    lastProgress = SystemClock.elapsedRealtime();
                }
                if (SystemClock.elapsedRealtime() - lastProgress > 5000) throw new IOException("Audio decoder stalled");
            }
            return reader;
        } finally {
            decoder.release();
        }
    }

    private static final class PcmReader {
        final TonalAnalyzer.Clip clip;
        private final WaveformEnvelope waveform;
        private final int channels;
        private final int encoding;
        private final int frameBytes;
        private final int rate;
        private final long startUs;
        private final long frameLimit;
        private long frame;

        PcmReader(MediaFormat format, long startUs, long endUs, WaveformEnvelope waveform) throws IOException {
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
            rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE);
            if (rate <= 0 || rate > 384000) throw new IOException("Invalid sample rate");
            this.waveform = waveform;
            clip = waveform == null ? new TonalAnalyzer.Clip(rate) : null;
            this.startUs = startUs;
            frameLimit = (long) Math.ceil((endUs - startUs) * (rate / 1_000_000.0));
        }

        boolean done() {
            return frame >= frameLimit || clip != null && clip.full();
        }

        void read(ByteBuffer buffer, long presentationUs) {
            buffer.order(ByteOrder.LITTLE_ENDIAN);
            // Preserve the selection's time origin after seeking to a preceding packet.
            long packetFrame = Math.round((presentationUs - startUs) * (rate / 1_000_000.0));
            int skip = (int) Math.min(buffer.remaining() / frameBytes, Math.max(0, frame - packetFrame));
            buffer.position(buffer.position() + skip * frameBytes);
            if (clip == null) {
                frame = Math.max(frame, packetFrame);
            } else {
                while (frame < packetFrame && !done()) {
                    clip.add(0);
                    frame++;
                }
            }
            while (buffer.remaining() >= frameBytes && !done()) {
                float sample = 0;
                float peak = 0;
                for (int channel = 0; channel < channels; channel++) {
                    float value = readSample(buffer);
                    if (clip != null) sample += value;
                    else if (Float.isFinite(value)) peak = Math.max(peak, Math.abs(value));
                }
                if (clip != null) clip.add(sample / channels);
                else waveform.add(frame, rate, peak);
                frame++;
            }
            if (waveform != null) waveform.reportProgress(frame, rate, SystemClock.elapsedRealtime());
        }

        private float readSample(ByteBuffer buffer) {
            switch (encoding) {
                case AudioFormat.ENCODING_PCM_8BIT: return ((buffer.get() & 255) - 128) / 128f;
                case AudioFormat.ENCODING_PCM_16BIT: return buffer.getShort() / 32768f;
                case AudioFormat.ENCODING_PCM_24BIT_PACKED:
                    int value = (buffer.get() & 255) | ((buffer.get() & 255) << 8) | (buffer.get() << 16);
                    return value / 8388608f;
                case AudioFormat.ENCODING_PCM_32BIT: return buffer.getInt() / 2147483648f;
                default: return buffer.getFloat();
            }
        }
    }
}
