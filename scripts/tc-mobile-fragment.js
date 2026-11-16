
/* ========== Trip Command Centre (mobile UX overhaul) ==========
   PWA Trip Mode shell — desktop DOM untouched. Data from itineraryFor /
   ASSIGN / LOGI / APPT / VISIT. Demo (?tripDemo=1 or fieldOpsDemo=1) uses fixture. */
var TRIP_DEMO=(function(){
  try{
    var q=new URLSearchParams(location.search);
    return q.get('tripDemo')==='1' || q.get('fieldOpsDemo')==='1' || (typeof FIELD_OPS_DEMO!=='undefined'&&FIELD_OPS_DEMO);
  }catch(e){ return false; }
})();

function tcTripMeta(){
  if(TRIP_DEMO){
    return { name:'Midwest Dealer Circuit', region:'Wisconsin · Illinois', dates:wkDY(MOB.wk), weekLabel:'Week '+wkNo(MOB.wk) };
  }
  return {
    name:(MOB.terr==='All'?'North America':MOB.terr)+' Trip',
    region: MOB.terr==='All'?'All territories':MOB.terr,
    dates: wkDY(MOB.wk),
    weekLabel:'Week '+wkNo(MOB.wk)
  };
}

function tcDemoItems(wk){
  var today=mobToday(wk); if(today==null) today=0;
  var labs=dayLabels(wk)||[];
  function dayOf(offset){ return Math.max(0, Math.min(Math.max(labs.length-1,0), today+offset)); }
  var d0=dayOf(0), d1=dayOf(1), dm=dayOf(-1), d2=dayOf(2);
  return [
    {kind:'travel', id:'demo-fly-in', key:'m:demo-fly-in', type:'flight_in', name:'YYZ → MKE', address:'Milwaukee Mitchell (MKE)',
      lat:42.9472, lon:-87.8966, day:dm, time:'08:40', located:true, airline:'Air Canada', flightNo:'AC8891', conf:'AC-DEMO',
      raw:{done:true, type:'flight_in', airline:'Air Canada', flightNo:'AC8891', conf:'AC-DEMO'}},
    {kind:'travel', id:'demo-rental', key:'m:demo-rental', type:'rental', name:'Enterprise — Midsize SUV', address:'MKE Airport rental desk',
      lat:42.9472, lon:-87.8966, day:dm, time:'10:15', located:true,
      raw:{done:false, type:'rental', conf:'ENT-78421', notes:'Due back Friday 16:00 MKE'}},
    {kind:'travel', id:'demo-hotel', key:'m:demo-hotel', type:'hotel', name:'Hilton Garden Inn Madison', address:'210 S Pinckney St, Madison, WI',
      lat:43.0747, lon:-89.3842, day:dm, time:'15:00', located:true,
      raw:{done:false, type:'hotel', conf:'HGI-55201', notes:'Tonight · late checkout Friday'}},
    {kind:'dealer', id:'demo-riverside', key:'d:demo-riverside', type:'dealer', name:'Riverside Equipment Co.',
      address:'1840 Industrial Pkwy, Springfield, WI', lat:43.1, lon:-89.2, day:d0, time:'10:00', located:true, status:'Pending'},
    {kind:'dealer', id:'demo-heartland', key:'d:demo-heartland', type:'dealer', name:'Heartland Livestock Supply',
      address:'920 Highway 14, Janesville, WI', lat:42.68, lon:-89.02, day:d0, time:'14:00', located:true, status:'Pending'},
    {kind:'dealer', id:'demo-prairie', key:'d:demo-prairie', type:'dealer', name:'Prairie Gate Dealers',
      address:'415 Commerce Dr, Rockford, IL', lat:42.27, lon:-89.09, day:d1, time:'09:30', located:true, status:'Pending'},
    {kind:'dealer', id:'demo-northstar', key:'d:demo-northstar', type:'dealer', name:'Northstar Ag Systems',
      address:'77 Farm Tech Rd, Beloit, WI', lat:42.51, lon:-89.03, day:d1, time:'13:30', located:true, status:'Pending'},
    {kind:'travel', id:'demo-hotel-2', key:'m:demo-hotel-2', type:'hotel', name:'Courtyard Rockford', address:'7100 Walton St, Rockford, IL',
      lat:42.27, lon:-89.0, day:d1, time:'18:00', located:true, raw:{type:'hotel', conf:'CY-99102'}},
    {kind:'travel', id:'demo-fly-out', key:'m:demo-fly-out', type:'flight_out', name:'MKE → YYZ', address:'Milwaukee Mitchell (MKE)',
      lat:42.9472, lon:-87.8966, day:d2, time:'17:25', located:true, airline:'Air Canada', flightNo:'AC8892', conf:'AC-DEMO-R',
      raw:{type:'flight_out', airline:'Air Canada', flightNo:'AC8892', conf:'AC-DEMO-R'}}
  ];
}

function tcIsDone(i){
  if(!i) return false;
  if(i.kind==='dealer'||i.kind==='xvisit'){
    if(TRIP_DEMO && String(i.id).indexOf('demo-')===0){
      try{ var s=JSON.parse(localStorage.getItem('aqTripDemoAppt')||'{}'); return !!s[i.id]; }catch(e){ return false; }
    }
    return !!APPT[i.id];
  }
  return !!(i.raw && i.raw.done);
}

function tcSetDone(id, done){
  if(TRIP_DEMO && String(id).indexOf('demo-')===0){
    try{ var s=JSON.parse(localStorage.getItem('aqTripDemoAppt')||'{}'); if(done) s[id]=true; else delete s[id]; localStorage.setItem('aqTripDemoAppt', JSON.stringify(s)); }catch(e){}
    return;
  }
  if(done){
    APPT[id]=true;
    var v=visitOf(id); v.completedAt=new Date().toISOString(); v.outcomeStatus='completed'; visitSave(); savePlan();
  } else {
    delete APPT[id];
    var v0=visitOf(id); delete v0.completedAt; delete v0.outcomeStatus; visitSave(); savePlan();
  }
}

function tcItems(wk){
  wk=wk!=null?wk:MOB.wk;
  if(TRIP_DEMO) return tcDemoItems(wk);
  return itineraryFor(MOB.terr, wk);
}

function tcDealers(items){ return (items||[]).filter(function(i){ return i.kind==='dealer'||i.kind==='xvisit'; }); }

function tcDayCity(items, day){
  var dayItems=(items||[]).filter(function(i){ return i.day===day; });
  var cities=[];
  dayItems.forEach(function(i){
    var loc='';
    if(i.kind==='dealer'){ var d=uniById(i.id); loc=(d&&d.loc)||''; }
    if(!loc && i.address){ var parts=String(i.address).split(','); loc=(parts[parts.length-2]||parts[parts.length-1]||'').trim(); }
    if(!loc && i.name) loc=i.name;
    if(loc) cities.push(loc.replace(/\s+/g,' ').trim());
  });
  if(!cities.length) return 'Open day';
  var counts={};
  cities.forEach(function(c){ counts[c]=(counts[c]||0)+1; });
  return Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; })[0];
}

function tcTonightHotel(items, day){
  var hotels=(items||[]).filter(function(i){ return i.kind==='travel' && normType(i.type)==='hotel'; });
  var onDay=hotels.filter(function(h){ return h.day===day; });
  if(onDay.length) return onDay[onDay.length-1];
  var prior=hotels.filter(function(i){ return i.day!=null && i.day<=day; }).sort(function(a,b){ return a.day-b.day; });
  return prior.length?prior[prior.length-1]:null;
}

function tcNextFlight(items, day){
  var flights=(items||[]).filter(function(i){
    return i.kind==='travel' && (String(i.type).indexOf('flight')===0 || normType(i.type)==='airport');
  }).filter(function(i){ return i.day!=null && i.day>=day; })
    .sort(function(a,b){ return (a.day-b.day)||String(a.time||'').localeCompare(String(b.time||'')); });
  return flights[0]||null;
}

function tcRental(items){
  return (items||[]).filter(function(i){ return i.kind==='travel' && normType(i.type)==='rental'; })[0]||null;
}

function tcLeaveHint(next, items, wk){
  if(!next) return {leave:'', drive:''};
  if(TRIP_DEMO && next.id==='demo-riverside') return {leave:'Leave by 9:15 AM', drive:'45 min · 32 km'};
  try{
    var TL=tlCompute(MOB.terr,wk), by=TL.by||{};
    var key=(next.kind==='dealer'?'d:':'m:')+next.id;
    if(!by[key] && next.key) key=next.key;
    var node=by[key];
    if(node){
      var leave='', drive='';
      var idx=TL.seq.indexOf(node);
      if(idx>0 && TL.seq[idx-1].tnext){
        leave='Leave by '+tlT(node.estArr-(TL.seq[idx-1].tnext.min||0));
        drive=fmtDur(TL.seq[idx-1].tnext.min||0)+' · ~'+Math.round(TL.seq[idx-1].tnext.km||0)+' km';
      }
      return {leave:leave, drive:drive};
    }
  }catch(e){}
  return {leave:'', drive:''};
}

function tcTaskRows(){
  if(TRIP_DEMO){
    try{ var demo=JSON.parse(localStorage.getItem('aqTripDemoTasks')||'null'); if(demo&&demo.length) return demo; }catch(e){}
    return [
      {id:'demo-riverside', i:0, t:'Send crowder lead-time clarification', due:'Friday', done:false, name:'Riverside Equipment Co.', group:'thisweek'},
      {id:'demo-riverside', i:1, t:'Share spring Q-Catch proposal (draft)', due:'Next week', done:false, name:'Riverside Equipment Co.', group:'upcoming'},
      {id:'demo-heartland', i:0, t:'Confirm aged units to feature', due:'Today', done:false, name:'Heartland Livestock Supply', group:'today'}
    ];
  }
  var rows=[];
  Object.keys(VISIT||{}).forEach(function(id){
    var v=VISIT[id]||{}, d=uniById(id);
    (v.actions||[]).forEach(function(a,i){
      rows.push({id:id, i:i, t:a.t, due:a.due||'', done:!!a.done, name:(d&&d.name)||id});
    });
  });
  return rows;
}

function tcTaskGroup(r){
  if(r.group) return r.group;
  var due=String(r.due||'').toLowerCase();
  if(r.done) return 'done';
  if(/overdue|yesterday|ago/.test(due)) return 'overdue';
  if(/^today$|today/.test(due)) return 'today';
  if(/friday|this week|week/.test(due)) return 'thisweek';
  return 'upcoming';
}

function tcTopBar(){
  var meta=tcTripMeta();
  return '<div class="tc-top">'
    +'<div class="brand"><img src="/assets/aq-logo-red-white-horizontal.png" alt="Arrowquip"><span class="chip">TRAVEL</span></div>'
    +'<div class="tc-title">'+esc(meta.name)+'</div>'
    +'<div class="tc-sub">'+esc(meta.region)+' · '+esc(meta.dates)+'</div>'
    +'<div class="tc-weekctl">'
      +'<button class="tmbtn" data-mobwk="-1" aria-label="Previous week">‹</button>'
      +'<div class="meta">'+esc(meta.weekLabel)+'</div>'
      +'<button class="tmbtn this" data-mobwk="0">This Week</button>'
      +'<button class="tmbtn" data-mobwk="1" aria-label="Next week">›</button>'
    +'</div>'
    +(TRIP_DEMO?'<div style="margin-top:8px;font-size:11px;color:#fca5a5">Preview demo — live plan not modified</div>':'')
  +'</div>';
}

function tcNavHtml(active){
  var tab=function(id,icon,label){
    return '<button data-mobtab="'+id+'" class="'+(active===id?'on':'')+'"><span class="ni">'+icon+'</span>'+label+'</button>';
  };
  return '<div class="tm-nav">'
    +tab('trip',tmIcon('map'),'Trip')
    +tab('day',tmIcon('home'),'Day')
    +tab('tasks',tmIcon('clipboard'),'Tasks')
  +'</div>';
}

function tcNextCard(next, wk, items){
  if(!next) return '<div class="tm-empty" style="padding:16px">No outstanding appointments this day.</div>';
  var hint=tcLeaveHint(next, items, wk);
  var call='';
  if(next.kind==='dealer'){
    if(TRIP_DEMO && String(next.id).indexOf('demo-')===0) call='555-0142';
    else { var d=uniById(next.id)||{}; var sf=(typeof sfLookup==='function'?sfLookup(d):null)||{}; call=sf.contactMobile||sf.contactPhone||d.phone||''; }
  }
  var obj='';
  if(TRIP_DEMO && next.id==='demo-riverside') obj='Review spring order opportunities and inventory.';
  else if(next.kind==='dealer' && VISIT[next.id]) obj=VISIT[next.id].objective||VISIT[next.id].notes||'';
  if(obj && obj.length>110) obj=obj.slice(0,109)+'…';
  return '<div class="tc-next">'
    +'<div class="k">Next</div>'
    +'<div class="nm">'+esc(next.name||'Appointment')+'</div>'
    +'<div class="meta">'+(next.time?t12s(next.time):'Time TBD')+(next.address?('<br>'+esc(next.address)):'')+'</div>'
    +(obj?('<div class="meta" style="margin-top:6px">'+esc(obj)+'</div>'):'')
    +((hint.leave||hint.drive)?('<div class="leave">'+esc([hint.drive,hint.leave].filter(Boolean).join(' · '))+'</div>'):'')
    +'<div class="acts">'
      +(mobHasDest(next)?('<a class="tmbtn nav" href="'+navUrl(next)+'" target="_blank" rel="noopener">Navigate</a>'):'<button class="tmbtn" disabled>Navigate</button>')
      +(call?('<a class="tmbtn" href="tel:'+esc(call)+'">Call</a>'):'<button class="tmbtn" disabled>Call</button>')
      +'<button class="tmbtn" data-mobvisit="'+next.id+'">Open</button>'
    +'</div></div>';
}

function mobTrip_render(){
  var wk=MOB.wk, items=tcItems(wk), dealers=tcDealers(items);
  var doneN=dealers.filter(tcIsDone).length;
  var openTasks=tcTaskRows().filter(function(r){return !r.done;}).length;
  var today=mobToday(wk);
  var dayFocus=(today!=null)?today:0;
  var todays=items.filter(function(i){return i.day===dayFocus;}).sort(function(a,b){return String(a.time||'99').localeCompare(String(b.time||'99'));});
  var next=tcDealers(todays).filter(function(i){return !tcIsDone(i);})[0];
  var hotel=tcTonightHotel(items, dayFocus);
  var flight=tcNextFlight(items, dayFocus);
  var rental=tcRental(items);
  var labs=dayLabels(wk)||[];
  var pct=dealers.length?Math.round(doneN/dealers.length*100):0;
  var h='<div class="tm-screen">';
  h+='<div class="tc-stats">'
    +'<div class="tc-stat"><b>'+dealers.length+'</b><span>Scheduled</span></div>'
    +'<div class="tc-stat"><b>'+doneN+'</b><span>Completed</span></div>'
    +'<div class="tc-stat"><b>'+openTasks+'</b><span>Tasks</span></div>'
    +'<div class="tc-stat"><b>'+pct+'%</b><span>Progress</span></div></div>';
  h+='<div class="tc-ctx">';
  if(hotel) h+='<div class="row"><span>Tonight</span><b>'+esc(hotel.name)+'</b></div>';
  if(flight) h+='<div class="row"><span>Next flight</span><b>'+esc(flight.name)+(flight.time?(' · '+t12s(flight.time)):'')+'</b></div>';
  if(rental) h+='<div class="row"><span>Rental</span><b>'+esc(rental.name)+'</b></div>';
  if(!hotel && !flight && !rental) h+='<div class="row"><span>Travel</span><b>No flights, hotel or rental on file</b></div>';
  h+='</div>';
  h+=tcNextCard(next, wk, items);
  h+='<div class="tc-mapbox"><div class="teaser" id="tcMapToggle"><b>Trip route</b><span>'+(MOB.mapOpen?'Collapse':'Expand map')+'</span></div>'
    +'<div id="tcMap" class="'+(MOB.mapOpen?'open':'')+'"></div></div>';
  h+='<div class="tm-h"><span>Week itinerary</span></div>';
  for(var d=0;d<labs.length;d++){
    var dayItems=items.filter(function(i){return i.day===d;});
    var dDeal=tcDealers(dayItems);
    var dDone=dDeal.filter(tcIsDone).length;
    var overnight=tcTonightHotel(items,d);
    var travelBits=[];
    dayItems.filter(function(i){return i.kind==='travel';}).slice(0,2).forEach(function(t){ travelBits.push(mobKind(t)); });
    h+='<button type="button" class="tc-dayrow'+(today===d?' today':'')+'" data-tcday="'+d+'">'
      +'<div class="dow"><b>'+esc(labs[d][0])+'</b><span>'+esc(labs[d][1])+'</span></div>'
      +'<div class="body"><b>'+esc(tcDayCity(items,d))+'</b><span>'
        +(dDeal.length?(dDeal.length+' appointment'+(dDeal.length===1?'':'s')):'No appointments')
        +(travelBits.length?(' · '+esc(travelBits.join(' · '))):'')
        +(overnight?(' · Stay: '+esc(overnight.name)):'')
      +'</span></div>'
      +'<div class="prog">'+(dDeal.length?(dDone+'/'+dDeal.length):'—')+'</div></button>';
  }
  h+='</div>';
  return h;
}

function mobToday_render(){
  var wk=MOB.wk, items=tcItems(wk), labs=dayLabels(wk)||[];
  var today=mobToday(wk);
  if(MOB.day==null) MOB.day=(today!=null?today:0);
  var day=MOB.day;
  var dayItems=items.filter(function(i){return i.day===day;}).sort(function(a,b){return String(a.time||'99').localeCompare(String(b.time||'99'));});
  var dealers=tcDealers(dayItems);
  var doneN=dealers.filter(tcIsDone).length;
  var next=dealers.filter(function(i){return !tcIsDone(i);})[0];
  var h='<div class="tm-screen"><div class="tc-daysel">';
  for(var d=0;d<labs.length;d++){
    var ds=(labs[d][1]||''); var short=ds.replace(/^[A-Za-z]+\s*/,'');
    h+='<button type="button" data-tcday="'+d+'" class="'+(day===d?'on':'')+(today===d?' today':'')+'"><b>'+esc(labs[d][0])+'</b><span>'+esc(short)+'</span></button>';
  }
  h+='</div>';
  h+='<div class="fo-progress"><div><div class="fo-n">'+dealers.length+'</div><div class="fo-l">today</div></div>'
    +'<div class="fo-bar"><i class="done" style="width:'+(dealers.length?doneN/dealers.length*100:0)+'%"></i><i class="left" style="width:'+(dealers.length?(100-doneN/dealers.length*100):100)+'%"></i></div>'
    +'<div style="font-size:11px;color:#6b7280;text-align:right"><b style="color:#16a34a">'+doneN+' done</b><br><b style="color:#cc152f">'+(dealers.length-doneN)+' left</b></div></div>';
  h+=tcNextCard(next, wk, items);
  if(!dayItems.length){
    h+='<div class="tm-empty">Nothing scheduled for this day.<br>Use + Add.</div>';
  } else {
    h+='<div class="tm-tl">';
    var locatedPrev=null;
    dayItems.forEach(function(i){
      var isNext=next && i.id===next.id && (i.kind==='dealer'||i.kind==='xvisit');
      if(locatedPrev && i.located && !sameSpot(locatedPrev,i)){
        var fly=(String(locatedPrev.type).indexOf('flight')===0 && String(i.type).indexOf('flight')===0);
        var mi=roadMi([locatedPrev.lat,locatedPrev.lon],[i.lat,i.lon])||0;
        h+='<div class="legrow">'+(fly?'✈ Flight':'→ Drive')+' · ~'+Math.round(mi*1.60934)+' km · ~'+fmtDur(mi/55*60)+'</div>';
      }
      if(i.located) locatedPrev=i;
      h+=mobTLItem(i, wk, isNext);
    });
    h+='</div>';
  }
  h+='<button class="tm-primary" id="mobAdd">+ Add</button></div>';
  return h;
}

function mobTasks_render(){
  var rows=tcTaskRows();
  var groups=[['overdue','Overdue'],['today','Today'],['thisweek','This week'],['upcoming','Upcoming']];
  var h='<div class="tm-screen"><div class="tm-h" style="margin-top:4px"><span>My tasks</span></div>';
  if(TRIP_DEMO) h+='<div class="fo-banner">Demo tasks for preview. Completing them stays on this device.</div>';
  var any=false;
  groups.forEach(function(g){
    var list=rows.filter(function(r){return !r.done && tcTaskGroup(r)===g[0];});
    if(!list.length) return;
    any=true;
    h+='<div class="tc-taskg">'+g[1]+' · '+list.length+'</div>';
    list.forEach(function(r){
      h+='<div class="tmrow"><button class="tmbtn icon" data-tasktog="'+r.id+':'+r.i+'" title="Complete">✓</button>'
        +'<div class="t"><b>'+esc(r.t)+'</b><span>'+esc(r.name)+(r.due?(' · '+esc(r.due)):'')+'</span></div>'
        +'<button class="tmbtn" data-mobvisit="'+r.id+'">Open</button></div>';
    });
  });
  var done=rows.filter(function(r){return r.done;});
  if(done.length){
    h+='<div class="tc-taskg">Completed · '+done.length+'</div>';
    done.slice(0,12).forEach(function(r){
      h+='<div class="tmrow tc-muted"><button class="tmbtn icon done" data-tasktog="'+r.id+':'+r.i+'">✓</button>'
        +'<div class="t"><b>'+esc(r.t)+'</b><span>'+esc(r.name)+'</span></div></div>';
    });
  }
  if(!any && !done.length) h+='<div class="tm-empty">No follow-up tasks yet. They appear after you approve a visit report.</div>';
  h+='</div>';
  return h;
}

function tcQuickCompleteSheet(id){
  var name=(TRIP_DEMO && String(id).indexOf('demo-')===0)?((tcItems().filter(function(i){return i.id===id;})[0]||{}).name):((uniById(id)||{}).name||'Appointment');
  var w=document.createElement('div'); w.className='tc-quick'; w.id='tcQuick';
  w.innerHTML='<div class="sheet"><h3>Appointment complete</h3><p>'+esc(name)+' · recorded just now. Optional next steps — or keep travelling.</p>'
    +'<button class="tm-opt" data-tcq="photos"><span class="oi" style="background:#0f766e">'+tmIcon('camera',16)+'</span>Photos</button>'
    +'<button class="tm-opt" data-tcq="plaud"><span class="oi" style="background:#0ea5e9">'+tmIcon('msg',16)+'</span>PLAUD / meeting intelligence</button>'
    +'<button class="tm-opt" data-tcq="note"><span class="oi" style="background:#4338ca">'+tmIcon('clipboard',16)+'</span>Quick note</button>'
    +'<button class="tm-primary fo-red" data-tcq="continue" style="margin-top:8px">Continue travelling</button>'
    +'<button class="tmbtn" data-tcq="undo" style="width:100%;margin-top:8px">Undo completion</button></div>';
  document.body.appendChild(w);
  w.addEventListener('click',function(e){ if(e.target===w) w.remove(); });
  w.querySelectorAll('[data-tcq]').forEach(function(b){
    b.onclick=function(){
      var k=b.dataset.tcq;
      if(k==='undo'){ tcSetDone(id,false); w.remove(); renderMobile(); return; }
      if(k==='continue'){ w.remove(); MOB.stack=[]; MOB.tab='day'; renderMobile(); return; }
      w.remove();
      if(k==='photos'){ mobPush({type:'dphotos', id:id}); return; }
      if(k==='plaud'){ foOpenComplete(id); return; }
      if(k==='note'){
        var note=prompt('Quick note for this visit:');
        if(note && !(TRIP_DEMO && String(id).indexOf('demo-')===0)){
          var v=visitOf(id); v.notes=((v.notes||'')+(v.notes?'\n':'')+note); visitSave(); savePlan();
        }
        renderMobile();
      }
    };
  });
}

function tcCompleteOneTap(id){
  if(tcIsDone({kind:'dealer',id:id})){
    if(!confirm('Reopen this appointment?')) return;
    tcSetDone(id,false); renderMobile(); return;
  }
  tcSetDone(id,true);
  renderMobile();
  tcQuickCompleteSheet(id);
}

function tcDrawMap(){
  var el=document.getElementById('tcMap'); if(!el||typeof L==='undefined') return;
  if(!MOB.mapOpen) return;
  if(MOB.map){ try{MOB.map.remove();}catch(e){} MOB.map=null; }
  var items=tcItems(MOB.wk);
  var dayFilter=MOB.mapDay;
  var pts=items.filter(function(i){ return i.located && (dayFilter==null || i.day===dayFilter); });
  MOB.map=L.map(el,{zoomControl:true,scrollWheelZoom:false,attributionControl:false}).setView([43.5,-89],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(MOB.map);
  pts.forEach(function(i,n){
    var ic=mobIcon(i);
    var mk=L.marker([i.lat,i.lon],{icon:L.divIcon({className:'',html:'<div class="pin" style="background:'+ic.c+';width:18px;height:18px;font-size:9px">'+(n+1)+'</div>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(MOB.map);
    mk.on('click',function(){
      if(i.kind==='dealer'||i.kind==='xvisit') mobPush({type:'dealer',id:i.id});
      else if(String(i.id).indexOf('demo-')===0){ /* demo stop detail via dealer-like open */ mobPush({type:'dealer',id:i.id}); }
      else mobPush({type:'stop',id:i.id});
    });
  });
  if(pts.length) MOB.map.fitBounds(L.latLngBounds(pts.map(function(i){return [i.lat,i.lon];})).pad(0.3));
  setTimeout(function(){ if(MOB.map) MOB.map.invalidateSize(); },60);
}
