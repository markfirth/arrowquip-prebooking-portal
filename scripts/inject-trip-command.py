#!/usr/bin/env python3
"""Inject Trip Command Centre mobile overhaul into index.html."""
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path("/workspace/index.html")
FRAG = Path("/workspace/scripts/tc-mobile-fragment.js")
text = ROOT.read_text(encoding="utf-8")
js = FRAG.read_text(encoding="utf-8")


def once(old, new, label):
    global text
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"FAIL {label}: count={n}\n---\n{old[:200]}")
    text = text.replace(old, new, 1)
    print("OK", label)


CSS = """
/* ---- Trip Command Centre overhaul (mobile only) ---- */
.tm-nav button.on{color:var(--aq-red,#cc152f);}
.tc-top{background:#000;color:#fff;padding:calc(var(--safe-t) + 10px) 14px 12px;position:sticky;top:0;z-index:50;}
.tc-top .brand{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.tc-top .brand img{height:20px;width:auto;}
.tc-top .chip{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;}
.tc-title{font-family:var(--font-heading);font-size:20px;font-weight:900;letter-spacing:.02em;margin:10px 0 2px;line-height:1.15;}
.tc-sub{font-size:12px;color:#9ca3af;}
.tc-weekctl{display:flex;gap:6px;margin-top:10px;align-items:center;}
.tc-weekctl .tmbtn{min-height:36px;padding:0 10px;font-size:12px;background:#111;border-color:#333;color:#fff;flex:0 0 auto;}
.tc-weekctl .tmbtn.this{background:var(--aq-red,#cc152f);border-color:var(--aq-red,#cc152f);flex:1 1 auto;}
.tc-weekctl .meta{flex:1;text-align:center;font-size:12px;color:#d1d5db;font-weight:700;}
.tc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0;}
.tc-stat{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px 6px;text-align:center;}
.tc-stat b{display:block;font-size:16px;font-weight:800;color:#111;line-height:1.1;}
.tc-stat span{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;}
.tc-ctx{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin:0 0 10px;font-size:12px;color:#4b5563;line-height:1.45;}
.tc-ctx b{color:#111;}
.tc-ctx .row{display:flex;justify-content:space-between;gap:8px;padding:3px 0;}
.tc-mapbox{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:0 0 12px;}
.tc-mapbox .teaser{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;min-height:44px;cursor:pointer;font-size:13px;font-weight:600;color:#111;}
.tc-mapbox .teaser span{color:#6b7280;font-weight:500;font-size:12px;}
#tcMap{height:0;transition:height .2s ease;}
#tcMap.open{height:220px;border-top:1px solid #e5e7eb;}
.tc-dayrow{display:flex;align-items:center;gap:10px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin-bottom:8px;text-align:left;font-family:inherit;cursor:pointer;min-height:64px;}
.tc-dayrow.today{border-color:#111;box-shadow:0 0 0 1px #111;}
.tc-dayrow .dow{width:44px;flex:0 0 auto;text-align:center;}
.tc-dayrow .dow b{display:block;font-size:15px;font-weight:800;color:#111;}
.tc-dayrow .dow span{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;}
.tc-dayrow .body{flex:1;min-width:0;}
.tc-dayrow .body b{display:block;font-size:14px;font-weight:700;color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tc-dayrow .body span{font-size:11px;color:#6b7280;}
.tc-dayrow .prog{width:52px;flex:0 0 auto;text-align:right;font-size:11px;font-weight:700;color:#374151;}
.tc-daysel{display:flex;gap:4px;overflow-x:auto;padding:2px 0 10px;-webkit-overflow-scrolling:touch;}
.tc-daysel button{flex:0 0 auto;min-width:46px;min-height:54px;border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:6px 4px;font-family:inherit;cursor:pointer;}
.tc-daysel button.on{background:#111;border-color:#111;color:#fff;}
.tc-daysel button.today:not(.on){border-color:var(--aq-red,#cc152f);}
.tc-daysel b{display:block;font-size:13px;font-weight:800;line-height:1.1;}
.tc-daysel span{font-size:9px;text-transform:uppercase;letter-spacing:.03em;opacity:.75;}
.tc-next{background:#111;color:#fff;border-radius:14px;padding:14px;margin:0 0 12px;}
.tc-next .k{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fca5a5;margin-bottom:6px;}
.tc-next .nm{font-size:18px;font-weight:800;margin:0 0 6px;}
.tc-next .meta{font-size:12px;color:#d1d5db;line-height:1.45;}
.tc-next .leave{margin-top:8px;font-size:12px;font-weight:700;color:#fca5a5;}
.tc-next .acts{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:8px;margin-top:12px;}
.tc-next .acts .tmbtn{min-height:44px;justify-content:center;}
.tc-next .acts .tmbtn.nav{background:var(--aq-red,#cc152f);border-color:var(--aq-red,#cc152f);}
.tc-exp{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin:0 0 8px;overflow:hidden;}
.tc-exp > summary{list-style:none;cursor:pointer;padding:12px 14px;font-size:13px;font-weight:700;color:#111;display:flex;justify-content:space-between;align-items:center;min-height:48px;}
.tc-exp > summary::-webkit-details-marker{display:none;}
.tc-exp > summary::after{content:"›";color:#9ca3af;font-size:18px;transform:rotate(90deg);}
.tc-exp[open] > summary::after{transform:rotate(-90deg);}
.tc-exp .pad{padding:0 14px 12px;font-size:13px;color:#4b5563;line-height:1.45;}
.tc-quick{position:fixed;inset:0;z-index:220;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;}
.tc-quick .sheet{width:100%;background:#fff;border-radius:16px 16px 0 0;padding:14px 14px calc(14px + var(--safe-b));}
.tc-quick h3{margin:0 0 6px;font-size:16px;font-weight:800;text-align:center;}
.tc-quick p{margin:0 0 12px;font-size:12px;color:#6b7280;text-align:center;}
.tc-taskg{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin:14px 4px 8px;}
.tc-muted{opacity:.55;}
.tm-primary{background:var(--aq-red,#cc152f);}
.tmbtn.nav{background:var(--aq-red,#cc152f);border-color:var(--aq-red,#cc152f);}
.tl-item.next .tl-body{border-color:var(--aq-red,#cc152f);box-shadow:0 0 0 1px var(--aq-red,#cc152f);}
.tl-next{background:var(--aq-red,#cc152f);}
"""

if "Trip Command Centre overhaul" not in text:
    once(
        ".fo-banner{font-size:11px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:8px 10px;margin:0 0 10px;line-height:1.35;}\n",
        ".fo-banner{font-size:11px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:8px 10px;margin:0 0 10px;line-height:1.35;}\n"
        + CSS,
        "tc css",
    )
else:
    print("SKIP css (already present)")

once(
    "return {terr:area, wk:32, tab:'today', day:null, routeView:'map', map:null};",
    "return {terr:area, wk:32, tab:'trip', day:null, routeView:'map', map:null, mapOpen:false, mapDay:null};",
    "MOB default trip tab",
)

marker = "/* ===== Field Ops visit completion workflow (Phase 2/3) ===== */"
if "Trip Command Centre (mobile UX overhaul)" not in text:
    if marker not in text:
        raise SystemExit("missing FO marker")
    text = text.replace(marker, js + "\n" + marker, 1)
    print("OK inserted TC JS")
else:
    print("SKIP JS insert (already present)")


def rename_second(fn):
    global text
    key = "function " + fn + "("
    idxs = []
    start = 0
    while True:
        i = text.find(key, start)
        if i < 0:
            break
        idxs.append(i)
        start = i + 1
    if len(idxs) < 2:
        raise SystemExit(f"expected 2 defs of {fn}, got {len(idxs)}")
    i = idxs[1]
    text = text[:i] + "function " + fn + "_legacy(" + text[i + len(key) :]
    print("OK renamed second", fn)


if "function mobTrip_render_legacy(" not in text:
    rename_second("mobTrip_render")
    rename_second("mobToday_render")
    rename_second("mobTasks_render")
else:
    print("SKIP rename legacy")

# Replace dealer page
m = re.search(
    r"function mobDealer_page\(id\)\{.*?\n/\* ---------- DEALER PHOTOS",
    text,
    flags=re.S,
)
if not m:
    raise SystemExit("dealer page not found")
if "data-tccomplete" not in m.group(0):
    new_dealer = r"""function mobDealer_page(id){
  var demoItem=null;
  if(TRIP_DEMO && String(id).indexOf('demo-')===0){
    demoItem=(tcItems().filter(function(i){return i.id===id;})[0])||null;
  }
  var d=demoItem?{id:id,name:demoItem.name,address:demoItem.address,loc:'WI',phone:'555-0142',lat:demoItem.lat,lon:demoItem.lon}:uniById(id);
  if(!d) return '<div class="tm-screen"><div class="tm-empty">Dealer not found.</div></div>';
  var v=(TRIP_DEMO && String(id).indexOf('demo-')===0)?{objective:'Review spring order opportunities and inventory.',notes:'',actions:[]}:visitOf(id);
  var wk=MOB.wk;
  var when=demoItem?(mobDayLabel(wk,demoItem.day)+(demoItem.time?(' · '+t12s(demoItem.time)):'')):((DAY[id]!=null?mobDayLabel(wk,DAY[id]):'No day set')+(TIME[id]?(' · '+t12s(TIME[id])):''));
  var done=tcIsDone({kind:'dealer',id:id});
  var sf=demoItem?{contactName:'John Peterson',contactMobile:'555-0142'}:(sfLookup(d)||{});
  var callNum=sf.contactMobile||sf.contactPhone||d.phone||'';
  var cName=sf.contactName||'';
  var meetUrl=(v&&v.meetingUrl)||'';
  var h='<div class="tm-screen">';
  h+='<div class="vd-head"><div class="vd-name">'+esc(d.name)+'</div>'
    +'<div class="vd-meta">'+esc(when)+' · '+(done?'Completed':'Planned')+'</div>'
    +(d.address?'<div class="vd-meta" style="margin-top:6px">'+esc(d.address)+'</div>':'')
  +'</div>';
  h+='<div class="vd-actions">'
    +(mobHasDest(d)?('<a class="tmbtn nav" href="'+navUrl(d)+'" target="_blank" rel="noopener">Navigate</a>'):'<button class="tmbtn" disabled>Navigate</button>')
    +(callNum?('<a class="tmbtn" href="tel:'+encodeURIComponent(callNum)+'">Call</a>'):'<button class="tmbtn" disabled>Call</button>')
    +(meetUrl?('<a class="tmbtn" href="'+esc(meetUrl)+'" target="_blank" rel="noopener">Join</a>'):'')
  +'</div>';
  h+='<button class="tm-primary fo-red" style="margin-top:10px" data-tccomplete="'+id+'">'+(done?'Reopen appointment':'Complete appointment')+'</button>';
  function exp(title, body){
    if(!body) return '';
    return '<details class="tc-exp"><summary>'+title+'</summary><div class="pad">'+body+'</div></details>';
  }
  h+=exp('Objective', esc(v.objective||v.followUp||'No objective recorded'));
  h+=exp('Contact', esc([cName,callNum].filter(Boolean).join(' · ')||'No contact on file'));
  h+=exp('Meeting preparation', esc(v.prep||v.brief||'No prep brief yet'));
  h+=exp('Dealer information', esc([d.id?('Dealer '+d.id):'', d.loc||''].filter(Boolean).join(' · ')||'—'));
  var commits=(v.actions||[]).map(function(a){return '• '+a.t+(a.due?(' ('+a.due+')'):'');}).join('<br>');
  h+=exp('Previous commitments', commits||'None');
  h+=exp('Notes', esc(v.notes||'No notes'));
  h+='<details class="tc-exp"><summary>Photographs</summary><div class="pad"><button class="tmbtn" style="width:100%" data-dphotos="'+id+'">Open photos</button></div></details>';
  h+='<details class="tc-exp"><summary>PLAUD &amp; meeting intelligence</summary><div class="pad">'
    +'<button class="tmbtn" style="width:100%;margin-bottom:8px" data-focomplete="'+id+'">Open intelligence workflow</button>'
    +'<button class="tmbtn" style="width:100%" data-attachrec="'+id+'">Attach recording</button></div></details>';
  h+='</div>';
  return h;
}
/* ---------- DEALER PHOTOS"""
    text = text[: m.start()] + new_dealer + text[m.end() :]
    print("OK dealer page")
else:
    print("SKIP dealer page")

# Replace renderMobile
m2 = re.search(r"function renderMobile\(\)\{.*?\nfunction wireMobile\(\)\{", text, flags=re.S)
if not m2:
    raise SystemExit("renderMobile not found")
if "tcNavHtml" not in m2.group(0):
    new_render = """function renderMobile(){
  var host=document.getElementById('tripmode'); if(!host) return;
  if(MOB.tab==='today') MOB.tab='day';
  if(MOB.tab==='route'||MOB.tab==='files'||MOB.tab==='more'||MOB.tab==='budget') MOB.tab='trip';
  if(MOB.stack && MOB.stack.length){
    var p=MOB.stack[MOB.stack.length-1], meta=mobPageMeta(p);
    host.innerHTML=mobPageHead(meta.title,meta.menu)+meta.body+tcNavHtml(MOB.tab==='tasks'?'tasks':(MOB.tab==='day'?'day':'trip'));
    document.querySelectorAll('#tripmode [data-mobtab]').forEach(function(b){ b.onclick=function(){ MOB.stack=[]; MOB.tab=b.dataset.mobtab; renderMobile(); }; });
    wireMobPage(p);
    return;
  }
  var _mw=mobWeeks(MOB.terr), _cw=wkCurrent(); var weeks=wkShown(FIELD_NUMS).filter(function(w){ return w>=_cw || _mw.indexOf(w)>=0; });
  if(weeks.indexOf(MOB.wk)<0){
    if(WEEKDATES[MOB.wk]) weeks=[MOB.wk].concat(weeks).sort(function(a,b){return a-b;});
    else MOB.wk=weeks[0];
  }
  var body = MOB.tab==='day' ? mobToday_render()
           : MOB.tab==='tasks' ? mobTasks_render()
           : mobTrip_render();
  host.innerHTML = tcTopBar() + body + tcNavHtml(MOB.tab==='day'?'day':(MOB.tab==='tasks'?'tasks':'trip'));
  if(MOB.tab==='trip' && MOB.mapOpen) setTimeout(tcDrawMap, 30);
  wireMobile();
}
function wireMobile(){
"""
    text = text[: m2.start()] + new_render + text[m2.end() :]
    print("OK renderMobile")
else:
    print("SKIP renderMobile")

once(
    """  q('[data-mobtab]').forEach(function(b){ b.onclick=function(){ MOB.tab=b.dataset.mobtab; renderMobile(); }; });""",
    """  q('[data-mobtab]').forEach(function(b){ b.onclick=function(){ MOB.stack=[]; MOB.tab=b.dataset.mobtab; if(b.dataset.mobtab==='day' && MOB.day==null) MOB.day=mobToday(MOB.wk); renderMobile(); }; });
  q('[data-tcday]').forEach(function(b){ b.onclick=function(){ MOB.day=+b.dataset.tcday; MOB.tab='day'; MOB.stack=[]; renderMobile(); }; });
  q('[data-tccomplete]').forEach(function(b){ b.onclick=function(){ tcCompleteOneTap(b.dataset.tccomplete); }; });
  var mt=document.getElementById('tcMapToggle');
  if(mt) mt.onclick=function(){ MOB.mapOpen=!MOB.mapOpen; renderMobile(); };""",
    "wire tc handlers",
)

once(
    "MOB.stack=[]; MOB.tab='today'; FO.step=1; renderMobile();",
    "MOB.stack=[]; MOB.tab='day'; FO.step=1; renderMobile();",
    "fo return day tab",
)

once(
    """function mobBoot(){
  if(!mobIsPhone()) return;
  var cur=mobCurrentWeek();
  if(cur!=null) MOB.wk=cur;                    /* always open on the week containing today */
  else { var weeks=mobWeeks(MOB.terr); if(weeks.length && weeks.indexOf(MOB.wk)<0) MOB.wk=weeks[0]; }
  /* restore last territory preference */
  try{ var a=localStorage.getItem('aqMyArea'); if(a) MOB.terr=a; }catch(e){}
  MOB.day=mobToday(MOB.wk);
  MOB.tab='today';
  if(FIELD_OPS_DEMO){ try{ cloudBadge('Field Ops demo — live plan isolated'); }catch(e){} }
  renderMobile();
}""",
    """function mobBoot(){
  if(!mobIsPhone()) return;
  var cur=mobCurrentWeek();
  if(cur!=null) MOB.wk=cur;
  else { var weeks=mobWeeks(MOB.terr); if(weeks.length && weeks.indexOf(MOB.wk)<0) MOB.wk=weeks[0]; }
  try{ var a=localStorage.getItem('aqMyArea'); if(a) MOB.terr=a; }catch(e){}
  MOB.day=mobToday(MOB.wk);
  MOB.tab='trip';
  if(TRIP_DEMO||FIELD_OPS_DEMO){ try{ cloudBadge('Trip Command demo — live plan isolated'); }catch(e){} }
  renderMobile();
}""",
    "mobBoot",
)

once(
    """    q('[data-focomplete]').forEach(function(b){ b.onclick=function(){ foOpenComplete(b.dataset.focomplete||p.id); };});
    var comp=document.getElementById('vd_complete');""",
    """    q('[data-focomplete]').forEach(function(b){ b.onclick=function(){ foOpenComplete(b.dataset.focomplete||p.id); };});
    q('[data-tccomplete]').forEach(function(b){ b.onclick=function(){ tcCompleteOneTap(b.dataset.tccomplete||p.id); };});
    var comp=document.getElementById('vd_complete');""",
    "wireMobPage tccomplete",
)

once(
    "  var done=dealer?!!APPT[i.id]:(i.raw&&i.raw.done);",
    "  var done=dealer?tcIsDone(i):(i.raw&&i.raw.done);",
    "mobTLItem tcIsDone",
)
# also mobCard
if "tcIsDone(i):(i.raw&&i.raw.done)" not in text or text.count("var done=(i.kind==='dealer')?!!APPT[i.id]:(i.raw&&i.raw.done);") == 1:
    once(
        "  var done=(i.kind==='dealer')?!!APPT[i.id]:(i.raw&&i.raw.done);",
        "  var done=(i.kind==='dealer'||i.kind==='xvisit')?tcIsDone(i):(i.raw&&i.raw.done);",
        "mobCard tcIsDone",
    )

# task toggle for demo ids
# Find existing tasktog handler and extend
if "aqTripDemoTasks" not in text.split("data-tasktog")[1][:800] if "data-tasktog" in text else True:
    pass

# Patch tasktog in wireMobile if present
task_pat = re.search(
    r"q\('\[data-tasktog\]'\)\.forEach\(function\(b\)\{ b\.onclick=function\(\)\{[\s\S]*?\};\}\);",
    text,
)
if task_pat and "aqTripDemoTasks" not in task_pat.group(0):
    new_task = """q('[data-tasktog]').forEach(function(b){ b.onclick=function(){
    var parts=String(b.dataset.tasktog||'').split(':'); var id=parts[0], ix=+parts[1];
    if(TRIP_DEMO && String(id).indexOf('demo-')===0){
      var rows=tcTaskRows(); if(rows[ix]||rows.filter(function(r){return r.id===id;})[0]){
        var list=tcTaskRows();
        list.forEach(function(r){ if(r.id===id && r.i===ix) r.done=!r.done; });
        try{ localStorage.setItem('aqTripDemoTasks', JSON.stringify(list)); }catch(e){}
      }
      renderMobile(); return;
    }
    var v=visitOf(id); if(!v.actions||!v.actions[ix]) return;
    v.actions[ix].done=!v.actions[ix].done; visitSave(); savePlan(); renderMobile();
  };});"""
    # Only replace if we can find a simpler one-liner; else append after wire tc handlers
    # Safer: insert after tc handlers block
    once(
        """  var mt=document.getElementById('tcMapToggle');
  if(mt) mt.onclick=function(){ MOB.mapOpen=!MOB.mapOpen; renderMobile(); };""",
        """  var mt=document.getElementById('tcMapToggle');
  if(mt) mt.onclick=function(){ MOB.mapOpen=!MOB.mapOpen; renderMobile(); };
  """
        + new_task,
        "demo task toggle",
    )

Path("/workspace/manifest.webmanifest").write_text(
    """{
  "name": "Arrowquip TRAVEL",
  "short_name": "TRAVEL",
  "description": "Trip Command Centre — trip, day, appointments and tasks for field travel.",
  "start_url": "/?m=1",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#111111",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
""",
    encoding="utf-8",
)
print("OK manifest")

ROOT.write_text(text, encoding="utf-8")

html = ROOT.read_text(encoding="utf-8")
scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, flags=re.S | re.I)
s = scripts[0]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
    f.write(s)
    path = f.name
r = subprocess.run(
    ["node", "-e", f'const fs=require("fs"); new Function(fs.readFileSync("{path}","utf8"));'],
    capture_output=True,
    text=True,
)
Path(path).unlink(missing_ok=True)
if r.returncode != 0:
    print("SYNTAX FAIL")
    print(r.stderr[:2500])
    raise SystemExit(1)
print("syntax PASS")
for sym in ["tcTopBar", "tcNavHtml", "tcCompleteOneTap", "tcDrawMap", "TRIP_DEMO", "mobTrip_render_legacy"]:
    print(sym, "OK" if sym in html else "MISSING")
