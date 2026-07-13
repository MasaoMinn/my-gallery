export type ImageFileIdentity = {
  filename: string;
  sizeBytes: number;
  contentType: string;
};

export function imageIdentityKey(identity: ImageFileIdentity): string {
  return JSON.stringify([
    identity.filename,
    identity.sizeBytes,
    identity.contentType
  ]);
}
