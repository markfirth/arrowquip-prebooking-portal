/* Arrowquip Travel Portal — My Team (Users)
   Visual reference: Dealer Portal My Dealership / Users.
   Depends on index.html globals: ADMIN, SB, pbIsAdmin, savePlan, render, etc. */
(function (global) {
  'use strict';

  var MT_PERM_GROUPS = [
    {
      id: 'standard',
      label: 'STANDARD TEAM MEMBER',
      perms: [
        'Manage their own travel plans',
        'View authorized team schedules',
        'Create and edit their own appointments',
        'Complete dealer visits',
        'Upload meeting transcripts',
        'Access approved travel itineraries',
      ],
    },
    {
      id: 'coordinator',
      label: 'TRAVEL COORDINATOR',
      perms: [
        'View travel across authorized territories',
        'Organize travel bookings',
        'Update booking information',
        'Review and approve travel itineraries',
        'Generate Excel and PDF travel documents',
        'Send approved itineraries to travellers',
      ],
    },
    {
      id: 'leadership',
      label: 'LEADERSHIP',
      perms: [
        'View company-wide travel schedules where authorized',
        'View annual planning',
        'Review travel activity',
        'Access authorized executive dealer visit reports',
      ],
    },
    {
      id: 'administrator',
      label: 'ADMINISTRATOR',
      perms: [
        'Manage users',
        'Manage roles',
        'Assign territories',
        'Manage application permissions',
        'Manage system settings',
      ],
    },
  ];

  var DEFAULT_JOB_ROLES = [
    { id: 'AM', label: 'AM — Account Manager', group: 'standard' },
    { id: 'DSR', label: 'DSR — Dealer Success Representative', group: 'standard' },
    { id: 'ISS', label: 'ISS — Inside Sales Support', group: 'standard' },
    { id: 'SA', label: 'Sales Assistant', group: 'coordinator' },
    { id: 'TC', label: 'Travel Coordinator', group: 'coordinator' },
    { id: 'LEAD', label: 'Leadership', group: 'leadership' },
  ];

  function esc(s) {
    return global.esc
      ? global.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
  }
  function ADMIN() {
    /* Prefer the portal's shared ADMIN (var on window). Never create a private
       empty object — that desynced My Team from the planner roster. */
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
  function rolesArr() {
    var A = ADMIN();
    if (!Array.isArray(A.jobRoles) || !A.jobRoles.length) {
      A.jobRoles = DEFAULT_JOB_ROLES.map(function (r) { return Object.assign({}, r); });
    } else {
      /* Ensure Sales Assistant exists for older saved plans without requiring a reset */
      if (!A.jobRoles.some(function (r) { return r && r.id === 'SA'; })) {
        A.jobRoles.splice(3, 0, { id: 'SA', label: 'Sales Assistant', group: 'coordinator' });
      }
      /* Rename legacy Travel Coordinator label clarity; keep TC id */
      A.jobRoles.forEach(function (r) {
        if (r && r.id === 'TC' && (!r.label || r.label === 'Travel Coordinator')) r.label = 'Travel Coordinator';
        if (r && r.id === 'DSR' && r.label && /Dealer Success Rep$/.test(r.label)) {
          r.label = 'DSR — Dealer Success Representative';
        }
      });
    }
    return A.jobRoles;
  }
  function accountStatusLabel(m) {
    if (!m || m.active === false) return 'Deactivated';
    if (m.inviteStatus === 'pending' || m.inviteStatus === 'invited') return 'Invitation pending';
    if (!m.email) return 'No login';
    return 'Active';
  }
  function roleLabel(id) {
    var r = rolesArr().filter(function (x) { return x.id === id; })[0];
    if (r) return r.label;
    if (global.TEAM_ROLE_LABEL && global.TEAM_ROLE_LABEL[id]) return id + ' — ' + global.TEAM_ROLE_LABEL[id];
    return id || '—';
  }
  function canManage() {
    try { return !!(global.pbIsAdmin && global.pbIsAdmin()); } catch (e) { return false; }
  }
  function bearer() {
    try { return global._PB_TOKEN || null; } catch (e) { return null; }
  }
  function save() {
    /* Roster/admin writes must persist even when the employee nav is on All Reports. */
    try { if (global.savePlan) global.savePlan({ force: true }); } catch (e) {}
    try {
      if (global.persistTeamOrg) global.persistTeamOrg();
      else if (global.AQEmp && global.AQEmp.persistTeamOrg) global.AQEmp.persistTeamOrg();
    } catch (e) {}
  }
  function managerOptionsHtml(selectedId, selfId) {
    var opts = '<option value="">— None —</option>';
    teamArr()
      .filter(function (m) { return m && m.active !== false && m.id !== selfId; })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); })
      .forEach(function (m) {
        opts +=
          '<option value="' + esc(m.id) + '"' + (selectedId === m.id ? ' selected' : '') + '>' +
          esc(m.name || m.email || m.id) +
          '</option>';
      });
    return opts;
  }
  function eaChecksHtml(selected, selfId) {
    var sel = selected || [];
    return teamArr()
      .filter(function (m) { return m && m.active !== false && m.id !== selfId; })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); })
      .map(function (m) {
        var on = sel.indexOf(m.id) >= 0;
        return (
          '<label class="mt-check"><input type="checkbox" name="mtu_ea" value="' + esc(m.id) + '"' +
          (on ? ' checked' : '') + '> ' + esc(m.name || m.email || m.id) + '</label>'
        );
      })
      .join('') || '<span class="mt-muted">No other employees yet</span>';
  }
  function portalRoleLabel(r) {
    return ({ employee: 'Employee', leader: 'Leader', ea: 'EA / Coordinator', admin: 'Admin' })[r] || r || 'Employee';
  }
  function managerName(id) {
    if (!id) return '—';
    var m = teamArr().filter(function (x) { return x.id === id; })[0];
    return m ? (m.name || m.email || id) : '—';
  }
  function toast(msg, ok) {
    try { if (global.aqToast) global.aqToast(msg, ok !== false); else if (global.cloudBadge) global.cloudBadge(msg); } catch (e) {}
  }
  function validEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim()); }
  function toE164(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var plus = s.charAt(0) === '+';
    var digits = s.replace(/[^\d]/g, '');
    if (!digits) return '';
    if (plus) return '+' + digits;
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
    return '+' + digits;
  }
  function fmtLastSignIn(iso) {
    if (!iso) return 'Never';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return 'Never';
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return 'Never'; }
  }
  function splitName(full) {
    var p = String(full || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return { first: '', last: '' };
    if (p.length === 1) return { first: p[0], last: '' };
    return { first: p[0], last: p.slice(1).join(' ') };
  }
  function joinName(first, last) {
    return [String(first || '').trim(), String(last || '').trim()].filter(Boolean).join(' ');
  }
  function memberTerrs(m) {
    if (!m) return [];
    if (Array.isArray(m.terrs) && m.terrs.length) return m.terrs.slice();
    if (m.terr) return [m.terr];
    return [];
  }
  function terrDisplay(m) {
    var t = memberTerrs(m);
    if (!t.length) return '—';
    if (t.indexOf('All') >= 0) return 'All';
    return t.join(', ');
  }

  var _lastSignIn = {};
  var _menuOpen = null;

  function ensureMemberShape(m) {
    if (!m) return m;
    if (!m.firstName && !m.lastName) {
      var sp = splitName(m.name);
      m.firstName = sp.first;
      m.lastName = sp.last;
    }
    if (!Array.isArray(m.terrs)) m.terrs = m.terr ? [m.terr] : [];
    if (!m.dialpad) m.dialpad = m.phone || '';
    if (m.isAdmin == null) m.isAdmin = false;
    if (!m.inviteStatus) m.inviteStatus = m.email ? 'linked' : 'profile';
    if (!m.accessGroup) {
      if (m.role === 'TC') m.accessGroup = 'coordinator';
      else if (m.role === 'LEAD') m.accessGroup = 'leadership';
      else m.accessGroup = 'standard';
    }
    if (!Array.isArray(m.eaFor)) m.eaFor = Array.isArray(m.eaForIds) ? m.eaForIds.slice() : [];
    if (m.managerId === undefined) m.managerId = m.manager_id || null;
    if (!m.portalRole) {
      if (m.isAdmin || m.accessGroup === 'administrator') m.portalRole = 'admin';
      else if (m.accessGroup === 'coordinator' || m.role === 'SA' || m.role === 'TC') m.portalRole = 'ea';
      else if (m.accessGroup === 'leadership' || m.role === 'LEAD') m.portalRole = 'leader';
      else m.portalRole = 'employee';
    }
    return m;
  }

  function normalizeTeam() {
    teamArr().forEach(ensureMemberShape);
    /* Keep legacy role label map in sync for planners. */
    global.TEAM_ROLE_LABEL = global.TEAM_ROLE_LABEL || {};
    rolesArr().forEach(function (r) {
      var short = String(r.label || r.id).split('—')[0].trim();
      global.TEAM_ROLE_LABEL[r.id] = short || r.id;
    });
  }

  async function refreshLastSignIn() {
    var emails = teamArr().map(function (m) { return String(m.email || '').toLowerCase(); }).filter(validEmail);
    if (!emails.length || !bearer()) return;
    try {
      var r = await fetch('/api/team-invite?emails=' + encodeURIComponent(emails.join(',')), {
        headers: { Authorization: 'Bearer ' + bearer() },
      });
      var j = await r.json().catch(function () { return null; });
      if (j && j.ok && j.lastSignIn) {
        _lastSignIn = j.lastSignIn;
        teamArr().forEach(function (m) {
          var em = String(m.email || '').toLowerCase();
          if (_lastSignIn[em] !== undefined) m.lastSignIn = _lastSignIn[em];
        });
      }
    } catch (e) {}
  }

  function currentTerr() {
    try {
      if (typeof global.getPortalTerr === 'function') return global.getPortalTerr();
    } catch (e) {}
    return global.terr;
  }

  function openMyTeam() {
    /* Root cause fix: index.html declares `let terr` / `let PLAN_MODE`, which are
       NOT properties of window. Setting global.terr left render()'s lexical terr
       unchanged, so Team view flashed then disappeared. Always navigate via
       goMyTeam() which lives in the same scope as terr. */
    if (typeof global.goMyTeam === 'function') {
      global.goMyTeam();
    } else {
      try { if (global.setPortalPlanMode) global.setPortalPlanMode('weekly'); } catch (e) {}
      try { if (global.setPortalTerr) global.setPortalTerr('Team'); else global.terr = 'Team'; } catch (e) {}
      document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
      var tv = document.getElementById('teamView');
      if (tv) { tv.classList.add('is-on'); tv.style.display = 'block'; }
      try { if (global.render) global.render(); else renderMyTeam(); } catch (e) {
        console.error(e);
        try { renderMyTeam(); } catch (e2) { console.error(e2); }
      }
    }
    if (!canManage()) toast('View only — administrator access required to edit users', false);
  }

  function renderMyTeam() {
    normalizeTeam();
    var host = document.getElementById('teamView');
    if (!host) return;
    var rows = teamArr().slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    var body = rows.map(function (m) {
      ensureMemberShape(m);
      var inactive = m.active === false;
      var email = m.email || '';
      var dial = m.dialpad || '';
      var status = accountStatusLabel(m);
      var roleOpts = rolesArr()
        .map(function (r) {
          return '<option value="' + esc(r.id) + '"' + (m.role === r.id ? ' selected' : '') + '>' + esc(r.label || r.id) + '</option>';
        })
        .join('');
      return (
        '<tr class="' + (inactive ? 'mt-inactive' : '') + '" data-mid="' + esc(m.id) + '">' +
        '<td><div class="mt-name">' + esc(m.name || '') + '</div></td>' +
        '<td>' +
        (email
          ? '<a class="mt-email" href="mailto:' + esc(email) + '">' + esc(email) + '</a>'
          : '<span class="mt-muted">Not set</span>') +
        '</td>' +
        '<td>' +
        (dial
          ? '<a class="mt-dial" href="tel:' + esc(dial) + '">' + esc(dial) + '</a>'
          : '<span class="mt-muted">—</span>') +
        '</td>' +
        '<td>' + esc(terrDisplay(m)) + '</td>' +
        '<td><select class="mt-role" data-mtrole="' + esc(m.id) + '"' + (canManage() ? '' : ' disabled') + ' title="Position">' + roleOpts + '</select></td>' +
        '<td>' + esc(managerName(m.managerId)) + '</td>' +
        '<td>' + esc(portalRoleLabel(m.portalRole)) + '</td>' +
        '<td class="mt-last">' + esc(fmtLastSignIn(m.lastSignIn || _lastSignIn[String(email).toLowerCase()])) + '</td>' +
        '<td><span class="mt-status-pill' + (inactive ? ' off' : (status === 'Active' ? ' on' : '')) + '">' + esc(status) + '</span></td>' +
        '<td class="mt-admin"><input type="checkbox" data-mtadmin="' + esc(m.id) + '"' + (m.isAdmin ? ' checked' : '') + (canManage() ? '' : ' disabled') + ' title="Administrator access"></td>' +
        '<td class="mt-actions"><button type="button" class="mt-more" data-mtmore="' + esc(m.id) + '" title="Actions" aria-label="Actions">⋯</button></td>' +
        '</tr>'
      );
    }).join('');

    host.innerHTML =
      '<div class="mt-page">' +
      '<div class="mt-head"><h1>MY TEAM</h1></div>' +
      '<div class="mt-tabs"><button type="button" class="mt-tab on">USERS</button></div>' +
      '<div class="mt-card">' +
      '<div class="mt-toolbar">' +
      '<button type="button" class="mt-btn ghost" id="mtManageRoles">MANAGE ROLES</button>' +
      '<button type="button" class="mt-btn solid" id="mtAddUser">ADD USER</button>' +
      '</div>' +
      '<div class="mt-table-wrap"><table class="mt-table">' +
      '<thead><tr><th>NAME</th><th>EMAIL</th><th>DIALPAD</th><th>TERRITORY</th><th>POSITION</th><th>MANAGER</th><th>PORTAL ROLE</th><th>LAST SIGN-IN</th><th>STATUS</th><th>ADMIN</th><th></th></tr></thead>' +
      '<tbody>' + (body || '<tr><td colspan="11" class="mt-empty">No team members yet. Click ADD USER to invite the first employee.</td></tr>') + '</tbody>' +
      '</table></div>' +
      '<p class="mt-foot">Job title and territory are separate from portal permissions (Employee / Leader / EA / Admin). Reporting lines drive employee tabs. Deactivating a user preserves their travel history.</p>' +
      '</div></div>';

    wireMyTeam(host);
    refreshLastSignIn().then(function () {
      /* soft-refresh last-sign-in cells without full re-render if still on page */
      if (document.getElementById('teamView') !== host) return;
      host.querySelectorAll('tr[data-mid]').forEach(function (tr) {
        var m = teamArr().filter(function (x) { return x.id === tr.dataset.mid; })[0];
        if (!m) return;
        var cell = tr.querySelector('.mt-last');
        if (cell) cell.textContent = fmtLastSignIn(m.lastSignIn || _lastSignIn[String(m.email || '').toLowerCase()]);
      });
    });
  }

  function closeMenus() {
    document.querySelectorAll('.mt-pop').forEach(function (p) { p.remove(); });
    _menuOpen = null;
  }

  function wireMyTeam(host) {
    var add = host.querySelector('#mtAddUser');
    if (add) add.onclick = function () { openAddUserModal({}); };
    var roles = host.querySelector('#mtManageRoles');
    if (roles) roles.onclick = function () { openManageRolesModal(); };

    host.querySelectorAll('[data-mtrole]').forEach(function (sel) {
      sel.onchange = function () {
        var m = teamArr().filter(function (x) { return x.id === sel.dataset.mtrole; })[0];
        if (!m) return;
        m.role = sel.value;
        var rr = rolesArr().filter(function (r) { return r.id === m.role; })[0];
        if (rr && rr.group) m.accessGroup = rr.group;
        save();
        toast('Role updated');
      };
    });
    host.querySelectorAll('[data-mtadmin]').forEach(function (cb) {
      cb.onchange = function () {
        var m = teamArr().filter(function (x) { return x.id === cb.dataset.mtadmin; })[0];
        if (!m) return;
        if (cb.checked) {
          if (!confirm('Grant administrator access to ' + (m.name || m.email) + '?')) {
            cb.checked = false;
            return;
          }
        } else {
          var admins = teamArr().filter(function (x) { return x.active !== false && x.isAdmin; });
          if (admins.length <= 1 && m.isAdmin) {
            alert('Cannot remove the last active administrator.');
            cb.checked = true;
            return;
          }
          if (!confirm('Remove administrator access for ' + (m.name || m.email) + '?')) {
            cb.checked = true;
            return;
          }
        }
        m.isAdmin = !!cb.checked;
        save();
        if (m.email) inviteMember(m, { resend: false, portalOnly: true });
      };
    });
    host.querySelectorAll('[data-mtmore]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var id = btn.dataset.mtmore;
        if (_menuOpen === id) { closeMenus(); return; }
        closeMenus();
        openRowMenu(btn, id);
      };
    });
    document.addEventListener('click', closeMenus, { once: true });
  }

  function openRowMenu(btn, id) {
    var m = teamArr().filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    ensureMemberShape(m);
    var pop = document.createElement('div');
    pop.className = 'mt-pop';
    var items = [
      { k: 'edit', t: 'Edit User' },
      { k: 'invite', t: m.email ? (m.inviteStatus === 'pending' ? 'Resend Invitation' : 'Send Invitation') : 'Send Invitation', hide: !m.email && false },
      { k: 'reset', t: 'Reset Password', hide: !m.email },
      { k: 'perms', t: 'Change Permissions' },
      { k: 'toggle', t: m.active === false ? 'Reactivate User' : 'Deactivate User', danger: m.active !== false },
    ];
    pop.innerHTML = items
      .filter(function (i) { return !i.hide; })
      .map(function (i) {
        return '<button type="button" data-act="' + i.k + '" class="' + (i.danger ? 'danger' : '') + '">' + esc(i.t) + '</button>';
      })
      .join('');
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect();
    pop.style.top = Math.min(window.innerHeight - 8, r.bottom + 4) + 'px';
    pop.style.left = Math.max(8, r.right - 180) + 'px';
    _menuOpen = id;
    pop.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        closeMenus();
        var act = b.dataset.act;
        if (act === 'edit') openAddUserModal({ member: m });
        else if (act === 'invite') inviteMember(m, { resend: true });
        else if (act === 'reset') inviteMember(m, { resend: true, reset: true });
        else if (act === 'perms') openAddUserModal({ member: m, focusAdmin: true });
        else if (act === 'toggle') toggleActive(m);
      };
    });
  }

  function toggleActive(m) {
    if (m.active === false) {
      m.active = true;
      save();
      toast('User reactivated');
      renderMyTeam();
      return;
    }
    if (m.isAdmin) {
      var admins = teamArr().filter(function (x) { return x.active !== false && x.isAdmin; });
      if (admins.length <= 1) { alert('Cannot deactivate the last active administrator.'); return; }
    }
    if (!confirm('Deactivate ' + (m.name || m.email) + '? They will lose access. Travel history is preserved.')) return;
    m.active = false;
    save();
    toast('User deactivated');
    renderMyTeam();
  }

  function terrCheckboxes(selected, name) {
    var opts = ['East', 'South', 'Central', 'West', 'Exports', 'All'];
    var sel = selected || [];
    return opts
      .map(function (t) {
        var on = sel.indexOf(t) >= 0 || (t === 'All' && sel.indexOf('All') >= 0);
        return (
          '<label class="mt-check"><input type="checkbox" name="' + name + '" value="' + t + '"' + (on ? ' checked' : '') + '> ' +
          (t === 'All' ? 'All Territories' : t) +
          '</label>'
        );
      })
      .join('');
  }

  function openAddUserModal(opts) {
    opts = opts || {};
    if (!canManage()) { toast('Administrator access required', false); return; }
    var existing = opts.member || null;
    var ct = currentTerr();
    var preTerr = opts.preTerr || (ct && ['East', 'South', 'Central', 'West', 'Exports'].indexOf(ct) >= 0 ? ct : 'East');
    var sp = existing ? { first: existing.firstName || splitName(existing.name).first, last: existing.lastName || splitName(existing.name).last } : { first: '', last: '' };
    var wrap = document.createElement('div');
    wrap.className = 'mt-modalbg';
    var roleOpts = rolesArr()
      .map(function (r) {
        return '<option value="' + esc(r.id) + '"' + ((existing ? existing.role : 'AM') === r.id ? ' selected' : '') + '>' + esc(r.label) + '</option>';
      })
      .join('');
    wrap.innerHTML =
      '<div class="mt-modal" role="dialog" aria-label="' + (existing ? 'Edit user' : 'Add user') + '">' +
      '<div class="mt-mh"><div class="mt-mt">' + (existing ? 'Edit User' : 'Add User') + '</div><button type="button" class="mt-mx" id="mtu_x">×</button></div>' +
      '<div class="mt-mb">' +
      '<div class="mt-grid2">' +
      '<label>First name<input id="mtu_first" value="' + esc(sp.first) + '" autocomplete="off"></label>' +
      '<label>Last name<input id="mtu_last" value="' + esc(sp.last) + '" autocomplete="off"></label>' +
      '</div>' +
      '<label>Company email<input id="mtu_email" type="email" value="' + esc(existing ? existing.email || '' : '') + '" placeholder="name@arrowquip.com"></label>' +
      '<label>Dialpad telephone<input id="mtu_dial" value="' + esc(existing ? existing.dialpad || '' : '') + '" placeholder="+1…"></label>' +
      '<label>Position<select id="mtu_role">' + roleOpts + '</select></label>' +
      '<div class="mt-label">Territory</div><div class="mt-checks" id="mtu_terrs">' +
      terrCheckboxes(existing ? memberTerrs(existing) : [preTerr], 'mtu_terr') +
      '</div>' +
      '<label>Reporting manager<select id="mtu_manager">' +
      managerOptionsHtml(existing ? existing.managerId : null, existing ? existing.id : null) +
      '</select></label>' +
      '<label>Portal role<select id="mtu_portal">' +
      ['employee', 'leader', 'ea', 'admin'].map(function (r) {
        var cur = existing ? existing.portalRole : 'employee';
        return '<option value="' + r + '"' + (cur === r ? ' selected' : '') + '>' + portalRoleLabel(r) + '</option>';
      }).join('') +
      '</select></label>' +
      '<div class="mt-label">EA assignment (coordinate on behalf of)</div><div class="mt-checks" id="mtu_ea">' +
      eaChecksHtml(existing ? existing.eaFor : [], existing ? existing.id : null) +
      '</div>' +
      '<div class="mt-label">Access permissions</div>' +
      '<label class="mt-check admin"><input type="checkbox" id="mtu_admin"' + (existing && existing.isAdmin ? ' checked' : '') + '> Administrator access</label>' +
      '<p class="mt-hint" style="margin:6px 0 0">Portal role controls travel access (own / reports / EA assignees / all). Job title and territory stay independent. Administrator access is required to manage users.</p>' +
      '<div class="mt-err" id="mtu_err"></div>' +
      '</div>' +
      '<div class="mt-mf">' +
      '<button type="button" class="mt-btn ghost" id="mtu_cancel">CANCEL</button>' +
      '<button type="button" class="mt-btn solid" id="mtu_save">' + (existing ? 'SAVE CHANGES' : 'SEND INVITATION') + '</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('#mtu_x').onclick = close;
    wrap.querySelector('#mtu_cancel').onclick = close;
    if (opts.focusAdmin) setTimeout(function () { wrap.querySelector('#mtu_admin').focus(); }, 50);

    wrap.querySelector('#mtu_save').onclick = async function () {
      var first = wrap.querySelector('#mtu_first').value.trim();
      var last = wrap.querySelector('#mtu_last').value.trim();
      var email = wrap.querySelector('#mtu_email').value.trim().toLowerCase();
      var dial = toE164(wrap.querySelector('#mtu_dial').value);
      var role = wrap.querySelector('#mtu_role').value;
      var isAdmin = wrap.querySelector('#mtu_admin').checked;
      var portalRole = wrap.querySelector('#mtu_portal').value || 'employee';
      var managerId = wrap.querySelector('#mtu_manager').value || null;
      var terrs = Array.prototype.slice.call(wrap.querySelectorAll('input[name="mtu_terr"]:checked')).map(function (c) { return c.value; });
      var eaFor = Array.prototype.slice.call(wrap.querySelectorAll('input[name="mtu_ea"]:checked')).map(function (c) { return c.value; });
      var err = wrap.querySelector('#mtu_err');
      err.textContent = '';
      if (!first) { err.textContent = 'Enter a first name'; return; }
      if (!email || !validEmail(email)) { err.textContent = 'Enter a valid company email address'; return; }
      if (wrap.querySelector('#mtu_dial').value.trim() && !dial) { err.textContent = 'Enter a valid international telephone number'; return; }
      if (!terrs.length) { err.textContent = 'Select at least one territory'; return; }
      if (terrs.indexOf('All') >= 0) terrs = ['All'];
      if (portalRole === 'admin') isAdmin = true;

      var dup = teamArr().filter(function (x) {
        if (existing && x.id === existing.id) return false;
        return x.email && String(x.email).toLowerCase() === email;
      })[0];
      if (dup) { err.textContent = 'An employee with this email already exists'; return; }

      var name = joinName(first, last);
      var member = existing;
      if (!member) {
        /* Prefer linking a same-name profile without email (seeded travellers). */
        var reuse = teamArr().filter(function (x) {
          return !x.email && String(x.name || '').toLowerCase() === name.toLowerCase() && x.active !== false;
        })[0];
        if (reuse) member = reuse;
      }
      if (!member) {
        member = {
          id: 'tm_' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
          source: 'manual',
          active: true,
        };
        teamArr().push(member);
      }
      if (managerId) {
        if (managerId === member.id) { err.textContent = 'Cannot report to yourself'; return; }
        if (global.AQEmp && AQEmp.wouldCreateCycle && AQEmp.wouldCreateCycle(member.id, managerId)) {
          err.textContent = 'That reporting line would create a circular relationship';
          return;
        }
      }
      member.firstName = first;
      member.lastName = last;
      member.name = name;
      member.email = email;
      member.dialpad = dial;
      member.role = role;
      member.terrs = terrs;
      member.terr = terrs[0] === 'All' ? 'East' : terrs[0];
      member.isAdmin = !!isAdmin;
      member.portalRole = portalRole;
      member.managerId = managerId || null;
      member.eaFor = eaFor;
      member.active = member.active !== false;
      member.inviteStatus = member.inviteStatus || 'pending';
      var rr = rolesArr().filter(function (r) { return r.id === role; })[0];
      member.accessGroup = (rr && rr.group) || 'standard';
      if (portalRole === 'admin') member.accessGroup = 'administrator';
      else if (portalRole === 'leader') member.accessGroup = 'leadership';
      else if (portalRole === 'ea') member.accessGroup = 'coordinator';
      save();
      close();
      toast(existing ? 'Saving & inviting…' : 'Creating account…');
      await inviteMember(member, { resend: true });
      try { if (global.AQEmp && AQEmp.paint) AQEmp.paint(); } catch (e) {}
      if (currentTerr() === 'Team') renderMyTeam();
      else try { if (global.render) global.render(); } catch (e) {}
    };
  }

  async function inviteMember(m, opts) {
    opts = opts || {};
    if (!m || !m.email) { toast('Add a company email before inviting', false); return; }
    if (!bearer()) { toast('Sign in required to send invitations', false); return; }
    try {
      var r = await fetch('/api/team-invite', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + bearer(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: m.email,
          fullName: m.name,
          dialpad: m.dialpad || '',
          admin: !!m.isAdmin,
          portalRole: m.isAdmin || m.portalRole === 'admin' ? 'admin' : (m.portalRole === 'ea' ? 'coordinator' : 'planner'),
          redirectTo: location.origin + '/',
          dryRun: false,
        }),
      });
      var j = await r.json().catch(function () { return null; });
      if (!j) { toast('Invite request failed', false); return; }
      if (j.ok) {
        m.inviteStatus = j.invite && j.invite.ok ? 'invited' : 'linked';
        if (j.invite && j.invite.lastSignIn) m.lastSignIn = j.invite.lastSignIn;
        save();
        toast(j.message || 'Invitation sent');
      } else {
        m.inviteStatus = 'pending';
        save();
        toast(j.message || j.error || 'Allowlist updated; invite incomplete', false);
      }
      if (currentTerr() === 'Team') renderMyTeam();
    } catch (e) {
      toast('Invite failed — check connection', false);
    }
  }

  function openManageRolesModal() {
    if (!canManage()) return;
    normalizeTeam();
    var wrap = document.createElement('div');
    wrap.className = 'mt-modalbg';
    var roleRows = rolesArr()
      .map(function (r, i) {
        return (
          '<tr data-ri="' + i + '"><td><input class="mt-rin" data-f="id" value="' + esc(r.id) + '" ' + (r.locked ? 'readonly' : '') + '></td>' +
          '<td><input class="mt-rin" data-f="label" value="' + esc(r.label) + '"></td>' +
          '<td><select class="mt-rin" data-f="group">' +
          MT_PERM_GROUPS.map(function (g) {
            return '<option value="' + g.id + '"' + (r.group === g.id ? ' selected' : '') + '>' + esc(g.label) + '</option>';
          }).join('') +
          '</select></td></tr>'
        );
      })
      .join('');
    var permHtml = MT_PERM_GROUPS.map(function (g) {
      return (
        '<div class="mt-pg"><div class="mt-pgl">' + esc(g.label) + '</div><ul>' +
        g.perms.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
        '</ul></div>'
      );
    }).join('');
    wrap.innerHTML =
      '<div class="mt-modal wide" role="dialog" aria-label="Manage roles">' +
      '<div class="mt-mh"><div class="mt-mt">Manage Roles</div><button type="button" class="mt-mx" id="mtr_x">×</button></div>' +
      '<div class="mt-mb">' +
      '<p class="mt-hint">Job roles are separate from system access. An Account Manager is not automatically an administrator.</p>' +
      '<table class="mt-roles"><thead><tr><th>Code</th><th>Label</th><th>Permission group</th></tr></thead><tbody id="mtr_body">' + roleRows + '</tbody></table>' +
      '<button type="button" class="mt-btn ghost" id="mtr_add" style="margin-top:10px">+ ADD ROLE</button>' +
      '<div class="mt-perms">' + permHtml + '</div>' +
      '<div class="mt-err" id="mtr_err"></div>' +
      '</div>' +
      '<div class="mt-mf"><button type="button" class="mt-btn ghost" id="mtr_cancel">CANCEL</button><button type="button" class="mt-btn solid" id="mtr_save">SAVE</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('#mtr_x').onclick = close;
    wrap.querySelector('#mtr_cancel').onclick = close;
    wrap.querySelector('#mtr_add').onclick = function () {
      rolesArr().push({ id: 'NEW', label: 'New role', group: 'standard' });
      close();
      openManageRolesModal();
    };
    wrap.querySelector('#mtr_save').onclick = function () {
      var next = [];
      wrap.querySelectorAll('#mtr_body tr').forEach(function (tr) {
        var id = tr.querySelector('[data-f="id"]').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12);
        var label = tr.querySelector('[data-f="label"]').value.trim();
        var group = tr.querySelector('[data-f="group"]').value;
        if (!id || !label) return;
        next.push({ id: id, label: label, group: group });
      });
      if (!next.length) { wrap.querySelector('#mtr_err').textContent = 'Keep at least one role'; return; }
      ADMIN().jobRoles = next;
      normalizeTeam();
      save();
      close();
      toast('Roles saved');
      if (currentTerr() === 'Team') renderMyTeam();
    };
  }

  /* Public API */
  global.MT_PERM_GROUPS = MT_PERM_GROUPS;
  global.openMyTeam = openMyTeam;
  global.renderMyTeam = renderMyTeam;
  global.openAddUserModal = openAddUserModal;
  global.openManageRolesModal = openManageRolesModal;
  global.mtNormalizeTeam = normalizeTeam;
  global.mtInviteMember = inviteMember;

})(window);
