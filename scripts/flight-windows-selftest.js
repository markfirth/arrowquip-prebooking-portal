#!/usr/bin/env node
/* Soft flight-window + commercial-airport filter checks (no DOM). */
'use strict';

var fails = 0;
function pass(n) { console.log('PASS  ' + n); }
function fail(n, m) { fails++; console.log('FAIL  ' + n + (m ? (' — ' + m) : '')); }
function chk(n, cond, m) { if (cond) pass(n); else fail(n, m); }

var FLIGHT_WINDOWS = {
  morning: { id: 'morning', label: 'Morning', short: 'Morning', start: 6 * 60, end: 11 * 60, prefer: 9 * 60 },
  midday: { id: 'midday', label: 'Mid-day', short: 'Mid-day', start: 11 * 60, end: 15 * 60, prefer: 13 * 60 },
  afternoon: { id: 'afternoon', label: 'Afternoon', short: 'Afternoon', start: 15 * 60, end: 20 * 60, prefer: 17 * 60 }
};

function commercialFilter(rows, full) {
  var out = [], seen = {};
  for (var i = 0; i < rows.length; i++) {
    var a = rows[i];
    var iata = (a[0] || '').toUpperCase();
    if (!iata || iata.length !== 3) continue;
    if (full && (a[8] || 0) < 30) continue;
    if (seen[iata]) continue;
    seen[iata] = 1;
    out.push(iata);
  }
  return out;
}

/* Seed-style curated row (weight 20) should pass when not full DB */
chk('seed airline airport kept', commercialFilter([['CLT', 'Charlotte', 'Charlotte', 35, -80, 'KCLT', 'NC', 'hay', 20]], false).indexOf('CLT') >= 0);

/* Full DB: large airport weight 30+ kept */
chk('large airport kept', commercialFilter([['ATL', 'Atlanta', 'Atlanta', 33, -84, 'KATL', 'GA', 'hay', 48]], true).indexOf('ATL') >= 0);

/* Full DB: medium+scheduled+iata (~33) kept */
chk('medium scheduled kept', commercialFilter([['GSO', 'Piedmont', 'Greensboro', 36, -79, 'KGSO', 'NC', 'hay', 33]], true).indexOf('GSO') >= 0);

/* Full DB: small / private hangar excluded */
chk('small private excluded', commercialFilter([['XYZ', 'Private Field', 'Town', 35, -80, 'KXYZ', 'NC', 'hay', 6]], true).length === 0);

/* Full DB: no-IATA excluded even if large-ish */
chk('no IATA excluded', commercialFilter([['', 'No Code', 'Town', 35, -80, 'KXXX', 'NC', 'hay', 42]], true).length === 0);

function softSuggest(windowId, role, firstApptMin, driveBuf) {
  var win = FLIGHT_WINDOWS[windowId];
  if (!win) return null;
  var sug = win.prefer;
  var conflict = false;
  if (role === 'arrive' && firstApptMin != null) {
    var needBy = firstApptMin - (driveBuf || 105);
    if (needBy < win.start) {
      conflict = true;
      sug = win.start;
    } else {
      sug = Math.min(win.prefer, Math.max(win.start, needBy - 15));
    }
  } else if (role === 'depart' && firstApptMin != null) {
    /* firstApptMin here = leave-after minute-of-day */
    if (firstApptMin > win.end) {
      conflict = true;
      sug = win.end - 30;
    } else {
      sug = Math.max(win.prefer, Math.min(win.end - 15, firstApptMin + 15));
    }
  }
  sug = Math.max(win.start, Math.min(win.end - 1, Math.round(sug)));
  var hh = Math.floor(sug / 60), mm = sug % 60;
  return {
    time: (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm,
    conflict: conflict,
    mins: sug
  };
}

var morningOk = softSuggest('morning', 'arrive', 14 * 60, 105);
chk('morning fits before 2pm appt', morningOk && morningOk.time === '09:00' && !morningOk.conflict);

var afternoonTight = softSuggest('afternoon', 'arrive', 14 * 60, 105);
chk('afternoon conflicts with 2pm appt', afternoonTight && afternoonTight.conflict);

var departOk = softSuggest('afternoon', 'depart', 15 * 60, 0);
chk('afternoon depart after 3pm leave', departOk && !departOk.conflict && departOk.mins >= 15 * 60);

var departLate = softSuggest('morning', 'depart', 14 * 60, 0);
chk('morning depart conflicts after late day', departLate && departLate.conflict);

if (fails) {
  console.error('\n' + fails + ' failed');
  process.exit(1);
}
console.log('\nFlight window tests OK');
process.exit(0);
