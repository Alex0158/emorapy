/** 文件上傳項目（替代 antd UploadFile） */
export interface UploadFile<T = unknown> {
  uid: string;
  name: string;
  status?: 'uploading' | 'done' | 'error' | 'removed';
  url?: string;
  preview?: string;
  originFileObj?: File;
  response?: T;
}
