const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'df6z5jvia';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'jangoes_unsigned';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// Compression settings
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 0.7; // 70% quality — good balance of size vs clarity

/**
 * Compress an image file client-side using canvas before uploading.
 * Resizes to fit within MAX_WIDTH × MAX_HEIGHT and converts to JPEG at 70% quality.
 * Typically reduces a 5 MB phone photo to ~100–200 KB.
 */
function compressImage(file: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down proportionally if exceeds max dimensions
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/**
 * Compress and upload a single image file to Cloudinary (unsigned).
 * Returns the secure URL of the uploaded image.
 * @param file   — the File/Blob to upload
 * @param folder — optional Cloudinary folder path (e.g. "kyc/vehicle")
 */
export async function uploadToCloudinary(file: File | Blob, folder?: string): Promise<string> {
  // Compress before uploading
  const compressed = await compressImage(file);

  const formData = new FormData();
  formData.append('file', compressed);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) {
    formData.append('folder', folder);
  }

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Cloudinary upload error:', errBody);
    throw new Error('Image upload failed. Please try again.');
  }

  const data = await response.json();
  return data.secure_url;
}
