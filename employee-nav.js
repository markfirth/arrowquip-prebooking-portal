/* Arrowquip Travel Portal — Employee tabs (reporting hierarchy)
   Replaces territory-first navigation with people: My Travel | All Reports | reports…
   Extends ADMIN.team; does not invent a parallel roster.
   Depends on index.html globals: ADMIN, teamById, terr, WORKSPACE, TEAM_*, pb*, render. */
(function (global) {
  'use strict';

  var EMP_VIEW = { mode: 'self', memberId: null }; /* self | all | member */

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

  /** Walk managerId chain; detect cycles. */
  function managerChain(memberId, stopAt) {
    var seen = {};
    var chain = [];
    var cur = memberId;
    while (cur) {
      if (seen[cur]) return { chain: chain, cycle: true };
      seen[cur] = 1;
      chain.push(cur);
      if (stopAt && cur === stopAt) break;
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
    /* EA: edit on behalf of assigned employees */
    if ((me.eaFor || []).indexOf(memberId) >= 0) return true;
    /* Leaders may edit assigned reports' travel */
    if ((me.portalRole === 'leader' || me.accessGroup === 'leadership') && isReportOf(me.id, memberId)) return true;
    return false;
  }

  function visibleEmployeeTabs() {
    var me = currentEmployee();
    var tabs = [];
    tabs.push({ id: '__self', label: 'My Travel', mode: 'self' });
    var reports = me ? directReports(me.id) : [];
    var ea = me ? eaAssignees(me.id) : [];
    var showAll = isAdminActor() || (me && (reports.length || me.portalRole === 'leader' || me.accessGroup === 'leadership'));
    if (showAll || (me && ea.length)) {
      tabs.push({ id: '__all', label: 'All Reports', mode: 'all' });
    }
    var seen = {};
    function addPerson(m) {
      if (!m || seen[m.id]) return;
      if (me && m.id === me.id) return;
      if (!canViewMember(m.id)) return;
      seen[m.id] = 1;
      tabs.push({ id: m.id, label: m.name || m.email || 'Employee', mode: 'member', member: m });
    }
    reports.forEach(addPerson);
    ea.forEach(addPerson);
    if (isAdminActor()) {
      teamArr().filter(function (m) { return m && m.active !== false; })
        .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); })
        .forEach(addPerson);
    }
    return tabs;
  }

  function primaryTerr(m) {
    if (!m) return 'East';
    var t = (Array.isArray(m.terrs) && m.terrs.length) ? m.terrs[0] : m.terr;
    if (t === 'All' || !t) t = 'East';
    if (['East', 'South', 'Central', 'West', 'Exports'].indexOf(t) < 0) t = 'East';
    return t;
  }

  function applyViewFilters() {
    var mode = EMP_VIEW.mode;
    var mid = EMP_VIEW.memberId;
    try {
      if (typeof global.TEAM_ALL === 'undefined') return;
    } catch (e) { return; }

    if (mode === 'all') {
      global.TEAM_ALL = true;
      global.TEAM_IDS = {};
      if (typeof global.WORKSPACE !== 'undefined') global.WORKSPACE = 'team';
      if (typeof global.PORTAL_MODE !== 'undefined') global.PORTAL_MODE = 'sales';
      if (typeof global.terr !== 'undefined') global.terr = 'All';
      return;
    }

    var target = null;
    if (mode === 'self') target = currentEmployee();
    else if (mode === 'member') target = byId(mid);

    if (!target) {
      global.TEAM_ALL = false;
      global.TEAM_IDS = {};
      return;
    }
    if (!canViewMember(target.id)) {
      EMP_VIEW = { mode: 'self', memberId: null };
      target = currentEmployee();
      if (!target) return;
    }

    global.TEAM_ALL = false;
    global.TEAM_IDS = {};
    global.TEAM_IDS[target.id] = true;
    if (typeof global.WORKSPACE !== 'undefined') global.WORKSPACE = 'trips';
    if (typeof global.PORTAL_MODE !== 'undefined') global.PORTAL_MODE = 'sales';
    if (typeof global.terr !== 'undefined') global.terr = primaryTerr(target);
    try { localStorage.setItem('aqLastAreaTerr', global.terr); } catch (e) {}
    try { localStorage.setItem('aqEmpView', JSON.stringify(EMP_VIEW)); } catch (e) {}
  }

  function setEmpView(mode, memberId, opts) {
    opts = opts || {};
    mode = mode === 'all' || mode === 'member' ? mode : 'self';
    if (mode === 'member') {
      if (!memberId || !canViewMember(memberId)) {
        if (typeof global.aqToast === 'function') global.aqToast('You do not have access to that traveller', false);
        mode = 'self';
        memberId = null;
      }
    }
    EMP_VIEW = { mode: mode, memberId: mode === 'member' ? memberId : null };
    applyViewFilters();
    try {
      if (typeof global.teamSaveSel === 'function') global.teamSaveSel();
    } catch (e) {}
    try {
      if (typeof global.syncWorkspaceTabs === 'function') global.syncWorkspaceTabs();
    } catch (e) {}
    paintTabs();
    paintContextBanner();
    if (!opts.silent) {
      try {
        if (typeof global.render === 'function') global.render();
        else if (typeof global.refreshPlanner === 'function') global.refreshPlanner();
      } catch (e) {}
    }
  }

  function selectedLabel() {
    if (EMP_VIEW.mode === 'all') return 'All Reports';
    if (EMP_VIEW.mode === 'member') {
      var m = byId(EMP_VIEW.memberId);
      return m ? (m.name || 'Employee') : 'Employee';
    }
    var me = currentEmployee();
    return me ? (me.name || 'My Travel') : 'My Travel';
  }

  function paintContextBanner() {
    var el = document.getElementById('empContextBanner');
    if (!el) return;
    var label = selectedLabel();
    var mode = EMP_VIEW.mode;
    var edit = true;
    if (mode === 'member') edit = canEditMember(EMP_VIEW.memberId);
    else if (mode === 'self') edit = true;
    else edit = false;
    el.className = 'emp-context' + (mode === 'all' ? ' all' : '') + (edit ? '' : ' readonly');
    el.innerHTML =
      '<span>Viewing travel for <b>' + esc(label) + '</b>' +
      (edit ? '' : ' <span class="emp-ro">(view only)</span>') +
      '</span>';
    el.style.display = '';
  }

  function paintTabs() {
    var host = document.getElementById('empTabs');
    if (!host) return;
    normalizeAll();
    var tabs = visibleEmployeeTabs();
    var html = tabs.map(function (t) {
      var on =
        (t.mode === 'self' && EMP_VIEW.mode === 'self') ||
        (t.mode === 'all' && EMP_VIEW.mode === 'all') ||
        (t.mode === 'member' && EMP_VIEW.mode === 'member' && EMP_VIEW.memberId === t.id);
      return (
        '<button type="button" class="emp-tab' + (on ? ' on' : '') + '" data-empmode="' + esc(t.mode) + '"' +
        (t.mode === 'member' ? ' data-empid="' + esc(t.id) + '"' : '') +
        ' title="' + esc(t.label) + '">' + esc(t.label) + '</button>'
      );
    }).join('');
    var me = currentEmployee();
    var canAdd = isAdminActor() || (me && (me.portalRole === 'leader' || me.accessGroup === 'leadership' || directReports(me.id).length >= 0 && (me.portalRole === 'leader' || isAdminActor())));
    canAdd = isAdminActor() || (me && (me.portalRole === 'leader' || me.accessGroup === 'leadership'));
    if (canAdd) {
      html += '<button type="button" class="emp-tab add" data-empadd="1" title="Add report">+ Add Report</button>';
    }
    host.innerHTML = html;
    host.querySelectorAll('[data-empmode]').forEach(function (b) {
      b.onclick = function (e) {
        e.preventDefault();
        setEmpView(b.dataset.empmode, b.dataset.empid || null);
      };
    });
    var add = host.querySelector('[data-empadd]');
    if (add) add.onclick = function (e) { e.preventDefault(); openAddReportModal(); };
  }

  function openAddReportModal() {
    if (!isAdminActor()) {
      var me = currentEmployee();
      if (!me || (me.portalRole !== 'leader' && me.accessGroup !== 'leadership')) {
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
      if (isAdminActor() && me) managerId = me.id;
      var res = setManager(id, managerId);
      if (!res.ok) { err.textContent = res.error || 'Could not assign'; return; }
      try { if (typeof global.savePlan === 'function') global.savePlan(); } catch (e) {}
      try { if (typeof global.persistTeamOrg === 'function') global.persistTeamOrg(); } catch (e) {}
      close();
      paintTabs();
      setEmpView('member', id);
      if (typeof global.aqToast === 'function') global.aqToast('Report added');
    };
  }

  function bootEmpView() {
    normalizeAll();
    try {
      var raw = localStorage.getItem('aqEmpView');
      if (raw) {
        var o = JSON.parse(raw);
        if (o && (o.mode === 'self' || o.mode === 'all' || o.mode === 'member')) {
          EMP_VIEW = { mode: o.mode, memberId: o.memberId || null };
        }
      }
    } catch (e) {}
    if (EMP_VIEW.mode === 'member' && !canViewMember(EMP_VIEW.memberId)) {
      EMP_VIEW = { mode: 'self', memberId: null };
    }
    applyViewFilters();
    paintTabs();
    paintContextBanner();
  }

  /** Gate mutations: when viewing someone you cannot edit, block savePlan side-effects callers should check first. */
  function assertCanEditCurrent() {
    if (isAdminActor()) {
      /* Admins may edit any traveller; All Reports stays view-only for trip edits. */
      return EMP_VIEW.mode !== 'all';
    }
    if (EMP_VIEW.mode === 'all') return false;
    if (EMP_VIEW.mode === 'self') return true;
    return canEditMember(EMP_VIEW.memberId);
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
      /* Merge hierarchy fields into local ADMIN.team without wiping travel fields */
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
    directReports: directReports,
    allReports: allReports,
    canViewMember: canViewMember,
    canEditMember: canEditMember,
    setManager: setManager,
    wouldCreateCycle: wouldCreateCycle,
    assertCanEditCurrent: assertCanEditCurrent,
    selectedLabel: selectedLabel,
    persistTeamOrg: persistTeamOrg,
    loadTeamOrg: loadTeamOrg,
    orgPayload: orgPayload,
    ensureShape: ensureShape,
    normalizeAll: normalizeAll,
  };
  global.persistTeamOrg = persistTeamOrg;
})(typeof window !== 'undefined' ? window : global);
