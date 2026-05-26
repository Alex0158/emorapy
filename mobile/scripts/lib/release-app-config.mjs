const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getExpoProjectId(app) {
  const value = app?.extra?.eas?.projectId;
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidExpoProjectId(value) {
  return uuidPattern.test(String(value || '').trim());
}

export function getExpoProjectIdStatus(app) {
  const value = getExpoProjectId(app);
  return {
    present: value.length > 0,
    valid: isValidExpoProjectId(value),
    format: value.length > 0 ? 'uuid' : 'missing',
  };
}
