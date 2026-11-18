/* Arrowquip TRAVEL — Travel Coordination (Sales EA) work queue + booking checklist.
   Same TRIPBOOK / LOGI / visit records as Sales Planning. Attaches window.AQCoord. */
(function (global) {
  'use strict';

  function esc(s) {
    return global.esc
      ? global.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
  }
  function TRIPBOOK() { return global.TRIPBOOK || (global.TRIPBOOK = {}); }
  function ADMIN() { return global.ADMIN || {}; }
  function teamById(id) {
    try { return global.teamById ? global.teamById(id) : null; } catch (e) { return null; }
  }
  function save() { try { if (global.savePlan) global.savePlan(); } catch (e) {} }
  function toast(m, ok) {
    try { if (global.aqToast) global.aqToast(m, ok !== false); } catch (e) {}
  }
  function who() {
    try { return global.pbWho ? global.pbWho() : 'coordinator'; } catch (e) { return 'coordinator'; }
  }
  function travelType(it) {
    try { return global.travelType ? global.travelType(it) : (it && it.type) || 'other'; } catch (e) { return 'other'; }
  }
  function WEEKDATES() { return global.WEEKDATES || {}; }
  function wkNo(wk) { try { return global.wkNo ? global.wkNo(wk) : wk; } catch (e) { return wk; } }

  function parseTripKey(k) {
    var p = String(k || '').split('|');
    return { terr: p[0] || '', wk: parseInt(p[1], 10), memberId: p[2] || null, key: k };
  }

  function tripRows(filter) {
    filter = filter || {};
    var out = [];
    var TB = TRIPBOOK();
    Object.keys(TB).forEach(function (k) {
      var rec = TB[k];
      if (!rec || !rec.status || rec.status === 'planning') return;
      var meta = parseTripKey(k);
      if (!isFinite(meta.wk)) return;
      if (filter.status && rec.status !== filter.status) return;
      if (filter.attention) {
        if (!(rec.status === 'ready' || rec.status === 'booking' || rec.needsReview)) return;
      }
      if (filter.terr && meta.terr !== filter.terr) return;
      if (filter.memberId && meta.memberId !== filter.memberId) return;
      if (filter.wk && meta.wk !== +filter.wk) return;
      var member = meta.memberId ? teamById(meta.memberId) : null;
      var pack = null;
      try {
        if (global.tripCollectWeek && member)
          pack = global.tripCollectWeek(meta.terr, meta.wk, member);
      } catch (e) {}
      var dealers = 0, confirmed = 0;
      try {
        dealers = ((pack && pack.vs) || []).length + ((pack && pack.xs) || []).length;
        ((pack && pack.vs) || []).forEach(function (d) {
          if (d && global.APPT && global.APPT[d.id]) confirmed++;
        });
        ((pack && pack.xs) || []).forEach(function (x) {
          if (x && x.done) confirmed++;
        });
      } catch (e) {}
      var checklist = ensureChecklist(k, meta, pack, rec);
      var bookedN = checklist.filter(function (c) { return c.status === 'booked'; }).length;
      out.push({
        key: k,
        rec: rec,
        terr: meta.terr,
        wk: meta.wk,
        memberId: meta.memberId,
        traveller: (member && member.name) || (rec.travellerName) || 'Traveller',
        dates: WEEKDATES()[meta.wk] || ('WK ' + wkNo(meta.wk)),
        destination: destinationsOf(pack),
        dealers: dealers,
        confirmed: confirmed,
        checklist: checklist,
        bookedN: bookedN,
        checklistN: checklist.length,
        status: rec.status,
        needsReview: !!rec.needsReview,
      });
    });
    out.sort(function (a, b) {
      if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
      var order = { ready: 0, booking: 1, booked: 2, sent: 3, completed: 4 };
      var oa = order[a.status] != null ? order[a.status] : 9;
      var ob = order[b.status] != null ? order[b.status] : 9;
      if (oa !== ob) return oa - ob;
      return a.wk - b.wk;
    });
    return out;
  }

  function destinationsOf(pack) {
    var dest = [];
    try {
      ((pack && pack.vs) || []).forEach(function (d) { if (d && d.name) dest.push(d.name); });
      ((pack && pack.xs) || []).forEach(function (x) {
        var d = (global.byId && global.byId[x.dealer]) || (global.uniById && global.uniById(x.dealer));
        if (d && d.name) dest.push(d.name);
      });
      ((pack && pack.ls) || []).forEach(function (it) {
        var ty = travelType(it);
        if ((ty === 'hotel' || /^flight_/.test(ty)) && it.name) dest.push(it.name);
      });
    } catch (e) {}
    var uniq = [];
    dest.forEach(function (n) { if (uniq.indexOf(n) < 0) uniq.push(n); });
    return uniq.slice(0, 3).join(', ') || '—';
  }

  function ensureChecklist(key, meta, pack, rec) {
    if (rec.checklist && Array.isArray(rec.checklist) && rec.checklist.length) return rec.checklist;
    var items = [];
    function add(kind, title, sourceId) {
      items.push({
        id: 'ck_' + kind + '_' + (sourceId || items.length) + '_' + Date.now().toString(36).slice(-4),
        kind: kind,
        title: title,
        sourceId: sourceId || null,
        status: 'needed',
        details: {},
      });
    }
    ((pack && pack.ls) || []).forEach(function (it) {
      var ty = travelType(it);
      if (ty === 'flight_out' || ty === 'flight_stop') add('flight_out', 'Outbound flight' + (it.airline ? (' · ' + it.airline) : ''), it.id);
      else if (ty === 'flight_in') add('flight_in', 'Return / inbound flight' + (it.airline ? (' · ' + it.airline) : ''), it.id);
      else if (ty === 'hotel') add('hotel', 'Hotel' + (it.name ? (' · ' + it.name) : (it.address ? (' · ' + it.address) : '')), it.id);
      else if (ty === 'rental_pickup') add('rental', 'Rental car pickup', it.id);
      else if (ty === 'rental_return') add('rental_return', 'Rental car return', it.id);
      else if (ty === 'other' || ty === 'ground') add('ground', it.name || 'Ground transportation', it.id);
    });
    /* Only itinerary-derived requirements — never invent flights/hotels the salesperson did not request */
    rec.checklist = items;
    TRIPBOOK()[key] = rec;
    return items;
  }

  function metrics() {
    var rows = tripRows({});
    return {
      ready: rows.filter(function (r) { return r.status === 'ready' || r.needsReview; }).length,
      booking: rows.filter(function (r) { return r.status === 'booking'; }).length,
      completed: rows.filter(function (r) { return r.status === 'booked' || r.status === 'sent' || r.status === 'completed'; }).length,
    };
  }

  function openTrip(row) {
    try {
      if (global.setPortalTerr) global.setPortalTerr(row.terr);
      else global.terr = row.terr;
      if (typeof global.FOCUS_WK !== 'undefined') global.FOCUS_WK = row.wk;
      if (typeof global.ALL_WK !== 'undefined') global.ALL_WK = row.wk;
      if (row.memberId && global.TEAM_IDS) {
        global.TEAM_ALL = false;
        global.TEAM_IDS = {};
        global.TEAM_IDS[row.memberId] = true;
        try { if (global.teamSaveSel) global.teamSaveSel(); } catch (e) {}
      }
      if (global.setPortalMode) global.setPortalMode('sales');
      else if (global.render) global.render();
      toast('Opened trip for ' + row.traveller);
    } catch (e) {
      console.error(e);
    }
  }

  function setTripStatus(key, status) {
    var rec = TRIPBOOK()[key] || { status: 'planning' };
    rec.status = status;
    rec.updatedAt = new Date().toISOString();
    rec.updatedBy = who();
    if (status === 'booking' && !rec.bookingStartedAt) rec.bookingStartedAt = rec.updatedAt;
    if (status === 'booked') {
      rec.bookedAt = rec.updatedAt;
      rec.needsReview = false;
    }
    if (status === 'completed') rec.completedAt = rec.updatedAt;
    if (status === 'sent') {
      rec.sentAt = rec.updatedAt;
      rec.deliveryStatus = 'sent';
    }
    TRIPBOOK()[key] = rec;
    try {
      if (global.CONF && status !== 'planning') global.CONF[key] = true;
      if (global.CONF && status === 'planning') delete global.CONF[key];
    } catch (e) {}
    save();
    renderCoord();
  }

  function hotelPrefBlurb(memberId) {
    try {
      var prefs = global.travelPrefsFor ? global.travelPrefsFor(memberId) : null;
      if (!prefs) return '';
      var liked = [].concat(prefs.hotelsPreferred || [], prefs.hotelsLiked || []).slice(0, 4);
      var disliked = (prefs.hotelsDisliked || []).slice(0, 3);
      var bits = [];
      if (liked.length) {
        bits.push(
          'Preferred / liked: ' +
            liked
              .map(function (h) {
                return h.name || h.brand || h.city || 'hotel';
              })
              .join(', ')
        );
      }
      if (disliked.length) {
        bits.push(
          'Avoid: ' +
            disliked
              .map(function (h) {
                return h.name || h.brand || 'hotel';
              })
              .join(', ')
        );
      }
      if (prefs.hotelBudget) bits.push('Budget ≈ ' + prefs.hotelBudget);
      if (!bits.length) return '<div class="coord-prefs">No saved hotel preferences for this traveller. Live hotel search is not connected.</div>';
      return (
        '<div class="coord-prefs"><b>Traveller hotel memory</b> — ' +
        esc(bits.join(' · ')) +
        '. Live availability/pricing is not invented — use connected booking tools when available.</div>'
      );
    } catch (e) {
      return '';
    }
  }

  function openChecklist(row) {
    var rec = TRIPBOOK()[row.key];
    if (!rec) return;
    var meta = parseTripKey(row.key);
    var member = meta.memberId ? teamById(meta.memberId) : null;
    var pack = null;
    try {
      if (global.tripCollectWeek) pack = global.tripCollectWeek(meta.terr, meta.wk, member);
    } catch (e) {}
    var items = ensureChecklist(row.key, meta, pack, rec);
    save();
    var wrap = document.createElement('div');
    wrap.className = 'modalbg';
    wrap.id = 'coordCkModal';
    function rowHtml(c, i) {
      var d = c.details || {};
      var pref = c.kind === 'hotel' ? hotelPrefBlurb(meta.memberId) : '';
      return (
        '<div class="coord-ck" data-ci="' + i + '">' +
        '<div class="coord-ck-h">' +
        '<b>' + esc(c.title) + '</b>' +
        '<select data-ckstat="' + i + '">' +
        ['needed', 'booking', 'booked'].map(function (s) {
          return '<option value="' + s + '"' + (c.status === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') +
        '</select></div>' +
        '<div class="coord-ck-b">' +
        pref +
        (c.kind.indexOf('flight') === 0
          ? fieldGrid([
              ['airline', 'Airline', d.airline],
              ['flightNo', 'Flight #', d.flightNo],
              ['depAirport', 'Dep airport', d.depAirport],
              ['arrAirport', 'Arr airport', d.arrAirport],
              ['depTime', 'Dep local time', d.depTime],
              ['arrTime', 'Arr local time', d.arrTime],
              ['conf', 'Confirmation #', d.conf],
              ['seat', 'Seat', d.seat],
              ['cost', 'Cost', d.cost],
              ['currency', 'Currency', d.currency || 'USD'],
            ], i)
          : c.kind === 'hotel'
          ? fieldGrid([
              ['name', 'Hotel name', d.name],
              ['address', 'Address', d.address],
              ['maps', 'Google Maps URL', d.maps],
              ['checkIn', 'Check-in', d.checkIn],
              ['checkOut', 'Check-out', d.checkOut],
              ['conf', 'Confirmation #', d.conf],
              ['rate', 'Nightly rate', d.rate],
              ['total', 'Total', d.total],
              ['currency', 'Currency', d.currency || 'USD'],
            ], i)
          : fieldGrid([
              ['provider', 'Provider', d.provider],
              ['pickup', 'Pickup', d.pickup],
              ['dropoff', 'Return', d.dropoff],
              ['vehicle', 'Vehicle', d.vehicle],
              ['conf', 'Confirmation #', d.conf],
              ['cost', 'Cost', d.cost],
              ['currency', 'Currency', d.currency || 'USD'],
            ], i)) +
        '<label class="coord-notes">Notes<textarea data-ckf="' + i + '" data-fk="notes">' + esc(d.notes || '') + '</textarea></label>' +
        '</div></div>'
      );
    }
    function fieldGrid(fields, i) {
      return (
        '<div class="coord-fields">' +
        fields
          .map(function (f) {
            return (
              '<label>' +
              esc(f[1]) +
              '<input data-ckf="' + i + '" data-fk="' + f[0] + '" value="' + esc(f[2] || '') + '"></label>'
            );
          })
          .join('') +
        '</div>'
      );
    }
    wrap.innerHTML =
      '<div class="modalbox" style="width:min(720px,96vw)">' +
      '<div class="mh"><div class="mt">Booking checklist · ' + esc(row.traveller) + '</div>' +
      '<button type="button" class="mclose" id="ckx">×</button></div>' +
      '<div style="padding:12px 16px;max-height:70vh;overflow:auto">' +
      '<p style="margin:0 0 10px;font-size:12px;color:#6b7280">Enter real booking details only. Nothing is invented. Saving writes confirmations back onto the shared trip events.</p>' +
      items.map(rowHtml).join('') +
      '</div>' +
      '<div style="padding:10px 16px 14px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #e5e7eb">' +
      '<button type="button" class="kbb" id="ckcancel">Close</button>' +
      '<button type="button" class="kbb primary" id="cksave">Save</button></div></div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.querySelector('#ckx').onclick = close;
    wrap.querySelector('#ckcancel').onclick = close;
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('#cksave').onclick = function () {
      items.forEach(function (c, i) {
        c.status = (wrap.querySelector('[data-ckstat="' + i + '"]') || {}).value || c.status;
        c.details = c.details || {};
        wrap.querySelectorAll('[data-ckf="' + i + '"]').forEach(function (inp) {
          c.details[inp.dataset.fk] = inp.value;
        });
        applyChecklistToEvent(c);
      });
      rec.checklist = items;
      var allBooked = items.length && items.every(function (c) { return c.status === 'booked'; });
      if (allBooked && (rec.status === 'ready' || rec.status === 'booking')) {
        rec.status = 'booked';
        rec.bookedAt = new Date().toISOString();
        rec.needsReview = false;
      } else if (items.some(function (c) { return c.status === 'booking' || c.status === 'booked'; }) && rec.status === 'ready') {
        rec.status = 'booking';
        rec.bookingStartedAt = rec.bookingStartedAt || new Date().toISOString();
      }
      TRIPBOOK()[row.key] = rec;
      save();
      close();
      renderCoord();
      toast('Checklist saved');
      try { if (global.refreshPlanner) global.refreshPlanner(); } catch (e) {}
    };
  }

  function applyChecklistToEvent(c) {
    if (!c.sourceId || !global.LOGI) return;
    var it = (global.LOGI || []).filter(function (x) { return x.id === c.sourceId; })[0];
    if (!it) return;
    var d = c.details || {};
    if (c.kind.indexOf('flight') === 0) {
      if (d.airline) it.airline = d.airline;
      if (d.flightNo) it.flightNo = d.flightNo;
      if (d.depAirport) it.depAirport = d.depAirport;
      if (d.arrAirport) it.arrAirport = d.arrAirport;
      if (d.depTime) it.time = d.depTime;
      if (d.arrTime) it.time2 = d.arrTime;
      if (d.conf) it.conf = d.conf;
      if (d.seat) it.seat = d.seat;
    } else if (c.kind === 'hotel') {
      if (d.name) it.name = d.name;
      if (d.address) it.address = d.address;
      if (d.maps) it.mapsUrl = d.maps;
      if (d.conf) it.conf = d.conf;
    } else {
      if (d.provider) it.name = d.provider;
      if (d.conf) it.conf = d.conf;
    }
    if (c.status === 'booked') it.bookStatus = 'booked';
    if (d.notes) it.notes = d.notes;
  }

  function renderCoord() {
    var host = document.getElementById('coordView');
    if (!host) return;
    var m = metrics();
    var filter = global._COORD_FILTER || { attention: true };
    var rows = tripRows(filter);
    var body = rows
      .map(function (r) {
        var stLabel = (global.TRIP_STATUS && global.TRIP_STATUS[r.status] && global.TRIP_STATUS[r.status].label) || r.status;
        return (
          '<tr data-ckey="' + esc(r.key) + '">' +
          '<td><button type="button" class="coord-link" data-open="' + esc(r.key) + '">' + esc(r.traveller) + '</button>' +
          (r.needsReview ? '<div class="coord-flag">Needs review</div>' : '') +
          '</td>' +
          '<td>' + esc(r.terr) + '</td>' +
          '<td>' + esc(r.dates) + '</td>' +
          '<td>' + esc(r.destination) + '</td>' +
          '<td>' + r.confirmed + '/' + r.dealers + '</td>' +
          '<td>' + r.bookedN + '/' + r.checklistN + '</td>' +
          '<td><span class="coord-st ' + esc(r.status) + '">' + esc(stLabel) + '</span></td>' +
          '<td class="coord-acts">' +
          '<button type="button" class="kbb" data-ck="' + esc(r.key) + '">Checklist</button>' +
          (r.status === 'ready' ? '<button type="button" class="kbb" data-st="' + esc(r.key) + '|booking">Start booking</button>' : '') +
          (r.status === 'booking' ? '<button type="button" class="kbb" data-st="' + esc(r.key) + '|booked">Mark booked</button>' : '') +
          (r.status === 'booked' ? '<button type="button" class="kbb" data-st="' + esc(r.key) + '|sent">Mark sent</button>' : '') +
          (r.status === 'sent' ? '<button type="button" class="kbb" data-st="' + esc(r.key) + '|completed">Mark completed</button>' : '') +
          '</td></tr>'
        );
      })
      .join('');
    host.innerHTML =
      '<div class="coord-page">' +
      '<div class="coord-head"><h1>TRAVEL COORDINATION</h1>' +
      '<div class="coord-sub">Sales EA booking queue · same trips as Sales Planning</div></div>' +
      '<div class="coord-metrics">' +
      '<div class="coord-m"><div class="coord-mn">' + m.ready + '</div><div class="coord-ml">Ready to book</div></div>' +
      '<div class="coord-m"><div class="coord-mn">' + m.booking + '</div><div class="coord-ml">Bookings in progress</div></div>' +
      '<div class="coord-m"><div class="coord-mn">' + m.completed + '</div><div class="coord-ml">Trips completed</div></div>' +
      '</div>' +
      '<div class="coord-toolbar">' +
      '<label class="coord-chk"><input type="checkbox" id="coordAtt"' + (filter.attention !== false ? ' checked' : '') + '> Needs attention</label>' +
      '<select id="coordTerr"><option value="">All territories</option>' +
      ['East', 'South', 'Central', 'West', 'Exports']
        .map(function (t) {
          return '<option value="' + t + '"' + (filter.terr === t ? ' selected' : '') + '>' + t + '</option>';
        })
        .join('') +
      '</select>' +
      '<select id="coordStat"><option value="">All statuses</option>' +
      ['ready', 'booking', 'booked', 'sent', 'completed']
        .map(function (s) {
          return '<option value="' + s + '"' + (filter.status === s ? ' selected' : '') + '>' + s + '</option>';
        })
        .join('') +
      '</select></div>' +
      '<div class="coord-table-wrap"><table class="coord-table">' +
      '<thead><tr><th>Traveller</th><th>Territory</th><th>Dates</th><th>Destination</th><th>Dealer conf.</th><th>Booking</th><th>Status</th><th></th></tr></thead>' +
      '<tbody>' +
      (body || '<tr><td colspan="8" class="coord-empty">No trips in the queue. Submitted Ready to Book trips appear here.</td></tr>') +
      '</tbody></table></div></div>';

    var att = host.querySelector('#coordAtt');
    if (att)
      att.onchange = function () {
        global._COORD_FILTER = global._COORD_FILTER || {};
        global._COORD_FILTER.attention = !!att.checked;
        if (att.checked) delete global._COORD_FILTER.status;
        renderCoord();
      };
    var terr = host.querySelector('#coordTerr');
    if (terr)
      terr.onchange = function () {
        global._COORD_FILTER = global._COORD_FILTER || {};
        global._COORD_FILTER.terr = terr.value || null;
        renderCoord();
      };
    var st = host.querySelector('#coordStat');
    if (st)
      st.onchange = function () {
        global._COORD_FILTER = global._COORD_FILTER || {};
        global._COORD_FILTER.status = st.value || null;
        if (st.value) global._COORD_FILTER.attention = false;
        renderCoord();
      };
    host.querySelectorAll('[data-open]').forEach(function (b) {
      b.onclick = function () {
        var row = rows.filter(function (r) { return r.key === b.dataset.open; })[0];
        if (row) openTrip(row);
      };
    });
    host.querySelectorAll('[data-ck]').forEach(function (b) {
      b.onclick = function () {
        var row = rows.filter(function (r) { return r.key === b.dataset.ck; })[0];
        if (row) openChecklist(row);
      };
    });
    host.querySelectorAll('[data-st]').forEach(function (b) {
      b.onclick = function () {
        var parts = b.dataset.st.split('|');
        setTripStatus(parts[0], parts[1]);
      };
    });
  }

  function isCoordinatorUser() {
    try {
      if (global.pbIsAdmin && global.pbIsAdmin()) return true;
      var email = (global.PB_USER && global.PB_USER.email) || (global.pbWho && global.pbWho()) || '';
      email = String(email).toLowerCase();
      var me = ((ADMIN().team) || []).filter(function (m) {
        return m && m.email && String(m.email).toLowerCase() === email;
      })[0];
      if (!me) return /nikita/i.test(email);
      return me.role === 'SA' || me.role === 'TC' || me.accessGroup === 'coordinator' || !!me.isAdmin;
    } catch (e) {
      return false;
    }
  }

  function preferredMode() {
    try {
      var saved = localStorage.getItem('aqPortalMode');
      if (saved === 'sales' || saved === 'coord') return saved;
    } catch (e) {}
    return isCoordinatorUser() ? 'coord' : 'sales';
  }

  global.AQCoord = {
    render: renderCoord,
    tripRows: tripRows,
    metrics: metrics,
    ensureChecklist: ensureChecklist,
    isCoordinatorUser: isCoordinatorUser,
    preferredMode: preferredMode,
    openChecklist: openChecklist,
  };
  global.renderCoord = renderCoord;
  global.coordIsCoordinator = isCoordinatorUser;
})(window);
