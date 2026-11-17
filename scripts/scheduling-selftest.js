#!/usr/bin/env node
/* Arrowquip TRAVEL — scheduling engine self-tests */
var path = require('path');
var eng = require(path.join(__dirname, '..', 'scheduling.js'));
var out = eng.runSelfTests();
out.results.forEach(function (r) {
  console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name);
});
if (!out.ok) {
  console.error('\n' + out.failed.length + ' test(s) failed');
  process.exit(1);
}
console.log('\nAll ' + out.results.length + ' scheduling tests passed');
process.exit(0);
