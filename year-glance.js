/* Arrowquip TRAVEL — Year at a Glance
   Compact annual calendar matrix (months × days 1–31). Always renders every
   month and every date for the selected year — empty years are valid planning
   surfaces. Depends on globals from index.html (ASSIGN, DAY, LOGI, teamList…). */
(function(global){
'use strict';

var YG_CATS = [
  {id:'DV', label:'Dealer visits', color:'#2563eb'},
  {id:'SV', label:'Supplier visits', color:'#0d9488'},
  {id:'TS', label:'Trade shows', color:'#c2410c'},
  {id:'TR', label:'Business travel', color:'#7c3aed'},
  {id:'LM', label:'Leadership meetings', color:'#b45309'},
  {id:'BM', label:'Board meetings', color:'#1f2937'},
  {id:'QM', label:'Quarterly meetings', color:'#0369a1'},
  {id:'AP', label:'Annual planning', color:'#be185d'},
  {id:'DE', label:'Annual dealer events', color:'#15803d'},
  {id:'WM', label:'Weekly meetings', color:'#64748b'},
  {id:'HO', label:'Holidays / shutdowns', color:'#dc2626'},
  {id:'PT', label:'Personal / unavailable', color:'#9ca3af'},
  {id:'AU', label:'Australia office', color:'#0891b2'},
  {id:'OT', label:'Other', color:'#6b7280'}
];

var YG = {
  year: new Date().getFullYear(),
  terr: 'All',
  role: '',
  memberIds: {},
  membersAll: true,
  cats: {},
  panelDate: null,
  focusOpen: false
};
YG_CATS.forEach(function(c){ YG.cats[c.id]=true; });

var YG_EVENTS = global.YG_EVENTS || [];
var YG_NOTES = global.YG_NOTES || {};

function esc(s){ return (global.esc?global.esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];})); }
function catOf(id){ for(var i=0;i<YG_CATS.length;i++) if(YG_CATS[i].id===id) return YG_CATS[i]; return YG_CATS[YG_CATS.length-1]; }

function ygIsLeap(y){ return (y%4===0 && y%100!==0) || (y%400===0); }
function ygDaysInMonth(y,m){ return [31, ygIsLeap(y)?29:28,31,30,31,30,31,31,30,31,30,31][m]; }
function ygDate(y,m,d){ return new Date(y,m,d,12,0,0,0); }
function ygISO(dt){ return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function ygParseISO(s){ var p=String(s||'').split('-'); return new Date(+p[0],(+p[1]||1)-1,+p[2]||1,12); }
function ygISOWeek(dt){
  var t=new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  var dayNum=t.getUTCDay()||7;
  t.setUTCDate(t.getUTCDate()+4-dayNum);
  var yearStart=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  return Math.ceil((((t-yearStart)/86400000)+1)/7);
}

function ygMemberSelected(m){
  if(!m) return YG.membersAll;
  if(YG.terr!=='All' && m.terr!==YG.terr) return false;
  if(YG.role && m.role!==YG.role) return false;
  if(YG.membersAll) return true;
  return !!YG.memberIds[m.id];
}
function ygTeam(){
  var list=(global.teamList?global.teamList(null,false):[])||[];
  return list.filter(ygMemberSelected);
}
function ygTravellerForDealer(t,d){
  if(global.allTravellerForDealer) return global.allTravellerForDealer(t,d);
  if(global.teamOwnerOf && global.teamById){
    var oid=global.teamOwnerOf('d', d.id); if(oid){ var m=global.teamById(oid); if(m) return m; }
  }
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

function ygFromWkDay(wk, day){
  if(typeof wk!=='number' || day==null || day==='' || !global.wkStart) return null;
  var s=global.wkStart(wk);
  var d=new Date(s.getTime() + (+day)*86400000);
  d.setHours(12,0,0,0);
  return d;
}

function ygPush(bucket, iso, ev){
  if(!iso) return;
  if(YG.cats[ev.cat]===false) return;
  (bucket[iso]=bucket[iso]||[]).push(ev);
}

function ygBuildIndex(){
  var byDay={};
  var y=YG.year;
  var ASSIGN=global.ASSIGN||{}, DAY=global.DAY||{}, TIME=global.TIME||{}, APPT=global.APPT||{};
  var LOGI=global.LOGI||[], XVISITS=global.XVISITS||[];
  var TERRS=global.TERRS||['East','South','Central','West','Exports'];
  var dealersIn=global.dealersIn, byId=global.byId, uniById=global.uniById;
  var travelType=global.travelType, xvType=global.xvType;

  function inYear(dt){ return dt && dt.getFullYear()===y; }
  function memberOk(m){
    if(YG.membersAll && YG.terr==='All' && !YG.role) return true;
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
        ygPush(byDay, ygISO(dt), {
          cat:'DV', kind:'dealer', title:d.name, terr:t, member:m,
          conf:!!APPT[d.id], time:TIME[d.id]||'', place:d.address||d.loc||'',
          dealerId:d.id, wk:wk
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
      var cat='DV';
      var lab=String(ty.label||'').toLowerCase();
      if(lab.indexOf('trade')>=0) cat='TS';
      else if(lab.indexOf('supplier')>=0) cat='SV';
      ygPush(byDay, ygISO(dt), {
        cat:cat, kind:'xvisit', title:(function(){
          var d=(byId&&byId[x.dealer])||(uniById&&uniById(x.dealer));
          return (d&&d.name?d.name+' — ':'')+ty.label;
        })(), terr:x.terr, member:m, conf:!!x.done, time:x.time||'', place:'', wk:x.wk, xv:x
      });
    });

    LOGI.forEach(function(it){
      if(YG.terr!=='All' && it.terr!==YG.terr) return;
      if(typeof it.wk!=='number') return;
      var m=ygTravellerForLogi(it);
      if(!memberOk(m)) return;
      var ty=travelType?travelType(it):it.type;
      var cat='TR';
      if(String(it.type||'').indexOf('tradeshow')>=0 || String(it.name||'').toLowerCase().indexOf('trade')>=0) cat='TS';
      var startDay=it.day==null?0:it.day;
      var endDay=(it.day2!=null?it.day2:startDay);
      if(endDay<startDay) endDay=startDay;
      for(var di=startDay; di<=endDay; di++){
        var dt=ygFromWkDay(it.wk, di);
        if(!inYear(dt)) continue;
        ygPush(byDay, ygISO(dt), {
          cat:cat, kind:'travel', title:it.name||ty, terr:it.terr, member:m,
          conf:!!String(it.conf||'').trim(), time:it.time||'', place:it.address||it.airportCode||'',
          wk:it.wk, logi:it, type:ty
        });
      }
    });

    (YG_EVENTS||[]).forEach(function(ev){
      if(!ev||!ev.start) return;
      if(YG.cats[ev.cat]===false) return;
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
        ygPush(byDay, ygISO(t), {
          cat:ev.cat||'OT', kind:'event', title:ev.title||'Event', terr:ev.terr||'All',
          member:null, conf:true, time:'', place:ev.place||'', event:ev,
          reserves:!!ev.reserves
        });
      }
    });
  }catch(err){
    try{ console.warn('[YG] build index', err); }catch(e){}
  }

  return byDay;
}

function ygAggregate(list){
  var byCat={}, out=[];
  (list||[]).forEach(function(e){
    var c=e.cat||'OT';
    if(!byCat[c]) byCat[c]={cat:c, count:0, items:[]};
    byCat[c].count++; byCat[c].items.push(e);
  });
  Object.keys(byCat).forEach(function(k){ out.push(byCat[k]); });
  out.sort(function(a,b){ return b.count-a.count; });
  return out;
}

function ygYearOptions(){
  var now=new Date().getFullYear();
  var years=[], y;
  for(y=now-2; y<=now+5; y++) years.push(y);
  if(years.indexOf(YG.year)<0) years.push(YG.year);
  years.sort(function(a,b){ return a-b; });
  return years;
}

function ygToolbarHTML(){
  var years=ygYearOptions();
  var terrOpts=['All'].concat(global.TERRS||[]).map(function(t){
    return '<option value="'+esc(t)+'"'+(YG.terr===t?' selected':'')+'>'+esc(t==='All'?'All territories':t)+'</option>';
  }).join('');
  var roleOpts='<option value="">All roles</option>'
    +['AM','DSR','ISS'].map(function(r){ return '<option value="'+r+'"'+(YG.role===r?' selected':'')+'>'+r+'</option>'; }).join('');
  var members=(global.teamList?global.teamList(YG.terr==='All'?null:YG.terr,false):[])||[];
  if(YG.role) members=members.filter(function(m){ return m.role===YG.role; });
  var memOpts='<option value="__all__"'+(YG.membersAll?' selected':'')+'>All team members</option>'
    +members.map(function(m){
      return '<option value="'+esc(m.id)+'"'+(!YG.membersAll&&YG.memberIds[m.id]?' selected':'')+'>'+esc(m.name)+' · '+esc(m.role)+'</option>';
    }).join('');
  var catChips=YG_CATS.map(function(c){
    return '<button type="button" class="yg-chip'+(YG.cats[c.id]!==false?' on':'')+'" data-ygcat="'+c.id+'" title="'+esc(c.label)+'" style="--yg:'+c.color+'">'+c.id+'</button>';
  }).join('');
  return '<div class="yg-toolbar">'
    +'<button type="button" class="kbb icon" id="ygPrevYear" title="Previous year">‹</button>'
    +'<select id="ygYear" class="msearch">'+years.map(function(y){return '<option value="'+y+'"'+(y===YG.year?' selected':'')+'>'+y+'</option>';}).join('')+'</select>'
    +'<button type="button" class="kbb icon" id="ygNextYear" title="Next year">›</button>'
    +'<select id="ygTerr" class="msearch">'+terrOpts+'</select>'
    +'<select id="ygRole" class="msearch">'+roleOpts+'</select>'
    +'<select id="ygMember" class="msearch yg-mem" multiple size="3" title="Ctrl/Cmd-click to select multiple">'+memOpts+'</select>'
    +'<button type="button" class="kbb'+(YG.year===new Date().getFullYear()?' primary':'')+'" id="ygThisYear">This Year</button>'
    +'<span class="kb-space"></span>'
    +'<button type="button" class="kbb" id="ygAddEvent">+ Event</button>'
    +'<button type="button" class="kbb" id="ygExportPdf">Export PDF</button>'
    +'<button type="button" class="kbb" id="ygExportXlsx">Export Excel</button>'
    +'</div>'
    +'<div class="yg-cats">'+catChips+'</div>';
}

function ygLegendHTML(){
  return '<div class="yg-legend">'+YG_CATS.map(function(c){
    return '<span class="yg-leg"><i style="background:'+c.color+'"></i>'+c.id+' · '+esc(c.label)+'</span>';
  }).join('')+'</div>';
}

function ygDayHeadHTML(){
  /* Day-number columns 1–31. Weekend shading is applied per cell from the
     real weekday of that month/day — the header stays neutral. */
  var cells='<div class="yg-corner">Month</div>';
  for(var d=1;d<=31;d++) cells+='<div class="yg-hd">'+d+'</div>';
  return '<div class="yg-head">'+cells+'</div>';
}

function ygMonthRowHTML(month, byDay){
  var y=YG.year;
  var dim=ygDaysInMonth(y, month);
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var today=new Date(); today.setHours(12,0,0,0);
  var cells='';
  for(var d=1;d<=31;d++){
    if(d>dim){
      cells+='<div class="yg-cell na" aria-hidden="true"></div>';
      continue;
    }
    var dt=ygDate(y,month,d);
    var iso=ygISO(dt);
    var wd=dt.getDay();
    var isWe=(wd===0||wd===6);
    var isToday=dt.getFullYear()===today.getFullYear()&&dt.getMonth()===today.getMonth()&&dt.getDate()===today.getDate();
    var list=byDay[iso]||[];
    var agg=ygAggregate(list);
    var bars='';
    if(agg.length){
      var show=agg.slice(0,3);
      bars=show.map(function(a){
        var c=catOf(a.cat);
        var label=a.count>1?(a.cat+' · '+a.count):a.cat;
        return '<span class="yg-bar" style="background:'+c.color+'" title="'+esc(c.label)+' × '+a.count+'">'+esc(label)+'</span>';
      }).join('');
      if(agg.length>3) bars+='<span class="yg-more">+'+ (agg.length-3) +'</span>';
    }
    var wkN=(wd===1)?('<span class="yg-wk" title="ISO week">W'+ygISOWeek(dt)+'</span>'):'';
    cells+='<button type="button" class="yg-cell'+(isWe?' we':'')+(isToday?' today':'')+(list.length?' has':'')+'" data-ygday="'+iso+'" title="'+esc(iso)+(list.length?(' · '+list.length+' item'+(list.length===1?'':'s')):' · click to plan')+'">'
      +'<span class="yg-d">'+d+'</span>'+wkN
      +'<span class="yg-bars">'+bars+'</span>'
      +'</button>';
  }
  return '<div class="yg-month" data-ygmonth="'+month+'">'
    +'<div class="yg-mlbl">'+months[month]+'</div>'
    +cells
    +'</div>';
}

function ygPanelHTML(iso, byDay){
  if(!iso) return '';
  var list=byDay[iso]||[];
  var dt=ygParseISO(iso);
  var title=dt.toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric', year:'numeric'});
  var wk=null;
  try{ if(global.dateToWk) wk=global.dateToWk(dt); }catch(e){}
  var body=list.length?list.map(function(e){
    var c=catOf(e.cat);
    var who=e.member?(e.member.name+(e.member.role?' · '+e.member.role:'')):(e.terr||'Company');
    return '<div class="yg-pline">'
      +'<span class="yg-pcat" style="background:'+c.color+'">'+c.id+'</span>'
      +'<div class="yg-pmain"><div class="yg-pt">'+esc(e.title)+'</div>'
      +'<div class="yg-ps">'+esc(who)+(e.time?(' · '+(global.t12s?global.t12s(e.time):e.time)):'')
      +(e.place?(' · '+esc(e.place)):'')
      +' · '+(e.conf?'Confirmed':'Planned')+'</div></div></div>';
  }).join(''):'<div class="yg-empty">No scheduled travel on this date. Empty does not mean verified available.</div>';
  return '<div class="yg-panel" id="ygPanel">'
    +'<div class="yg-ph"><div><b>'+esc(title)+'</b><div class="yg-psub">'+list.length+' item'+(list.length===1?'':'s')+'</div></div>'
    +'<button type="button" class="kbb" id="ygPanelClose">×</button></div>'
    +'<div class="yg-pb">'+body+'</div>'
    +'<div class="yg-pf">'
    +'<button type="button" class="kbb" id="ygPlanDay" data-day="'+esc(iso)+'">+ Plan event</button>'
    +(wk!=null?('<button type="button" class="kbb primary" id="ygOpenWeek" data-wk="'+wk+'">Open Week</button>'):'')
    +'<button type="button" class="kbb" id="ygPanelClose2">Close</button>'
    +'</div></div>';
}

function ygFocusHTML(){
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var rows=months.map(function(name,m){
    var key=YG.year+'-'+(m+1)+(YG.terr!=='All'?('|'+YG.terr):'');
    var note=(YG_NOTES&&YG_NOTES[key])||'';
    return '<div class="yg-fn"><label>'+name+'</label>'
      +'<textarea data-ygnote="'+esc(key)+'" rows="2" placeholder="Planning priorities…">'+esc(note)+'</textarea></div>';
  }).join('');
  return '<details class="yg-focus"'+(YG.focusOpen?' open':'')+' id="ygFocus">'
    +'<summary>Monthly Focus</summary>'
    +'<div class="yg-focus-body"><div class="yg-psub">Short strategic notes — company, territory or team. Not a project tracker.</div>'
    +rows+'</div></details>';
}

function ygRender(){
  var host=document.getElementById('yearView'); if(!host) return;
  var byDay={};
  try{ byDay=ygBuildIndex()||{}; }catch(e){ byDay={}; }
  var months='';
  for(var m=0;m<12;m++) months+=ygMonthRowHTML(m, byDay);
  host.innerHTML='<div class="yg-wrap">'
    +ygToolbarHTML()
    +ygLegendHTML()
    +'<div class="yg-board">'+ygDayHeadHTML()+months+'</div>'
    +ygFocusHTML()
    +(YG.panelDate?ygPanelHTML(YG.panelDate, byDay):'')
    +'</div>';
  host.classList.add('is-on');
  host.style.display='block';
  ygWire(host, byDay);
}

function ygWire(host, byDay){
  var ysel=host.querySelector('#ygYear'); if(ysel) ysel.onchange=function(){ YG.year=parseInt(ysel.value,10)||YG.year; ygRender(); };
  var prev=host.querySelector('#ygPrevYear'); if(prev) prev.onclick=function(){ YG.year=YG.year-1; ygRender(); };
  var next=host.querySelector('#ygNextYear'); if(next) next.onclick=function(){ YG.year=YG.year+1; ygRender(); };
  var tsel=host.querySelector('#ygTerr'); if(tsel) tsel.onchange=function(){ YG.terr=tsel.value; ygRender(); };
  var rsel=host.querySelector('#ygRole'); if(rsel) rsel.onchange=function(){ YG.role=rsel.value; ygRender(); };
  var msel=host.querySelector('#ygMember');
  if(msel) msel.onchange=function(){
    var opts=Array.prototype.slice.call(msel.selectedOptions||[]);
    var ids=opts.map(function(o){ return o.value; }).filter(Boolean);
    if(!ids.length || ids.indexOf('__all__')>=0){ YG.membersAll=true; YG.memberIds={}; }
    else {
      YG.membersAll=false; YG.memberIds={};
      ids.forEach(function(id){ if(id!=='__all__') YG.memberIds[id]=true; });
    }
    ygRender();
  };
  var ty=host.querySelector('#ygThisYear'); if(ty) ty.onclick=function(){ YG.year=new Date().getFullYear(); ygRender(); };
  host.querySelectorAll('[data-ygcat]').forEach(function(b){
    b.onclick=function(){ var id=b.dataset.ygcat; YG.cats[id]=!(YG.cats[id]!==false); ygRender(); };
  });
  host.querySelectorAll('[data-ygday]').forEach(function(b){
    b.onclick=function(){
      var iso=b.dataset.ygday;
      YG.panelDate=iso;
      var list=byDay[iso]||[];
      if(!list.length){
        /* Empty cell → begin planning immediately; calendar stays visible. */
        ygRender();
        ygOpenEventModal(iso);
        return;
      }
      ygRender();
    };
  });
  var pc=host.querySelector('#ygPanelClose'); if(pc) pc.onclick=function(){ YG.panelDate=null; ygRender(); };
  var pc2=host.querySelector('#ygPanelClose2'); if(pc2) pc2.onclick=function(){ YG.panelDate=null; ygRender(); };
  var planDay=host.querySelector('#ygPlanDay'); if(planDay) planDay.onclick=function(){ ygOpenEventModal(planDay.dataset.day||YG.panelDate); };
  var ow=host.querySelector('#ygOpenWeek');
  if(ow) ow.onclick=function(){
    var wk=parseInt(ow.dataset.wk,10);
    try{ sessionStorage.setItem('aqYgReturn', JSON.stringify({year:YG.year,terr:YG.terr,at:Date.now()})); }catch(e){}
    global.PLAN_MODE='weekly';
    if(YG.terr!=='All'){
      global.terr=YG.terr;
      document.querySelectorAll('.tab').forEach(function(x){ x.classList.toggle('active', x.dataset.t===YG.terr); });
    } else {
      global.terr='All';
      document.querySelectorAll('.tab').forEach(function(x){ x.classList.toggle('active', x.dataset.t==='All'); });
    }
    if(typeof global.focusWkSet==='function') global.focusWkSet(wk);
    else { global.FOCUS_WK=wk; global.ALL_WK=wk; }
    if(typeof global.render==='function') global.render();
  };
  host.querySelectorAll('[data-ygnote]').forEach(function(ta){
    ta.onchange=function(){
      YG_NOTES[ta.dataset.ygnote]=ta.value;
      global.YG_NOTES=YG_NOTES;
      try{ if(global.savePlan) global.savePlan(); }catch(e){}
    };
  });
  var foc=host.querySelector('#ygFocus');
  if(foc) foc.addEventListener('toggle', function(){ YG.focusOpen=foc.open; });
  var add=host.querySelector('#ygAddEvent'); if(add) add.onclick=function(){ ygOpenEventModal(YG.panelDate); };
  var ep=host.querySelector('#ygExportPdf'); if(ep) ep.onclick=function(){ ygExport('pdf'); };
  var ex=host.querySelector('#ygExportXlsx'); if(ex) ex.onclick=function(){ ygExport('xlsx'); };
}

function ygOpenEventModal(prefillIso){
  var wrap=document.createElement('div'); wrap.className='modalbg';
  var catOpts=YG_CATS.map(function(c){ return '<option value="'+c.id+'">'+c.id+' — '+esc(c.label)+'</option>'; }).join('');
  var terrOpts='<option value="">Entire company</option>'+(global.TERRS||[]).map(function(t){return '<option value="'+t+'"'+(YG.terr===t?' selected':'')+'>'+t+'</option>';}).join('');
  var startVal=prefillIso||'';
  wrap.innerHTML='<div class="modalbox" style="width:min(480px,94vw)"><div class="mh"><div class="mt">Add annual event</div><button class="mclose" id="ygex">×</button></div>'
    +'<div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;font-size:13px">'
    +'<input id="yge_title" class="msearch" placeholder="Event name" autofocus>'
    +'<div style="display:flex;gap:8px"><input id="yge_start" type="date" class="msearch" style="flex:1" value="'+esc(startVal)+'"><input id="yge_end" type="date" class="msearch" style="flex:1" value="'+esc(startVal)+'"></div>'
    +'<select id="yge_cat" class="msearch">'+catOpts+'</select>'
    +'<select id="yge_terr" class="msearch">'+terrOpts+'</select>'
    +'<label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="yge_res"> Reserves availability</label>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="yge_cancel">Cancel</button><button class="btn" id="yge_save" style="background:var(--aq-red);color:#fff;border:0">Save</button></div>'
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
    YG_EVENTS.push({
      id:'yg'+Date.now(), title:title, start:start, end:end,
      cat:wrap.querySelector('#yge_cat').value, terr:wrap.querySelector('#yge_terr').value||'',
      reserves:wrap.querySelector('#yge_res').checked
    });
    global.YG_EVENTS=YG_EVENTS;
    try{ if(global.savePlan) global.savePlan(); }catch(e){}
    YG.panelDate=start;
    close(); ygRender();
  };
  setTimeout(function(){ var t=wrap.querySelector('#yge_title'); if(t) t.focus(); }, 30);
}

function ygExport(kind){
  var byDay=ygBuildIndex();
  if(kind==='xlsx'){
    var lines=['Date,Category,Count,Titles,People'];
    Object.keys(byDay).sort().forEach(function(iso){
      var agg=ygAggregate(byDay[iso]);
      agg.forEach(function(a){
        var titles=a.items.map(function(i){ return i.title; }).join(' | ');
        var people=a.items.map(function(i){ return i.member?i.member.name:(i.terr||''); }).join(' | ');
        lines.push([iso,a.cat,a.count,'"'+titles.replace(/"/g,'""')+'"','"'+people.replace(/"/g,'""')+'"'].join(','));
      });
    });
    var blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='Arrowquip_Year_'+YG.year+'_'+(YG.terr||'All')+'.csv';
    a.click(); URL.revokeObjectURL(a.href);
    if(global.aqToast) global.aqToast('Excel-friendly CSV downloaded (preview). Branded .xlsx export pending IT review.');
    return;
  }
  var w=window.open('','_blank');
  if(!w){ alert('Allow pop-ups to export PDF'); return; }
  var monthsHtml=ygDayHeadHTML();
  for(var m=0;m<12;m++) monthsHtml+=ygMonthRowHTML(m, byDay);
  w.document.write('<html><head><title>Arrowquip Year '+YG.year+'</title>'
    +'<style>body{font-family:Arial,sans-serif;font-size:8px;color:#111;margin:10px}'
    +'h1{font-size:14px;margin:0 0 8px}.yg-month,.yg-head{display:grid;grid-template-columns:54px repeat(31,minmax(12px,1fr));gap:1px;margin:0 0 2px;page-break-inside:avoid}'
    +'.yg-mlbl{font-weight:700}.yg-cell{border:1px solid #e5e7eb;min-height:18px;padding:1px}.yg-cell.we,.yg-hd.we{background:#f9fafb}'
    +'.yg-cell.na{border:0;background:transparent}.yg-bar{display:block;font-size:5px;color:#fff;overflow:hidden;white-space:nowrap}'
    +'@page{size:landscape;margin:6mm}</style></head><body>'
    +'<h1>ARROWQUIP TRAVEL — Year at a Glance '+YG.year+(YG.terr!=='All'?' · '+YG.terr:'')+'</h1>'
    +ygLegendHTML()+monthsHtml
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
    ygRender();
  } else {
    yv.classList.remove('is-on');
    yv.style.display='none';
  }
}

global.YG=YG;
global.YG_CATS=YG_CATS;
global.YG_EVENTS=YG_EVENTS;
global.YG_NOTES=YG_NOTES;
global.ygRender=ygRender;
global.ygShow=ygShow;
global.ygBuildIndex=ygBuildIndex;
global.ygSetEvents=function(v){ YG_EVENTS=v||[]; global.YG_EVENTS=YG_EVENTS; };
global.ygSetNotes=function(v){ YG_NOTES=v||{}; global.YG_NOTES=YG_NOTES; };

})(window);
