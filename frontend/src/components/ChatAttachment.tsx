import { useEffect, useState } from "react";
import {
  downloadChatAttachment,
  type ChatAttachment as Attachment,
} from "@/lib/api";

export function ChatAttachment({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState(attachment.previewUrl || "");
  const [error, setError] = useState("");
  const { mediaId, key, iv, mimeType, name, previewUrl } = attachment;
  useEffect(() => {
    setError("");
    setUrl(previewUrl || "");
    if (previewUrl) return;
    let active = true;
    let objectUrl: string | undefined;
    void downloadChatAttachment({ mediaId, key, iv, mimeType, name })
      .then((value) => {
        objectUrl = value;
        if (active) setUrl(value);
        else URL.revokeObjectURL(value);
      })
      .catch(() => {
        if (active) setError("Attachment expired or could not be decrypted.");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, key, iv, mimeType, name, previewUrl]);
  if (error)
    return (
      <p role="alert" className="text-xs text-muted-foreground">
        {error}
      </p>
    );
  if (!url)
    return (
      <p className="text-xs text-muted-foreground">Decrypting attachment…</p>
    );
  if (attachment.mimeType.startsWith("video/"))
    return (
      <video controls playsInline src={url} className="max-h-80 rounded-xl" />
    );
  if (attachment.mimeType.startsWith("audio/"))
    return <audio controls src={url} />;
  if (/^image\/(jpeg|png|webp|gif)$/.test(attachment.mimeType))
    return (
      <img src={url} alt={attachment.name} className="max-h-80 rounded-xl" />
    );
  return (
    <a href={url} download={attachment.name}>
      Download attachment
    </a>
  );
}
