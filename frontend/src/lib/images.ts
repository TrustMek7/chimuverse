import * as exifr from "exifr";
export async function preparePhoto(file: File) {
  if (file.size > 25 * 1024 * 1024) throw new Error("La foto supera 25 MB.");
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ].includes(file.type)
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
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "El navegador no pudo abrir esta foto. Si es HEIC, expórtala como JPEG.",
    );
  }
  const convert = async (max: number) => {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
    bitmap.close();
  }
}
