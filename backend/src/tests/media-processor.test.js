import { it, expect } from "@jest/globals";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { probeVideoDuration, stripClipMetadata, extractVideoThumbnail } from "../utils/mediaProcessor.js";

it("validates real video bytes, removes title metadata, and creates a thumbnail", async () => {
  const root = path.resolve("../tmp");
  await fs.mkdir(root, { recursive: true });
  const scratch = await fs.mkdtemp(path.join(root, "clip-test-"));
  const source = path.join(scratch, "source.mp4"); const output = path.join(scratch, "clean.mp4");
  const run = promisify(execFile);
  try {
    await run(ffmpeg, ["-nostdin", "-f", "lavfi", "-i", "color=c=blue:s=160x90:d=1", "-metadata", "title=PRIVATE LOCATION", "-c:v", "mpeg4", source], { timeout: 15000 });
    expect((await probeVideoDuration(source, false)).valid).toBe(true);
    expect((await probeVideoDuration(source, false, true)).valid).toBe(false);
    await stripClipMetadata(source, output);
    const metadata = await run(ffprobe.path, ["-v", "error", "-show_entries", "format_tags", "-of", "json", output]);
    expect(metadata.stdout).not.toContain("PRIVATE LOCATION");
    const thumbnail = path.join(scratch, "preview.jpg");
    expect(await extractVideoThumbnail(output, thumbnail)).toBe(true);
    expect((await fs.stat(thumbnail)).size).toBeGreaterThan(0);
  } finally {
    if (path.dirname(path.resolve(scratch)) !== root || !path.basename(scratch).startsWith("clip-test-")) throw new Error("Unexpected scratch directory");
    await fs.rm(scratch, { recursive: true, force: true });
  }
}, 30000);
