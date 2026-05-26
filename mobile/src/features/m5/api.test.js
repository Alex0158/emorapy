const mockCreateM5ApiClient = jest.fn(() => ({ marker: 'm5-api' }));

jest.mock('@cj/api-client', () => ({
  createM5ApiClient: mockCreateM5ApiClient,
}), { virtual: true });

jest.mock('@/src/platform/api/client', () => ({
  appApiClient: {
    instance: { marker: 'axios' },
    normalizeError: (error) => ({
      code: error?.code || 'APP_ERROR',
      message: error?.message || 'failed',
    }),
  },
}));

const { m5Api, normalizeM5Error } = require('./api');

describe('M5 feature API adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('binds M5 shared client to the App API adapter', () => {
    expect(m5Api).toEqual({ marker: 'm5-api' });
  });

  it('normalizes App API errors for notification and upload screens', () => {
    expect(normalizeM5Error({ code: 'FORBIDDEN', message: 'no' })).toEqual({
      code: 'FORBIDDEN',
      message: 'no',
    });
  });
});
