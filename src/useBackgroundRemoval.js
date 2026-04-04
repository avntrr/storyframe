import { removeBackground } from "@imgly/background-removal";
import { useRef, useState, useCallback, useEffect } from "react";

const MAX_PX = 2048;

// Resize image to max MAX_PX on longest edge before processing
function resizeImageUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= MAX_PX && h <= MAX_PX) { resolve(dataUrl); return; }
      const scale = MAX_PX / Math.max(w, h);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function useBackgroundRemoval() {
  const [status, setStatus] = useState("idle"); // idle | loading-model | processing | ready | error
  const [subjectUrl, setSubjectUrl] = useState(null);
  const [error, setError] = useState(null);
  const [modelProgress, setModelProgress] = useState(0);

  const currentUrlRef = useRef(null);
  const abortRef = useRef(false);

  // Revoke previous object URL
  const revokeUrl = useCallback(() => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
  }, []);

  const process = useCallback(async (imageDataUrl) => {
    if (!imageDataUrl) return;
    abortRef.current = false;
    revokeUrl();
    setSubjectUrl(null);
    setError(null);
    setModelProgress(0);
    setStatus("loading-model");

    try {
      const resized = await resizeImageUrl(imageDataUrl);
      if (abortRef.current) return;

      let modelLoaded = false;
      const blob = await removeBackground(resized, {
        output: { format: "image/png", quality: 1 },
        progress: (key, current, total) => {
          if (key === "fetch:onnx" || key.startsWith("fetch:")) {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0;
            setModelProgress(pct);
            setStatus("loading-model");
          } else {
            if (!modelLoaded) { modelLoaded = true; setStatus("processing"); }
          }
        },
      });

      if (abortRef.current) return;

      const url = URL.createObjectURL(blob);
      currentUrlRef.current = url;
      setSubjectUrl(url);
      setStatus("ready");
    } catch (e) {
      if (!abortRef.current) {
        setError(e?.message || "Background removal gagal");
        setStatus("error");
      }
    }
  }, [revokeUrl]);

  const reset = useCallback(() => {
    abortRef.current = true;
    revokeUrl();
    setSubjectUrl(null);
    setStatus("idle");
    setError(null);
    setModelProgress(0);
  }, [revokeUrl]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      revokeUrl();
    };
  }, [revokeUrl]);

  return { process, reset, status, subjectUrl, error, modelProgress };
}
