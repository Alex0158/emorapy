import { Platform } from 'react-native';

import type { EvidenceUploadFormDataOptions, PickImageOptions, PickImageResult, UploadAsset } from './types';

type ExpoImagePickerModule = typeof import('expo-image-picker');
declare const require: (moduleName: 'expo-image-picker') => ExpoImagePickerModule;

function isNativeImagePickerPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function loadExpoImagePicker(): ExpoImagePickerModule | null {
  if (!isNativeImagePickerPlatform()) return null;
  return require('expo-image-picker');
}

export async function pickImage(options: PickImageOptions = {}): Promise<UploadAsset | null> {
  const result = await pickImageWithStatus(options);
  return result.status === 'selected' ? (result.asset ?? null) : null;
}

export async function pickImageWithStatus(options: PickImageOptions = {}): Promise<PickImageResult> {
  const ImagePicker = loadExpoImagePicker();
  if (!ImagePicker) return { status: 'unsupported' };

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'permission_denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: options.allowsEditing ?? false,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: options.quality ?? 0.86,
  });

  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  const asset = result.assets[0];
  return {
    status: 'selected',
    asset: {
      uri: asset.uri,
      fileName: asset.fileName ?? undefined,
      mimeType: asset.mimeType ?? undefined,
      fileSize: asset.fileSize ?? undefined,
    },
  };
}

export function createUploadFormData(asset: UploadAsset, fieldName = 'file'): FormData {
  const formData = new FormData();
  formData.append(fieldName, {
    uri: asset.uri,
    name: asset.fileName ?? 'upload.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);
  return formData;
}

export function createEvidenceUploadFormData(
  assets: UploadAsset[],
  options: EvidenceUploadFormDataOptions = {}
): FormData {
  const formData = new FormData();
  const fieldName = options.fieldName ?? 'files';
  assets.slice(0, 3).forEach((asset, index) => {
    formData.append(fieldName, {
      uri: asset.uri,
      name: asset.fileName ?? `evidence-${index + 1}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
  });

  if (options.safetyAssertion) {
    formData.append('safety_assertion', JSON.stringify(options.safetyAssertion));
  }

  return formData;
}
