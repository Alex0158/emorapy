import { parseAdbDeviceRows, parseXctraceListDevices, parseXctracePhysicalDevices } from './lib/release-device-discovery.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const xctraceCurrentShape = `== Devices ==
Alex的Mac Studio (D4B950DB-AB38-50A3-B6E1-35457D59B999)

== Devices Offline ==
Alex的iPad (7) (18.7.7) (00008027-000D51113EE9802E)
Hey bro (26.0) (00008101-0009218821D8001E)

== Simulators ==
iPhone 17 (26.4.1) (F7A5EB0B-BCAD-4BB1-8F6F-5E43FA848F06)`;

const parsedCurrentShape = parseXctraceListDevices(xctraceCurrentShape);
assert(
  parsedCurrentShape.some((device) => device.name.includes('Mac Studio') && !device.isPhysical),
  'xctrace parser must not classify the host Mac as a physical iOS device.'
);
assert(
  parsedCurrentShape.filter((device) => device.isPhysical && device.section === 'devices_offline').length === 2,
  'xctrace parser must count offline iOS physical devices without exposing UDIDs.'
);
assert(
  parsedCurrentShape.filter((device) => device.isSimulator).length === 1,
  'xctrace parser must keep simulator counts separate from physical devices.'
);
assert(
  parseXctracePhysicalDevices(xctraceCurrentShape).length === 0,
  'xctrace parser must not report offline physical devices as connected physical devices.'
);

const xctraceConnectedCustomName = `== Devices ==
Hey bro (26.0) (00008101-0009218821D8001E)`;
assert(
  parseXctracePhysicalDevices(xctraceConnectedCustomName).length === 1,
  'xctrace parser must accept connected iOS devices with custom names.'
);

const adbRows = parseAdbDeviceRows(`List of devices attached
emulator-5554 device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1
R5CT123456 device product:dm3qxxx model:SM_S918B device:dm3q transport_id:2
ZY22 offline transport_id:3`);
assert(adbRows.length === 3, 'adb parser must parse all non-empty device rows.');
assert(adbRows.filter((device) => device.state === 'device' && device.isEmulator).length === 1, 'adb parser must identify emulator rows.');
assert(adbRows.filter((device) => device.state === 'device' && !device.isEmulator).length === 1, 'adb parser must keep physical Android rows separate from emulators.');
assert(adbRows.filter((device) => device.state !== 'device').length === 1, 'adb parser must keep offline / unauthorized rows visible.');

console.log('[device-discovery-parser-check] ok: iOS xctrace and Android adb parser fixtures passed');
