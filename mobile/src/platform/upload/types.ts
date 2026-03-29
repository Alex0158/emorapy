export interface UploadAsset {
  uri: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface PickImageOptions {
  allowsEditing?: boolean;
  quality?: number;
}
