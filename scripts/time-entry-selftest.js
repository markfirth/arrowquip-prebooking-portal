#!/usr/bin/env node
/* Time-entry + scheduling regression helpers (browser parseTimeLoose mirrored). */
function parseTimeLoose(v) {
  var raw = String(v == null ? '' : v).trim();
  if (!raw) return '';
  var s = raw.toLowerCase().replace(/\s+/g, '').replace(/\./g, ':');
  var m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)?$/);
  if (!m) {
    m = s.match(/^(\d{3,4})(am|pm|a|p)?$/);
    if (m) {
      var dig = m[1], apx = m[2] || '';
      if (dig.length === 3) m = ['', dig.charAt(0), dig.slice(1), apx];
      else m = ['', dig.slice(0, 2), dig.slice(2), apx];
    } else return null;
  }
  var h = +m[1], mm = m[2] != null && m[2] !== '' ? +m[2] : 0;
  var apRaw = m[3] || '';
  var ap = apRaw.indexOf('p') === 0 ? 'p' : (apRaw.indexOf('a') === 0 ? 'a' : '');
  if (!isFinite(h) || !isFinite(mm) || mm > 59) return null;
  if (ap === 'a') {
    if (h > 12) return null;
    h = h % 12;
  } else if (ap === 'p') {
    if (h > 12) return null;
    h = (h % 12) + 12;
  } else {
    if (h > 23) return null;
    if (h >= 1 && h <= 12) return { ambiguous: true, h: h, mm: mm, raw: raw };
  }
  return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
}

function t12s(t) {
  if (!t) return '';
  var p = t.split(':').map(Number);
  var h = p[0], m = p[1];
  var ap = h < 12 ? 'AM' : 'PM';
  var hr = h % 12 || 12;
  return hr + (m ? (':' + String(m).padStart(2, '0')) : '') + ' ' + ap;
}

var cases = [
  ['9am', '09:00'],
  ['9 am', '09:00'],
  ['9:30am', '09:30'],
  ['930am', '09:30'],
  ['2pm', '14:00'],
  ['230pm', '14:30'],
  ['14:30', '14:30'],
  ['1430', '14:30'],
  ['9', 'ambiguous'],
  ['12pm', '12:00'],
  ['12am', '00:00'],
];

var failed = 0;
cases.forEach(function (c) {
  var got = parseTimeLoose(c[0]);
  var ok;
  if (c[1] === 'ambiguous') ok = got && got.ambiguous;
  else ok = got === c[1];
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + c[0] + ' → ' + JSON.stringify(got) + (ok ? '' : ' (want ' + c[1] + ')'));
  if (!ok) failed++;
  if (ok && c[1] !== 'ambiguous') {
    var disp = t12s(got);
    console.log('       display ' + disp);
  }
});

var eng = require('../scheduling.js');
var show = { id: 'show', type: 'tradeshow', name: 'Show', startMin: 9 * 60, endMin: 17 * 60 };
var zoom = { id: 'zoom', virtual: true, name: 'Zoom', startMin: 11 * 60, endMin: 11 * 60 + 30 };
var nest = eng.evaluatePair(show, zoom);
console.log((nest.nested && !nest.conflict ? 'PASS' : 'FAIL') + '  virtual during trade show still allowed');
if (!(nest.nested && !nest.conflict)) failed++;

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll time-entry checks passed');
process.exit(0);
