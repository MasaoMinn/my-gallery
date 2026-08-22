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
  body: ReadableStream,
  image: {
    albumId: string;
    imageId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }
): Promise<R2Object> {
  const fixedLengthStream = new FixedLengthStream(image.sizeBytes);
  const putPromise = bucket.put(key, fixedLengthStream.readable, {
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
  const [, object] = await Promise.all([
    body.pipeTo(fixedLengthStream.writable),
    putPromise
  ]);

  if (!object) {
    throw new Error("R2 rejected the image upload");
  }

  return object;
}

export async function deleteImageObject(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

function safeExtension(filename: string): string {
  const match = filename.toLowerCase().match(/\.[a-z0-9]{1,8}$/);
  return match?.[0] ?? ".bin";
}
