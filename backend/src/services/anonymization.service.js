import fs from "fs";
import { supabase } from "../config/supabase.js";

/**
 * Runs the face anonymization pipeline wrapper.
 * Uploads the raw file to a temporary staging path, simulates the anonymization,
 * copies the resulting file to the final path, and deletes the staging file immediately.
 * 
 * @param {string} localFilePath - Path to the local processed temp file.
 * @param {string} bucket - The destination bucket name.
 * @param {string} destPath - The final path (e.g. "media/userId/mediaId.mp4").
 * @param {string} mimeType - The mime type of the file.
 * @returns {Promise<void>}
 */
export async function runFaceAnonymization(localFilePath, bucket, destPath, mimeType) {
  if (!supabase) {
    throw new Error("Supabase client is not initialized. Cannot run upload pipeline.");
  }

  const stagingPath = `staging/${destPath}`;
  
  // 1. Upload raw file to staging bucket
  const fileBuffer = await fs.promises.readFile(localFilePath);
  const { error: uploadStagingError } = await supabase.storage
    .from(bucket)
    .upload(stagingPath, fileBuffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: true
    });

  if (uploadStagingError) {
    throw new Error(`Failed to upload raw file to staging: ${uploadStagingError.message}`);
  }

  // 2. Perform anonymization simulation
  // We copy the file from staging to the final destPath (simulating output generation)
  const { error: moveError } = await supabase.storage
    .from(bucket)
    .copy(stagingPath, destPath);

  if (moveError) {
    // Attempt clean up of staging file
    await supabase.storage.from(bucket).remove([stagingPath]).catch(console.error);
    throw new Error(`Face anonymization failed to copy/move file: ${moveError.message}`);
  }

  // 3. Delete staging file immediately after anonymization succeeds (storage efficiency)
  const { error: deleteStagingError } = await supabase.storage
    .from(bucket)
    .remove([stagingPath]);

  if (deleteStagingError) {
    console.error(`Warning: Failed to clean up raw staging file ${stagingPath}:`, deleteStagingError.message);
  }
}
