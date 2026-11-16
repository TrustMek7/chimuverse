import * as exifr from "exifr";
import { check, supabase } from "./supabase";
export async function preparePhoto(file: File) {
  if (file.size > 25 * 1024 * 1024) throw new Error("La foto supera 25 MB.");
  // Some browsers (and files shared from phones) report JPG as image/jpg or
  // leave File.type empty. Trust known image extensions in that case; decoding
  // below still verifies that the file is actually a supported image.
  const extension = file.name.split(".").pop()?.toLowerCase();
  const supportedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  const supportedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
  if (
    !supportedTypes.includes(file.type.toLowerCase()) &&
    !(file.type === "" && supportedExtensions.includes(extension ?? ""))
  )
    throw new Error("Usa una foto JPEG, PNG o WebP.");
  let captured: Date | undefined;
  try {
    const meta = await exifr.parse(file, ["DateTimeOriginal"]);
    if (meta?.DateTimeOriginal instanceof Date)
      captured = meta.DateTimeOriginal;
  } catch {
    /* Manual date is required if no EXIF. */
  }
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let release = () => {};
  try {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    release = () => bitmap.close();
  } catch {
    // createImageBitmap can be missing or unreliable in some mobile browsers.
    // HTMLImageElement uses the browser's regular image decoder as a fallback.
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("decode"));
        image.src = url;
      });
      source = image;
      width = image.naturalWidth;
      height = image.naturalHeight;
      release = () => URL.revokeObjectURL(url);
    } catch {
      URL.revokeObjectURL(url);
      throw new Error(
        "No se pudo leer esta foto en el celular. Prueba compartirla o guardarla como JPG/JPEG.",
      );
    }
  }
  const convert = async (max: number) => {
    const scale = Math.min(1, max / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas
      .getContext("2d")!
      .drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("No se pudo comprimir la foto.")),
        "image/webp",
        0.82,
      ),
    );
    if (blob.type !== "image/webp")
      throw new Error(
        "Este navegador no permite convertir a WebP. Prueba con Chrome, Firefox o Edge.",
      );
    return { blob, width: canvas.width, height: canvas.height };
  };
  try {
    return { full: await convert(2560), thumb: await convert(480), captured };
  } finally {
    release();
  }
}

/**
 * Compresses and uploads one photo to the shared vault, returning its id.
 * `fallbackDate` is used when the file carries no EXIF date; `preferDate` wins over EXIF.
 */
export async function uploadPhoto(opts: {
  file: File;
  spaceId: string;
  title: string;
  fallbackDate?: Date;
  preferDate?: Date;
  tripId?: string | null;
}) {
  const id = crypto.randomUUID();
  const base = `${opts.spaceId}/${id}`;
  const image = await preparePhoto(opts.file);
  const date = opts.preferDate ?? image.captured ?? opts.fallbackDate;
  if (!date || !Number.isFinite(date.getTime()))
    throw new Error("Esta foto no tiene fecha EXIF. Indica la fecha del recuerdo.");
  const bucket = supabase.storage.from("photos");
  let created = false;
  try {
    check(await bucket.upload(`${base}/full.webp`, image.full.blob, { contentType: "image/webp", upsert: false }));
    created = true;
    check(await bucket.upload(`${base}/thumb.webp`, image.thumb.blob, { contentType: "image/webp", upsert: false }));
    check(
      await supabase.from("photos").insert({
        id,
        space_id: opts.spaceId,
        title: opts.title.slice(0, 160),
        storage_path: `${base}/full.webp`,
        thumb_path: `${base}/thumb.webp`,
        captured_at: date.toISOString(),
        captured_at_source: !opts.preferDate && image.captured ? "exif" : "manual",
        visibility: "shared",
        trip_id: opts.tripId ?? null,
        size_bytes: image.full.blob.size + image.thumb.blob.size,
        width: image.full.width,
        height: image.full.height,
      }),
    );
    return id;
  } catch (e) {
    if (created) await bucket.remove([`${base}/full.webp`, `${base}/thumb.webp`]);
    throw e;
  }
}

/** The photo's EXIF capture date, if any; used to suggest when a date was lived. */
export async function readCaptureDate(file: File) {
  try {
    const meta = await exifr.parse(file, ["DateTimeOriginal"]);
    return meta?.DateTimeOriginal instanceof Date ? meta.DateTimeOriginal : undefined;
  } catch {
    return undefined;
  }
}
