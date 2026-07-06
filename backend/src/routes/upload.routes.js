import multer from "multer";
import { Router } from "express";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const router = Router();

router.post("/", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    // For local dev, we just mock the URL by sending back a base64 string
    // In production, this would upload to S3/GCS and return a public URL
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const mimeType = req.file.mimetype;
    const url = `data:${mimeType};base64,${b64}`;
    
    return res.status(200).json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
