/**
 * videoDuration.js
 * Server-side accurate video duration extractor using ffprobe.
 * Uses @ffprobe-installer/ffprobe for zero-system-dependency binary.
 */
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Point fluent-ffmpeg at the bundled ffprobe binary
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Get the exact duration of a video file in seconds (integer).
 * Returns 0 if extraction fails (graceful fallback).
 *
 * @param {string} absoluteFilePath - Absolute path to the video file
 * @returns {Promise<number>} Duration in whole seconds
 */
export const getVideoDurationSeconds = (absoluteFilePath) => {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(absoluteFilePath, (err, metadata) => {
            if (err) {
                console.warn(`[ffprobe] Could not probe "${path.basename(absoluteFilePath)}":`, err.message);
                return resolve(0);
            }

            const duration = metadata?.format?.duration;

            if (!duration || !isFinite(duration) || duration <= 0) {
                // Try extracting from the first video stream as fallback
                const videoStream = metadata?.streams?.find(s => s.codec_type === 'video');
                if (videoStream?.duration && isFinite(parseFloat(videoStream.duration))) {
                    return resolve(Math.round(parseFloat(videoStream.duration)));
                }
                console.warn(`[ffprobe] Duration unavailable for "${path.basename(absoluteFilePath)}"`);
                return resolve(0);
            }

            return resolve(Math.round(duration));
        });
    });
};

/**
 * Build the absolute path from a relative /uploads/... path stored in DB.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const resolveUploadPath = (relativePath) => {
    if (!relativePath) return null;
    // e.g.  /uploads/videos/video-123.mp4  →  <backend>/uploads/videos/video-123.mp4
    return path.join(__dirname, '..', relativePath);
};
