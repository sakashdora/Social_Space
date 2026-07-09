import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import sharp from "sharp";
import path from "path";

// Configure paths for static binaries
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Gets exact video duration in seconds using ffprobe.
 * Runs entirely server-side.
 * 
 * @param {string} filePath - Local path to the video file.
 * @returns {Promise<number>} - Duration in seconds.
 */
export function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(new Error(`ffprobe failed: ${err.message}`));
      }
      const duration = metadata?.format?.duration;
      if (duration === undefined) {
        return reject(new Error("Video duration not found in metadata."));
      }
      resolve(parseFloat(duration));
    });
  });
}

/**
 * Resizes an image to a max dimension of 1600px and converts to WebP.
 * 
 * @param {string} inputPath - Path to the original file.
 * @param {string} outputPath - Path where to save the processed file.
 * @returns {Promise<void>}
 */
export async function compressImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true
    })
    .toFormat("webp", { quality: 85 })
    .toFile(outputPath);
}

/**
 * Transcodes a video using H.264 at a resolution cap of 720p and CRF 28.
 * 
 * @param {string} inputPath - Path to the original file.
 * @param {string} outputPath - Path where to save the transcoded file.
 * @returns {Promise<void>}
 */
export function transcodeVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .size("?x720") // Cap height at 720p, preserve aspect ratio
      .videoCodec("libx264")
      .outputOptions([
        "-crf 28",
        "-preset fast",
        "-movflags +faststart" // optimize for Web streaming
      ])
      .audioCodec("aac")
      .save(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`Transcoding failed: ${err.message}`)));
  });
}

/**
 * Extracts a thumbnail image (frame) from a video at 1.0 seconds.
 * 
 * @param {string} inputPath - Path to the video file.
 * @param {string} outputDir - Directory where to write the thumbnail.
 * @param {string} thumbnailFilename - Name of the output thumbnail file.
 * @returns {Promise<string>} - Absolute path to the generated thumbnail.
 */
export function extractVideoThumbnail(inputPath, outputDir, thumbnailFilename) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [1.0], // extract frame at 1s mark
        filename: thumbnailFilename,
        folder: outputDir,
        size: "320x?" // small preview size
      })
      .on("end", () => resolve(path.join(outputDir, thumbnailFilename)))
      .on("error", (err) => reject(new Error(`Thumbnail extraction failed: ${err.message}`)));
  });
}
