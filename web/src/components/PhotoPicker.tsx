// PNG photo picker with a round preview and the standard-photo checks (add and replace).
import { useEffect, useState } from "react";
import { checkPhoto, PHOTO_SIZE } from "../lib/garmentForm";

export interface PickedPhoto {
  file: File;
  preview: string;
  errors: string[];
}

export function PhotoPicker({ onChange, invalid }: { onChange: (photo: PickedPhoto | null) => void; invalid?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setDims(null);
    const img = new Image();
    img.onload = () => setDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const check = file ? checkPhoto(file, dims) : null;
  useEffect(() => {
    onChange(file && preview && check ? { file, preview, errors: check.errors } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, preview, dims]);

  return (
    <>
      <div className={invalid ? "photo-pick invalid" : "photo-pick"}>
        <span className="photo-preview">{preview ? <img src={preview} alt="" /> : "PNG"}</span>
        <input type="file" accept="image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {check?.errors.map((m) => <small key={m} className="error">{m}</small>)}
      {check?.warnings.map((m) => <small key={m} className="muted">{m}</small>)}
      {!file && <small className="muted">The standard garment photo: {PHOTO_SIZE} × {PHOTO_SIZE} px PNG.</small>}
    </>
  );
}
