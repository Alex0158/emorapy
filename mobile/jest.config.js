module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/*.test.js'],
  moduleDirectories: ['node_modules'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@emorapy/api-client$': '<rootDir>/../packages/api-client/dist/index.js',
    '^@emorapy/api-client/(.*)$': '<rootDir>/../packages/api-client/dist/$1.js',
    '^@emorapy/contracts$': '<rootDir>/../packages/contracts/dist/index.js',
    '^@emorapy/contracts/(.*)$': '<rootDir>/../packages/contracts/dist/$1.js',
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
    '^react$': '<rootDir>/node_modules/react',
    '^react-test-renderer$': '<rootDir>/node_modules/react-test-renderer',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|expo-modules-core|@expo(nent)?/.*|expo-router|@react-navigation/.*|@react-native-community/.*|react-native-safe-area-context)/)',
  ],
};
