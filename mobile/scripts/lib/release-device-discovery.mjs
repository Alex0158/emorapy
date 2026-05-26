export function parseAdbDeviceRows(output) {
  return String(output || '')
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state, ...details] = line.split(/\s+/);
      return {
        serial,
        state,
        details: details.join(' '),
        isEmulator: serial?.startsWith('emulator-') || /model:sdk_gphone|product:sdk_gphone/.test(details.join(' ')),
      };
    });
}

function normalizeSection(line) {
  const value = line.trim();
  if (value === '== Devices ==') return 'devices';
  if (value === '== Devices Offline ==') return 'devices_offline';
  if (value === '== Simulators ==') return 'simulators';
  if (value.startsWith('==')) return 'other';
  return null;
}

function parseVersionedXctraceLine(line, section) {
  const match = line.match(/^(.+?)\s+\(([^()]+)\)\s+\(([A-Za-z0-9-]{8,})\)(?:\s+\(([^()]+)\))?$/);
  if (!match) return null;

  return {
    name: match[1].trim(),
    osVersion: match[2].trim(),
    identifier: match[3].trim(),
    state: match[4]?.trim() ?? null,
    section,
  };
}

function parseUnversionedXctraceLine(line, section) {
  const match = line.match(/^(.+?)\s+\(([A-Za-z0-9-]{8,})\)(?:\s+\(([^()]+)\))?$/);
  if (!match) return null;

  return {
    name: match[1].trim(),
    osVersion: null,
    identifier: match[2].trim(),
    state: match[3]?.trim() ?? null,
    section,
  };
}

function isHostMac(record) {
  return /(^|\s)(Mac|MacBook|MacBook Pro|MacBook Air|Mac Studio|Mac mini|Mac Pro|iMac)\b/i.test(record.name);
}

function isPhysicalAppleMobile(record) {
  if (!['devices', 'devices_offline'].includes(record.section)) return false;
  if (isHostMac(record)) return false;
  if (record.osVersion) return true;
  return /\b(iPhone|iPad|iPod)\b/i.test(record.name);
}

export function parseXctraceListDevices(output) {
  const devices = [];
  let section = null;

  for (const rawLine of String(output || '').split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const nextSection = normalizeSection(trimmed);
    if (nextSection) {
      section = nextSection;
      continue;
    }

    if (!['devices', 'devices_offline', 'simulators'].includes(section)) continue;

    const record =
      parseVersionedXctraceLine(trimmed, section) ||
      parseUnversionedXctraceLine(trimmed, section);
    if (!record) continue;

    devices.push({
      ...record,
      isPhysical: isPhysicalAppleMobile(record),
      isSimulator: section === 'simulators',
      isAvailable: section === 'devices' && !/unavailable|offline/i.test(record.state ?? ''),
    });
  }

  return devices;
}

export function parseXctracePhysicalDevices(output) {
  return parseXctraceListDevices(output).filter((device) => device.isPhysical && device.isAvailable);
}
