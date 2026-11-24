/* Self-test for employee-nav hierarchy helpers (Node, no DOM). */
'use strict';

var pass = 0, fail = 0;
function chk(name, cond) {
  if (cond) { pass++; console.log('PASS ', name); }
  else { fail++; console.log('FAIL ', name); }
}

/* Minimal stub of employee-nav cycle + report logic */
function wouldCreateCycle(members, memberId, newManagerId) {
  if (!memberId || !newManagerId) return false;
  if (memberId === newManagerId) return true;
  var byId = {};
  members.forEach(function (m) { byId[m.id] = m; });
  var seen = {}, cur = newManagerId, steps = 0;
  while (cur) {
    if (cur === memberId) return true;
    if (seen[cur]) return true;
    seen[cur] = 1;
    cur = byId[cur] && byId[cur].managerId;
    if (++steps > 50) return true;
  }
  return false;
}
function directReports(members, managerId) {
  return members.filter(function (m) { return m.managerId === managerId; });
}
function allReports(members, managerId) {
  var out = [], queue = directReports(members, managerId).map(function (m) { return m.id; }), seen = {};
  var byId = {}; members.forEach(function (m) { byId[m.id] = m; });
  while (queue.length) {
    var id = queue.shift();
    if (seen[id]) continue;
    seen[id] = 1;
    out.push(byId[id]);
    directReports(members, id).forEach(function (r) { queue.push(r.id); });
  }
  return out;
}
function canView(actor, targetId, members) {
  if (actor.isAdmin) return true;
  if (actor.id === targetId) return true;
  if (allReports(members, actor.id).some(function (m) { return m.id === targetId; })) return true;
  if ((actor.eaFor || []).indexOf(targetId) >= 0) return true;
  return false;
}

var roster = [
  { id: 'L1', name: 'Leader', managerId: null, isAdmin: false, eaFor: [] },
  { id: 'R1', name: 'Rep One', managerId: 'L1', isAdmin: false, eaFor: [] },
  { id: 'R2', name: 'Rep Two', managerId: 'L1', isAdmin: false, eaFor: [] },
  { id: 'R1a', name: 'Nested', managerId: 'R1', isAdmin: false, eaFor: [] },
  { id: 'EA1', name: 'EA', managerId: null, isAdmin: false, eaFor: ['R2'] },
  { id: 'ADM', name: 'Admin', managerId: null, isAdmin: true, eaFor: [] },
];

chk('direct reports of L1 = 2', directReports(roster, 'L1').length === 2);
chk('all reports of L1 includes nested', allReports(roster, 'L1').some(function (m) { return m.id === 'R1a'; }));
chk('self cycle blocked', wouldCreateCycle(roster, 'L1', 'L1') === true);
chk('child cannot manage parent', wouldCreateCycle(roster, 'L1', 'R1') === true);
chk('grandchild cannot manage leader', wouldCreateCycle(roster, 'L1', 'R1a') === true);
chk('ok assign R2 under R1', wouldCreateCycle(roster, 'R2', 'R1') === false);
chk('leader views report', canView(roster[0], 'R1', roster) === true);
chk('leader views nested', canView(roster[0], 'R1a', roster) === true);
chk('rep cannot view peer', canView(roster[1], 'R2', roster) === false);
chk('EA views assigned', canView(roster[4], 'R2', roster) === true);
chk('EA cannot view unassigned', canView(roster[4], 'R1', roster) === false);
chk('admin views all', canView(roster[5], 'R1a', roster) === true);

console.log('\nEmployee nav tests: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
console.log('Employee nav tests OK');
