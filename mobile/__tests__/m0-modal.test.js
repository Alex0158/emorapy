const React = require('react');
const { fireEvent, render, waitFor } = require('@testing-library/react-native');

const mockPickImageWithStatus = jest.fn();
const mockCreateEvidenceUploadFormData = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
}));

jest.mock('@/src/config/runtime', () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: 'https://api.private.example/api/v1',
  }),
}));

jest.mock('@/src/platform/upload/native', () => ({
  createEvidenceUploadFormData: mockCreateEvidenceUploadFormData,
  pickImageWithStatus: mockPickImageWithStatus,
}));

const { setLocale } = require('@/src/i18n');
const ModalScreen = require('../app/modal').default;

describe('M0 App status modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
    mockPickImageWithStatus.mockResolvedValue({ status: 'cancelled' });
    mockCreateEvidenceUploadFormData.mockReturnValue(new FormData());
  });

  it('shows service readiness without exposing the raw service URL', () => {
    const screen = render(React.createElement(ModalScreen));

    expect(screen.getByText('App')).toBeTruthy();
    expect(screen.getByText('App 狀態')).toBeTruthy();
    expect(screen.getByText('已準備連線')).toBeTruthy();
    expect(screen.queryByText('APP')).toBeNull();
    expect(screen.queryByText('https://api.private.example/api/v1')).toBeNull();
    expect(screen.queryByText('服務位址')).toBeNull();
  });

  it('renders service and upload copy in the selected locale', () => {
    setLocale('en-US', { persist: false });
    const screen = render(React.createElement(ModalScreen));

    expect(screen.getByText('App status')).toBeTruthy();
    expect(screen.getByText('Ready to connect')).toBeTruthy();
    expect(screen.getByText('No image selected')).toBeTruthy();
    expect(screen.getByText('Select image')).toBeTruthy();
  });

  it('uses user-facing upload status copy after selecting media', async () => {
    mockPickImageWithStatus.mockResolvedValueOnce({
      status: 'selected',
      asset: {
        fileName: 'evidence.jpg',
        mimeType: 'image/jpeg',
        uri: 'file:///tmp/evidence.jpg',
      },
    });
    const screen = render(React.createElement(ModalScreen));

    fireEvent.press(screen.getByText('選擇圖片'));

    await waitFor(() => expect(mockCreateEvidenceUploadFormData).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('圖片已準備，可隨案件一起上傳。')).toBeTruthy();
    expect(screen.queryByText(/https?:\/\//)).toBeNull();
  });
});
