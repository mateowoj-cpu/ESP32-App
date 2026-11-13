import { translate, UPDATE_ENDPOINTS } from './locales';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(translate('pl', 'nav.usb').includes('USB'), 'pl nav.usb');
assert(translate('en', 'nav.usb').includes('USB'), 'en nav.usb');
assert(translate('en', 'nav.simulator') === 'Hardware Simulator', 'en simulator');
assert(translate('en', 'flash.buildFlash') === 'Build + Flash', 'en flash');
assert(translate('en', 'usb.detect').includes('Detect'), 'en usb');
assert(translate('en', 'ota.title').includes('OTA'), 'en ota');
assert(translate('pl', 'ota.upload').includes('OTA'), 'pl ota');
assert(translate('en', 'auto.title').toLowerCase().includes('automation'), 'en auto');
assert(translate('en', 'editor.palette').toLowerCase().includes('palette'), 'en editor');
assert(translate('en', 'sim.on') === 'ON', 'en sim');
assert(translate('en', 'editor.widget.pet').toLowerCase().includes('pet'), 'en widget pet');
assert(translate('en', 'ota.discover').toLowerCase().includes('mdns'), 'en ota discover');
assert(translate('pl', 'ota.discover').toLowerCase().includes('mdns'), 'pl ota discover');
assert(translate('en', 'settings.mdnsName').toLowerCase().includes('mdns'), 'en mdns settings');
assert(translate('en', 'auto.ruleCreator').toLowerCase().includes('rule'), 'en rule creator');
assert(translate('en', 'pet.step.happy.name').toLowerCase().includes('smile'), 'en pet step');
assert(translate('pl', 'integ.city.dortmund').toLowerCase().includes('dortmund'), 'pl city');
assert(translate('en', 'pinout.title').toLowerCase().includes('pin'), 'en pinout');
assert(translate('en', 'ota.cancel').toLowerCase().includes('cancel'), 'en ota cancel');
assert(translate('en', 'desktop.diagnosticsExport').toLowerCase().includes('zip'), 'en diag zip');
assert(translate('pl', 'desktop.boardSync').toLowerCase().includes('profil'), 'pl board sync');
assert(UPDATE_ENDPOINTS.stable[0].includes('latest.json'), 'stable endpoint');
assert(UPDATE_ENDPOINTS.beta[0].includes('latest-beta.json'), 'beta endpoint');

console.log('locales.test.ts: OK');
