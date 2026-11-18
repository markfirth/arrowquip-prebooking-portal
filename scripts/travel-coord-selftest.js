#!/usr/bin/env node
/* Lightweight Travel Coordination unit checks (no DOM). */
'use strict';

var fails = 0;
function pass(n) { console.log('PASS  ' + n); }
function fail(n, m) { fails++; console.log('FAIL  ' + n + (m ? (' — ' + m) : '')); }

var global = {
  TRIPBOOK: {},
  ADMIN: { team: [{ id: 'm1', name: 'Nikita Line', email: 'nikita@arrowquip.com', role: 'SA', terrs: ['All'] }] },
  APPT: {},
  LOGI: [
    { id: 'F1', type: 'flight_out', airline: 'Delta', terr: 'East', wk: 40, day: 0, time: '09:00', depAirport: 'YYZ', arrAirport: 'ATL' },
    { id: 'H1', type: 'hotel', name: 'Hampton Inn', terr: 'East', wk: 40, day: 0, time: '21:00' }
  ],
  XVISITS: [],
  WEEKDATES: { 40: 'Sep 29–Oct 5' },
  TRIP_STATUS: { ready: { label: 'Ready to Book' }, booking: { label: 'Booking in Progress' }, booked: { label: 'Booked' }, sent: { label: 'Reviewed & Sent' }, completed: { label: 'Completed' } },
  teamById: function (id) { return this.ADMIN.team.filter(function (m) { return m.id === id; })[0]; },
  travelType: function (it) { return (it && it.type) || 'other'; },
  tripCollectWeek: function () {
    return { vs: [{ id: 'D1', name: 'Dealer A' }], xs: [], ls: this.LOGI };
  },
  travelPrefsFor: function () {
    return { hotelsPreferred: [{ name: 'Hampton Inn', city: 'Atlanta' }], hotelsLiked: [], hotelsDisliked: [] };
  },
  savePlan: function () {},
  aqToast: function () {},
  pbWho: function () { return 'test@arrowquip.com'; },
  wkNo: function (w) { return w; },
  esc: function (s) { return String(s == null ? '' : s); },
  localStorage: { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); } },
  document: { getElementById: function () { return null; }, createElement: function () { return { style: {}, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, appendChild: function () {} }; }, body: { appendChild: function () {} } }
};

var fs = require('fs');
var src = fs.readFileSync(require('path').join(__dirname, '..', 'travel-coord.js'), 'utf8');
var fn = new Function('window', src.replace(/\(function \(global\) \{/, 'return (function (global) {').replace(/\}\)\(window\);\s*$/, '})(window);'));
var mod = fn(global);
var AQ = global.AQCoord;
if (!AQ) { fail('AQCoord export'); process.exit(1); }
pass('AQCoord export');

global.TRIPBOOK['East|40|m1'] = { status: 'ready', submittedAt: '2026-01-01T00:00:00Z' };
var rows = AQ.tripRows({ attention: true });
if (rows.length === 1 && rows[0].traveller) pass('tripRows ready trip');
else fail('tripRows ready trip', JSON.stringify(rows));

var rec = global.TRIPBOOK['East|40|m1'];
var items = AQ.ensureChecklist('East|40|m1', { terr: 'East', wk: 40, memberId: 'm1' }, global.tripCollectWeek(), rec);
if (items.some(function (c) { return c.kind === 'flight_out'; }) && items.some(function (c) { return c.kind === 'hotel'; })) pass('checklist from itinerary');
else fail('checklist from itinerary', JSON.stringify(items.map(function (c) { return c.kind; })));

if (!items.some(function (c) { return c.title && /requested/i.test(c.title); })) pass('no invented soft flights');
else fail('no invented soft flights');

var m = AQ.metrics();
if (m.ready >= 1) pass('metrics ready');
else fail('metrics ready', JSON.stringify(m));

if (AQ.isCoordinatorUser) pass('isCoordinatorUser present');
else fail('isCoordinatorUser present');

if (fails) { console.log('\n' + fails + ' failed'); process.exit(1); }
console.log('\nTravel coord tests OK');
