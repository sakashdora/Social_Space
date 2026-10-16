/**
 * Lightweight MediaPipe FaceDetector wrapper.
 * Loads on-demand; falls back to null if unsupported.
 */
import type { FaceDetector } from "@mediapipe/tasks-vision";

let detectorPromise: Promise<FaceDetector | null> | null = null;

async function loadDetector(): Promise<FaceDetector | null> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    try {
      const { FilesetResolver, FaceDetector } =
        await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      const detector = await FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
      return detector;
    } catch (err) {
      console.warn("FaceDetector unavailable:", err);
      return null;
    }
  })();
  return detectorPromise;
}

export type FaceBox = {
  /** normalized 0..1 relative to source image */
  x: number;
  y: number;
  w: number;
  h: number;
};

export async function detectFaces(image: HTMLImageElement): Promise<FaceBox[]> {
  const detector = await loadDetector();
  if (!detector)
    throw new Error(
      "Face detection is unavailable. No face protection was applied.",
    );
  const result = detector.detect(image);
  return (result.detections || []).flatMap((detection) => {
    const box = detection.boundingBox;
    if (!box) return [];
    const pad = 0.12,
      iw = image.naturalWidth || image.width,
      ih = image.naturalHeight || image.height;
    const x = Math.max(0, (box.originX - box.width * pad) / iw);
    const y = Math.max(0, (box.originY - box.height * pad) / ih);
    return [
      {
        x,
        y,
        w: Math.min(1 - x, (box.width * (1 + 2 * pad)) / iw),
        h: Math.min(1 - y, (box.height * (1 + 2 * pad)) / ih),
      },
    ];
  });
}
export async function detectFace(
  image: HTMLImageElement,
): Promise<FaceBox | null> {
  try {
    return (await detectFaces(image))[0] || null;
  } catch {
    return null;
  }
}

/** Read an image File and return { dataUrl, image } once decoded. */
export function loadImageFromFile(
  file: File,
): Promise<{ dataUrl: string; image: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ dataUrl, image: img });
      img.onerror = () => reject(new Error("Could not decode the image."));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function loadImageFromUrl(
  url: string,
): Promise<{ dataUrl: string; image: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        // Re-encode to a data URL so we can send it to the server.
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        resolve({ dataUrl, image: img });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Could not load the demo image."));
    img.src = url;
  });
}
