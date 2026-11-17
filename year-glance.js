/* Arrowquip TRAVEL — Connected Year at a Glance
   Derived presentation of weekly travel plans (ASSIGN/DAY/LOGI/XVISITS) plus
   company events and explicit availability overrides. Two modes share one index:
   Availability (leadership) and Activities (planner icons). */
(function(global){
'use strict';

var YG_COLS = 42; /* 6 weeks × S–S — covers every month layout */
var YG_WD = ['S','M','T','W','T','F','S'];
var YG_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var YG_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* Default availability categories — admins may customize colours/labels; system ids stay. */
var YG_AVAIL_DEFAULTS = [
  {id:'TR', abbr:'TR', label:'Travelling', color:'#2563eb', text:'#fff', system:true, class:'away'},
  {id:'OF', abbr:'OF', label:'In office', color:'#e5e7eb', text:'#374151', system:true, class:'present'},
  {id:'RM', abbr:'RM', label:'Working remotely', color:'#0d9488', text:'#fff', system:true, class:'present'},
  {id:'TS', abbr:'TS', label:'Trade show', color:'#d97706', text:'#fff', system:true, class:'away'},
  {id:'CE', abbr:'CE', label:'Company event', color:'#CC162E', text:'#fff', system:true, class:'away'},
  {id:'PT', abbr:'PT', label:'Unavailable', color:'#4b5563', text:'#fff', system:true, class:'away'},
  {id:'HO', abbr:'HO', label:'Holiday / shutdown', color:'#6d28d9', text:'#fff', system:true, class:'away'},
  {id:'NP', abbr:'NP', label:'Not yet planned', color:'#ffffff', text:'#9ca3af', system:true, class:'empty'}
];

var YG = {
  year: new Date().getFullYear(),
  terr: 'All',
  role: '',
  memberIds: {},
  membersAll: true,
  mode: 'availability', /* availability | activities */
  cats: {},
  panelDate: null,
  keyOpen: true,
  outlookPending: true
};
try{
  var _kp = localStorage.getItem('aqYgKeyOpen');
  if(_kp==='0') YG.keyOpen=false; else if(_kp==='1') YG.keyOpen=true;
  var _ym = localStorage.getItem('aqYgMode');
  if(_ym==='activities'||_ym==='availability') YG.mode=_ym;
}catch(e){}

YG_AVAIL_DEFAULTS.forEach(function(c){ YG.cats[c.id]=true; });

var YG_EVENTS = global.YG_EVENTS || [];
var YG_NOTES = global.YG_NOTES || {};
var YG_AVAIL = global.YG_AVAIL || {}; /* iso|memberId → {status, note?, private?} */
var YG_CAT_CUSTOM = Array.isArray(global.YG_CAT_CUSTOM) ? global.YG_CAT_CUSTOM : [];

function esc(s){
  return (global.esc?global.esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  }));
}
function ygIsLeap(y){ return (y%4===0 && y%100!==0) || (y%400===0); }
function ygDaysInMonth(y,m){ return [31, ygIsLeap(y)?29:28,31,30,31,30,31,31,30,31,30,31][m]; }
function ygDate(y,m,d){ return new Date(y,m,d,12,0,0,0); }
function ygISO(dt){ return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function ygParseISO(s){ var p=String(s||'').split('-'); return new Date(+p[0],(+p[1]||1)-1,+p[2]||1,12); }
function ygFromWkDay(wk, day){
  if(typeof wk!=='number' || day==null || day==='' || !global.wkStart) return null;
  var s=global.wkStart(wk);
  var d=new Date(s.getTime() + (+day)*86400000);
  d.setHours(12,0,0,0);
  return d;
}
function ygCloudSynced(){
  try{
    var v=global.PB_VER && global.PB_VER[global.PLAN_KEY||'plan'];
    var pending=global._pbPending && global._pbPending[global.PLAN_KEY||'plan']!==undefined;
    var err=document.getElementById('pbSaveErr');
    var errOn=!!(err&&err.style.display!=='none'&&err.style.display!=='');
    return v!=null && !pending && !errOn;
  }catch(e){ return false; }
}
function ygPersistPlan(){
  global.YG_EVENTS=YG_EVENTS;
  global.YG_NOTES=YG_NOTES;
  global.YG_AVAIL=YG_AVAIL;
  global.YG_CAT_CUSTOM=YG_CAT_CUSTOM;
  try{ if(global.savePlan) global.savePlan(); }catch(e){}
}
function ygCanAdmin(){
  try{ return !!(global.teamCanManage && global.teamCanManage()); }catch(e){ return false; }
}

function ygAvailCats(){
  var map={};
  YG_AVAIL_DEFAULTS.forEach(function(c){ map[c.id]=Object.assign({},c); });
  (YG_CAT_CUSTOM||[]).forEach(function(c){
    if(!c||!c.id||c.archived) return;
    if(map[c.id] && map[c.id].system){
      if(c.label) map[c.id].label=c.label;
      if(c.color) map[c.id].color=c.color;
      if(c.abbr) map[c.id].abbr=c.abbr;
      if(c.text) map[c.id].text=c.text;
    } else {
      map[c.id]={
        id:c.id, abbr:c.abbr||c.id, label:c.label||c.id, color:c.color||'#6b7280',
        text:c.text||'#fff', system:false, class:c.class||'away'
      };
    }
  });
  return Object.keys(map).map(function(k){ return map[k]; });
}
function ygAvailCat(id){
  var list=ygAvailCats();
  for(var i=0;i<list.length;i++) if(list[i].id===id) return list[i];
  return list[list.length-1];
}

function ygMemberSelected(m){
  if(!m) return YG.membersAll;
  if(YG.terr!=='All' && m.terr!==YG.terr){
    var terrs=Array.isArray(m.terrs)?m.terrs:[];
    if(terrs.indexOf(YG.terr)<0 && terrs.indexOf('All')<0) return false;
  }
  if(YG.role && m.role!==YG.role) return false;
  if(YG.membersAll) return true;
  return !!YG.memberIds[m.id];
}
function ygTeam(){
  var list=(global.teamList?global.teamList(YG.terr==='All'?null:YG.terr,false):[])||[];
  return list.filter(ygMemberSelected);
}
function ygSelectedMemberCount(){
  if(YG.membersAll) return ygTeam().length;
  return Object.keys(YG.memberIds).filter(function(id){ return YG.memberIds[id]; }).length;
}
function ygIsSingleMember(){ return ygSelectedMemberCount()===1; }
function ygSingleMember(){
  var t=ygTeam();
  if(t.length===1) return t[0];
  if(!YG.membersAll){
    var ids=Object.keys(YG.memberIds).filter(function(id){ return YG.memberIds[id]; });
    if(ids.length===1 && global.teamById) return global.teamById(ids[0]);
  }
  return t.length===1?t[0]:null;
}
function ygTravellerForDealer(t,d){
  if(global.allTravellerForDealer) return global.allTravellerForDealer(t,d);
  return null;
}
function ygTravellerForX(x){
  if(global.allTravellerForX) return global.allTravellerForX(x);
  return null;
}
function ygTravellerForLogi(it){
  if(global.allTravellerForLogi) return global.allTravellerForLogi(it);
  return null;
}

/* —— Geography abbreviations from verified itinerary locations only —— */
function ygAirportRegion(code){
  code=String(code||'').toUpperCase(); if(!code||!global.AIRPORTS) return '';
  for(var i=0;i<global.AIRPORTS.length;i++){
    var a=global.AIRPORTS[i];
    if(a[0]===code){
      var reg=String(a[6]||'');
      var m=reg.match(/\b([A-Z]{2})\b/);
      return m?m[1]:'';
    }
  }
  return '';
}
function ygGeoFromText(s){
  s=String(s||'');
  var m=s.match(/,\s*([A-Z]{2})(?:\s|,|$)/);
  if(m) return m[1];
  m=s.match(/\b(TX|NC|SC|GA|FL|AL|MS|LA|AR|OK|KS|MO|IA|MN|WI|IL|IN|OH|MI|PA|NY|NJ|VA|WV|KY|TN|CA|OR|WA|AZ|NM|CO|UT|NV|ID|MT|WY|ND|SD|NE|ME|NH|VT|MA|CT|RI|DE|MD|DC|AB|BC|MB|SK|ON|QC|NB|NS|PE|NL|NT|YT|NU|AU)\b/);
  return m?m[1]:'';
}
function ygGeoAbbr(ev){
  if(!ev) return '';
  if(ev.geo) return ev.geo;
  if(ev.airportCode){
    var r=ygAirportRegion(ev.airportCode);
    if(r) return r;
  }
  var fromPlace=ygGeoFromText(ev.place||'');
  if(fromPlace) return fromPlace;
  fromPlace=ygGeoFromText(ev.title||'');
  return fromPlace||'';
}

function ygTravelIcon(type){
  var TT=global.TRAVEL_TYPES||{};
  if(TT[type]) return {icon:TT[type].icon||'•', color:TT[type].color||'#6b7280', label:TT[type].label||type};
  if(type==='dealer'||type==='visit'||type==='prebook')
    return {icon:'🤝', color:'#16a34a', label:'Dealer visit'};
  if(type==='meeting') return {icon:'📅', color:'#2563eb', label:'Meeting'};
  if(type==='drive'||type==='driving') return {icon:'🚗', color:'#38bdf8', label:'Driving'};
  return {icon:'•', color:'#6b7280', label:type||'Activity'};
}

function ygPushAct(bucket, iso, ev){
  if(!iso) return;
  (bucket[iso]=bucket[iso]||[]).push(ev);
}

/* Build raw activity index from weekly planner sources — no duplicate travel store. */
function ygBuildActivities(){
  var byDay={};
  var y=YG.year;
  var ASSIGN=global.ASSIGN||{}, DAY=global.DAY||{}, TIME=global.TIME||{}, APPT=global.APPT||{};
  var LOGI=global.LOGI||[], XVISITS=global.XVISITS||[];
  var TERRS=global.TERRS||['East','South','Central','West','Exports'];
  var dealersIn=global.dealersIn, byId=global.byId, uniById=global.uniById;
  var travelType=global.travelType, xvType=global.xvType;

  function inYear(dt){ return dt && dt.getFullYear()===y; }
  function memberOk(m){
    if(!m) return YG.membersAll && !YG.role && YG.terr==='All';
    return ygMemberSelected(m);
  }

  try{
    TERRS.forEach(function(t){
      if(YG.terr!=='All' && YG.terr!==t) return;
      if(!dealersIn) return;
      dealersIn(t).forEach(function(d){
        var wk=ASSIGN[d.id]; if(typeof wk!=='number') return;
        var dt=ygFromWkDay(wk, DAY[d.id]==null?0:DAY[d.id]);
        if(!inYear(dt)) return;
        var m=ygTravellerForDealer(t,d);
        if(!memberOk(m)) return;
        ygPushAct(byDay, ygISO(dt), {
          kind:'dealer', type:'dealer', title:d.name, terr:t, member:m,
          conf:!!APPT[d.id], time:TIME[d.id]||'', place:d.address||d.loc||'',
          dealerId:d.id, wk:wk, day:DAY[d.id]==null?0:DAY[d.id],
          geo:ygGeoFromText(d.address||d.loc||'')
        });
      });
    });

    XVISITS.forEach(function(x){
      if(YG.terr!=='All' && x.terr!==YG.terr) return;
      if(typeof x.wk!=='number') return;
      var dt=ygFromWkDay(x.wk, x.day==null?0:x.day);
      if(!inYear(dt)) return;
      var m=ygTravellerForX(x);
      if(!memberOk(m)) return;
      var ty=(xvType&&xvType(x.type))||{label:'Visit'};
      var d=(byId&&byId[x.dealer])||(uniById&&uniById(x.dealer));
      ygPushAct(byDay, ygISO(dt), {
        kind:'xvisit', type:'dealer', title:(d&&d.name?d.name+' — ':'')+ty.label,
        terr:x.terr, member:m, conf:!!x.done, time:x.time||'',
        place:(d&&(d.address||d.loc))||'', wk:x.wk, day:x.day==null?0:x.day, xv:x,
        geo:ygGeoFromText((d&&(d.address||d.loc))||'')
      });
    });

    LOGI.forEach(function(it){
      if(YG.terr!=='All' && it.terr!==YG.terr) return;
      if(typeof it.wk!=='number') return;
      var m=ygTravellerForLogi(it);
      if(!memberOk(m)) return;
      var ty=travelType?travelType(it):it.type;
      var startDay=it.day==null?0:it.day;
      var endDay=(it.day2!=null?it.day2:startDay);
      if(endDay<startDay) endDay=startDay;
      var conf=!!String(it.conf||'').trim();
      var geo=ygAirportRegion(it.airportCode)||ygGeoFromText(it.address||it.airportName||it.name||'');
      for(var di=startDay; di<=endDay; di++){
        var dt=ygFromWkDay(it.wk, di);
        if(!inYear(dt)) continue;
        ygPushAct(byDay, ygISO(dt), {
          kind:'travel', type:ty, title:it.name||((global.TRAVEL_TYPES&&global.TRAVEL_TYPES[ty])||{}).label||ty,
          terr:it.terr, member:m, conf:conf, time:it.time||'',
          place:it.address||it.airportName||it.airportCode||'',
          airportCode:it.airportCode||'', wk:it.wk, day:di, logi:it, geo:geo,
          overnight: /^(flight_|hotel|rental_|tradeshow)/.test(String(ty))
        });
      }
    });

    (YG_EVENTS||[]).forEach(function(ev){
      if(!ev||!ev.start) return;
      if(ev.terr && YG.terr!=='All' && ev.terr!==YG.terr) return;
      if(ev.role && YG.role && ev.role!==YG.role) return;
      if(ev.memberIds && ev.memberIds.length && !YG.membersAll){
        var hit=ev.memberIds.some(function(id){ return YG.memberIds[id]; });
        if(!hit) return;
      }
      var a=ygParseISO(ev.start), b=ygParseISO(ev.end||ev.start);
      if(b<a) b=a;
      for(var t=new Date(a); t<=b; t.setDate(t.getDate()+1)){
        if(t.getFullYear()!==y) continue;
        ygPushAct(byDay, ygISO(t), {
          kind:'event', type:ev.cat||'CE', title:ev.title||'Event', terr:ev.terr||'All',
          member:null, conf:true, time:ev.allDay?'':(ev.time||''), place:ev.place||'',
          event:ev, status:ev.avail||ev.cat||'CE', company:!(ev.memberIds&&ev.memberIds.length),
          privateNote:!!ev.private
        });
      }
    });
  }catch(err){
    try{ console.warn('[YG] activities', err); }catch(e){}
  }
  return byDay;
}

/* Infer overnight travel spans so empty mid-trip days stay "travelling". */
function ygBuildAvailability(byAct){
  var byDay={}; /* iso → [{member, status, geo, conf, tentative, acts, incomplete}] */
  var team=ygTeam();
  var teamIds={}; team.forEach(function(m){ teamIds[m.id]=m; });

  /* Seed explicit overrides */
  Object.keys(YG_AVAIL||{}).forEach(function(key){
    var parts=key.split('|'); if(parts.length<2) return;
    var iso=parts[0], mid=parts[1];
    if(iso.slice(0,4)!==String(YG.year)) return;
    var m=teamIds[mid]||(global.teamById&&global.teamById(mid));
    if(!memberInFilter(m)) return;
    var o=YG_AVAIL[key];
    pushAvail(byDay, iso, {
      member:m, status:o.status||'OF', geo:'', conf:true, tentative:false,
      acts:[], note:o.private?'' :(o.note||''), source:'override'
    });
  });

  function memberInFilter(m){
    if(!m) return YG.membersAll && !YG.role;
    return ygMemberSelected(m);
  }
  function pushAvail(bucket, iso, row){
    (bucket[iso]=bucket[iso]||[]).push(row);
  }

  /* Per member+week: compute overnight span from flights/hotels/rentals/tradeshows */
  var spans={}; /* mid|wk → {min,max,geo,conf,hasOvernight,incomplete} */
  Object.keys(byAct).forEach(function(iso){
    (byAct[iso]||[]).forEach(function(ev){
      if(!ev.member || !memberInFilter(ev.member)) return;
      if(typeof ev.wk!=='number') return;
      var k=ev.member.id+'|'+ev.wk;
      var s=spans[k]||{min:99,max:-1,geo:'',conf:false,hasOvernight:false,incomplete:false,types:{}};
      var day=ev.day!=null?+ev.day:null;
      if(day==null) return;
      var overnight=!!ev.overnight || ev.type==='tradeshow' || /^flight_/.test(String(ev.type)) || ev.type==='hotel'
        || ev.type==='rental_pickup' || ev.type==='rental_return';
      if(overnight){
        s.hasOvernight=true;
        if(day<s.min) s.min=day;
        if(day>s.max) s.max=day;
        if(ev.geo) s.geo=ev.geo;
        if(ev.conf) s.conf=true;
        if(/^flight_out/.test(String(ev.type)) && s.max===s.min){ /* outbound alone — incomplete return */ }
        s.types[ev.type]=1;
      } else if(ev.kind==='dealer'||ev.kind==='xvisit'){
        /* local visit — track but do not alone create overnight span */
        s.types.dealer=1;
        if(!s.localGeo && ev.geo) s.localGeo=ev.geo;
        s.localDays=s.localDays||{};
        s.localDays[day]=1;
      }
      spans[k]=s;
    });
  });

  /* Incomplete: overnight markers without both ends (flight out without return-ish) */
  Object.keys(spans).forEach(function(k){
    var s=spans[k];
    if(!s.hasOvernight) return;
    var hasOut=!!(s.types.flight_out||s.types.flight_stop);
    var hasIn=!!(s.types.flight_in||s.types.hotel||s.types.rental_return);
    if(hasOut && !hasIn && s.min===s.max) s.incomplete=true;
  });

  /* Paint overnight spans onto days */
  Object.keys(spans).forEach(function(k){
    var parts=k.split('|');
    var mid=parts[0], wk=+parts[1];
    var s=spans[k];
    var m=teamIds[mid]||(global.teamById&&global.teamById(mid));
    if(!m||!memberInFilter(m)) return;
    if(s.hasOvernight && s.min<=s.max){
      for(var di=s.min; di<=s.max; di++){
        var dt=ygFromWkDay(wk, di);
        if(!dt || dt.getFullYear()!==YG.year) continue;
        var iso=ygISO(dt);
        var dayActs=(byAct[iso]||[]).filter(function(a){ return a.member&&a.member.id===mid; });
        var isTs=dayActs.some(function(a){ return a.type==='tradeshow'||(a.event&&a.event.cat==='TS'); });
        pushAvail(byDay, iso, {
          member:m, status:isTs?'TS':'TR', geo:s.geo||'',
          conf:s.conf, tentative:!s.conf, incomplete:!!s.incomplete,
          acts:dayActs, source:'trip'
        });
      }
    }
  });

  /* Company / personal events that set availability */
  Object.keys(byAct).forEach(function(iso){
    (byAct[iso]||[]).forEach(function(ev){
      if(ev.kind!=='event') return;
      var st=String(ev.status||ev.type||'CE').toUpperCase();
      if(['TR','OF','RM','TS','CE','PT','HO'].indexOf(st)<0) st='CE';
      var targets=ev.event&&ev.event.memberIds&&ev.event.memberIds.length
        ? ev.event.memberIds.map(function(id){ return teamIds[id]||(global.teamById&&global.teamById(id)); }).filter(Boolean)
        : team;
      targets.forEach(function(m){
        if(!memberInFilter(m)) return;
        /* Don't overwrite stronger personal override */
        var existing=(byDay[iso]||[]).filter(function(r){ return r.member&&r.member.id===m.id; });
        if(existing.some(function(r){ return r.source==='override'; })) return;
        pushAvail(byDay, iso, {
          member:m, status:st, geo:ygGeoAbbr(ev)||'', conf:true, tentative:false,
          acts:[ev], source:'event', privateNote:!!ev.privateNote
        });
      });
    });
  });

  /* Deduplicate per member per day — priority PT/HO > CE > TS > TR > OF/RM */
  var rank={PT:0,HO:1,CE:2,TS:3,TR:4,OF:5,RM:6,NP:9};
  Object.keys(byDay).forEach(function(iso){
    var byM={};
    (byDay[iso]||[]).forEach(function(r){
      if(!r.member) return;
      var id=r.member.id;
      var cur=byM[id];
      if(!cur || (rank[r.status]||8)<(rank[cur.status]||8)) byM[id]=r;
      else if(cur && r.acts&&r.acts.length){
        cur.acts=(cur.acts||[]).concat(r.acts);
      }
    });
    byDay[iso]=Object.keys(byM).map(function(id){ return byM[id]; });
  });

  return byDay;
}

function ygStatusVisible(st){
  return YG.cats[st]!==false;
}

function ygCellSummary(iso, byAct, byAvail){
  var single=ygIsSingleMember();
  var member=ygSingleMember();
  if(YG.mode==='activities'){
    var acts=(byAct[iso]||[]).filter(function(a){
      if(a.kind==='event' && a.privateNote && !ygCanAdmin()) return false;
      if(single && member && a.member && a.member.id!==member.id) return false;
      if(single && member && !a.member && a.company===false) return false;
      return true;
    });
    if(!acts.length) return {kind:'empty', label:'', title:iso+' · not yet planned'};
    if(single || acts.length===1){
      var a0=acts[0];
      var ic=ygTravelIcon(a0.type);
      var multi=acts.length>1;
      return {
        kind:'activity', icon:ic.icon, color:ic.color, label:multi?('×'+acts.length):'',
        title:acts.map(function(x){ return x.title; }).join(' · '),
        tentative:acts.some(function(x){ return !x.conf; }),
        count:acts.length, acts:acts
      };
    }
    return {
      kind:'team-act', label:acts.length+' items', title:acts.length+' activities',
      count:acts.length, acts:acts, color:'#374151'
    };
  }

  /* Availability mode */
  var rows=(byAvail[iso]||[]).filter(function(r){ return ygStatusVisible(r.status); });
  if(single && member){
    var mine=rows.filter(function(r){ return r.member&&r.member.id===member.id; })[0];
    if(!mine) return {kind:'empty', status:'NP', label:'', title:iso+' · Not yet planned'};
    var cat=ygAvailCat(mine.status);
    var show=mine.geo || cat.abbr;
    if(mine.status==='TS') show='TS';
    if(mine.status==='PT') show='PT';
    if(mine.status==='CE') show='CE';
    if(mine.status==='HO') show='HO';
    if(mine.status==='OF') show='OF';
    if(mine.status==='RM') show='RM';
    if(mine.status==='TR' && mine.geo) show=mine.geo;
    return {
      kind:'avail', status:mine.status, label:show, color:cat.color, text:cat.text,
      title:member.name+' · '+cat.label+(mine.geo?(' · '+mine.geo):'')+(mine.incomplete?' · incomplete dates':''),
      tentative:!!mine.tentative, incomplete:!!mine.incomplete, row:mine
    };
  }

  /* Team aggregate */
  var away=rows.filter(function(r){ return (ygAvailCat(r.status).class==='away'); });
  var travelling=rows.filter(function(r){ return r.status==='TR'||r.status==='TS'; });
  var unavail=rows.filter(function(r){ return r.status==='PT'||r.status==='HO'; });
  if(!away.length) return {kind:'empty', status:'NP', label:'', title:iso+' · no confirmed absences'};
  var label=travelling.length?(travelling.length+' travelling'):(unavail.length?(unavail.length+' unavailable'):(away.length+' away'));
  if(away.length<=3 && travelling.length){
    /* prefer short count form from spec */
    label=away.length+' away';
  } else {
    label=away.length+' away';
  }
  return {
    kind:'team-avail', label:label, color:'#2563eb', text:'#fff',
    title:away.map(function(r){ return (r.member?r.member.name:'?')+' · '+r.status+(r.geo?(' '+r.geo):''); }).join('\n'),
    rows:rows, away:away
  };
}

/* —— Layout —— */
function ygToolbarHTML(){
  var years=[];
  var now=new Date().getFullYear();
  for(var y=now-2;y<=now+5;y++) years.push(y);
  if(years.indexOf(YG.year)<0) years.push(YG.year);
  years.sort(function(a,b){ return a-b; });

  var terrOpts=['All'].concat(global.TERRS||[]).map(function(t){
    return '<option value="'+esc(t)+'"'+(YG.terr===t?' selected':'')+'>'+esc(t==='All'?'All territories':t)+'</option>';
  }).join('');
  var roleOpts='<option value="">All roles</option>'
    +['AM','DSR','ISS','TC','LEAD'].map(function(r){
      return '<option value="'+r+'"'+(YG.role===r?' selected':'')+'>'+esc(r)+'</option>';
    }).join('');
  var members=(global.teamList?global.teamList(YG.terr==='All'?null:YG.terr,false):[])||[];
  if(YG.role) members=members.filter(function(m){ return m.role===YG.role; });
  var memOpts='<option value="__all__"'+(YG.membersAll?' selected':'')+'>All team members</option>'
    +members.map(function(m){
      return '<option value="'+esc(m.id)+'"'+(!YG.membersAll&&YG.memberIds[m.id]?' selected':'')+'>'
        +esc(m.name)+' · '+esc(m.role)+'</option>';
    }).join('');

  return '<div class="yg-toolbar">'
    +'<div class="yg-tb-left">'
    +'<button type="button" class="kbb icon" id="ygPrevYear" title="Previous year">‹</button>'
    +'<select id="ygYear" class="msearch yg-ctrl">'+years.map(function(y){
      return '<option value="'+y+'"'+(y===YG.year?' selected':'')+'>'+y+'</option>';
    }).join('')+'</select>'
    +'<button type="button" class="kbb icon" id="ygNextYear" title="Next year">›</button>'
    +'<button type="button" class="kbb'+(YG.year===now?' primary':'')+'" id="ygThisYear">This Year</button>'
    +'</div>'
    +'<div class="yg-tb-right">'
    +'<select id="ygTerr" class="msearch yg-ctrl" title="Territory">'+terrOpts+'</select>'
    +'<select id="ygRole" class="msearch yg-ctrl" title="Role">'+roleOpts+'</select>'
    +'<select id="ygMember" class="msearch yg-ctrl yg-mem" title="Team members">'+memOpts+'</select>'
    +'<div class="yg-seg" role="tablist" aria-label="Calendar mode">'
    +'<button type="button" class="yg-seg-btn'+(YG.mode==='availability'?' on':'')+'" data-ygmode="availability">Availability</button>'
    +'<button type="button" class="yg-seg-btn'+(YG.mode==='activities'?' on':'')+'" data-ygmode="activities">Activities</button>'
    +'</div>'
    +'<div class="yg-export">'
    +'<button type="button" class="kbb" id="ygExportBtn" aria-haspopup="true">Export ▾</button>'
    +'<div class="yg-export-menu" id="ygExportMenu" hidden>'
    +'<button type="button" data-ygexport="pdf">Export PDF</button>'
    +'<button type="button" data-ygexport="xlsx">Export Excel</button>'
    +'</div></div>'
    +'<button type="button" class="kbb" id="ygAddEvent">+ Event</button>'
    +(!YG.keyOpen?'<button type="button" class="kbb" id="ygKeyOpen">Key</button>':'')
    +'</div></div>'
    +(ygCloudSynced()?'':'<div class="yg-sync-warn">Trip Plan not fully synced with the cloud — annual view may be incomplete. Reload before relying on this calendar.</div>');
}

function ygKeyHTML(){
  if(!YG.keyOpen) return '';
  var body='';
  if(YG.mode==='availability'){
    body=ygAvailCats().filter(function(c){ return !c.archived; }).map(function(c){
      var on=YG.cats[c.id]!==false;
      return '<button type="button" class="yg-key-row'+(on?' on':'')+'" data-ygcat="'+esc(c.id)+'" title="Toggle '+esc(c.label)+'">'
        +'<i style="background:'+c.color+';border:1px solid '+(c.id==='NP'?'#d1d5db':c.color)+'"></i>'
        +'<span>'+esc(c.label)+'</span></button>';
    }).join('');
  } else {
    var TT=global.TRAVEL_TYPES||{};
    var rows=[
      {k:'dealer', icon:'🤝', label:'Dealer visits', color:'#16a34a'}
    ].concat(Object.keys(TT).map(function(k){
      return {k:k, icon:TT[k].icon, label:TT[k].label, color:TT[k].color};
    }));
    /* de-dupe flight variants visually */
    var seen={};
    body=rows.filter(function(r){
      var lab=r.label||r.k;
      if(seen[lab]) return false; seen[lab]=1; return true;
    }).map(function(r){
      return '<div class="yg-key-row on"><span class="yg-key-ic" style="color:'+r.color+'">'+r.icon+'</span><span>'+esc(r.label)+'</span></div>';
    }).join('');
  }
  return '<aside class="yg-key" id="ygKey">'
    +'<div class="yg-key-h"><span>EVENT KEY</span>'
    +'<button type="button" class="yg-key-x" id="ygKeyClose" title="Collapse key">×</button></div>'
    +'<div class="yg-key-b">'+body+'</div>'
    +'<div class="yg-key-note">Linked to weekly travel plans</div>'
    +(YG.outlookPending?'<div class="yg-key-note yg-outlook">Outlook availability — pending Microsoft auth</div>':'')
    +(ygCanAdmin()?'<button type="button" class="yg-key-manage" id="ygManageCats">⚙ Manage categories</button>':'')
    +'</aside>';
}

function ygHeadHTML(){
  var cells='<div class="yg-corner"></div>';
  for(var i=0;i<YG_COLS;i++){
    var wd=i%7;
    var sep=(i>0 && wd===0)?' yg-sep':'';
    var we=(wd===0||wd===6)?' we':'';
    cells+='<div class="yg-hd'+we+sep+'">'+YG_WD[wd]+'</div>';
  }
  return '<div class="yg-head" style="--yg-cols:'+YG_COLS+'">'+cells+'</div>';
}

function ygMonthRowHTML(month, byAct, byAvail){
  var y=YG.year;
  var dim=ygDaysInMonth(y, month);
  var first=ygDate(y,month,1);
  var start=first.getDay(); /* 0=Sun */
  var today=new Date(); today.setHours(12,0,0,0);
  var cells='';
  for(var col=0; col<YG_COLS; col++){
    var dayNum=col-start+1;
    var wd=col%7;
    var we=(wd===0||wd===6);
    var sep=(col>0 && wd===0)?' yg-sep':'';
    if(dayNum<1 || dayNum>dim){
      cells+='<div class="yg-cell na'+sep+'" aria-hidden="true"></div>';
      continue;
    }
    var dt=ygDate(y,month,dayNum);
    var iso=ygISO(dt);
    var isToday=dt.getFullYear()===today.getFullYear()&&dt.getMonth()===today.getMonth()&&dt.getDate()===today.getDate();
    var sum=ygCellSummary(iso, byAct, byAvail);
    var bar='';
    if(sum.kind==='avail'||sum.kind==='team-avail'){
      bar='<span class="yg-chip'+(sum.tentative?' tent':'')+'" style="background:'+sum.color+';color:'+(sum.text||'#fff')+'">'+esc(sum.label)+'</span>';
    } else if(sum.kind==='activity'){
      bar='<span class="yg-chip act" style="background:'+sum.color+'">'+sum.icon+(sum.label?(' '+esc(sum.label)):'')+'</span>';
    } else if(sum.kind==='team-act'){
      bar='<span class="yg-chip" style="background:#374151;color:#fff">'+esc(sum.label)+'</span>';
    }
    cells+='<button type="button" class="yg-cell'+(we?' we':'')+(isToday?' today':'')+(sum.kind!=='empty'?' has':'')+sep+'" data-ygday="'+iso+'" title="'+esc(sum.title||iso)+'">'
      +'<span class="yg-d">'+dayNum+'</span>'
      +'<span class="yg-bars">'+bar+'</span>'
      +'</button>';
  }
  return '<div class="yg-month" data-ygmonth="'+month+'" style="--yg-cols:'+YG_COLS+'">'
    +'<div class="yg-mlbl">'+YG_MONTHS_SHORT[month]+'</div>'
    +cells
    +'</div>';
}

function ygPanelHTML(iso, byAct, byAvail){
  if(!iso) return '';
  var dt=ygParseISO(iso);
  var title=dt.toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric', year:'numeric'});
  var wk=null;
  try{ if(global.dateToWk) wk=global.dateToWk(dt); }catch(e){}
  var single=ygIsSingleMember();
  var member=ygSingleMember();
  var body='';

  if(YG.mode==='availability' && !single){
    var rows=byAvail[iso]||[];
    var travelling=rows.filter(function(r){ return r.status==='TR'||r.status==='TS'; });
    var unavail=rows.filter(function(r){ return r.status==='PT'||r.status==='HO'; });
    var present=rows.filter(function(r){ return r.status==='OF'||r.status==='RM'; });
    var plannedIds={};
    rows.forEach(function(r){ if(r.member) plannedIds[r.member.id]=1; });
    var notPlanned=ygTeam().filter(function(m){ return !plannedIds[m.id]; });

    function block(h, list, priv){
      if(!list.length) return '';
      return '<div class="yg-psec"><div class="yg-psec-h">'+esc(h)+'</div>'
        +list.map(function(r){
          var m=r.member||{};
          var cat=ygAvailCat(r.status);
          var dest=r.geo?(' · '+r.geo):'';
          var conf=r.tentative?'Tentative':'Confirmed';
          var detail=priv?'Unavailable':(cat.label+dest+' · '+conf);
          return '<div class="yg-pline">'
            +'<span class="yg-pcat" style="background:'+cat.color+';color:'+(cat.text||'#fff')+'">'+esc(cat.abbr)+'</span>'
            +'<div class="yg-pmain"><div class="yg-pt">'+esc(m.name||'Team')+(m.role?(' · '+esc(m.role)):'')+'</div>'
            +'<div class="yg-ps">'+esc((m.terr||'')+(detail?(' · '+detail):''))+'</div>'
            +(wk!=null&&m.id?('<button type="button" class="yg-link" data-ygopen="'+esc(m.id)+'" data-wk="'+wk+'">Open weekly plan</button>'):'')
            +'</div></div>';
        }).join('')+'</div>';
    }
    body=block('Travelling', travelling, false)
      +block('Unavailable', unavail.map(function(r){
        return Object.assign({}, r, {status:'PT'}); /* privacy: show Unavailable not personal detail */
      }), true)
      +block('Confirmed available', present, false)
      + (notPlanned.length?('<div class="yg-psec"><div class="yg-psec-h">Not yet planned ('+notPlanned.length+')</div>'
        +notPlanned.slice(0,12).map(function(m){
          return '<div class="yg-ps" style="padding:2px 0">'+esc(m.name)+' · '+esc(m.role)+'</div>';
        }).join('')
        +(notPlanned.length>12?'<div class="yg-ps">+'+ (notPlanned.length-12) +' more</div>':'')
        +'</div>'):'');
    if(!travelling.length && !unavail.length && !present.length)
      body='<div class="yg-empty">No confirmed availability for this date. Empty means Not yet planned — not verified in office.</div>'+body;
  } else {
    var acts=(byAct[iso]||[]).filter(function(a){
      if(single && member && a.member && a.member.id!==member.id) return false;
      if(a.privateNote && !ygCanAdmin()) return false;
      return true;
    });
    var availRow=null;
    if(member){
      availRow=(byAvail[iso]||[]).filter(function(r){ return r.member&&r.member.id===member.id; })[0];
    }
    if(availRow){
      var ac=ygAvailCat(availRow.status);
      body+='<div class="yg-statusline"><span class="yg-pcat" style="background:'+ac.color+';color:'+(ac.text||'#fff')+'">'+esc(ac.abbr)+'</span> '
        +esc(ac.label)+(availRow.geo?(' · '+esc(availRow.geo)):'')
        +(availRow.tentative?' · Tentative':' · Confirmed')
        +(availRow.incomplete?' · <em>incomplete travel dates</em>':'')
        +'</div>';
    }
    if(member){
      body+='<div class="yg-psub" style="margin:4px 0 8px">'+esc(member.name)+(member.role?(' · '+esc(member.role)):'')+(member.terr?(' · '+esc(member.terr)):'')+'</div>';
    }
    if(acts.length){
      body+=acts.map(function(e){
        var ic=ygTravelIcon(e.type);
        var who=e.member?(e.member.name+(e.member.role?' · '+e.member.role:'')):(e.terr||'Company');
        var title=e.privateNote&&!ygCanAdmin()?'Unavailable':e.title;
        return '<div class="yg-pline">'
          +'<span class="yg-pcat" style="background:'+ic.color+'">'+ic.icon+'</span>'
          +'<div class="yg-pmain"><div class="yg-pt">'+esc(title)+'</div>'
          +'<div class="yg-ps">'+esc(who)+(e.time?(' · '+(global.t12s?global.t12s(e.time):e.time)):'')
          +(e.place?(' · '+esc(e.place)):'')
          +' · '+(e.conf?'Confirmed':'Tentative')+'</div></div></div>';
      }).join('');
    } else if(!availRow){
      body+='<div class="yg-empty">Not yet planned. Empty does not mean verified available.</div>';
    }
  }

  return '<div class="yg-panel" id="ygPanel">'
    +'<div class="yg-ph"><div><b>'+esc(title)+'</b><div class="yg-psub">'+esc(YG.mode==='availability'?'Availability':'Activities')+'</div></div>'
    +'<button type="button" class="kbb" id="ygPanelClose">×</button></div>'
    +'<div class="yg-pb">'+body+'</div>'
    +'<div class="yg-pf">'
    +'<button type="button" class="kbb" id="ygPlanDay" data-day="'+esc(iso)+'">+ Event</button>'
    +(wk!=null?('<button type="button" class="kbb primary" id="ygOpenWeek" data-wk="'+wk+'">Open Weekly Plan</button>'):'')
    +'<button type="button" class="kbb" id="ygPanelClose2">Close</button>'
    +'</div></div>';
}

function ygRender(){
  var host=document.getElementById('yearView'); if(!host) return;
  var byAct={}, byAvail={};
  try{ byAct=ygBuildActivities()||{}; }catch(e){ byAct={}; }
  try{ byAvail=ygBuildAvailability(byAct)||{}; }catch(e){ byAvail={}; }
  var months='';
  for(var m=0;m<12;m++) months+=ygMonthRowHTML(m, byAct, byAvail);
  host.innerHTML='<div class="yg-wrap'+(YG.keyOpen?'':' yg-key-collapsed')+'">'
    +ygToolbarHTML()
    +'<div class="yg-main">'
    +'<div class="yg-board">'+ygHeadHTML()+months+'</div>'
    +ygKeyHTML()
    +'</div>'
    +(YG.panelDate?ygPanelHTML(YG.panelDate, byAct, byAvail):'')
    +'</div>';
  host.classList.add('is-on');
  host.style.display='block';
  ygWire(host, byAct, byAvail);
}

function ygOpenWeekly(wk, memberId){
  try{ sessionStorage.setItem('aqYgReturn', JSON.stringify({
    year:YG.year, terr:YG.terr, role:YG.role, mode:YG.mode,
    membersAll:YG.membersAll, memberIds:YG.memberIds, at:Date.now()
  })); }catch(e){}
  global.PLAN_MODE='weekly';
  if(YG.terr!=='All'){
    global.terr=YG.terr;
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.toggle('active', x.dataset.t===YG.terr); });
  } else {
    global.terr='All';
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.toggle('active', x.dataset.t==='All'); });
  }
  if(memberId && global.teamById && global.teamById(memberId)){
    try{
      global.TEAM_ALL=false; global.TEAM_IDS={}; global.TEAM_IDS[memberId]=true;
      if(global.teamSaveSel) global.teamSaveSel();
    }catch(e){}
  }
  if(typeof global.focusWkSet==='function') global.focusWkSet(wk);
  else { global.FOCUS_WK=wk; global.ALL_WK=wk; }
  if(typeof global.render==='function') global.render();
}

function ygWire(host, byAct, byAvail){
  var ysel=host.querySelector('#ygYear'); if(ysel) ysel.onchange=function(){ YG.year=parseInt(ysel.value,10)||YG.year; ygRender(); };
  var prev=host.querySelector('#ygPrevYear'); if(prev) prev.onclick=function(){ YG.year--; ygRender(); };
  var next=host.querySelector('#ygNextYear'); if(next) next.onclick=function(){ YG.year++; ygRender(); };
  var tsel=host.querySelector('#ygTerr'); if(tsel) tsel.onchange=function(){ YG.terr=tsel.value; ygRender(); };
  var rsel=host.querySelector('#ygRole'); if(rsel) rsel.onchange=function(){ YG.role=rsel.value; ygRender(); };
  var msel=host.querySelector('#ygMember');
  if(msel) msel.onchange=function(){
    var v=msel.value;
    if(!v || v==='__all__'){ YG.membersAll=true; YG.memberIds={}; }
    else { YG.membersAll=false; YG.memberIds={}; YG.memberIds[v]=true; }
    ygRender();
  };
  var ty=host.querySelector('#ygThisYear'); if(ty) ty.onclick=function(){ YG.year=new Date().getFullYear(); ygRender(); };
  host.querySelectorAll('[data-ygmode]').forEach(function(b){
    b.onclick=function(){
      YG.mode=b.dataset.ygmode==='activities'?'activities':'availability';
      try{ localStorage.setItem('aqYgMode', YG.mode); }catch(e){}
      ygRender();
    };
  });
  host.querySelectorAll('[data-ygcat]').forEach(function(b){
    b.onclick=function(){ var id=b.dataset.ygcat; YG.cats[id]=!(YG.cats[id]!==false); ygRender(); };
  });
  var kc=host.querySelector('#ygKeyClose');
  if(kc) kc.onclick=function(){ YG.keyOpen=false; try{ localStorage.setItem('aqYgKeyOpen','0'); }catch(e){} ygRender(); };
  var ko=host.querySelector('#ygKeyOpen');
  if(ko) ko.onclick=function(){ YG.keyOpen=true; try{ localStorage.setItem('aqYgKeyOpen','1'); }catch(e){} ygRender(); };

  host.querySelectorAll('[data-ygday]').forEach(function(b){
    b.onclick=function(){
      YG.panelDate=b.dataset.ygday;
      ygRender();
    };
  });
  var pc=host.querySelector('#ygPanelClose'); if(pc) pc.onclick=function(){ YG.panelDate=null; ygRender(); };
  var pc2=host.querySelector('#ygPanelClose2'); if(pc2) pc2.onclick=function(){ YG.panelDate=null; ygRender(); };
  var planDay=host.querySelector('#ygPlanDay'); if(planDay) planDay.onclick=function(){ ygOpenEventModal(planDay.dataset.day||YG.panelDate); };
  var ow=host.querySelector('#ygOpenWeek');
  if(ow) ow.onclick=function(){
    var wk=parseInt(ow.dataset.wk,10);
    var m=ygSingleMember();
    ygOpenWeekly(wk, m&&m.id);
  };
  host.querySelectorAll('[data-ygopen]').forEach(function(b){
    b.onclick=function(){ ygOpenWeekly(parseInt(b.dataset.wk,10), b.dataset.ygopen); };
  });

  var add=host.querySelector('#ygAddEvent'); if(add) add.onclick=function(){ ygOpenEventModal(YG.panelDate); };
  var mc=host.querySelector('#ygManageCats'); if(mc) mc.onclick=function(){ ygOpenManageCats(); };

  var exBtn=host.querySelector('#ygExportBtn');
  var exMenu=host.querySelector('#ygExportMenu');
  if(exBtn&&exMenu){
    exBtn.onclick=function(e){ e.stopPropagation(); exMenu.hidden=!exMenu.hidden; };
    exMenu.querySelectorAll('[data-ygexport]').forEach(function(b){
      b.onclick=function(){ exMenu.hidden=true; ygExport(b.dataset.ygexport); };
    });
  }
}

function ygOpenEventModal(prefillIso){
  var wrap=document.createElement('div'); wrap.className='modalbg';
  var cats=ygAvailCats().filter(function(c){ return c.id!=='NP'; });
  var catOpts=cats.map(function(c){ return '<option value="'+c.id+'">'+esc(c.abbr)+' — '+esc(c.label)+'</option>'; }).join('');
  var terrOpts='<option value="">Entire company</option>'+(global.TERRS||[]).map(function(t){
    return '<option value="'+t+'"'+(YG.terr===t?' selected':'')+'>'+t+'</option>';
  }).join('');
  var memOpts='<option value="">All filtered team</option>'+ygTeam().map(function(m){
    return '<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>';
  }).join('');
  var startVal=prefillIso||'';
  wrap.innerHTML='<div class="modalbox" style="width:min(480px,94vw)"><div class="mh"><div class="mt">Add event</div><button class="mclose" id="ygex">×</button></div>'
    +'<div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;font-size:13px">'
    +'<input id="yge_title" class="msearch" placeholder="Event name" autofocus>'
    +'<div style="display:flex;gap:8px"><input id="yge_start" type="date" class="msearch" style="flex:1" value="'+esc(startVal)+'">'
    +'<input id="yge_end" type="date" class="msearch" style="flex:1" value="'+esc(startVal)+'"></div>'
    +'<select id="yge_cat" class="msearch">'+catOpts+'</select>'
    +'<select id="yge_terr" class="msearch">'+terrOpts+'</select>'
    +'<select id="yge_mem" class="msearch">'+memOpts+'</select>'
    +'<input id="yge_place" class="msearch" placeholder="Location (optional)">'
    +'<label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="yge_allday" checked> All-day</label>'
    +'<label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="yge_priv"> Keep details private (show as Unavailable)</label>'
    +'<textarea id="yge_notes" class="msearch" rows="2" placeholder="Notes (optional)"></textarea>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="yge_cancel">Cancel</button>'
    +'<button class="btn" id="yge_save" style="background:var(--aq-red);color:#fff;border:0">Save</button></div>'
    +'</div></div>';
  document.body.appendChild(wrap);
  var close=function(){ wrap.remove(); };
  wrap.addEventListener('click',function(e){ if(e.target===wrap) close(); });
  wrap.querySelector('#ygex').onclick=close;
  wrap.querySelector('#yge_cancel').onclick=close;
  wrap.querySelector('#yge_save').onclick=function(){
    var title=wrap.querySelector('#yge_title').value.trim();
    var start=wrap.querySelector('#yge_start').value;
    if(!title||!start){ alert('Title and start date required'); return; }
    var end=wrap.querySelector('#yge_end').value||start;
    var mid=wrap.querySelector('#yge_mem').value;
    var cat=wrap.querySelector('#yge_cat').value;
    var priv=wrap.querySelector('#yge_priv').checked;
    YG_EVENTS.push({
      id:'yg'+Date.now(), title:title, start:start, end:end,
      cat:cat, avail:cat, terr:wrap.querySelector('#yge_terr').value||'',
      memberIds:mid?[mid]:[], place:wrap.querySelector('#yge_place').value.trim(),
      allDay:wrap.querySelector('#yge_allday').checked,
      notes:wrap.querySelector('#yge_notes').value.trim(),
      private:priv, reserves:['PT','HO','TR','TS','CE','OF','RM'].indexOf(cat)>=0
    });
    /* Explicit personal availability override when assigned to one person */
    if(mid && ['OF','RM','PT'].indexOf(cat)>=0){
      var a=ygParseISO(start), b=ygParseISO(end);
      for(var t=new Date(a); t<=b; t.setDate(t.getDate()+1)){
        YG_AVAIL[ygISO(t)+'|'+mid]={status:cat, note:priv?'':title, private:priv};
      }
    }
    ygPersistPlan();
    YG.panelDate=start;
    close(); ygRender();
  };
  setTimeout(function(){ var t=wrap.querySelector('#yge_title'); if(t) t.focus(); }, 30);
}

function ygOpenManageCats(){
  if(!ygCanAdmin()) return;
  var wrap=document.createElement('div'); wrap.className='modalbg';
  function rows(){
    return ygAvailCats().map(function(c){
      return '<tr data-id="'+esc(c.id)+'">'
        +'<td><input class="msearch yg-mc-abbr" value="'+esc(c.abbr)+'" maxlength="4" '+(c.system?'':'')+'></td>'
        +'<td><input class="msearch yg-mc-label" value="'+esc(c.label)+'"></td>'
        +'<td><input type="color" class="yg-mc-color" value="'+esc(c.color)+'"></td>'
        +'<td style="font-size:11px;color:#6b7280">'+(c.system?'System':'Custom')+'</td>'
        +'<td>'+(c.system?'':('<button type="button" class="kbb yg-mc-del" data-del="'+esc(c.id)+'">Archive</button>'))+'</td>'
        +'</tr>';
    }).join('');
  }
  wrap.innerHTML='<div class="modalbox" style="width:min(560px,96vw)"><div class="mh"><div class="mt">Manage availability categories</div><button class="mclose" id="ygmcx">×</button></div>'
    +'<div style="padding:12px 16px;font-size:13px">'
    +'<p style="margin:0 0 8px;font-size:12px;color:#6b7280">System appointment types (flights, hotels, dealer visits) are never deleted. Category changes only affect Year at a Glance presentation.</p>'
    +'<table class="yg-mctable"><thead><tr><th>Abbr</th><th>Name</th><th>Colour</th><th></th><th></th></tr></thead>'
    +'<tbody id="ygmcBody">'+rows()+'</tbody></table>'
    +'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'
    +'<input id="ygmc_new_abbr" class="msearch" placeholder="Abbr" style="width:64px" maxlength="4">'
    +'<input id="ygmc_new_label" class="msearch" placeholder="New category name" style="flex:1">'
    +'<input id="ygmc_new_color" type="color" value="#64748b">'
    +'<button type="button" class="kbb" id="ygmcAdd">Add</button>'
    +'<span style="flex:1"></span>'
    +'<button type="button" class="kbb" id="ygmcCancel">Close</button>'
    +'<button type="button" class="kbb primary" id="ygmcSave">Save</button>'
    +'</div></div></div>';
  document.body.appendChild(wrap);
  var close=function(){ wrap.remove(); };
  wrap.querySelector('#ygmcx').onclick=close;
  wrap.querySelector('#ygmcCancel').onclick=close;
  wrap.addEventListener('click',function(e){ if(e.target===wrap) close(); });
  wrap.querySelector('#ygmcAdd').onclick=function(){
    var abbr=wrap.querySelector('#ygmc_new_abbr').value.trim().toUpperCase();
    var label=wrap.querySelector('#ygmc_new_label').value.trim();
    var color=wrap.querySelector('#ygmc_new_color').value;
    if(!abbr||!label){ alert('Abbreviation and name required'); return; }
    if(ygAvailCats().some(function(c){ return c.abbr===abbr||c.id===abbr; })){
      alert('Abbreviation already in use'); return;
    }
    YG_CAT_CUSTOM.push({id:abbr, abbr:abbr, label:label, color:color, text:'#fff', class:'away', system:false});
    YG.cats[abbr]=true;
    wrap.querySelector('#ygmcBody').innerHTML=rows();
    wireDel();
  };
  function wireDel(){
    wrap.querySelectorAll('.yg-mc-del').forEach(function(b){
      b.onclick=function(){
        var id=b.dataset.del;
        YG_CAT_CUSTOM=YG_CAT_CUSTOM.map(function(c){
          if(c.id===id) return Object.assign({},c,{archived:true});
          return c;
        });
        wrap.querySelector('#ygmcBody').innerHTML=rows();
        wireDel();
      };
    });
  }
  wireDel();
  wrap.querySelector('#ygmcSave').onclick=function(){
    wrap.querySelectorAll('#ygmcBody tr').forEach(function(tr){
      var id=tr.dataset.id;
      var abbr=tr.querySelector('.yg-mc-abbr').value.trim().toUpperCase();
      var label=tr.querySelector('.yg-mc-label').value.trim();
      var color=tr.querySelector('.yg-mc-color').value;
      var base=YG_AVAIL_DEFAULTS.filter(function(c){ return c.id===id; })[0];
      var existing=null;
      YG_CAT_CUSTOM.forEach(function(c){ if(c.id===id) existing=c; });
      if(base){
        if(!existing){
          YG_CAT_CUSTOM.push({id:id, abbr:abbr, label:label, color:color, text:base.text, system:true});
        } else {
          existing.abbr=abbr; existing.label=label; existing.color=color;
        }
      } else if(existing){
        existing.abbr=abbr; existing.label=label; existing.color=color;
      }
    });
    ygPersistPlan();
    close(); ygRender();
  };
}

function ygExport(kind){
  var byAct=ygBuildActivities();
  var byAvail=ygBuildAvailability(byAct);
  var who=ygSingleMember();
  var whoLabel=who?(who.name):(YG.membersAll?'All team':('Selected · '+ygSelectedMemberCount()));
  if(kind==='xlsx'){
    var lines=['Date,Weekday,Status,Abbr,Person,Role,Territory,Destination,Confirmed,Title'];
    Object.keys(YG.mode==='availability'?byAvail:byAct).sort().forEach(function(iso){
      if(YG.mode==='availability'){
        (byAvail[iso]||[]).forEach(function(r){
          if(!ygStatusVisible(r.status)) return;
          var cat=ygAvailCat(r.status);
          var m=r.member||{};
          lines.push([iso,ygParseISO(iso).toLocaleDateString('en-US',{weekday:'short'}),cat.label,cat.abbr,
            '"'+String(m.name||'').replace(/"/g,'""')+'"',m.role||'',m.terr||'',r.geo||'',
            r.tentative?'tentative':'confirmed',''].join(','));
        });
      } else {
        (byAct[iso]||[]).forEach(function(a){
          if(a.privateNote&&!ygCanAdmin()) return;
          var m=a.member||{};
          lines.push([iso,ygParseISO(iso).toLocaleDateString('en-US',{weekday:'short'}),a.type,'',
            '"'+String(m.name||'').replace(/"/g,'""')+'"',m.role||'',a.terr||'',a.geo||ygGeoAbbr(a)||'',
            a.conf?'confirmed':'tentative','"'+String(a.title||'').replace(/"/g,'""')+'"'].join(','));
        });
      }
    });
    var blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='Arrowquip_Year_'+YG.year+'_'+(YG.terr||'All')+'_'+YG.mode+'.csv';
    a.click(); URL.revokeObjectURL(a.href);
    if(global.aqToast) global.aqToast('Excel-friendly CSV downloaded.');
    return;
  }
  var w=window.open('','_blank');
  if(!w){ alert('Allow pop-ups to export PDF'); return; }
  var monthsHtml=ygHeadHTML();
  for(var m=0;m<12;m++) monthsHtml+=ygMonthRowHTML(m, byAct, byAvail);
  var key=ygAvailCats().map(function(c){
    return '<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px"><i style="width:8px;height:8px;background:'+c.color+';display:inline-block"></i>'+esc(c.label)+'</span>';
  }).join('');
  w.document.write('<html><head><title>Arrowquip Year '+YG.year+'</title>'
    +'<style>body{font-family:Arial,sans-serif;font-size:7px;color:#111;margin:8px}'
    +'h1{font-size:13px;margin:0 0 6px}.yg-month,.yg-head{display:grid;grid-template-columns:36px repeat('+YG_COLS+',minmax(10px,1fr));gap:1px;margin:0 0 2px;page-break-inside:avoid}'
    +'.yg-mlbl{font-weight:700}.yg-cell{border:1px solid #333;background:#2a2d31;color:#fff;min-height:16px;padding:1px}.yg-cell.we{background:#3a3d42}'
    +'.yg-cell.na{border:0;background:transparent}.yg-chip{display:block;font-size:5px;overflow:hidden;white-space:nowrap;padding:0 1px}'
    +'.yg-d{font-size:6px;color:#fff}.yg-hd{text-align:center;font-weight:700}'
    +'@page{size:landscape;margin:6mm}</style></head><body>'
    +'<h1>ARROWQUIP TRAVEL — Year at a Glance '+YG.year+' · '+esc(whoLabel)+(YG.terr!=='All'?' · '+esc(YG.terr):'')+' · '+esc(YG.mode)+'</h1>'
    +'<div style="margin-bottom:6px">'+key+'</div>'
    +monthsHtml
    +'<div style="margin-top:8px;color:#666">Generated '+new Date().toLocaleString()+' · Linked to weekly travel plans · Confidential personal details omitted</div>'
    +'<script>setTimeout(function(){window.print();},300)<\\/script></body></html>');
  w.document.close();
}

function ygShow(show){
  var yv=document.getElementById('yearView');
  document.querySelectorAll('[data-planmode]').forEach(function(b){
    b.classList.toggle('on', b.dataset.planmode===(show?'year':'weekly'));
  });
  if(!yv) return;
  if(show){
    yv.classList.add('is-on');
    yv.style.display='block';
    var pv=document.getElementById('plannerView'); if(pv) pv.style.display='none';
    var av=document.getElementById('allView'); if(av) av.style.display='none';
    var cards=document.getElementById('cards'); if(cards) cards.style.display='none';
    /* Restore filters when returning from weekly plan */
    try{
      var raw=sessionStorage.getItem('aqYgReturn');
      if(raw){
        var o=JSON.parse(raw);
        if(o && o.at && (Date.now()-o.at)<3600000){
          if(o.year) YG.year=o.year;
          if(o.terr) YG.terr=o.terr;
          if(o.role!=null) YG.role=o.role;
          if(o.mode) YG.mode=o.mode;
          if(o.membersAll!=null) YG.membersAll=!!o.membersAll;
          if(o.memberIds) YG.memberIds=o.memberIds;
        }
        sessionStorage.removeItem('aqYgReturn');
      }
    }catch(e){}
    if(!YG.year) YG.year=new Date().getFullYear();
    ygRender();
  } else {
    yv.classList.remove('is-on');
    yv.style.display='none';
  }
}

global.YG=YG;
global.YG_EVENTS=YG_EVENTS;
global.YG_NOTES=YG_NOTES;
global.YG_AVAIL=YG_AVAIL;
global.YG_CAT_CUSTOM=YG_CAT_CUSTOM;
global.YG_AVAIL_DEFAULTS=YG_AVAIL_DEFAULTS;
global.ygRender=ygRender;
global.ygShow=ygShow;
global.ygBuildActivities=ygBuildActivities;
global.ygBuildAvailability=ygBuildAvailability;
global.ygBuildIndex=ygBuildActivities; /* compat */
global.ygSetEvents=function(v){ YG_EVENTS=v||[]; global.YG_EVENTS=YG_EVENTS; };
global.ygSetNotes=function(v){ YG_NOTES=v||{}; global.YG_NOTES=YG_NOTES; };
global.ygSetAvail=function(v){ YG_AVAIL=v||{}; global.YG_AVAIL=YG_AVAIL; };
global.ygSetCats=function(v){ YG_CAT_CUSTOM=v||[]; global.YG_CAT_CUSTOM=YG_CAT_CUSTOM; };

})(window);
