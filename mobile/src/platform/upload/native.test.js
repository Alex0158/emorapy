jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

const ImagePicker = require('expo-image-picker');
const { Platform } = require('react-native');
const { createEvidenceUploadFormData, pickImage, pickImageWithStatus } = require('./native');

describe('Upload platform adapter', () => {
  const OriginalFormData = global.FormData;
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    jest.clearAllMocks();
    global.FormData = OriginalFormData;
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => originalPlatformOS,
    });
  });

  function setPlatformOS(os) {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => os,
    });
  }

  it('skips ImagePicker on web so static export does not require native picker side effects', async () => {
    setPlatformOS('web');

    await expect(pickImage()).resolves.toBeNull();
    await expect(pickImageWithStatus()).resolves.toEqual({ status: 'unsupported' });

    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('does not launch picker when media permission is denied', async () => {
    setPlatformOS('ios');
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(pickImage()).resolves.toBeNull();
    await expect(pickImageWithStatus()).resolves.toEqual({ status: 'permission_denied' });

    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('reports native picker cancellation without producing an upload asset', async () => {
    setPlatformOS('android');
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });

    await expect(pickImageWithStatus()).resolves.toEqual({ status: 'cancelled' });
    await expect(pickImage()).resolves.toBeNull();
  });

  it('normalizes the selected native image asset', async () => {
    setPlatformOS('ios');
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{
        fileName: 'evidence.jpg',
        fileSize: 1280,
        mimeType: 'image/jpeg',
        uri: 'file://evidence.jpg',
      }],
    });

    await expect(pickImage({ allowsEditing: true, quality: 0.72 })).resolves.toEqual({
      fileName: 'evidence.jpg',
      fileSize: 1280,
      mimeType: 'image/jpeg',
      uri: 'file://evidence.jpg',
    });
    await expect(pickImageWithStatus({ allowsEditing: true, quality: 0.72 })).resolves.toEqual({
      status: 'selected',
      asset: {
        fileName: 'evidence.jpg',
        fileSize: 1280,
        mimeType: 'image/jpeg',
        uri: 'file://evidence.jpg',
      },
    });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72,
    });
  });

  it('creates backend-compatible evidence FormData without screen-level file decisions', () => {
    const append = jest.fn();
    global.FormData = jest.fn(() => ({ append }));

    const formData = createEvidenceUploadFormData(
      [
        { uri: 'file://one.jpg', fileName: 'one.jpg', mimeType: 'image/jpeg' },
        { uri: 'file://two.jpg' },
      ],
      {
        safetyAssertion: {
          contains_sensitive_content: true,
          sensitive_content_handling_ack: true,
        },
      }
    );

    expect(formData).toBeTruthy();
    expect(append).toHaveBeenNthCalledWith(1, 'files', expect.objectContaining({
      name: 'one.jpg',
      type: 'image/jpeg',
      uri: 'file://one.jpg',
    }));
    expect(append).toHaveBeenNthCalledWith(2, 'files', expect.objectContaining({
      name: 'evidence-2.jpg',
      type: 'image/jpeg',
      uri: 'file://two.jpg',
    }));
    expect(append).toHaveBeenNthCalledWith(
      3,
      'safety_assertion',
      JSON.stringify({ contains_sensitive_content: true, sensitive_content_handling_ack: true })
    );
  });
});
