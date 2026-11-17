/* Arrowquip TRAVEL — intelligent inline trip entry (NL → structured intent).
   Browser: attaches window.AQSmart. Node: module.exports for selftests.
   Does not invent confirmations, prices, or schedules — marks unverified fields. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AQSmart = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DAYS = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };

  function trim(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* Mirror of portal parseTimeLoose — keep in sync with index.html */
  function parseTimeLoose(v) {
    var raw = String(v == null ? '' : v).trim();
    if (!raw) return '';
    var s = raw.toLowerCase().replace(/\s+/g, '').replace(/\./g, ':');
    var m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)?$/);
    if (!m) {
      m = s.match(/^(\d{3,4})(am|pm|a|p)?$/);
      if (m) {
        var dig = m[1], apx = m[2] || '';
        if (dig.length === 3) m = ['', dig.charAt(0), dig.slice(1), apx];
        else m = ['', dig.slice(0, 2), dig.slice(2), apx];
      } else return null;
    }
    var h = +m[1], mm = m[2] != null && m[2] !== '' ? +m[2] : 0;
    var apRaw = m[3] || '';
    var ap = apRaw.indexOf('p') === 0 ? 'p' : (apRaw.indexOf('a') === 0 ? 'a' : '');
    if (!isFinite(h) || !isFinite(mm) || mm > 59) return null;
    if (ap === 'a') {
      if (h > 12) return null;
      h = h % 12;
    } else if (ap === 'p') {
      if (h > 12) return null;
      h = (h % 12) + 12;
    } else {
      if (h > 23) return null;
      if (h >= 1 && h <= 12) return { ambiguous: true, h: h, mm: mm, raw: raw };
    }
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  function parseDuration(text) {
    var t = String(text || '').toLowerCase();
    var m = t.match(/for\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/);
    if (!m) m = t.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/);
    if (!m) return null;
    var n = parseFloat(m[1]);
    var u = m[2];
    if (/^h/.test(u)) return Math.round(n * 60);
    return Math.round(n);
  }

  function parseDayWord(text) {
    var t = String(text || '').toLowerCase();
    var m = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/);
    if (!m) return null;
    return DAYS[m[1]];
  }

  function parseTimeRange(text) {
    var t = String(text || '');
    /* 9am to 1pm / 9:00-13:00 / 9am–1pm */
    var m = t.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?)\s*(?:to|-|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?)\b/i);
    if (m) {
      return { start: parseTimeLoose(m[1]), end: parseTimeLoose(m[2]), raw: m[0] };
    }
    m = t.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?)\b/i)
      || t.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i)
      || t.match(/\b(noon|midnight)\b/i);
    if (m) {
      var raw = m[1];
      if (/^noon$/i.test(raw)) return { start: '12:00', end: null, raw: raw };
      if (/^midnight$/i.test(raw)) return { start: '00:00', end: null, raw: raw };
      return { start: parseTimeLoose(raw), end: null, raw: raw };
    }
    /* evening / morning / afternoon without clock */
    if (/\bevening\b/i.test(t)) return { start: '18:00', end: null, raw: 'evening', soft: true };
    if (/\bafternoon\b/i.test(t)) return { start: '14:00', end: null, raw: 'afternoon', soft: true };
    if (/\bmorning\b/i.test(t)) return { start: '09:00', end: null, raw: 'morning', soft: true };
    return null;
  }

  function stripNoise(name, drops) {
    var s = trim(name);
    (drops || []).forEach(function (re) { s = s.replace(re, ' '); });
    return trim(s.replace(/^[\s,.\-–—:]+|[\s,.\-–—:]+$/g, ''));
  }

  function detectKind(text) {
    var t = text.toLowerCase();
    if (/\b(zoom|teams|google meet|webex|virtual meeting|video call|phone call|call with)\b/.test(t)
      || /\b(zoom|teams)\s+with\b/.test(t)) {
      return 'virtual';
    }
    if (/\b(fly|flight|depart|arrive|landing|airline|delta|united|american|air canada|westjet|southwest)\b/.test(t)) {
      return 'flight';
    }
    if (/\b(hotel|motel|marriott|hilton|hyatt|holiday inn|courtyard|stay at|overnight|lodging)\b/.test(t)
      || /\bunder\s*\$?\d+/.test(t) && /\b(hotel|stay|night)\b/.test(t)) {
      return 'hotel';
    }
    if (/\b(rental|rent a car|hire car|enterprise|hertz|avis|national|budget)\b/.test(t)) {
      return 'rental';
    }
    if (/\b(trade\s*show|expo|fair|convention|mechanization show|farm show)\b/.test(t)) {
      return 'tradeshow';
    }
    if (/\b(breakfast|lunch|dinner|supper|coffee|brunch)\b/.test(t)) {
      return 'food';
    }
    if (/\b(drive to|driving to|next dealer)\b/.test(t)) {
      return 'drive';
    }
    if (/\b(fuel|gas station|ev charg)/.test(t)) return 'fuel';
    return 'dealer'; /* default: try dealer match, else other stop */
  }

  function extractBudget(text) {
    var m = String(text).match(/under\s*\$?\s*([\d,]+)\s*(usd|cad|eur|gbp)?/i)
      || String(text).match(/\$\s*([\d,]+)\s*(usd|cad)?/i);
    if (!m) return null;
    return {
      amount: parseInt(String(m[1]).replace(/,/g, ''), 10),
      currency: (m[2] || 'USD').toUpperCase(),
      verified: false,
    };
  }

  function extractAirline(text) {
    var m = String(text).match(/\b(delta|united|american|air canada|westjet|southwest|alaska|jetblue|lufthansa|british airways)\b/i);
    return m ? m[1] : '';
  }

  function extractAirportHint(text) {
    var m = String(text).match(/\bto\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?:\s+(?:on|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat|evening|morning|afternoon|at)\b|[.,]|$)/i);
    if (m) return trim(m[1]);
    m = String(text).match(/\b(?:in|at)\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?:\s+under\b|[.,]|$)/i);
    return m ? trim(m[1]) : '';
  }

  function parseLine(rawLine, opts) {
    opts = opts || {};
    var raw = trim(rawLine);
    if (!raw) return null;
    var kind = detectKind(raw);
    var times = parseTimeRange(raw);
    var dur = parseDuration(raw);
    var day = parseDayWord(raw);
    var intent = {
      raw: raw,
      kind: kind,
      time: times && times.start && typeof times.start === 'string' ? times.start : null,
      timeAmbiguous: times && times.start && times.start.ambiguous ? times.start : null,
      timeEnd: times && times.end && typeof times.end === 'string' ? times.end : null,
      timeSoft: !!(times && times.soft),
      durationMin: dur,
      day: day,
      name: '',
      virtual: false,
      travelType: null,
      airline: '',
      placeHint: '',
      budget: null,
      needsClarify: [],
      unverified: [],
      confidence: 'high',
    };

    if (times && times.start && times.start.ambiguous) {
      intent.needsClarify.push('time_ampm');
      intent.confidence = 'medium';
    }

    if (kind === 'virtual') {
      intent.virtual = true;
      intent.travelType = 'other';
      intent.name = stripNoise(raw, [
        /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?/ig,
        /\bfor\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/ig,
        /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig,
      ]);
      if (!intent.durationMin) intent.durationMin = 30;
      if (!intent.time && !intent.timeAmbiguous) intent.needsClarify.push('time');
    } else if (kind === 'flight') {
      intent.travelType = /\b(arrive|arrival|land|landing|inbound)\b/i.test(raw) ? 'flight_in' : 'flight_out';
      intent.airline = extractAirline(raw);
      intent.placeHint = extractAirportHint(raw);
      intent.name = (intent.airline ? intent.airline + ' ' : '') + (intent.placeHint ? ('→ ' + intent.placeHint) : 'Flight');
      intent.unverified.push('schedule');
      if (!intent.time && !intent.timeAmbiguous && !intent.timeSoft) intent.needsClarify.push('time');
    } else if (kind === 'hotel') {
      intent.travelType = 'hotel';
      intent.budget = extractBudget(raw);
      intent.placeHint = extractAirportHint(raw) || (raw.match(/\bin\s+([A-Za-z][A-Za-z\s.'-]+)/i) || [])[1] || '';
      intent.placeHint = trim(intent.placeHint);
      var same = /\b(same|last time|previously|preferred)\b/i.test(raw);
      var brand = (raw.match(/\b(marriott|hilton|hyatt|holiday inn|courtyard|hampton|best western|residence inn)\b/i) || [])[1] || '';
      intent.name = brand ? brand : (intent.placeHint ? ('Hotel · ' + intent.placeHint) : 'Hotel');
      intent.preferPrevious = same;
      intent.unverified.push('availability');
      if (intent.budget) intent.unverified.push('price');
    } else if (kind === 'rental') {
      intent.travelType = 'rental_pickup';
      intent.name = 'Rental car';
      intent.unverified.push('availability');
      /* Monday through Thursday → note range, pickup Monday */
      var thru = raw.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+through\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
      if (thru) {
        intent.day = DAYS[thru[1].toLowerCase()];
        intent.dayEnd = DAYS[thru[2].toLowerCase()];
        intent.name = 'Rental car · ' + thru[1] + '–' + thru[2];
      }
    } else if (kind === 'tradeshow') {
      intent.travelType = 'tradeshow';
      intent.name = stripNoise(raw, [
        /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig,
        /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?(?:\s*(?:to|-|–|—)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?)?/ig,
      ]);
      intent.unverified.push('venue');
      if (intent.time && intent.timeEnd && !intent.durationMin) {
        var a = intent.time.split(':').map(Number);
        var b = intent.timeEnd.split(':').map(Number);
        intent.durationMin = (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]);
        if (intent.durationMin <= 0) intent.durationMin = null;
      }
    } else if (kind === 'food') {
      intent.travelType = 'food';
      var meal = (raw.match(/\b(breakfast|lunch|dinner|supper|coffee|brunch)\b/i) || [])[1] || 'Meal';
      intent.name = meal.charAt(0).toUpperCase() + meal.slice(1).toLowerCase();
      if (!intent.durationMin) intent.durationMin = 60;
      if (!intent.time && !intent.timeAmbiguous) {
        if (/lunch/i.test(meal)) intent.time = '12:00';
        else if (/breakfast/i.test(meal)) intent.time = '08:00';
        else if (/dinner|supper/i.test(meal)) intent.time = '18:30';
        else if (/coffee/i.test(meal)) intent.time = '10:00';
      }
    } else if (kind === 'drive') {
      intent.travelType = 'other';
      intent.name = 'Drive to next dealer';
      intent.needsClarify.push('destination');
      intent.confidence = 'low';
    } else if (kind === 'fuel') {
      intent.travelType = 'fuel';
      intent.name = 'Fuel';
    } else {
      /* dealer / free text */
      intent.kind = 'dealer';
      intent.name = stripNoise(raw, [
        /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?/ig,
        /\bfor\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/ig,
        /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig,
        /\b(pre-?book|visit|drop-?in)\b/ig,
      ]);
      if (!intent.durationMin) intent.durationMin = 60;
      intent.query = intent.name;
    }

    if (!intent.name) intent.name = raw.slice(0, 80);
    return intent;
  }

  function parseMany(text) {
    var lines = String(text || '')
      .split(/\r?\n|\t|;/)
      .map(trim)
      .filter(Boolean);
    /* Also split Excel-ish rows that used • or numbered lists */
    var out = [];
    lines.forEach(function (line) {
      var cleaned = line.replace(/^\s*[\d]+[\.\)]\s+/, '').replace(/^[-•*]\s+/, '');
      var intent = parseLine(cleaned);
      if (intent) out.push(intent);
    });
    return out;
  }

  /* Rank dealer candidates for a query against a list of {id,name,...} */
  function rankDealers(query, dealers) {
    var toks = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    var rows = (dealers || []).filter(function (d) {
      var h = [d.name, d.loc, d.city, d.address, d.zip, d.postal].join(' ').toLowerCase();
      return toks.every(function (t) { return h.indexOf(t) >= 0; });
    });
    var q0 = toks[0];
    rows.sort(function (a, b) {
      var na = (a.name || '').toLowerCase(), nb = (b.name || '').toLowerCase();
      var sa = (na.indexOf(q0) === 0 ? 0 : 1);
      var sb = (nb.indexOf(q0) === 0 ? 0 : 1);
      return sa - sb || na.localeCompare(nb);
    });
    return rows.slice(0, 8);
  }

  return {
    parse: parseLine,
    parseMany: parseMany,
    parseTimeLoose: parseTimeLoose,
    parseDuration: parseDuration,
    rankDealers: rankDealers,
    detectKind: detectKind,
  };
});
