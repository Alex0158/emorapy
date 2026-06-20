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

export function getExpectedExpoProjectFullName(app) {
  const owner = typeof app?.owner === 'string' ? app.owner.trim() : '';
  const slug = typeof app?.slug === 'string' ? app.slug.trim() : '';
  if (!owner || !slug) return '';
  return `@${owner}/${slug}`;
}

export function normalizeExpoProjectFullName(value) {
  return String(value ?? '').trim();
}

export function getExpoProjectIdentityStatus(app, projectFullName) {
  const projectId = getExpoProjectIdStatus(app);
  const expectedFullName = getExpectedExpoProjectFullName(app);
  const configuredFullName = normalizeExpoProjectFullName(projectFullName);
  const fullNameMatches = Boolean(
    expectedFullName &&
    configuredFullName &&
    configuredFullName === expectedFullName
  );

  return {
    project_id_present: projectId.present,
    project_id_valid: projectId.valid,
    project_id_format: projectId.format,
    expected_full_name: expectedFullName || null,
    configured_full_name_present: configuredFullName.length > 0,
    configured_full_name: configuredFullName || null,
    full_name_matches_expected: fullNameMatches,
    valid: projectId.valid && fullNameMatches,
  };
}
