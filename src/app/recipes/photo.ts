// A photo from the phone, made small in the browser before upload: 1600 px on
// the long edge, JPEG 0.8 (≈300 KB), like the trip journey's photos.

const LONG_EDGE = 1600;

export async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('לא הצלחנו לעבד את התמונה'))), 'image/jpeg', 0.8));
}
