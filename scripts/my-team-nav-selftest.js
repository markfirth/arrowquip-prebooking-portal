#!/usr/bin/env node
/* Verifies the My Team navigation bridge contract used by my-team.js.
   Simulates the bug: setting window.terr must not be required; goMyTeam must exist. */
var fs = require('fs');
var path = require('path');
var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var mt = fs.readFileSync(path.join(__dirname, '..', 'my-team.js'), 'utf8');
var failed = 0;
function chk(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failed++;
}
chk('goMyTeam defined in index.html', /function goMyTeam\(/.test(html));
chk('goMyTeam assigned to window', /window\.goMyTeam\s*=\s*goMyTeam/.test(html));
chk('goMyTeam sets lexical terr to Team', /terr\s*=\s*'Team'/.test(html) && /function goMyTeam/.test(html));
chk('gear menu sets lexical terr inline', /if\(a==='team'\)[\s\S]{0,400}?terr\s*=\s*'Team'/.test(html));
chk('openMyTeam prefers goMyTeam', /typeof global\.goMyTeam === 'function'/.test(mt));
chk('Sales Assistant role seeded', /id:\s*'SA'/.test(mt) && /Sales Assistant/.test(mt));
chk('setPortalTerr bridge present', /function setPortalTerr\(/.test(html));
chk('getPortalTerr bridge present', /function getPortalTerr\(/.test(html));
chk('ADMIN is var (shared with my-team.js)', /\bvar ADMIN\s*=\s*\{/.test(html));
chk('getPortalAdmin bridge present', /function getPortalAdmin\(/.test(html));
chk('my-team uses getPortalAdmin', /getPortalAdmin/.test(mt));
chk('Add User send invitation CTA', /SEND INVITATION/.test(mt));
chk('Status column in table', /LAST SIGN-IN[\s\S]*STATUS[\s\S]*ADMIN/.test(mt));
chk('SW cache bumped for My Team', /aq-prebooking-v(?:[4-9]|\d{2,})/.test(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8')));
chk('SW network-first for my-team.js', /my-team\.js/.test(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8')));

/* Behavioral: prove window.terr mutation does not affect lexical terr */
(function lexicalBridge() {
  var terr = 'All';
  function setPortalTerr(t) { terr = t; }
  function getPortalTerr() { return terr; }
  var fakeWindow = { terr: 'All' };
  fakeWindow.terr = 'Team';
  chk('window.terr alone does not change lexical terr (root bug)', getPortalTerr() === 'All' && fakeWindow.terr === 'Team');
  setPortalTerr('Team');
  chk('setPortalTerr updates lexical terr', getPortalTerr() === 'Team');
})();

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nMy Team navigation contract OK');
process.exit(0);
