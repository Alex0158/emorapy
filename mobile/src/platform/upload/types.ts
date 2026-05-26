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

export type PickImageStatus = 'unsupported' | 'permission_denied' | 'cancelled' | 'selected';

export interface PickImageResult {
  status: PickImageStatus;
  asset?: UploadAsset;
}

export interface EvidenceSafetyAssertion {
  contains_minor?: boolean;
  contains_sensitive_content?: boolean;
  contains_nonconsensual_content?: boolean;
  contains_illegal_content?: boolean;
  minor_guardian_or_self_upload_confirmed?: boolean;
  sensitive_content_handling_ack?: boolean;
}

export interface EvidenceUploadFormDataOptions {
  fieldName?: string;
  safetyAssertion?: EvidenceSafetyAssertion;
}
