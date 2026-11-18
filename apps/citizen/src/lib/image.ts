/**
 * Resize στο κινητό πριν το upload (~1600 px, JPEG): μια φωτογραφία 4–8 MB γίνεται ~300 KB,
 * άρα ανεβαίνει σε <1 s σε 4G. Ο browser εφαρμόζει μόνος του το EXIF orientation στο <img>.
 * Αν κάτι αποτύχει, στέλνουμε το αρχικό αρχείο· ο gateway κάνει ούτως ή άλλως resize.
 */
const MAX_PX = 1600;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

export async function preparePhoto(file: File): Promise<Blob> {
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
