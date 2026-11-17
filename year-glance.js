/* Arrowquip TRAVEL — Year at a Glance (refined)
   Live derived view of weekly travel plans + company events + monthly focuses.
   Territory comes from the black nav. Exports live in the Trip Documents footer. */
(function(global){
'use strict';

var YG_WD = ['S','M','T','W','T','F','S'];
var YG_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var YG_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

var YG_AVAIL_DEFAULTS = [
  {id:'TR', abbr:'TR', label:'Travelling', color:'#2563eb', text:'#fff', system:true, class:'away'},
  {id:'OF', abbr:'OF', label:'In office', color:'#4b5563', text:'#fff', system:true, class:'present'},
  {id:'RM', abbr:'RM', label:'Working remotely', color:'#0d9488', text:'#fff', system:true, class:'present'},
  {id:'TS', abbr:'TS', label:'Trade show', color:'#d97706', text:'#fff', system:true, class:'away'},
  {id:'CE', abbr:'CE', label:'Company event', color:'#CC162E', text:'#fff', system:true, class:'away'},
  {id:'PT', abbr:'PT', label:'Unavailable', color:'#6b7280', text:'#fff', system:true, class:'away'},
  {id:'HO', abbr:'HO', label:'Holiday / shutdown', color:'#6d28d9', text:'#fff', system:true, class:'away'},
  {id:'NP', abbr:'NP', label:'Not yet planned', color:'#ffffff', text:'#9ca3af', system:true, class:'empty'}
];

var YG = {
  year: new Date().getFullYear(),
  role: '',
  memberIds: {},
  membersAll: true,
  cats: {},
  panelDate: null,
  rangeStart: null,
  keyOpen: true,
  teamMenuOpen: false
};
try{
  var _kp=localStorage.getItem('aqYgKeyOpen');
  if(_kp==='0') YG.keyOpen=false; else if(_kp==='1') YG.keyOpen=true;
}catch(e){}
YG_AVAIL_DEFAULTS.forEach(function(c){ YG.cats[c.id]=true; });

var YG_EVENTS = global.YG_EVENTS || [];
var YG_NOTES = global.YG_NOTES || {};
var YG_AVAIL = global.YG_AVAIL || {};
var YG_CAT_CUSTOM = Array.isArray(global.YG_CAT_CUSTOM) ? global.YG_CAT_CUSTOM : [];
var YG_FOCUS = global.YG_FOCUS || {}; /* 'year-month|scopeKey' → {title, notes, scope, memberId?} */

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
function ygTerr(){
  var t=global.terr;
  if(t==='Master'||t==='Settings'||t==='Team') return 'All';
  return t||'All';
}
function ygColsForYear(y){
  var max=0;
  for(var m=0;m<12;m++){
    var need=ygDate(y,m,1).getDay()+ygDaysInMonth(y,m);
    if(need>max) max=need;
  }
  return Math.max(28, max);
}
function ygPersistPlan(){
  global.YG_EVENTS=YG_EVENTS;
  global.YG_NOTES=YG_NOTES;
  global.YG_AVAIL=YG_AVAIL;
  global.YG_CAT_CUSTOM=YG_CAT_CUSTOM;
  global.YG_FOCUS=YG_FOCUS;
  try{ if(global.savePlan) global.savePlan(); }catch(e){}
}
function ygCanAdmin(){
  try{ return !!(global.teamCanManage && global.teamCanManage()); }catch(e){ return false; }
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

function ygAvailCats(){
  var map={};
  YG_AVAIL_DEFAULTS.forEach(function(c){ map[c.id]=Object.assign({},c); });
  (YG_CAT_CUSTOM||[]).forEach(function(c){
    if(!c||!c.id||c.archived) return;
    if(map[c.id] && map[c.id].system){
      if(c.label) map[c.id].label=c.label;
      if(c.color) map[c.id].color=c.color;
      if(c.abbr) map[c.id].abbr=c.abbr;
    } else {
      map[c.id]={id:c.id, abbr:c.abbr||c.id, label:c.label||c.id, color:c.color||'#6b7280', text:'#fff', system:false, class:c.class||'away'};
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
  var terr=ygTerr();
  if(terr!=='All' && m.terr!==terr){
    var terrs=Array.isArray(m.terrs)?m.terrs:[];
    if(terrs.indexOf(terr)<0 && terrs.indexOf('All')<0) return false;
  }
  if(YG.role && m.role!==YG.role) return false;
  if(YG.membersAll) return true;
  return !!YG.memberIds[m.id];
}
function ygTeam(){
  var terr=ygTerr();
  var list=(global.teamList?global.teamList(terr==='All'?null:terr,false):[])||[];
  if(YG.role) list=list.filter(function(m){ return m.role===YG.role; });
  return list.filter(function(m){ return YG.membersAll || YG.memberIds[m.id]; });
}
function ygTeamRoster(){
  var terr=ygTerr();
  return (global.teamList?global.teamList(terr==='All'?null:terr,false):[])||[];
}
function ygIsNone(){ return !YG.membersAll && !Object.keys(YG.memberIds).length; }
function ygIsAll(){
  if(YG.membersAll) return true;
  var roster=ygTeamRoster();
  return !!(roster.length && roster.every(function(m){ return YG.memberIds[m.id]; }));
}
function ygIsPartial(){
  if(YG.membersAll || ygIsNone()) return false;
  var roster=ygTeamRoster();
  var n=roster.filter(function(m){ return YG.memberIds[m.id]; }).length;
  return n>0 && n<roster.length;
}
function ygTravellerForDealer(t,d){ return global.allTravellerForDealer?global.allTravellerForDealer(t,d):null; }
function ygTravellerForX(x){ return global.allTravellerForX?global.allTravellerForX(x):null; }
function ygTravellerForLogi(it){ return global.allTravellerForLogi?global.allTravellerForLogi(it):null; }
function ygAirportRegion(code){
  code=String(code||'').toUpperCase(); if(!code||!global.AIRPORTS) return '';
  for(var i=0;i<global.AIRPORTS.length;i++){
    var a=global.AIRPORTS[i];
    if(a[0]===code){ var m=String(a[6]||'').match(/\b([A-Z]{2})\b/); return m?m[1]:''; }
  }
  return '';
}
function ygGeoFromText(s){
  s=String(s||'');
  var m=s.match(/,\s*([A-Z]{2})(?:\s|,|$)/); if(m) return m[1];
  m=s.match(/\b(TX|NC|SC|GA|FL|AL|MS|LA|AR|OK|KS|MO|IA|MN|WI|IL|IN|OH|MI|PA|NY|NJ|VA|WV|KY|TN|CA|OR|WA|AZ|NM|CO|UT|NV|ID|MT|WY|ND|SD|NE|ME|NH|VT|MA|CT|RI|DE|MD|DC|AB|BC|MB|SK|ON|QC|NB|NS|PE|NL|NT|YT|NU|AU)\b/);
  return m?m[1]:'';
}
function ygPushAct(bucket, iso, ev){ if(!iso) return; (bucket[iso]=bucket[iso]||[]).push(ev); }

function ygBuildActivities(){
  var byDay={}, y=YG.year, terr=ygTerr();
  var ASSIGN=global.ASSIGN||{}, DAY=global.DAY||{}, TIME=global.TIME||{}, APPT=global.APPT||{};
  var LOGI=global.LOGI||[], XVISITS=global.XVISITS||[];
  var TERRS=global.TERRS||['East','South','Central','West','Exports'];
  var dealersIn=global.dealersIn, byId=global.byId, uniById=global.uniById;
  var travelType=global.travelType, xvType=global.xvType;
  function inYear(dt){ return dt && dt.getFullYear()===y; }
  function memberOk(m){
    if(ygIsNone()) return false;
    if(!m) return YG.membersAll && !YG.role && terr==='All';
    return ygMemberSelected(m);
  }
  try{
    TERRS.forEach(function(t){
      if(terr!=='All' && terr!==t) return;
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
          geo:ygGeoFromText(d.address||d.loc||''), annual:false
        });
      });
    });
    XVISITS.forEach(function(x){
      if(terr!=='All' && x.terr!==terr) return;
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
        geo:ygGeoFromText((d&&(d.address||d.loc))||''), annual:!!x.annual
      });
    });
    LOGI.forEach(function(it){
      if(terr!=='All' && it.terr!==terr) return;
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
          overnight:/^(flight_|hotel|rental_|tradeshow)/.test(String(ty)),
          annual:!!it.annual || ty==='tradeshow'
        });
      }
    });
    (YG_EVENTS||[]).forEach(function(ev){
      if(!ev||!ev.start) return;
      if(ev.terr && terr!=='All' && ev.terr!==terr) return;
      if(ev.role && YG.role && ev.role!==YG.role) return;
      if(ev.memberIds && ev.memberIds.length && !YG.membersAll){
        if(!ev.memberIds.some(function(id){ return YG.memberIds[id]; })) return;
      }
      var a=ygParseISO(ev.start), b=ygParseISO(ev.end||ev.start);
      if(b<a) b=a;
      for(var t=new Date(a); t<=b; t.setDate(t.getDate()+1)){
        if(t.getFullYear()!==y) continue;
        ygPushAct(byDay, ygISO(t), {
          kind:'event', type:ev.cat||'CE', title:ev.title||'Event', terr:ev.terr||'All',
          member:null, conf:true, time:ev.allDay?'':(ev.time||''), place:ev.place||'',
          event:ev, status:ev.avail||ev.cat||'CE', company:!(ev.memberIds&&ev.memberIds.length),
          privateNote:!!ev.private, annual:ev.annual!==false
        });
      }
    });
  }catch(err){ try{ console.warn('[YG] activities', err); }catch(e){} }
  return byDay;
}

function ygBuildAvailability(byAct){
  var byDay={}, team=ygTeam(), teamIds={};
  team.forEach(function(m){ teamIds[m.id]=m; });
  function memberInFilter(m){
    if(ygIsNone()) return false;
    if(!m) return YG.membersAll && !YG.role;
    return ygMemberSelected(m);
  }
  function pushAvail(bucket, iso, row){ (bucket[iso]=bucket[iso]||[]).push(row); }

  Object.keys(YG_AVAIL||{}).forEach(function(key){
    var parts=key.split('|'); if(parts.length<2) return;
    var iso=parts[0], mid=parts[1];
    if(iso.slice(0,4)!==String(YG.year)) return;
    var m=teamIds[mid]||(global.teamById&&global.teamById(mid));
    if(!memberInFilter(m)) return;
    var o=YG_AVAIL[key];
    pushAvail(byDay, iso, {member:m, status:o.status||'OF', geo:'', conf:true, tentative:false, acts:[], source:'override'});
  });

  var spans={};
  Object.keys(byAct).forEach(function(iso){
    (byAct[iso]||[]).forEach(function(ev){
      if(!ev.member || !memberInFilter(ev.member) || typeof ev.wk!=='number') return;
      var k=ev.member.id+'|'+ev.wk;
      var s=spans[k]||{min:99,max:-1,geo:'',conf:false,hasOvernight:false,incomplete:false,types:{}};
      var day=ev.day!=null?+ev.day:null; if(day==null) return;
      var overnight=!!ev.overnight || ev.type==='tradeshow' || /^flight_/.test(String(ev.type)) || ev.type==='hotel'
        || ev.type==='rental_pickup' || ev.type==='rental_return';
      if(overnight){
        s.hasOvernight=true;
        if(day<s.min) s.min=day; if(day>s.max) s.max=day;
        if(ev.geo) s.geo=ev.geo; if(ev.conf) s.conf=true;
        s.types[ev.type]=1;
      }
      spans[k]=s;
    });
  });
  Object.keys(spans).forEach(function(k){
    var parts=k.split('|'), mid=parts[0], wk=+parts[1], s=spans[k];
    var m=teamIds[mid]||(global.teamById&&global.teamById(mid));
    if(!m||!memberInFilter(m)||!s.hasOvernight||s.min>s.max) return;
    for(var di=s.min; di<=s.max; di++){
      var dt=ygFromWkDay(wk, di);
      if(!dt || dt.getFullYear()!==YG.year) continue;
      var iso=ygISO(dt);
      var dayActs=(byAct[iso]||[]).filter(function(a){ return a.member&&a.member.id===mid; });
      var isTs=dayActs.some(function(a){ return a.type==='tradeshow'; });
      pushAvail(byDay, iso, {
        member:m, status:isTs?'TS':'TR', geo:s.geo||'', conf:s.conf, tentative:!s.conf,
        acts:dayActs, source:'trip'
      });
    }
  });

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
        if((byDay[iso]||[]).some(function(r){ return r.member&&r.member.id===m.id&&r.source==='override'; })) return;
        pushAvail(byDay, iso, {
          member:m, status:st, geo:'', conf:true, tentative:false, acts:[ev], source:'event',
          title:ev.title, annual:ev.annual!==false
        });
      });
    });
  });

  var rank={PT:0,HO:1,CE:2,TS:3,TR:4,OF:5,RM:6,NP:9};
  Object.keys(byDay).forEach(function(iso){
    var byM={};
    (byDay[iso]||[]).forEach(function(r){
      if(!r.member) return;
      var id=r.member.id, cur=byM[id];
      if(!cur || (rank[r.status]||8)<(rank[cur.status]||8)) byM[id]=r;
    });
    byDay[iso]=Object.keys(byM).map(function(id){ return byM[id]; });
  });
  return byDay;
}

function ygStatusVisible(st){ return YG.cats[st]!==false; }

function ygDayStatus(iso, byAvail){
  var rows=(byAvail[iso]||[]).filter(function(r){ return ygStatusVisible(r.status); });
  if(!rows.length) return null;
  var rank={PT:0,HO:1,CE:2,TS:3,TR:4,OF:5,RM:6};
  rows.sort(function(a,b){ return (rank[a.status]||8)-(rank[b.status]||8); });
  return rows[0];
}

/* —— Toolbar —— */
function ygTeamLabel(){
  if(ygIsNone()) return 'No team members';
  if(ygIsAll() && !YG.role) return 'All team members';
  if(YG.role && ygIsAll()) return 'All '+YG.role;
  var sel=ygTeam();
  if(sel.length===1) return sel[0].name+' · '+sel[0].role;
  return sel.length+' team members';
}
function ygToolbarHTML(){
  var now=new Date().getFullYear();
  return '<div class="yg-toolbar">'
    +'<div class="yg-tb-left">'
    +'<button type="button" class="kbb icon" id="ygPrevYear" title="Previous year">‹</button>'
    +'<span class="yg-year-lbl">'+YG.year+'</span>'
    +'<button type="button" class="kbb icon" id="ygNextYear" title="Next year">›</button>'
    +'<button type="button" class="kbb" id="ygThisYear"'+(YG.year===now?' disabled':'')+'>This Year</button>'
    +'</div>'
    +'<div class="yg-tb-right">'
    +'<button type="button" class="kbb yg-team-btn" id="ygTeamBtn">'+esc(ygTeamLabel())+' ▾</button>'
    +(YG.teamMenuOpen?ygTeamMenuHTML():'')
    +'<button type="button" class="kbb primary" id="ygAddEvent">+ Event</button>'
    +(!YG.keyOpen?'<button type="button" class="kbb" id="ygKeyOpen">Key</button>':'')
    +'</div></div>'
    +(ygCloudSynced()?'':'<div class="yg-sync-warn">Trip Plan not fully synced — annual view may be incomplete.</div>');
}
function ygTeamMenuHTML(){
  var roster=ygTeamRoster();
  var allOn=ygIsAll(), partial=ygIsPartial();
  var roles=['','AM','DSR','ISS','TC','LEAD'];
  var html='<div class="yg-team-menu" id="ygTeamMenu">'
    +'<div class="yg-team-roles">'+roles.map(function(r){
      var lab=r?r:'All roles';
      return '<button type="button" class="yg-role'+(YG.role===r?' on':'')+'" data-ygrole="'+esc(r)+'">'+esc(lab)+'</button>';
    }).join('')+'</div>'
    +'<button type="button" class="yg-tm'+(allOn?' on':'')+(partial?' partial':'')+'" data-ygall="1">'
    +'<span class="box">'+(allOn?'✓':(partial?'−':''))+'</span> All team members</button>';
  roster.forEach(function(m){
    if(YG.role && m.role!==YG.role) return;
    var on=YG.membersAll||!!YG.memberIds[m.id];
    html+='<button type="button" class="yg-tm'+(on?' on':'')+'" data-ygmem="'+esc(m.id)+'">'
      +'<span class="box">'+(on?'✓':'')+'</span> '+esc(m.name)+' · '+esc(m.role)+'</button>';
  });
  html+='</div>';
  return html;
}

function ygKeyHTML(){
  if(!YG.keyOpen) return '';
  var body=ygAvailCats().filter(function(c){ return c.id!=='NP'; }).map(function(c){
    var on=YG.cats[c.id]!==false;
    return '<button type="button" class="yg-key-row'+(on?' on':'')+'" data-ygcat="'+esc(c.id)+'">'
      +'<i style="background:'+c.color+'"></i><span>'+esc(c.label)+'</span></button>';
  }).join('')
    +'<div class="yg-key-row on"><i style="background:#fff;border:1px solid #d1d5db"></i><span>Not planned</span></div>';
  return '<aside class="yg-key" id="ygKey">'
    +'<div class="yg-key-h"><span>EVENT KEY</span><button type="button" class="yg-key-x" id="ygKeyClose">×</button></div>'
    +'<div class="yg-key-b">'+body+'</div>'
    +(ygCanAdmin()?'<button type="button" class="yg-key-manage" id="ygManageCats">⚙ Manage categories</button>':'')
    +'</aside>';
}

function ygHeadHTML(cols){
  var cells='<div class="yg-corner"></div>';
  for(var i=0;i<cols;i++){
    var wd=i%7;
    cells+='<div class="yg-hd'+(wd===0||wd===6?' we':'')+(i>0&&wd===0?' yg-sep':'')+'">'+YG_WD[wd]+'</div>';
  }
  return '<div class="yg-head" style="--yg-cols:'+cols+'">'+cells+'</div>';
}

function ygMonthRowHTML(month, byAvail, cols){
  var y=YG.year, dim=ygDaysInMonth(y, month), start=ygDate(y,month,1).getDay();
  var today=new Date(); today.setHours(12,0,0,0);
  var cells='';
  for(var col=0; col<cols; col++){
    var dayNum=col-start+1;
    var wd=col%7;
    var sep=(col>0&&wd===0)?' yg-sep':'';
    if(dayNum<1 || dayNum>dim){
      cells+='<div class="yg-cell na'+sep+'" aria-hidden="true"></div>';
      continue;
    }
    var dt=ygDate(y,month,dayNum), iso=ygISO(dt);
    var isToday=dt.getFullYear()===today.getFullYear()&&dt.getMonth()===today.getMonth()&&dt.getDate()===today.getDate();
    var we=(wd===0||wd===6);
    var st=ygDayStatus(iso, byAvail);
    var bar='';
    if(st){
      var cat=ygAvailCat(st.status);
      bar='<span class="yg-bar" style="background:'+cat.color+'" title="'+esc(cat.label+(st.geo?(' · '+st.geo):''))+'"></span>';
    }
    var sel=(YG.panelDate===iso)||(YG.rangeStart===iso);
    cells+='<button type="button" class="yg-cell'+(we?' we':'')+(isToday?' today':'')+(sel?' sel':'')+(st?' has':'')+sep+'" data-ygday="'+iso+'">'
      +'<span class="yg-d">'+dayNum+'</span><span class="yg-bars">'+bar+'</span></button>';
  }
  return '<div class="yg-month" data-ygmonth="'+month+'" style="--yg-cols:'+cols+'">'
    +'<div class="yg-mlbl">'+YG_MONTHS_SHORT[month]+'</div>'+cells+'</div>';
}

/* —— Monthly Focus & Events —— */
function ygFocusKey(month, scope){
  return YG.year+'-'+month+'|'+scope;
}
function ygFocusScopeKey(){
  var terr=ygTerr();
  var team=ygTeam();
  if(team.length===1) return 'm:'+team[0].id;
  if(terr!=='All') return 't:'+terr;
  return 'company';
}
function ygFocusFor(month){
  var sk=ygFocusScopeKey();
  var terr=ygTerr();
  var keys=[ygFocusKey(month, sk)];
  if(sk.indexOf('m:')===0) keys.push(ygFocusKey(month, 't:'+terr), ygFocusKey(month, 'company'));
  else if(sk.indexOf('t:')===0) keys.push(ygFocusKey(month, 'company'));
  for(var i=0;i<keys.length;i++){
    if(YG_FOCUS[keys[i]] && YG_FOCUS[keys[i]].title) return Object.assign({_key:keys[i]}, YG_FOCUS[keys[i]]);
  }
  return null;
}
function ygKeyEventsForMonth(month, byAct, byAvail){
  var y=YG.year, dim=ygDaysInMonth(y,month);
  var seen={}, out=[];
  for(var d=1;d<=dim;d++){
    var iso=ygISO(ygDate(y,month,d));
    (byAct[iso]||[]).forEach(function(ev){
      if(ev.kind==='travel' && /^(flight_|hotel|rental_|fuel|food|parking)/.test(String(ev.type))) return;
      if(ev.kind==='dealer' && !ev.annual) return; /* routine visits stay off monthly overview unless promoted */
      if(ev.kind==='event' && ev.annual===false) return;
      if(ev.kind==='travel' && ev.type!=='tradeshow' && !ev.annual) return;
      var id=(ev.event&&ev.event.id)||(ev.logi&&ev.logi.id)||(ev.xv&&ev.xv.id)||(ev.dealerId+'|'+iso)||(ev.title+'|'+iso);
      if(seen[id]) return; seen[id]=1;
      var st=(ev.status||(ev.type==='tradeshow'?'TS':(ev.kind==='event'?(ev.type||'CE'):'TR')));
      if(!ygStatusVisible(st) && st!=='TR') return;
      var cat=ygAvailCat(st);
      out.push({
        day:d, title:ev.title||cat.label, cat:st, color:cat.color,
        member:ev.member, wk:ev.wk, iso:iso, annual:true
      });
    });
    (byAvail[iso]||[]).forEach(function(r){
      if(r.source!=='trip' && r.source!=='event') return;
      if(r.status!=='TR' && r.status!=='TS' && r.status!=='CE' && r.status!=='HO') return;
      var title=r.title || (r.geo?(r.status+' · '+r.geo):ygAvailCat(r.status).label);
      var id='av|'+iso+'|'+(r.member?r.member.id:'')+'|'+r.status;
      if(seen[id]) return; seen[id]=1;
      /* collapse consecutive travel into ranges later */
      out.push({day:d, title:title, cat:r.status, color:ygAvailCat(r.status).color, member:r.member, iso:iso, span:true});
    });
  }
  /* Merge consecutive same-title span days into ranges */
  out.sort(function(a,b){ return a.day-b.day; });
  var merged=[], i=0;
  while(i<out.length){
    var cur=out[i], end=cur.day, j=i+1;
    if(cur.span){
      while(j<out.length && out[j].span && out[j].cat===cur.cat && out[j].member===(cur.member) && out[j].day===end+1){
        end=out[j].day; j++;
      }
    }
    merged.push({
      day:cur.day, end:end, title:cur.title, cat:cur.cat, color:cur.color,
      member:cur.member, wk:cur.wk, iso:cur.iso,
      label:(end>cur.day?(cur.day+'–'+end):(String(cur.day)))+' — '+cur.title
    });
    i=j;
  }
  /* Prefer annual-promoted / company events; cap list */
  return merged.filter(function(e,idx,arr){
    /* dedupe overlapping TR spans of same member */
    return true;
  }).slice(0,6);
}

function ygMonthlyHTML(byAct, byAvail){
  var cards='';
  for(var m=0;m<12;m++){
    var focus=ygFocusFor(m);
    var events=ygKeyEventsForMonth(m, byAct, byAvail);
    var evHtml=events.length
      ? events.map(function(e){
          return '<div class="yg-mev"><i style="background:'+e.color+'"></i><button type="button" class="yg-mev-l" data-ygiso="'+esc(e.iso)+'">'+esc(e.label)+'</button></div>';
        }).join('')
      : '<div class="yg-mempty">No key events planned</div>';
    cards+='<div class="yg-mcard" data-ygm="'+m+'">'
      +'<div class="yg-mh"><span>'+YG_MONTHS[m].toUpperCase()+'</span>'
      +(ygCanAdmin()?'<button type="button" class="yg-medit" data-ygfocus="'+m+'" title="Edit monthly focus">✎</button>':'')
      +'</div>'
      +'<div class="yg-mflab">Monthly focus</div>'
      +(focus&&focus.title
        ? '<div class="yg-mfocus">'+esc(focus.title)+'</div>'+(focus.notes?('<div class="yg-mnotes">'+esc(focus.notes)+'</div>'):'')
        : (ygCanAdmin()
          ? '<button type="button" class="yg-mset" data-ygfocus="'+m+'">+ Set monthly focus</button>'
          : '<div class="yg-mempty">Set monthly focus</div>'))
      +'<div class="yg-mdiv"></div>'
      +'<div class="yg-mevs">'+evHtml+'</div>'
      +'<button type="button" class="yg-madd" data-ygaddev="'+m+'">+ Event</button>'
      +'</div>';
  }
  return '<section class="yg-monthly">'
    +'<div class="yg-monthly-h"><b>Monthly Focus &amp; Events</b><span>'+YG.year+'</span></div>'
    +'<div class="yg-monthly-grid">'+cards+'</div></section>';
}

function ygPanelHTML(iso, byAct, byAvail){
  if(!iso) return '';
  var dt=ygParseISO(iso);
  var title=dt.toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric', year:'numeric'});
  var wk=null; try{ if(global.dateToWk) wk=global.dateToWk(dt); }catch(e){}
  var rows=byAvail[iso]||[];
  var acts=byAct[iso]||[];
  var body='';
  if(rows.length){
    body+=rows.map(function(r){
      var cat=ygAvailCat(r.status);
      var m=r.member||{};
      return '<div class="yg-pline"><span class="yg-pcat" style="background:'+cat.color+'">'+esc(cat.abbr)+'</span>'
        +'<div class="yg-pmain"><div class="yg-pt">'+esc(m.name||'Team')+(m.role?(' · '+esc(m.role)):'')+'</div>'
        +'<div class="yg-ps">'+esc(cat.label)+(r.geo?(' · '+esc(r.geo)):'')+(r.tentative?' · Tentative':'')+'</div></div></div>';
    }).join('');
  }
  if(acts.length){
    body+=acts.slice(0,8).map(function(e){
      return '<div class="yg-pline"><span class="yg-pcat" style="background:#6b7280">•</span>'
        +'<div class="yg-pmain"><div class="yg-pt">'+esc(e.title)+'</div>'
        +'<div class="yg-ps">'+(e.member?esc(e.member.name):esc(e.terr||''))+(e.time?(' · '+(global.t12s?global.t12s(e.time):e.time)):'')+'</div></div></div>';
    }).join('');
  }
  if(!body) body='<div class="yg-empty">Not yet planned.</div>';
  return '<div class="yg-panel" id="ygPanel">'
    +'<div class="yg-ph"><div><b>'+esc(title)+'</b></div><button type="button" class="kbb" id="ygPanelClose">×</button></div>'
    +'<div class="yg-pb">'+body+'</div>'
    +'<div class="yg-pf">'
    +'<button type="button" class="kbb" id="ygPlanDay">+ Event</button>'
    +(wk!=null?('<button type="button" class="kbb primary" id="ygOpenWeek" data-wk="'+wk+'">Open Weekly Planner</button>'):'')
    +'<button type="button" class="kbb" id="ygPanelClose2">Close</button>'
    +'</div></div>';
}

function ygRender(){
  var host=document.getElementById('yearView'); if(!host) return;
  YG.teamMenuOpen=false;
  var byAct={}, byAvail={};
  try{ byAct=ygBuildActivities()||{}; }catch(e){ byAct={}; }
  try{ byAvail=ygBuildAvailability(byAct)||{}; }catch(e){ byAvail={}; }
  var cols=ygColsForYear(YG.year);
  var months='';
  for(var m=0;m<12;m++) months+=ygMonthRowHTML(m, byAvail, cols);
  host.innerHTML='<div class="yg-wrap'+(YG.keyOpen?'':' yg-key-collapsed')+'">'
    +ygToolbarHTML()
    +'<div class="yg-main">'
    +'<div class="yg-board">'+ygHeadHTML(cols)+months+'</div>'
    +ygKeyHTML()
    +'</div>'
    +ygMonthlyHTML(byAct, byAvail)
    +(YG.panelDate?ygPanelHTML(YG.panelDate, byAct, byAvail):'')
    +'</div>';
  host.classList.add('is-on');
  host.style.display='block';
  ygWire(host, byAct, byAvail);
  try{ if(global.tripsDocBarRender) global.tripsDocBarRender(); }catch(e){}
}

function ygOpenWeekly(wk){
  try{ sessionStorage.setItem('aqYgReturn', JSON.stringify({
    year:YG.year, role:YG.role, membersAll:YG.membersAll, memberIds:YG.memberIds, at:Date.now()
  })); }catch(e){}
  global.PLAN_MODE='weekly';
  var terr=ygTerr();
  global.terr=terr;
  document.querySelectorAll('.tab').forEach(function(x){ x.classList.toggle('active', x.dataset.t===terr); });
  if(!YG.membersAll){
    try{
      global.TEAM_ALL=false; global.TEAM_IDS=Object.assign({}, YG.memberIds);
      if(global.teamSaveSel) global.teamSaveSel();
    }catch(e){}
  } else {
    try{ global.TEAM_ALL=true; global.TEAM_IDS={}; if(global.teamSaveSel) global.teamSaveSel(); }catch(e){}
  }
  if(typeof global.focusWkSet==='function') global.focusWkSet(wk);
  else { global.FOCUS_WK=wk; global.ALL_WK=wk; }
  if(typeof global.render==='function') global.render();
}

function ygWire(host, byAct, byAvail){
  var prev=host.querySelector('#ygPrevYear'); if(prev) prev.onclick=function(){ YG.year--; ygRender(); };
  var next=host.querySelector('#ygNextYear'); if(next) next.onclick=function(){ YG.year++; ygRender(); };
  var ty=host.querySelector('#ygThisYear'); if(ty) ty.onclick=function(){ YG.year=new Date().getFullYear(); ygRender(); };
  var tb=host.querySelector('#ygTeamBtn');
  if(tb) tb.onclick=function(e){
    e.stopPropagation();
    YG.teamMenuOpen=!YG.teamMenuOpen;
    var wrap=host.querySelector('.yg-toolbar');
    if(wrap){
      var right=wrap.querySelector('.yg-tb-right');
      if(right){
        var menu=host.querySelector('#ygTeamMenu');
        if(YG.teamMenuOpen && !menu){
          tb.insertAdjacentHTML('afterend', ygTeamMenuHTML());
          ygWireTeamMenu(host);
        } else if(!YG.teamMenuOpen && menu) menu.remove();
      }
    }
  };
  ygWireTeamMenu(host);
  host.querySelectorAll('[data-ygcat]').forEach(function(b){
    b.onclick=function(){ var id=b.dataset.ygcat; YG.cats[id]=!(YG.cats[id]!==false); ygRender(); };
  });
  var kc=host.querySelector('#ygKeyClose');
  if(kc) kc.onclick=function(){ YG.keyOpen=false; try{ localStorage.setItem('aqYgKeyOpen','0'); }catch(e){} ygRender(); };
  var ko=host.querySelector('#ygKeyOpen');
  if(ko) ko.onclick=function(){ YG.keyOpen=true; try{ localStorage.setItem('aqYgKeyOpen','1'); }catch(e){} ygRender(); };
  host.querySelectorAll('[data-ygday]').forEach(function(b){
    b.onclick=function(e){
      var iso=b.dataset.ygday;
      if(e.shiftKey && YG.rangeStart){
        ygOpenEventModal(YG.rangeStart, iso);
        YG.rangeStart=null;
        return;
      }
      YG.panelDate=iso;
      YG.rangeStart=iso;
      ygRender();
    };
  });
  var pc=host.querySelector('#ygPanelClose'); if(pc) pc.onclick=function(){ YG.panelDate=null; ygRender(); };
  var pc2=host.querySelector('#ygPanelClose2'); if(pc2) pc2.onclick=function(){ YG.panelDate=null; ygRender(); };
  var planDay=host.querySelector('#ygPlanDay'); if(planDay) planDay.onclick=function(){ ygOpenEventModal(YG.panelDate, YG.panelDate); };
  var ow=host.querySelector('#ygOpenWeek');
  if(ow) ow.onclick=function(){ ygOpenWeekly(parseInt(ow.dataset.wk,10)); };
  var add=host.querySelector('#ygAddEvent'); if(add) add.onclick=function(){ ygOpenEventModal(YG.panelDate, YG.panelDate); };
  var mc=host.querySelector('#ygManageCats'); if(mc) mc.onclick=function(){ ygOpenManageCats(); };
  host.querySelectorAll('[data-ygfocus]').forEach(function(b){
    b.onclick=function(){ ygEditFocus(parseInt(b.dataset.ygfocus,10)); };
  });
  host.querySelectorAll('[data-ygaddev]').forEach(function(b){
    b.onclick=function(){
      var m=parseInt(b.dataset.ygaddev,10);
      ygOpenEventModal(ygISO(ygDate(YG.year,m,1)), ygISO(ygDate(YG.year,m,1)));
    };
  });
  host.querySelectorAll('[data-ygiso]').forEach(function(b){
    b.onclick=function(){ YG.panelDate=b.dataset.ygiso; ygRender(); };
  });
  document.addEventListener('click', function hideMenu(ev){
    if(!host.contains(ev.target)) return;
    var menu=host.querySelector('#ygTeamMenu');
    if(menu && !ev.target.closest('#ygTeamBtn') && !ev.target.closest('#ygTeamMenu')){
      YG.teamMenuOpen=false; menu.remove();
    }
  }, {once:true});
}

function ygSyncTeamToWeekly(){
  try{
    if(YG.membersAll){ global.TEAM_ALL=true; global.TEAM_IDS={}; }
    else { global.TEAM_ALL=false; global.TEAM_IDS=Object.assign({}, YG.memberIds); }
    if(global.teamSaveSel) global.teamSaveSel();
  }catch(e){}
}
function ygWireTeamMenu(host){
  var menu=host.querySelector('#ygTeamMenu'); if(!menu) return;
  menu.querySelectorAll('[data-ygrole]').forEach(function(b){
    b.onclick=function(e){ e.stopPropagation(); YG.role=b.dataset.ygrole||''; ygRender(); };
  });
  menu.querySelectorAll('[data-ygall]').forEach(function(b){
    b.onclick=function(e){
      e.stopPropagation();
      if(ygIsAll()){ YG.membersAll=false; YG.memberIds={}; }
      else { YG.membersAll=true; YG.memberIds={}; }
      ygSyncTeamToWeekly();
      ygRender();
    };
  });
  menu.querySelectorAll('[data-ygmem]').forEach(function(b){
    b.onclick=function(e){
      e.stopPropagation();
      var id=b.dataset.ygmem;
      var roster=ygTeamRoster();
      if(YG.membersAll){
        YG.membersAll=false; YG.memberIds={};
        roster.forEach(function(m){ if(m.id!==id) YG.memberIds[m.id]=true; });
      } else if(YG.memberIds[id]){
        delete YG.memberIds[id];
      } else {
        YG.memberIds[id]=true;
        if(roster.length && roster.every(function(m){ return YG.memberIds[m.id]; })){
          YG.membersAll=true; YG.memberIds={};
        }
      }
      ygSyncTeamToWeekly();
      ygRender();
    };
  });
}

function ygOpenEventModal(startIso, endIso){
  var wrap=document.createElement('div'); wrap.className='modalbg';
  var cats=ygAvailCats().filter(function(c){ return c.id!=='NP' && c.id!=='OF'; });
  var catOpts=cats.map(function(c){ return '<option value="'+c.id+'">'+esc(c.label)+'</option>'; }).join('');
  wrap.innerHTML='<div class="modalbox" style="width:min(460px,94vw)"><div class="mh"><div class="mt">Add event</div><button class="mclose" id="ygex">×</button></div>'
    +'<div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;font-size:13px">'
    +'<input id="yge_title" class="msearch" placeholder="Event name" autofocus>'
    +'<div style="display:flex;gap:8px"><input id="yge_start" type="date" class="msearch" style="flex:1" value="'+esc(startIso||'')+'">'
    +'<input id="yge_end" type="date" class="msearch" style="flex:1" value="'+esc(endIso||startIso||'')+'"></div>'
    +'<select id="yge_cat" class="msearch">'+catOpts+'</select>'
    +'<label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="yge_annual" checked> Include in Annual Overview</label>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="yge_cancel">Cancel</button>'
    +'<button class="btn" id="yge_save" style="background:var(--aq-red);color:#fff;border:0">Save</button></div>'
    +'</div></div>';
  document.body.appendChild(wrap);
  var close=function(){ wrap.remove(); };
  wrap.querySelector('#ygex').onclick=close;
  wrap.querySelector('#yge_cancel').onclick=close;
  wrap.addEventListener('click',function(e){ if(e.target===wrap) close(); });
  wrap.querySelector('#yge_save').onclick=function(){
    var title=wrap.querySelector('#yge_title').value.trim();
    var start=wrap.querySelector('#yge_start').value;
    if(!title||!start){ alert('Title and start date required'); return; }
    var end=wrap.querySelector('#yge_end').value||start;
    var cat=wrap.querySelector('#yge_cat').value;
    var team=ygTeam();
    YG_EVENTS.push({
      id:'yg'+Date.now(), title:title, start:start, end:end, cat:cat, avail:cat,
      terr:ygTerr()==='All'?'':ygTerr(),
      memberIds:team.length===1?[team[0].id]:[],
      annual:wrap.querySelector('#yge_annual').checked, allDay:true
    });
    ygPersistPlan();
    YG.panelDate=start;
    close(); ygRender();
  };
}

function ygEditFocus(month){
  var sk=ygFocusScopeKey();
  var cur=YG_FOCUS[ygFocusKey(month, sk)]||{};
  var wrap=document.createElement('div'); wrap.className='modalbg';
  wrap.innerHTML='<div class="modalbox" style="width:min(440px,94vw)"><div class="mh"><div class="mt">'+YG_MONTHS[month]+' focus</div><button class="mclose" id="ygfx">×</button></div>'
    +'<div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;font-size:13px">'
    +'<input id="ygf_title" class="msearch" placeholder="Monthly focus" value="'+esc(cur.title||'')+'">'
    +'<textarea id="ygf_notes" class="msearch" rows="3" placeholder="Optional supporting notes">'+esc(cur.notes||'')+'</textarea>'
    +'<div style="font-size:11px;color:#6b7280">Scope: '+esc(sk==='company'?'Entire sales team':(sk.indexOf('t:')===0?sk.slice(2):(ygTeam()[0]?ygTeam()[0].name:'Member')))+'</div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="ygf_cancel">Cancel</button>'
    +'<button class="btn" id="ygf_save" style="background:var(--aq-red);color:#fff;border:0">Save</button></div>'
    +'</div></div>';
  document.body.appendChild(wrap);
  var close=function(){ wrap.remove(); };
  wrap.querySelector('#ygfx').onclick=close;
  wrap.querySelector('#ygf_cancel').onclick=close;
  wrap.addEventListener('click',function(e){ if(e.target===wrap) close(); });
  wrap.querySelector('#ygf_save').onclick=function(){
    var title=wrap.querySelector('#ygf_title').value.trim();
    var notes=wrap.querySelector('#ygf_notes').value.trim();
    var key=ygFocusKey(month, sk);
    if(!title){ delete YG_FOCUS[key]; }
    else YG_FOCUS[key]={title:title, notes:notes, scope:sk, updated:Date.now()};
    ygPersistPlan();
    close(); ygRender();
  };
}

function ygOpenManageCats(){
  if(!ygCanAdmin()) return;
  var wrap=document.createElement('div'); wrap.className='modalbg';
  function rows(){
    return ygAvailCats().map(function(c){
      return '<tr data-id="'+esc(c.id)+'">'
        +'<td><input class="msearch yg-mc-abbr" value="'+esc(c.abbr)+'" maxlength="4"></td>'
        +'<td><input class="msearch yg-mc-label" value="'+esc(c.label)+'"></td>'
        +'<td><input type="color" class="yg-mc-color" value="'+esc(c.color)+'"></td>'
        +'<td style="font-size:11px;color:#6b7280">'+(c.system?'System':'Custom')+'</td>'
        +'<td>'+(c.system?'':('<button type="button" class="kbb yg-mc-del" data-del="'+esc(c.id)+'">Archive</button>'))+'</td></tr>';
    }).join('');
  }
  wrap.innerHTML='<div class="modalbox" style="width:min(560px,96vw)"><div class="mh"><div class="mt">Manage categories</div><button class="mclose" id="ygmcx">×</button></div>'
    +'<div style="padding:12px 16px;font-size:13px">'
    +'<table class="yg-mctable"><thead><tr><th>Abbr</th><th>Name</th><th>Colour</th><th></th><th></th></tr></thead><tbody id="ygmcBody">'+rows()+'</tbody></table>'
    +'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'
    +'<input id="ygmc_new_abbr" class="msearch" placeholder="Abbr" style="width:64px" maxlength="4">'
    +'<input id="ygmc_new_label" class="msearch" placeholder="New category" style="flex:1">'
    +'<input id="ygmc_new_color" type="color" value="#64748b">'
    +'<button type="button" class="kbb" id="ygmcAdd">Add</button>'
    +'<span style="flex:1"></span>'
    +'<button type="button" class="kbb" id="ygmcCancel">Close</button>'
    +'<button type="button" class="kbb primary" id="ygmcSave">Save</button></div></div></div>';
  document.body.appendChild(wrap);
  var close=function(){ wrap.remove(); };
  wrap.querySelector('#ygmcx').onclick=close;
  wrap.querySelector('#ygmcCancel').onclick=close;
  wrap.addEventListener('click',function(e){ if(e.target===wrap) close(); });
  function wireDel(){
    wrap.querySelectorAll('.yg-mc-del').forEach(function(b){
      b.onclick=function(){
        YG_CAT_CUSTOM=YG_CAT_CUSTOM.map(function(c){ return c.id===b.dataset.del?Object.assign({},c,{archived:true}):c; });
        wrap.querySelector('#ygmcBody').innerHTML=rows(); wireDel();
      };
    });
  }
  wireDel();
  wrap.querySelector('#ygmcAdd').onclick=function(){
    var abbr=wrap.querySelector('#ygmc_new_abbr').value.trim().toUpperCase();
    var label=wrap.querySelector('#ygmc_new_label').value.trim();
    var color=wrap.querySelector('#ygmc_new_color').value;
    if(!abbr||!label){ alert('Abbreviation and name required'); return; }
    if(ygAvailCats().some(function(c){ return c.abbr===abbr||c.id===abbr; })){ alert('Abbreviation already in use'); return; }
    YG_CAT_CUSTOM.push({id:abbr, abbr:abbr, label:label, color:color, text:'#fff', class:'away'});
    YG.cats[abbr]=true;
    wrap.querySelector('#ygmcBody').innerHTML=rows(); wireDel();
  };
  wrap.querySelector('#ygmcSave').onclick=function(){
    wrap.querySelectorAll('#ygmcBody tr').forEach(function(tr){
      var id=tr.dataset.id;
      var abbr=tr.querySelector('.yg-mc-abbr').value.trim().toUpperCase();
      var label=tr.querySelector('.yg-mc-label').value.trim();
      var color=tr.querySelector('.yg-mc-color').value;
      var existing=null; YG_CAT_CUSTOM.forEach(function(c){ if(c.id===id) existing=c; });
      var base=YG_AVAIL_DEFAULTS.filter(function(c){ return c.id===id; })[0];
      if(base){
        if(!existing) YG_CAT_CUSTOM.push({id:id, abbr:abbr, label:label, color:color, text:base.text, system:true});
        else { existing.abbr=abbr; existing.label=label; existing.color=color; }
      } else if(existing){ existing.abbr=abbr; existing.label=label; existing.color=color; }
    });
    ygPersistPlan(); close(); ygRender();
  };
}

/* Exports used by Trip Documents footer when Year mode is active */
function ygExportPdf(){
  var byAct=ygBuildActivities(), byAvail=ygBuildAvailability(byAct);
  var cols=ygColsForYear(YG.year);
  var w=window.open('','_blank'); if(!w){ alert('Allow pop-ups'); return; }
  var monthsHtml=ygHeadHTML(cols);
  for(var m=0;m<12;m++) monthsHtml+=ygMonthRowHTML(m, byAvail, cols);
  var focusHtml='';
  for(var i=0;i<12;i++){
    var f=ygFocusFor(i);
    var ev=ygKeyEventsForMonth(i, byAct, byAvail);
    focusHtml+='<div style="break-inside:avoid;margin:0 0 8px;padding:6px;border:1px solid #e5e7eb">'
      +'<b>'+YG_MONTHS[i]+'</b><div style="font-size:10px;color:#6b7280">Monthly focus</div>'
      +'<div>'+(f&&f.title?esc(f.title):'—')+'</div>'
      +'<ul style="margin:4px 0 0;padding-left:14px;font-size:10px">'
      +(ev.length?ev.map(function(e){return '<li>'+esc(e.label)+'</li>';}).join(''):'<li>No key events planned</li>')
      +'</ul></div>';
  }
  w.document.write('<html><head><title>Arrowquip Year '+YG.year+'</title><style>'
    +'body{font-family:Arial,sans-serif;font-size:8px;margin:8px;color:#111}'
    +'h1{font-size:14px;margin:0 0 8px}.yg-month,.yg-head{display:grid;grid-template-columns:36px repeat('+cols+',minmax(10px,1fr));gap:1px}'
    +'.yg-cell{border:1px solid #e5e7eb;min-height:14px;background:#fff}.yg-cell.we{background:#f3f4f6}'
    +'.yg-cell.na{border:0;background:transparent}.yg-bar{display:block;height:4px;margin-top:2px}'
    +'.yg-d{font-size:6px}.yg-mlbl{font-weight:700}@page{size:landscape;margin:6mm}</style></head><body>'
    +'<h1>ARROWQUIP TRAVEL — Year at a Glance '+YG.year+(ygTerr()!=='All'?' · '+esc(ygTerr()):'')+'</h1>'
    +monthsHtml+'<h2 style="font-size:12px;margin:12px 0 6px">Monthly Focus &amp; Events</h2>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'+focusHtml+'</div>'
    +'<div style="margin-top:8px;color:#666">Generated '+new Date().toLocaleString()+'</div>'
    +'<script>setTimeout(function(){window.print();},300)<\\/script></body></html>');
  w.document.close();
}
function ygExportExcel(){
  var byAct=ygBuildActivities(), byAvail=ygBuildAvailability(byAct);
  var lines=['Sheet,Month,Day,Status,Person,Focus,Event'];
  Object.keys(byAvail).sort().forEach(function(iso){
    (byAvail[iso]||[]).forEach(function(r){
      lines.push(['Calendar',iso.slice(5,7),iso.slice(8),r.status,(r.member?r.member.name:''),'',''].join(','));
    });
  });
  for(var m=0;m<12;m++){
    var f=ygFocusFor(m);
    lines.push(['Focus',YG_MONTHS[m],'', '', '', (f&&f.title?('"'+f.title.replace(/"/g,'""')+'"'):''),''].join(','));
    ygKeyEventsForMonth(m, byAct, byAvail).forEach(function(e){
      lines.push(['Events',YG_MONTHS[m],e.day,e.cat,(e.member?e.member.name:''),'','"'+String(e.label).replace(/"/g,'""')+'"'].join(','));
    });
  }
  var blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='Arrowquip_Year_'+YG.year+'_'+ygTerr()+'.csv';
  a.click(); URL.revokeObjectURL(a.href);
  if(global.aqToast) global.aqToast('Year overview CSV downloaded');
}

function ygShow(show){
  var yv=document.getElementById('yearView');
  var ys=document.getElementById('yearShell');
  document.querySelectorAll('[data-planmode]').forEach(function(b){
    b.classList.toggle('on', b.dataset.planmode===(show?'year':'weekly'));
  });
  if(!yv) return;
  if(show){
    if(ys){ ys.classList.add('is-on'); ys.style.display='flex'; }
    yv.classList.add('is-on'); yv.style.display='block';
    var pv=document.getElementById('plannerView'); if(pv) pv.style.display='none';
    var av=document.getElementById('allView'); if(av) av.style.display='none';
    var cards=document.getElementById('cards'); if(cards) cards.style.display='none';
    try{
      var raw=sessionStorage.getItem('aqYgReturn');
      if(raw){
        var o=JSON.parse(raw);
        if(o&&o.at&&(Date.now()-o.at)<3600000){
          if(o.year) YG.year=o.year;
          if(o.role!=null) YG.role=o.role;
          if(o.membersAll!=null) YG.membersAll=!!o.membersAll;
          if(o.memberIds) YG.memberIds=o.memberIds;
        }
        sessionStorage.removeItem('aqYgReturn');
      }
    }catch(e){}
    /* Align team filter with Weekly Planner selection when entering YAG */
    try{
      if(typeof global.TEAM_ALL==='boolean'){
        if(global.TEAM_ALL){ YG.membersAll=true; YG.memberIds={}; }
        else { YG.membersAll=false; YG.memberIds=Object.assign({}, global.TEAM_IDS||{}); }
      }
    }catch(e){}
    ygRender();
  } else {
    if(ys){ ys.classList.remove('is-on'); ys.style.display='none'; }
    yv.classList.remove('is-on'); yv.style.display='none';
  }
}

global.YG=YG;
global.YG_EVENTS=YG_EVENTS;
global.YG_NOTES=YG_NOTES;
global.YG_AVAIL=YG_AVAIL;
global.YG_CAT_CUSTOM=YG_CAT_CUSTOM;
global.YG_FOCUS=YG_FOCUS;
global.ygRender=ygRender;
global.ygShow=ygShow;
global.ygExportPdf=ygExportPdf;
global.ygExportExcel=ygExportExcel;
global.ygBuildActivities=ygBuildActivities;
global.ygBuildAvailability=ygBuildAvailability;
global.ygBuildIndex=ygBuildActivities;
global.ygSetEvents=function(v){ YG_EVENTS=v||[]; global.YG_EVENTS=YG_EVENTS; };
global.ygSetNotes=function(v){ YG_NOTES=v||{}; global.YG_NOTES=YG_NOTES; };
global.ygSetAvail=function(v){ YG_AVAIL=v||{}; global.YG_AVAIL=YG_AVAIL; };
global.ygSetCats=function(v){ YG_CAT_CUSTOM=v||[]; global.YG_CAT_CUSTOM=YG_CAT_CUSTOM; };
global.ygSetFocus=function(v){ YG_FOCUS=v||{}; global.YG_FOCUS=YG_FOCUS; };

})(window);
