/* Arrowquip TRAVEL — Context-aware scheduling engine
   Classifies appointments and evaluates genuine conflicts only.
   Does not treat every calendar overlap as a conflict.
   Pure helpers are usable from Node tests and the browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AQScheduling = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CLASS = {
    FIXED_PLACE: 'fixed_place',           /* Fixed time, fixed location */
    FIXED_TIME_FLEX: 'fixed_time_flex',   /* Fixed time, flexible location (virtual) */
    INTERRUPTIBLE: 'interruptible',       /* Trade shows / exhibitions */
    FLEXIBLE: 'flexible',                 /* Cold calls, fuel, food */
    ACCOMMODATION: 'accommodation'        /* Hotel / overnight background */
  };

  var CLASS_LABELS = {
    fixed_place: 'Fixed time, fixed location',
    fixed_time_flex: 'Fixed time, flexible location',
    interruptible: 'Interruptible event',
    flexible: 'Flexible appointment',
    accommodation: 'Accommodation / background'
  };

  var DEFAULT_BUFFERS = {
    virtualPrepMin: 10,
    tradeShowReturnMin: 10,
    dealerPrepMin: 10,
    dealerOverrunMin: 15,
    airportDomesticMin: 90,
    airportIntlMin: 180,
    rentalPickupMin: 20,
    hotelCheckInMin: 15,
    hotelCheckOutMin: 15,
    drivePaddingPct: 10
  };

  function assign(a, b) {
    var o = {};
    Object.keys(a || {}).forEach(function (k) { o[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) { o[k] = b[k]; });
    return o;
  }

  function buffers(cfg) {
    return assign(DEFAULT_BUFFERS, (cfg && cfg.schedBuffers) || cfg || {});
  }

  function normType(t) {
    return String(t || '').toLowerCase().replace(/\s+/g, '_');
  }

  function isVirtualMeta(ev) {
    if (!ev) return false;
    if (ev.virtual || ev.onlineMeeting || ev.isOnlineMeeting) return true;
    var n = String(ev.name || ev.title || ev.subject || '').toLowerCase();
    var link = String(ev.meetingUrl || ev.joinUrl || ev.onlineUrl || '').toLowerCase();
    if (/zoom\.us|teams\.microsoft|meet\.google|webex\.com/.test(link)) return true;
    if (/\bzoom\b|\bteams\b|\bvirtual\b|\bphone call\b|\bms teams\b/.test(n)) return true;
    if (ev.kind === 'meeting' && (ev.locationType === 'virtual' || ev.locationType === 'online')) return true;
    return false;
  }

  function isTradeShow(ev) {
    var ty = normType(ev && (ev.type || ev.ty0 || ev.travelType));
    if (ty === 'tradeshow' || ty === 'trade_show' || ty === 'exhibition') return true;
    var n = String((ev && (ev.name || ev.title)) || '').toLowerCase();
    return /\btrade\s*show\b|\bexhibition\b|\bexpo\b/.test(n);
  }

  function isFlight(ev) {
    var ty = normType(ev && (ev.type || ev.ty0));
    return /^flight_/.test(ty) || ty === 'flight';
  }

  function isHotel(ev) {
    var ty = normType(ev && (ev.type || ev.ty0));
    return ty === 'hotel' || ty === 'lodging' || (ev && ev.kind === 'hotel');
  }

  function isDealerLike(ev) {
    if (!ev) return false;
    if (ev.kind === 'dealer' || ev.kind === 'xvisit' || ev.kind === 'supplier') return true;
    var ty = normType(ev.type || ev.ty0);
    return ty === 'dealer' || ty === 'supplier' || ty === 'visit' || ty === 'prebook';
  }

  function isFlexibleStop(ev) {
    var ty = normType(ev && (ev.type || ev.ty0));
    if (['fuel', 'food', 'parking', 'other', 'rest', 'shopping'].indexOf(ty) >= 0) return true;
    if (ev && (ev.act === 'coldcall' || ev.act === 'dropin')) return true;
    var n = String((ev && (ev.name || ev.title)) || '').toLowerCase();
    return /\bcold call\b|\bdrop-?in\b|\bfuel\b|\blunch\b|\bdinner\b|\bbreakfast\b/.test(n);
  }

  function isProtectedPresentation(ev) {
    if (!ev) return false;
    if (ev.protected || ev.schedProtected || ev.nonInterruptible) return true;
    var n = String(ev.name || ev.title || '').toLowerCase();
    return /\bpresentation\b|\bdemo(nstration)?\b|\bkeynote\b|\bscheduled customer\b/.test(n);
  }

  /** Auto-classify; respects explicit ev.schedClass override. */
  function classify(ev) {
    if (!ev) return CLASS.FLEXIBLE;
    var override = ev.schedClass || ev.schedulingClass || (ev.meta && ev.meta.schedClass);
    if (override && CLASS_LABELS[override]) return override;
    if (isHotel(ev)) return CLASS.ACCOMMODATION;
    if (isVirtualMeta(ev)) return CLASS.FIXED_TIME_FLEX;
    if (isTradeShow(ev) && !isProtectedPresentation(ev)) return CLASS.INTERRUPTIBLE;
    if (isFlight(ev) || isDealerLike(ev) || isProtectedPresentation(ev)) return CLASS.FIXED_PLACE;
    if (isFlexibleStop(ev)) return CLASS.FLEXIBLE;
    /* default physical meeting */
    if (ev.lat != null || ev.lon != null || ev.address || ev.dealerId) return CLASS.FIXED_PLACE;
    return CLASS.FLEXIBLE;
  }

  function priority(ev, opts) {
    opts = opts || {};
    if (opts.locked || ev.locked || ev.lock) return 1;
    var conf = !!(opts.confirmed || ev.confirmed || ev.conf || ev.done || ev.appt);
    var cls = classify(ev);
    if (isFlight(ev)) return 3;
    if (conf && (cls === CLASS.FIXED_PLACE || cls === CLASS.FIXED_TIME_FLEX)) return 2;
    if (cls === CLASS.FIXED_PLACE || cls === CLASS.FIXED_TIME_FLEX) return 4;
    if (cls === CLASS.INTERRUPTIBLE) return 5;
    if (cls === CLASS.FLEXIBLE) return 6;
    if (cls === CLASS.ACCOMMODATION) return 7;
    return 6;
  }

  function interval(ev) {
    if (!ev) return null;
    var start = ev.startMin != null ? ev.startMin : ev.start;
    var end = ev.endMin != null ? ev.endMin : ev.end;
    if (start == null && ev.day != null && ev.timeMin != null) start = ev.day * 1440 + ev.timeMin;
    if (start == null) return null;
    if (end == null) {
      var dur = ev.dur != null ? ev.dur : (ev.durationMin != null ? ev.durationMin : 60);
      end = start + dur;
    }
    return { start: start, end: end };
  }

  function overlaps(a, b) {
    var A = interval(a), B = interval(b);
    if (!A || !B) return false;
    return A.start < B.end && B.start < A.end;
  }

  function contains(outer, inner) {
    var O = interval(outer), I = interval(inner);
    if (!O || !I) return false;
    return I.start >= O.start && I.end <= O.end;
  }

  /**
   * Decide whether two events are a genuine scheduling conflict.
   * Returns { conflict:boolean, reason?:string, nested?:boolean, driveStop?:boolean }
   */
  function evaluatePair(a, b, cfg) {
    if (!a || !b || a.id === b.id) return { conflict: false };
    if (!overlaps(a, b)) return { conflict: false };

    var ca = classify(a), cb = classify(b);
    var buf = buffers(cfg);

    /* Hotels are background — never block overlapping dealer/virtual work */
    if (ca === CLASS.ACCOMMODATION || cb === CLASS.ACCOMMODATION) {
      return { conflict: false, reason: 'accommodation-background' };
    }

    /* Virtual inside interruptible trade show → nested, allowed */
    if (ca === CLASS.INTERRUPTIBLE && cb === CLASS.FIXED_TIME_FLEX) {
      if (isProtectedPresentation(a)) return { conflict: true, reason: 'protected-trade-show-commitment' };
      return {
        conflict: false,
        nested: true,
        parentId: a.id,
        childId: b.id,
        reason: 'virtual-within-tradeshow',
        leaveMin: buf.virtualPrepMin,
        returnMin: buf.tradeShowReturnMin
      };
    }
    if (cb === CLASS.INTERRUPTIBLE && ca === CLASS.FIXED_TIME_FLEX) {
      if (isProtectedPresentation(b)) return { conflict: true, reason: 'protected-trade-show-commitment' };
      return {
        conflict: false,
        nested: true,
        parentId: b.id,
        childId: a.id,
        reason: 'virtual-within-tradeshow',
        leaveMin: buf.virtualPrepMin,
        returnMin: buf.tradeShowReturnMin
      };
    }

    /* Two interruptible events overlapping — no hard conflict; avoid double-count */
    if (ca === CLASS.INTERRUPTIBLE && cb === CLASS.INTERRUPTIBLE) {
      return { conflict: false, reason: 'interruptible-overlap', dedupeTime: true };
    }

    /* Virtual vs dealer / supplier / protected physical */
    if (ca === CLASS.FIXED_TIME_FLEX && (cb === CLASS.FIXED_PLACE || isDealerLike(b))) {
      return { conflict: true, reason: 'virtual-during-dealer' };
    }
    if (cb === CLASS.FIXED_TIME_FLEX && (ca === CLASS.FIXED_PLACE || isDealerLike(a))) {
      return { conflict: true, reason: 'virtual-during-dealer' };
    }

    /* Two virtuals */
    if (ca === CLASS.FIXED_TIME_FLEX && cb === CLASS.FIXED_TIME_FLEX) {
      return { conflict: true, reason: 'two-virtual-meetings' };
    }

    /* Virtual during flight */
    if ((ca === CLASS.FIXED_TIME_FLEX && isFlight(b)) || (cb === CLASS.FIXED_TIME_FLEX && isFlight(a))) {
      return { conflict: true, reason: 'virtual-during-flight' };
    }

    /* Virtual during driving segment */
    if ((ca === CLASS.FIXED_TIME_FLEX && b.kind === 'drive') || (cb === CLASS.FIXED_TIME_FLEX && a.kind === 'drive')) {
      return {
        conflict: false,
        driveStop: true,
        reason: 'virtual-during-drive',
        requireStopConfirm: true
      };
    }

    /* Flexible can yield */
    if (ca === CLASS.FLEXIBLE || cb === CLASS.FLEXIBLE) {
      return { conflict: false, reason: 'flexible-yields' };
    }

    /* Two fixed protected commitments */
    if (ca === CLASS.FIXED_PLACE && cb === CLASS.FIXED_PLACE) {
      return { conflict: true, reason: 'two-protected-physical', needsUserResolution: true };
    }

    return { conflict: true, reason: 'overlap' };
  }

  /**
   * Suggest whether an unconfirmed dealer appointment may be shifted around a virtual meeting.
   * Never auto-moves locked or confirmed appointments.
   */
  function proposeDealerAdjustment(dealer, virtual, cfg) {
    var buf = buffers(cfg);
    if (!dealer || !virtual) return { allowed: false, reason: 'missing' };
    if (dealer.locked || dealer.lock) return { allowed: false, reason: 'locked-prohibited' };
    if (dealer.confirmed || dealer.conf || dealer.done || dealer.appt) {
      return { allowed: false, reason: 'confirmed-prohibited' };
    }
    var V = interval(virtual);
    var D = interval(dealer);
    if (!V || !D) return { allowed: false, reason: 'untimed' };
    var prep = buf.dealerPrepMin + buf.virtualPrepMin;
    var beforeEnd = V.start - prep;
    var afterStart = V.end + prep;
    var dur = D.end - D.start;
    return {
      allowed: true,
      options: [
        { start: beforeEnd - dur, end: beforeEnd, label: 'Before virtual meeting' },
        { start: afterStart, end: afterStart + dur, label: 'After virtual meeting' }
      ]
    };
  }

  /**
   * Driving + virtual: propose a stop window (does not invent facilities).
   */
  function proposeDriveStop(driveSeg, virtual, cfg) {
    var buf = buffers(cfg);
    var V = interval(virtual);
    var D = interval(driveSeg);
    if (!V || !D) return { ok: false, reason: 'untimed' };
    if (!overlaps(driveSeg, virtual) && !(V.start >= D.start && V.start <= D.end)) {
      return { ok: false, reason: 'not-during-drive' };
    }
    return {
      ok: true,
      requireUserConfirm: true,
      stopWindow: {
        arriveBy: V.start - buf.virtualPrepMin,
        meetingStart: V.start,
        meetingEnd: V.end,
        resumeDrive: V.end + buf.virtualPrepMin
      },
      note: 'Confirm a suitable place to stop and take the meeting. Do not assume parking or connectivity.'
    };
  }

  /**
   * Evaluate a list of normalized events for a traveller/week.
   * events: [{id, type, kind, name, startMin|start, endMin|end, dur, virtual, locked, confirmed, parentId, ...}]
   */
  function evaluateSchedule(events, cfg) {
    events = (events || []).slice();
    var conflicts = [];
    var nested = [];
    var driveStops = [];
    var soft = [];
    var i, j;

    for (i = 0; i < events.length; i++) {
      events[i].schedClass = classify(events[i]);
      events[i].schedPriority = priority(events[i]);
    }

    for (i = 0; i < events.length; i++) {
      for (j = i + 1; j < events.length; j++) {
        var a = events[i], b = events[j];
        var r = evaluatePair(a, b, cfg);
        if (r.nested) {
          nested.push({
            parentId: r.parentId,
            childId: r.childId,
            leaveMin: r.leaveMin,
            returnMin: r.returnMin
          });
          soft.push({ a: a.id, b: b.id, reason: r.reason });
        } else if (r.driveStop) {
          driveStops.push({
            virtualId: classify(a) === CLASS.FIXED_TIME_FLEX ? a.id : b.id,
            driveId: a.kind === 'drive' ? a.id : b.id,
            detail: proposeDriveStop(a.kind === 'drive' ? a : b, classify(a) === CLASS.FIXED_TIME_FLEX ? a : b, cfg)
          });
        } else if (r.conflict) {
          conflicts.push({
            a: a.id,
            b: b.id,
            reason: r.reason,
            needsUserResolution: !!r.needsUserResolution,
            classes: [classify(a), classify(b)]
          });
        } else if (r.reason) {
          soft.push({ a: a.id, b: b.id, reason: r.reason });
        }
      }
    }

    return {
      events: events,
      conflicts: conflicts,
      nested: nested,
      driveStops: driveStops,
      soft: soft
    };
  }

  /** Reporting helper — avoid double-counting nested virtual inside trade show. */
  function reportableMinutes(ev, nestedPairs) {
    var iv = interval(ev);
    if (!iv) return 0;
    var mins = iv.end - iv.start;
    if (classify(ev) !== CLASS.INTERRUPTIBLE) return Math.max(0, mins);
    (nestedPairs || []).forEach(function (n) {
      if (n.parentId !== ev.id) return;
      /* nested virtual time is attributed to the virtual meeting, not the show */
      /* caller supplies child duration via n.childMinutes when available */
      if (n.childMinutes) mins -= n.childMinutes;
    });
    return Math.max(0, mins);
  }

  function runSelfTests() {
    var results = [];
    function chk(name, cond) { results.push({ name: name, pass: !!cond }); }

    var show = { id: 'show', type: 'tradeshow', name: 'Atlantic Farm Mechanization Show', startMin: 9 * 60, endMin: 17 * 60 };
    var zoom = { id: 'zoom', type: 'other', virtual: true, name: 'Zoom meeting', startMin: 11 * 60, endMin: 11 * 60 + 30 };
    var r1 = evaluatePair(show, zoom);
    chk('Virtual meeting during a trade show: allowed', r1.conflict === false && r1.nested === true);

    var presentation = { id: 'pres', type: 'tradeshow', name: 'Trade show presentation', startMin: 10 * 60, endMin: 11 * 60 + 30, protected: true };
    var r2 = evaluatePair(presentation, zoom);
    chk('Virtual meeting during a protected trade show presentation: conflict', r2.conflict === true);

    var dealer = { id: 'd1', kind: 'dealer', type: 'visit', name: 'D&J Sales', startMin: 10 * 60, endMin: 12 * 60 };
    var r3 = evaluatePair(dealer, zoom);
    chk('Virtual meeting during a dealer visit: conflict', r3.conflict === true);

    var zoom2 = { id: 'zoom2', virtual: true, name: 'Teams meeting', startMin: 11 * 60 + 15, endMin: 12 * 60 };
    var r4 = evaluatePair(zoom, zoom2);
    chk('Two simultaneous virtual meetings: conflict', r4.conflict === true);

    var drive = { id: 'drv', kind: 'drive', startMin: 10 * 60, endMin: 13 * 60 };
    var r5 = evaluatePair(drive, zoom);
    chk('Virtual meeting during driving: stopping location required', r5.driveStop === true && r5.conflict === false);

    var flight = { id: 'fl', type: 'flight_out', name: 'Delta depart', startMin: 10 * 60, endMin: 13 * 60 };
    var r6 = evaluatePair(flight, zoom);
    chk('Virtual meeting during a flight: conflict by default', r6.conflict === true);

    var hotel = { id: 'ht', type: 'hotel', name: 'Marriott', startMin: 15 * 60, endMin: 15 * 60 + 24 * 60 };
    var r7 = evaluatePair(hotel, dealer);
    chk('Hotel reservation overlapping a dealer visit: allowed', r7.conflict === false);

    var unconf = { id: 'd2', kind: 'dealer', type: 'visit', startMin: 10 * 60, endMin: 11 * 60 + 30, confirmed: false };
    var adj = proposeDealerAdjustment(unconf, zoom);
    chk('Unconfirmed dealer appointment moved around a virtual meeting: proposed adjustment allowed', adj.allowed === true);

    var conf = { id: 'd3', kind: 'dealer', type: 'visit', startMin: 10 * 60, endMin: 11 * 60 + 30, confirmed: true };
    var adj2 = proposeDealerAdjustment(conf, zoom);
    chk('Confirmed dealer appointment moved automatically: prohibited', adj2.allowed === false && adj2.reason === 'confirmed-prohibited');

    var locked = { id: 'd4', kind: 'dealer', type: 'visit', startMin: 10 * 60, endMin: 11 * 60 + 30, locked: true };
    var adj3 = proposeDealerAdjustment(locked, zoom);
    chk('Locked appointment moved automatically: prohibited', adj3.allowed === false && adj3.reason === 'locked-prohibited');

    /* Insufficient driving time between appointments */
    var a = { id: 'a', kind: 'dealer', type: 'visit', startMin: 9 * 60, endMin: 10 * 60, lat: 0, lon: 0 };
    var b = { id: 'b', kind: 'dealer', type: 'visit', startMin: 10 * 60 + 5, endMin: 11 * 60, lat: 1, lon: 1 };
    var driveNeed = 90; /* minutes needed */
    var gap = b.startMin - a.endMin;
    chk('Insufficient driving time between appointments: conflict', gap < driveNeed);

    /* Time zones — compare using absolute startMin already normalized to traveller-local minutes */
    var tzA = { id: 'tza', virtual: true, startMin: 14 * 60, endMin: 15 * 60, tz: 'America/Toronto' };
    var tzB = { id: 'tzb', kind: 'dealer', startMin: 14 * 60 + 30, endMin: 15 * 60 + 30, tz: 'America/Winnipeg' };
    /* If both already converted to the same timeline, overlap is a conflict */
    chk('Appointments in different time zones: correctly evaluated', evaluatePair(tzA, tzB).conflict === true);

    /* Overnight travel */
    var eve = { id: 'eve', kind: 'dealer', startMin: 1 * 1440 + 20 * 60, endMin: 1 * 1440 + 21 * 60 };
    var morn = { id: 'morn', kind: 'dealer', startMin: 2 * 1440 + 9 * 60, endMin: 2 * 1440 + 10 * 60 };
    chk('Overnight travel and date changes: correctly evaluated', evaluatePair(eve, morn).conflict === false);

    var show2 = { id: 'show2', type: 'tradeshow', startMin: 9 * 60, endMin: 17 * 60 };
    var nest = evaluateSchedule([show2, zoom]);
    var mins = reportableMinutes(show2, nest.nested.map(function (n) {
      return assign(n, { childMinutes: 30 });
    }));
    chk('Overlapping interruptible events: correctly calculated without double-counting', mins === (8 * 60 - 30));

    var failed = results.filter(function (r) { return !r.pass; });
    return { ok: failed.length === 0, results: results, failed: failed };
  }

  /**
   * Normalize a Microsoft Graph / Outlook calendar event into a scheduling event.
   * Respects private/sensitivity; does not assume busy = physical location.
   * Uses external IDs for sync/dedupe (iCalUId preferred, then id).
   */
  function fromOutlookEvent(o) {
    if (!o) return null;
    var sens = String(o.sensitivity || o.Sensitivity || '').toLowerCase();
    var isPrivate = sens === 'private' || sens === 'confidential' || o.isPrivate;
    var subject = isPrivate ? 'Private appointment' : (o.subject || o.Subject || 'Outlook event');
    var online = !!(o.isOnlineMeeting || o.IsOnlineMeeting || (o.onlineMeeting && o.onlineMeeting.joinUrl)
      || (o.onlineMeetingUrl) || (o.bodyPreview && /zoom\.us|teams\.microsoft/i.test(o.bodyPreview)));
    var join = (o.onlineMeeting && o.onlineMeeting.joinUrl) || o.onlineMeetingUrl || o.joinUrl || '';
    var loc = (o.location && (o.location.displayName || o.location.uniqueId)) || o.locationDisplayName || '';
    var startIso = (o.start && (o.start.dateTime || o.start.DateTime)) || o.startDateTime;
    var endIso = (o.end && (o.end.dateTime || o.end.DateTime)) || o.endDateTime;
    var extId = o.iCalUId || o.icaluid || o.id || o.Id;
    return {
      id: 'outlook:' + extId,
      externalId: extId,
      source: 'outlook',
      name: subject,
      private: !!isPrivate,
      virtual: online || isVirtualMeta({ name: subject, meetingUrl: join }),
      meetingUrl: join,
      address: online ? '' : loc,
      /* start/end left as ISO; caller converts to traveller-local startMin */
      startIso: startIso,
      endIso: endIso,
      tz: (o.start && o.start.timeZone) || o.originalStartTimeZone || null,
      busy: String(o.showAs || o.ShowAs || '').toLowerCase() === 'busy',
      /* Busy without location/online ≠ fixed place */
      kind: online ? 'meeting' : 'outlook',
      type: online ? 'other' : (loc ? 'other' : 'other'),
      locationType: online ? 'virtual' : (loc ? 'physical' : 'unknown')
    };
  }

  /** Deduplicate portal events against Outlook by externalEventId / iCalUId. */
  function findByExternalId(events, externalId) {
    if (!externalId) return null;
    var want = String(externalId);
    for (var i = 0; i < (events || []).length; i++) {
      var e = events[i];
      if (!e) continue;
      if (e.externalId === want || e.iCalUId === want || e.outlookId === want) return e;
      if (e.id === 'outlook:' + want) return e;
    }
    return null;
  }

  return {
    CLASS: CLASS,
    CLASS_LABELS: CLASS_LABELS,
    DEFAULT_BUFFERS: DEFAULT_BUFFERS,
    buffers: buffers,
    classify: classify,
    priority: priority,
    interval: interval,
    overlaps: overlaps,
    contains: contains,
    evaluatePair: evaluatePair,
    evaluateSchedule: evaluateSchedule,
    proposeDealerAdjustment: proposeDealerAdjustment,
    proposeDriveStop: proposeDriveStop,
    reportableMinutes: reportableMinutes,
    isVirtualMeta: isVirtualMeta,
    isTradeShow: isTradeShow,
    fromOutlookEvent: fromOutlookEvent,
    findByExternalId: findByExternalId,
    runSelfTests: runSelfTests
  };
});
