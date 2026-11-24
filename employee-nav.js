/* Arrowquip Travel Portal — Employee / reporting helpers
   My Trips = personal (logged-in user only).
   My Team  = leader management workspace with direct-report name tabs.
   Extends ADMIN.team; does not invent a parallel roster. */
(function (global) {
  'use strict';

  var EMP_VIEW = { mode: 'self', memberId: null }; /* self | member */

  function ADMIN() {
    if (typeof global.getPortalAdmin === 'function') {
      var via = global.getPortalAdmin();
      if (via) return via;
    }
    if (!global.ADMIN) global.ADMIN = {};
    return global.ADMIN;
  }
  function teamArr() {
    var A = ADMIN();
    if (!Array.isArray(A.team)) A.team = [];
    return A.team;
  }
  function esc(s) {
    return global.esc
      ? global.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
  }
  function byId(id) {
    if (!id) return null;
    if (typeof global.teamById === 'function') return global.teamById(id);
    var L = teamArr();
    for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
    return null;
  }
  function emailOf(m) {
    return String((m && m.email) || '').trim().toLowerCase();
  }
  function ensureShape(m) {
    if (!m) return m;
    if (!Array.isArray(m.terrs)) m.terrs = m.terr ? [m.terr] : [];
    if (!Array.isArray(m.eaFor)) m.eaFor = m.eaForIds || [];
    if (m.managerId === undefined) m.managerId = m.manager_id || null;
    if (!m.portalRole) {
      if (m.isAdmin || m.accessGroup === 'administrator') m.portalRole = 'admin';
      else if (m.accessGroup === 'coordinator' || m.role === 'SA' || m.role === 'TC') m.portalRole = 'ea';
      else if (m.accessGroup === 'leadership' || m.role === 'LEAD') m.portalRole = 'leader';
      else m.portalRole = 'employee';
    }
    return m;
  }
  function normalizeAll() {
    teamArr().forEach(ensureShape);
  }

  function currentEmployee() {
    normalizeAll();
    var email = '';
    try {
      if (global.PB_USER && global.PB_USER.email) email = String(global.PB_USER.email).toLowerCase();
      else if (typeof global.pbWho === 'function') email = String(global.pbWho() || '').toLowerCase();
    } catch (e) {}
    if (!email) return null;
    var hit = null;
    teamArr().forEach(function (m) {
      if (m && m.active !== false && emailOf(m) === email) hit = m;
    });
    return hit;
  }

  function isAdminActor() {
    try {
      if (typeof global.pbIsAdmin === 'function' && global.pbIsAdmin()) return true;
    } catch (e) {}
    var me = currentEmployee();
    return !!(me && (me.isAdmin || me.portalRole === 'admin'));
  }

  function managerChain(memberId) {
    var seen = {};
    var chain = [];
    var cur = memberId;
    while (cur) {
      if (seen[cur]) return { chain: chain, cycle: true };
      seen[cur] = 1;
      chain.push(cur);
      var m = byId(cur);
      cur = m && m.managerId ? m.managerId : null;
      if (chain.length > 50) return { chain: chain, cycle: true };
    }
    return { chain: chain, cycle: false };
  }

  function wouldCreateCycle(memberId, newManagerId) {
    if (!memberId || !newManagerId) return false;
    if (memberId === newManagerId) return true;
    var walk = managerChain(newManagerId);
    return walk.cycle || walk.chain.indexOf(memberId) >= 0;
  }

  function setManager(memberId, managerId) {
    var m = byId(memberId);
    if (!m) return { ok: false, error: 'Member not found' };
    if (managerId && !byId(managerId)) return { ok: false, error: 'Manager not found' };
    if (managerId && wouldCreateCycle(memberId, managerId)) {
      return { ok: false, error: 'That reporting line would create a circular relationship' };
    }
    var prev = m.managerId || null;
    m.managerId = managerId || null;
    return { ok: true, prev: prev, member: m };
  }

  function directReports(managerId) {
    if (!managerId) return [];
    return teamArr().filter(function (m) {
      return m && m.active !== false && m.managerId === managerId;
    }).sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function allReports(managerId) {
    var out = [];
    var queue = directReports(managerId).map(function (m) { return m.id; });
    var seen = {};
    while (queue.length) {
      var id = queue.shift();
      if (seen[id]) continue;
      seen[id] = 1;
      var m = byId(id);
      if (!m || m.active === false) continue;
      out.push(m);
      directReports(id).forEach(function (r) { queue.push(r.id); });
    }
    return out;
  }

  function isReportOf(managerId, memberId) {
    if (!managerId || !memberId) return false;
    return allReports(managerId).some(function (m) { return m.id === memberId; });
  }

  function eaAssignees(eaId) {
    var ea = byId(eaId);
    if (!ea) return [];
    ensureShape(ea);
    return (ea.eaFor || []).map(byId).filter(function (m) { return m && m.active !== false; });
  }

  function canViewMember(memberId) {
    if (!memberId) return false;
    if (isAdminActor()) return true;
    var me = currentEmployee();
    if (!me) return false;
    if (me.id === memberId) return true;
    if (isReportOf(me.id, memberId)) return true;
    ensureShape(me);
    if ((me.eaFor || []).indexOf(memberId) >= 0) return true;
    return false;
  }

  function canEditMember(memberId) {
    if (!memberId) return false;
    if (isAdminActor()) return true;
    var me = currentEmployee();
    if (!me) return false;
    if (me.id === memberId) return true;
    ensureShape(me);
    if ((me.eaFor || []).indexOf(memberId) >= 0) return true;
    if ((me.portalRole === 'leader' || me.accessGroup === 'leadership') && isReportOf(me.id, memberId)) return true;
    return false;
  }

  /** People available as My Team tabs: direct reports + EA assignees (+ all for admin). */
  function manageablePeople() {
    var me = currentEmployee();
    var seen = {};
    var out = [];
    function add(m) {
      if (!m || seen[m.id]) return;
      if (me && m.id === me.id) return;
      if (!canViewMember(m.id)) return;
      seen[m.id] = 1;
      out.push(m);
    }
    if (me) {
      directReports(me.id).forEach(add);
      eaAssignees(me.id).forEach(add);
    }
    if (isAdminActor()) {
      teamArr().filter(function (m) { return m && m.active !== false; })
        .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); })
        .forEach(add);
    }
    return out;
  }

  function canSeeMyTeamWorkspace() {
    if (isAdminActor()) return true;
    var me = currentEmployee();
    if (!me) return false;
    if (directReports(me.id).length) return true;
    if (eaAssignees(me.id).length) return true;
    return me.portalRole === 'leader' || me.accessGroup === 'leadership';
  }

  function primaryTerr(m) {
    if (!m) return 'East';
    var t = (Array.isArray(m.terrs) && m.terrs.length) ? m.terrs[0] : m.terr;
    if (t === 'All' || !t) t = 'East';
    if (['East', 'South', 'Central', 'West', 'Exports'].indexOf(t) < 0) t = 'East';
    return t;
  }

  function lockTeamIds(memberId) {
    global.TEAM_ALL = false;
    global.TEAM_IDS = {};
    if (memberId) global.TEAM_IDS[memberId] = true;
    try {
      if (typeof global.teamSaveSel === 'function') global.teamSaveSel();
    } catch (e) {}
  }

  function applyViewFilters() {
    try {
      if (typeof global.TEAM_ALL === 'undefined') return;
    } catch (e) { return; }

    var target = null;
    if (EMP_VIEW.mode === 'member') target = byId(EMP_VIEW.memberId);
    else target = currentEmployee();

    if (EMP_VIEW.mode === 'member' && (!target || !canViewMember(target.id))) {
      EMP_VIEW = { mode: 'self', memberId: null };
      target = currentEmployee();
    }

    if (!target) {
      lockTeamIds(null);
      return;
    }

    lockTeamIds(target.id);
    if (typeof global.WORKSPACE !== 'undefined' && global.WORKSPACE !== 'coord') {
      /* Keep workspace; only adjust territory for dealer library scoping */
    }
    if (typeof global.PORTAL_MODE !== 'undefined') global.PORTAL_MODE = 'sales';
    if (typeof global.terr !== 'undefined') {
      var t = primaryTerr(target);
      /* Never park personal/management travel on All/Team admin views */
      if (global.terr === 'All' || global.terr === 'Team' || global.terr === 'Master' || global.terr === 'Settings') {
        global.terr = t;
      } else if (EMP_VIEW.mode === 'member' || EMP_VIEW.mode === 'self') {
        global.terr = t;
      }
    }
    try { localStorage.setItem('aqLastAreaTerr', global.terr); } catch (e) {}
    try { localStorage.setItem('aqEmpView', JSON.stringify(EMP_VIEW)); } catch (e) {}
  }

  function setEmpView(mode, memberId, opts) {
    opts = opts || {};
    mode = mode === 'member' ? 'member' : 'self';
    if (mode === 'member') {
      if (!memberId || !canViewMember(memberId)) {
        if (typeof global.aqToast === 'function') global.aqToast('You do not have access to that traveller', false);
        mode = 'self';
        memberId = null;
      }
    }
    EMP_VIEW = { mode: mode, memberId: mode === 'member' ? memberId : null };
    applyViewFilters();
    paintTabs();
    paintContextBanner();
    try {
      if (typeof global.syncWorkspaceTabs === 'function') global.syncWorkspaceTabs();
    } catch (e) {}
    if (!opts.silent) {
      try {
        if (typeof global.render === 'function') global.render();
        else if (typeof global.refreshPlanner === 'function') global.refreshPlanner();
      } catch (e) {}
    }
  }

  function selectedPerson() {
    if (EMP_VIEW.mode === 'member') return byId(EMP_VIEW.memberId);
    return currentEmployee();
  }

  function selectedLabel() {
    var m = selectedPerson();
    return m ? (m.name || 'Employee') : 'My Trips';
  }

  function tripsTitle() {
    var me = currentEmployee();
    var name = me ? (me.name || 'My Trips') : 'My Trips';
    return name + ' — My Trips';
  }

  function teamTitle() {
    var m = selectedPerson();
    if (!m) return 'My Team';
    if (EMP_VIEW.mode === 'self') return tripsTitle();
    return (m.name || 'Employee') + ' — Travel';
  }

  function paintContextBanner() {
    var el = document.getElementById('empContextBanner');
    if (!el) return;
    var ws = global.WORKSPACE || 'trips';
    if (ws !== 'team') {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    var m = selectedPerson();
    if (!m || EMP_VIEW.mode !== 'member') {
      el.className = 'emp-context';
      el.innerHTML = '<span>Select a team member to view their travel</span>';
      el.style.display = '';
      return;
    }
    var edit = canEditMember(m.id);
    el.className = 'emp-context' + (edit ? '' : ' readonly');
    el.innerHTML =
      '<span>Managing travel for <b>' + esc(m.name || 'Employee') + '</b>' +
      (edit ? '' : ' <span class="emp-ro">(view only)</span>') +
      '</span>';
    el.style.display = '';
  }

  function paintTabs() {
    var host = document.getElementById('teamEmpTabs');
    var strip = document.getElementById('teamEmpStrip');
    if (!host) return;
    normalizeAll();
    var ws = global.WORKSPACE || 'trips';
    if (strip) strip.style.display = ws === 'team' ? '' : 'none';
    if (ws !== 'team') {
      host.innerHTML = '';
      return;
    }
    var people = manageablePeople();
    var html = people.map(function (m) {
      var on = EMP_VIEW.mode === 'member' && EMP_VIEW.memberId === m.id;
      return (
        '<button type="button" class="emp-tab' + (on ? ' on' : '') + '" data-empmode="member" data-empid="' +
        esc(m.id) + '" title="' + esc(m.name || '') + '">' + esc(m.name || m.email || 'Employee') + '</button>'
      );
    }).join('');
    var me = currentEmployee();
    var canAdd = isAdminActor() || (me && (me.portalRole === 'leader' || me.accessGroup === 'leadership'));
    if (canAdd) {
      html += '<button type="button" class="emp-tab add" data-empadd="1" title="Add report">+ Add Report</button>';
    }
    if (!people.length && !canAdd) {
      html = '<span class="emp-empty">No direct reports assigned</span>';
    }
    host.innerHTML = html;
    host.querySelectorAll('[data-empmode]').forEach(function (b) {
      b.onclick = function (e) {
        e.preventDefault();
        setEmpView('member', b.dataset.empid || null);
      };
    });
    var add = host.querySelector('[data-empadd]');
    if (add) add.onclick = function (e) { e.preventDefault(); openAddReportModal(); };
  }

  function openAddReportModal() {
    if (!isAdminActor()) {
      var me0 = currentEmployee();
      if (!me0 || (me0.portalRole !== 'leader' && me0.accessGroup !== 'leadership')) {
        if (typeof global.aqToast === 'function') global.aqToast('Only leaders or admins can add reports', false);
        return;
      }
    }
    var me = currentEmployee();
    var candidates = teamArr().filter(function (m) {
      if (!m || m.active === false) return false;
      if (me && m.id === me.id) return false;
      if (me && m.managerId === me.id) return false;
      return true;
    }).sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });

    var wrap = document.createElement('div');
    wrap.className = 'mt-modalbg';
    wrap.innerHTML =
      '<div class="mt-modal" role="dialog" aria-label="Add report">' +
      '<div class="mt-mh"><div class="mt-mt">Add Report</div><button type="button" class="mt-mx" id="ear_x">×</button></div>' +
      '<div class="mt-mb">' +
      '<p class="mt-hint">Assign an existing team member as your direct report. Travel history stays on their account.</p>' +
      '<label>Employee<select id="ear_who">' +
      '<option value="">Select…</option>' +
      candidates.map(function (m) {
        return '<option value="' + esc(m.id) + '">' + esc(m.name) + (m.email ? ' · ' + esc(m.email) : '') + '</option>';
      }).join('') +
      '</select></label>' +
      '<div class="mt-err" id="ear_err"></div>' +
      '</div>' +
      '<div class="mt-mf">' +
      '<button type="button" class="mt-btn ghost" id="ear_cancel">CANCEL</button>' +
      '<button type="button" class="mt-btn solid" id="ear_save">ADD REPORT</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.querySelector('#ear_x').onclick = close;
    wrap.querySelector('#ear_cancel').onclick = close;
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('#ear_save').onclick = function () {
      var id = wrap.querySelector('#ear_who').value;
      var err = wrap.querySelector('#ear_err');
      err.textContent = '';
      if (!id) { err.textContent = 'Select an employee'; return; }
      var managerId = me ? me.id : null;
      var res = setManager(id, managerId);
      if (!res.ok) { err.textContent = res.error || 'Could not assign'; return; }
      try { if (typeof global.savePlan === 'function') global.savePlan({ force: true }); } catch (e) {}
      try { if (typeof global.persistTeamOrg === 'function') global.persistTeamOrg(); } catch (e) {}
      close();
      paintTabs();
      setEmpView('member', id);
      if (typeof global.aqToast === 'function') global.aqToast('Report added');
    };
  }

  function bootEmpView() {
    normalizeAll();
    var ws = global.WORKSPACE || 'trips';
    if (ws === 'team') {
      try {
        var raw = localStorage.getItem('aqEmpView');
        if (raw) {
          var o = JSON.parse(raw);
          if (o && o.mode === 'member' && o.memberId && canViewMember(o.memberId)) {
            EMP_VIEW = { mode: 'member', memberId: o.memberId };
          }
        }
      } catch (e) {}
      if (EMP_VIEW.mode !== 'member' || !canViewMember(EMP_VIEW.memberId)) {
        var people = manageablePeople();
        if (people.length) EMP_VIEW = { mode: 'member', memberId: people[0].id };
        else EMP_VIEW = { mode: 'self', memberId: null };
      }
    } else {
      EMP_VIEW = { mode: 'self', memberId: null };
    }
    applyViewFilters();
    paintTabs();
    paintContextBanner();
  }

  function assertCanEditCurrent() {
    if (isAdminActor()) return EMP_VIEW.mode !== 'all';
    if (EMP_VIEW.mode === 'self') return true;
    if (EMP_VIEW.mode === 'member') return canEditMember(EMP_VIEW.memberId);
    return false;
  }

  function orgPayload() {
    normalizeAll();
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      members: teamArr().map(function (m) {
        ensureShape(m);
        return {
          id: m.id,
          name: m.name,
          email: m.email || '',
          role: m.role,
          terr: m.terr,
          terrs: m.terrs || [],
          managerId: m.managerId || null,
          eaFor: m.eaFor || [],
          portalRole: m.portalRole,
          accessGroup: m.accessGroup,
          isAdmin: !!m.isAdmin,
          active: m.active !== false,
        };
      }),
    };
  }

  async function persistTeamOrg() {
    try {
      var token = global._PB_TOKEN;
      if (!token) return { ok: false, error: 'Sign in required' };
      var r = await fetch('/api/team-org', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(orgPayload()),
      });
      var j = await r.json().catch(function () { return null; });
      return j || { ok: r.ok };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  async function loadTeamOrg() {
    try {
      var token = global._PB_TOKEN;
      if (!token) return null;
      var r = await fetch('/api/team-org', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!r.ok) return null;
      var j = await r.json().catch(function () { return null; });
      if (!j || !j.ok || !j.data || !Array.isArray(j.data.members)) return null;
      j.data.members.forEach(function (row) {
        var m = byId(row.id);
        if (!m && row.email) {
          m = teamArr().filter(function (x) { return emailOf(x) === String(row.email || '').toLowerCase(); })[0];
        }
        if (!m) return;
        if (row.managerId !== undefined) m.managerId = row.managerId;
        if (Array.isArray(row.eaFor)) m.eaFor = row.eaFor.slice();
        if (row.portalRole) m.portalRole = row.portalRole;
        if (row.accessGroup) m.accessGroup = row.accessGroup;
        if (row.isAdmin != null) m.isAdmin = !!row.isAdmin;
        if (row.active === false) m.active = false;
      });
      normalizeAll();
      return j.data;
    } catch (e) {
      return null;
    }
  }

  global.AQEmp = {
    getView: function () { return { mode: EMP_VIEW.mode, memberId: EMP_VIEW.memberId }; },
    setView: setEmpView,
    boot: bootEmpView,
    paint: function () { paintTabs(); paintContextBanner(); },
    currentEmployee: currentEmployee,
    selectedPerson: selectedPerson,
    directReports: directReports,
    allReports: allReports,
    manageablePeople: manageablePeople,
    canSeeMyTeamWorkspace: canSeeMyTeamWorkspace,
    canViewMember: canViewMember,
    canEditMember: canEditMember,
    setManager: setManager,
    wouldCreateCycle: wouldCreateCycle,
    assertCanEditCurrent: assertCanEditCurrent,
    selectedLabel: selectedLabel,
    tripsTitle: tripsTitle,
    teamTitle: teamTitle,
    persistTeamOrg: persistTeamOrg,
    loadTeamOrg: loadTeamOrg,
    orgPayload: orgPayload,
    ensureShape: ensureShape,
    normalizeAll: normalizeAll,
    primaryTerr: primaryTerr,
  };
  global.persistTeamOrg = persistTeamOrg;
})(typeof window !== 'undefined' ? window : global);
