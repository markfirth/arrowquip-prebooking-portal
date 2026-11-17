#!/usr/bin/env node
var AQ = require('../smart-entry.js');
var failed = 0;
function chk(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
  if (!cond) failed++;
}

var a = AQ.parse('Double B Farm Supply at 9am for 2 hours.');
chk('dealer kind', a && a.kind === 'dealer');
chk('dealer name', a && /Double B Farm Supply/i.test(a.name), a && a.name);
chk('dealer time 09:00', a && a.time === '09:00');
chk('dealer dur 120', a && a.durationMin === 120);

var z = AQ.parse('Zoom with JW at 11am for 30 minutes.');
chk('virtual zoom', z && z.kind === 'virtual' && z.virtual);
chk('zoom time', z && z.time === '11:00');
chk('zoom dur 30', z && z.durationMin === 30);

var f = AQ.parse('Fly Delta to Atlanta Sunday evening.');
chk('flight kind', f && f.kind === 'flight' && f.travelType === 'flight_out');
chk('flight airline', f && /delta/i.test(f.airline));
chk('flight day Sunday', f && f.day === 0);
chk('flight soft evening', f && f.time === '18:00' && f.timeSoft);
chk('flight unverified schedule', f && f.unverified.indexOf('schedule') >= 0);

var h = AQ.parse('Hotel in Charlotte under $200 USD.');
chk('hotel kind', h && h.kind === 'hotel');
chk('hotel place', h && /Charlotte/i.test(h.placeHint));
chk('hotel budget', h && h.budget && h.budget.amount === 200 && h.budget.currency === 'USD');
chk('hotel price unverified', h && h.unverified.indexOf('price') >= 0);

var m = AQ.parse('Stay at the same Marriott as last time.');
chk('hotel prefer previous', m && m.preferPrevious && /marriott/i.test(m.name));

var r = AQ.parse('Rental car Monday through Thursday.');
chk('rental kind', r && r.kind === 'rental');
chk('rental day Mon', r && r.day === 1);
chk('rental dayEnd Thu', r && r.dayEnd === 4);

var l = AQ.parse('Lunch at noon.');
chk('lunch food', l && l.kind === 'food' && l.time === '12:00');

var s = AQ.parse('Atlantic Farm Mechanization Show Thursday 9am to 1pm.');
chk('tradeshow kind', s && s.kind === 'tradeshow');
chk('tradeshow day Thu', s && s.day === 4);
chk('tradeshow range', s && s.time === '09:00' && s.timeEnd === '13:00');
chk('tradeshow dur 240', s && s.durationMin === 240);

var amb = AQ.parse('Meet Alex at 9 for 1 hour');
chk('ambiguous time flagged', amb && amb.timeAmbiguous && amb.needsClarify.indexOf('time_ampm') >= 0);

var bulk = AQ.parseMany('Zoom with JW at 11am for 30 minutes.\nLunch at noon.\nFly Delta to Atlanta Sunday evening.');
chk('bulk parse 3', bulk.length === 3);
chk('bulk kinds', bulk[0].kind === 'virtual' && bulk[1].kind === 'food' && bulk[2].kind === 'flight');

var ranked = AQ.rankDealers('double b', [
  { id: '1', name: 'Double B Farm Supply', city: 'Athens' },
  { id: '2', name: 'Other Co', city: 'Rome' },
]);
chk('dealer rank', ranked.length === 1 && ranked[0].id === '1');

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nSmart entry tests OK');
process.exit(0);
