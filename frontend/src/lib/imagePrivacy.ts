import { detectFaces, loadImageFromFile } from "./faceDetect";

export async function processImagePrivacy(file: File, mode: string) {
  const { image } = await loadImageFromFile(file);
  if (image.naturalWidth * image.naturalHeight > 40000000)
    throw new Error("Choose an image smaller than 40 megapixels.");
  const needsFaces = ["face_shield", "pixelate", "blur_bg"].includes(mode);
  const faces = needsFaces ? await detectFaces(image) : [];
  if (needsFaces && !faces.length)
    throw new Error(
      "No faces were detected. No protected copy was created. Choose metadata removal or original media, and review the image before posting.",
    );
  const canvas = document.createElement("canvas");
  const scale = Math.min(
    1,
    2048 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is unavailable in this browser.");
  if (mode === "blur_bg") {
    if (!("filter" in ctx))
      throw new Error("Background blur is unavailable in this browser.");
    ctx.filter = "blur(20px)";
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";
  for (const face of faces) {
    const x = face.x * canvas.width,
      y = face.y * canvas.height;
    const width = face.w * canvas.width,
      height = face.h * canvas.height;
    if (mode === "blur_bg") {
      ctx.drawImage(
        image,
        face.x * image.naturalWidth,
        face.y * image.naturalHeight,
        face.w * image.naturalWidth,
        face.h * image.naturalHeight,
        x,
        y,
        width,
        height,
      );
    } else {
      const small = document.createElement("canvas");
      small.width = 8;
      small.height = 8;
      const pixels = small.getContext("2d");
      if (!pixels) throw new Error("Face processing failed.");
      pixels.drawImage(canvas, x, y, width, height, 0, 0, 8, 8);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, 8, 8, x, y, width, height);
      ctx.imageSmoothingEnabled = true;
    }
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Could not create the processed image.")),
      "image/webp",
      0.85,
    ),
  );
  return {
    file: new File([blob], "image.webp", { type: "image/webp" }),
    faces: faces.length,
  };
}
