import { translate, UPDATE_ENDPOINTS } from './locales';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(translate('pl', 'nav.usb').includes('USB'), 'pl nav.usb');
assert(translate('en', 'nav.usb').includes('USB'), 'en nav.usb');
assert(translate('en', 'nav.simulator') === 'Hardware Simulator', 'en simulator');
assert(translate('en', 'flash.buildFlash') === 'Build + Flash', 'en flash');
assert(translate('en', 'usb.detect').includes('Detect'), 'en usb');
assert(UPDATE_ENDPOINTS.stable[0].includes('latest.json'), 'stable endpoint');
assert(UPDATE_ENDPOINTS.beta[0].includes('latest-beta.json'), 'beta endpoint');

console.log('locales.test.ts: OK');
