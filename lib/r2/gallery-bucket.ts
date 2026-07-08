const extensionByContentType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif"
};

export function createImageObjectKey(
  albumId: string,
  imageId: string,
  filename: string,
  contentType: string
): string {
  const extension = extensionByContentType[contentType] ?? safeExtension(filename);
  return `albums/${albumId}/images/${imageId}/original${extension}`;
}

export async function putImageObject(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer,
  image: {
    albumId: string;
    imageId: string;
    filename: string;
    contentType: string;
  }
): Promise<void> {
  await bucket.put(key, body, {
    httpMetadata: {
      contentType: image.contentType,
      cacheControl: "public,max-age=31536000,immutable"
    },
    customMetadata: {
      albumId: image.albumId,
      imageId: image.imageId,
      originalFilename: image.filename
    }
  });
}

export async function deleteImageObject(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

function safeExtension(filename: string): string {
  const match = filename.toLowerCase().match(/\.[a-z0-9]{1,8}$/);
  return match?.[0] ?? ".bin";
}
