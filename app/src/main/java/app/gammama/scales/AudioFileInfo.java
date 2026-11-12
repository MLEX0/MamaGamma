package app.gammama.scales;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.media.MediaFormat;
import android.net.Uri;
import android.provider.OpenableColumns;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

final class AudioFileInfo {
    private final String name;
    private final String format;
    private final String codec;
    private final long size;
    private final long durationMs;

    private AudioFileInfo(String name, String format, String codec, long size, long durationMs) {
        this.name = name;
        this.format = format;
        this.codec = codec;
        this.size = size;
        this.durationMs = durationMs;
    }

    static AudioFileInfo read(Context context, Uri uri) {
        ContentResolver resolver = context.getContentResolver();
        String name = "";
        long size = -1;
        try (Cursor cursor = resolver.query(uri, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE},
                null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameColumn >= 0 && !cursor.isNull(nameColumn)) {
                    String displayName = cursor.getString(nameColumn);
                    if (displayName != null && !displayName.trim().isEmpty()) name = displayName;
                }
                if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) size = cursor.getLong(sizeColumn);
            }
        } catch (RuntimeException ignored) {
            // Some providers serve audio without implementing a metadata query.
        }
        int dot = name.lastIndexOf('.');
        String extension = dot < 0 ? "" : name.substring(dot + 1);
        String format = extension.matches("[a-zA-Z0-9]{1,8}") ? extension.toUpperCase(Locale.ROOT) : "";
        if (format.isEmpty()) {
            try {
                String mime = resolver.getType(uri);
                if ("audio/mp4".equals(mime) || "application/mp4".equals(mime) || "video/mp4".equals(mime)) format = "MP4";
                else if ("audio/x-m4a".equals(mime) || "application/x-m4a".equals(mime)) format = "M4A";
                else format = codecName(mime);
            } catch (RuntimeException ignored) {
                // The decoded track can supply its codec later.
            }
        }
        return new AudioFileInfo(name, format, "", size, -1);
    }

    AudioFileInfo withTrack(MediaFormat track) {
        long duration = track.containsKey(MediaFormat.KEY_DURATION) ? track.getLong(MediaFormat.KEY_DURATION) : -1;
        return new AudioFileInfo(name, format, codecName(track.getString(MediaFormat.KEY_MIME)), size,
                duration >= 0 ? duration / 1000 : -1);
    }

    private static String codecName(String mime) {
        if (mime == null) return "";
        switch (mime) {
            case "audio/mp4a-latm":
            case "audio/aac": return "AAC";
            case "audio/alac": return "ALAC";
            case "audio/mpeg": return "MP3";
            case "audio/wav":
            case "audio/x-wav": return "WAV";
            case "audio/raw": return "PCM";
            case "audio/flac": return "FLAC";
            case "audio/opus": return "Opus";
            case "audio/vorbis": return "Vorbis";
            default: return "";
        }
    }

    JSONObject toJson() {
        Map<String, Object> data = new HashMap<>();
        data.put("name", name);
        data.put("format", format);
        data.put("codec", codec);
        data.put("size", size);
        data.put("durationMs", durationMs);
        return new JSONObject(data);
    }
}
