import {createSocialsControls} from './socials-controls.mjs';
import {fitCanvas} from './viewport.mjs';
import { FIELDS, MODES, PRESETS, defaults, totals, streaks, rating, elapsed, clock, createMessageId,WIDGET_IDS } from './model.mjs';
import {createBonusControls} from './bonus-controls.mjs';
import { el, renderCanvas, tickCanvas } from './render.mjs';
const $=id=>document.getElementById(id);
const dockMode=location.pathname==='/dock'||location.pathname==='/dock/'?'combined':location.pathname==='/dock/score'?'score':location.pathname==='/dock/cta'?'cta':null;
if(dockMode){document.body.classList.add('dock-mode',`dock-${dockMode}`);document.title=`Pawn Control · ${dockMode==='combined'?'Stream':dockMode==='score'?'Score':'CTA'} dock`;}
let state, admin={}, events, tab='session', selected='stats', dragging=false, queue=Promise.resolve(), toastTimer;
const title={session:'Session overview',layout:'Layout studio',stats:'Stats & visibility',ticker:'CTA ticker',credits:'End credits',tips:'Chess tips',socials:'Social handle callouts',appearance:'Appearance',settings:'Settings & connections'};
const dockTabs=[['dock-score-tab','session'],['dock-cta-tab','ticker'],['dock-credits-tab','credits'],['dock-tips-tab','tips'],['dock-socials-tab','socials']];
const readableTime=value=>value?new Date(value).toLocaleString():'Not available yet';
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,4500); }
async function api(path, data) {
  const res=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const result=await res.json();
  if(!res.ok) { if(res.status===401&&path!=='/api/login') showLogin(); throw new Error(result.error || 'Request failed'); }
  return result;
}
function action(a) {
  $('save-state').textContent='Saving…';
  queue=queue.catch(()=>{}).then(async()=>{
    const command=typeof a==='function'?a():a;
    const result=await api('/api/action',command); accept(result.state,true);
    try { admin=await api('/api/admin'); renderAdmin(); } catch(e) { toast(`Saved, but admin refresh failed: ${e.message}`); }
    $('save-state').textContent='All changes saved'; return true;
  }).catch(e=>{toast(e.message);$('save-state').textContent='Change not saved'; if(state)renderTab();});
  return queue;
}
function change(mutator) { return action(()=>{const settings=structuredClone(Object.fromEntries(['username','channel','activeMode','showAvatar','fields','parts','goals','overrides','theme','widgets','layoutLocked','snap','ticker','credits','tips','socials'].map(k=>[k,state[k]])));const before=structuredClone(settings);mutator(settings);return {type:'settings',settings:Object.fromEntries(Object.entries(settings).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(before[k])))};}); }
function showLogin() { events?.close(); $('app').hidden=true; $('login').hidden=false; }
async function start() {
  try { state=await api('/api/state'); admin=await api('/api/admin'); }
  catch { showLogin(); return; }
  $('login').hidden=true; $('app').hidden=false;
  if(dockMode){
    let initial=dockMode==='cta'?'ticker':'session';
    if(dockMode==='combined'){try{const saved=localStorage.getItem('pawn-control-dock-tab');if(dockTabs.some(([,value])=>value===saved))initial=saved;}catch{}}
    setTab(initial);$('dock-title').textContent=dockMode==='combined'?'Stream dock':dockMode==='score'?'Score dock':'CTA dock';
  }
  render(); renderAdmin(); events?.close(); events=new EventSource('/api/events');
  events.addEventListener('state',event=>{accept(JSON.parse(event.data));setConnection(true);});
  events.onerror=()=>{setConnection(false);void api('/api/state').catch(()=>{});};
  resizePreviews();
}
function accept(next,force=false) { if(!next || (next.instance===state?.instance && next.revision<state?.revision))return;state=next;render(force); }
function setConnection(connected){
  for(const id of ['connection-dot','dock-connection-dot'])$(id).classList.toggle('connected',connected);
  for(const id of ['connection-label','dock-connection-label'])$(id).textContent=connected?'Server connected':'Reconnecting…';
}
async function setTab(next) {
  if(tab==='tips'&&next!==tab&&!await bonusControls.canLeave())return;
  tab=next;
  if(dockMode==='combined') {
    document.body.classList.toggle('dock-score',tab==='session');document.body.classList.toggle('dock-cta',tab==='ticker');
    try{localStorage.setItem('pawn-control-dock-tab',tab);}catch{}
    for(const [id,value] of dockTabs){
      const selected=tab===value;$(id).setAttribute('aria-selected',String(selected));$(id).tabIndex=selected?0:-1;
      $(`${value}-tab`).setAttribute('role','tabpanel');$(`${value}-tab`).setAttribute('aria-labelledby',id);
    }
  }
  for(const button of document.querySelectorAll('[data-tab]')) button.classList.toggle('active',button.dataset.tab===tab);
  for(const p of document.querySelectorAll('.tab-panel'))p.hidden=p.id!==`${tab}-tab`;
  $('page-title').textContent=title[tab];renderTab();resizePreviews();
  if(dockMode==='combined')window.scrollTo(0,0);
}
function render(force=false) {
  if(!state)return;
  const busy=document.activeElement?.matches('input,textarea,select');
  renderSessionSummary();
  if((!busy||force)&&!dragging)renderTab();
  else if(tab==='layout'&&!dragging)renderCanvas($('editor-canvas'),state,{editor:true});
  else if(tab==='ticker')renderTickerPreview();
  else if(tab==='socials')socialsControls.render();
  const clone=structuredClone(state); for(const id of WIDGET_IDS)clone.widgets[id].visible=id==='stats'&&state.widgets.stats.visible;
  clone.widgets.stats.x=10;clone.widgets.stats.y=8;
  renderCanvas($('card-preview'),clone);
  $('api-banner').hidden=!state.api.error; $('api-banner').textContent=state.api.error?`Chess.com: ${state.api.error}. Last good values remain on screen.`:'';
  resizePreviews();
}
function renderTab() {
  if(!state)return;
  if(tab==='session')renderSession();
  if(tab==='layout')renderLayout();
  if(tab==='stats')renderStats();
  if(tab==='ticker')renderTickerEditor();
  if(tab==='appearance')renderTheme();
  if(tab==='settings')renderSettings();
  bonusControls.render(tab);
  if(tab==='socials')socialsControls.render();
}
function button(text,handler,cls='secondary') { const b=el('button',cls,text); b.type='button'; b.onclick=handler;return b; }
function inputField(label,type,value,onchange,options={}) {
  const wrap=el('label','',label),input=el(type==='select'?'select':'input');
  if(type==='select') for(const [val,text] of options.items) { const o=el('option','',text);o.value=val;input.append(o); }
  else input.type=type;
  for(const [k,v] of Object.entries(options))if(k!=='items')input.setAttribute(k,v);
  if(type==='checkbox'){input.checked=!!value;wrap.classList.add('inline');}else input.value=value??'';
  input.onchange=()=>onchange(type==='checkbox'?input.checked:type==='number'||type==='range'?Number(input.value):input.value,input);
  wrap.append(input); return wrap;
}
function renderSessionSummary() {
  const t=totals(state.session), total=t.win+t.loss+t.draw, streak=streaks(state.session);
  for(const k of ['win','loss','draw']) { const e=document.querySelector(`[data-score="${k}"]`);if(e)e.textContent=t[k]; }
  $('session-clock').textContent=clock(elapsed(state.session));$('timer').textContent=state.session.runningSince!==null?'Pause timer':state.session.elapsed>0?'Resume timer':'Start timer';
  $('session-start').textContent=`Started ${new Date(state.session.startedAt).toLocaleDateString()}`;
  const metrics=$('session-metrics');metrics.replaceChildren();
  for(const [label,value] of [['WIN RATE',total?`${Math.round(t.win/total*100)}%`:'—'],['CURRENT STREAK',streak.label],['GAMES PLAYED',total]]) { const cell=el('div','metric');cell.append(el('span','',label),el('strong','',value));metrics.append(cell); }
}
function renderSession() {
  const host=$('score-controls');host.replaceChildren();const t=totals(state.session);
  for(const [k,label,symbol] of [['win','WINS','↗'],['loss','LOSSES','↘'],['draw','DRAWS','＝']]) {
    const box=el('div',`score-box ${k}`),top=el('div','score-top');top.append(el('span','',label),el('span','',symbol));
    const count=button(t[k],()=>action({type:'record',result:k}),'score-count');count.dataset.score=k;count.setAttribute('aria-label',`Increment ${label.toLowerCase()}`);
    const bottom=el('div','score-bottom');bottom.append(button(`Record ${k}`,()=>action({type:'record',result:k}),'record-button'),button('−',()=>action({type:'decrement',result:k})),button('+',()=>action({type:'record',result:k})));
    bottom.children[1].setAttribute('aria-label',`Decrease ${label.toLowerCase()}`);bottom.children[2].setAttribute('aria-label',`Increase ${label.toLowerCase()}`);
    box.append(top,count,bottom);host.append(box);
  }
  const history=$('history');history.replaceChildren();
  if(!state.session.results.length)history.append(el('div','empty-state','No session games recorded. Use Record win / loss / draw above to populate streak, best session streak, win rate, and recent results. Chess.com refreshes update ratings, not these session results.'));
  for(const r of state.session.results.slice(-40).reverse()) {
    const row=el('div','history-row');row.append(el('span',`result-chip ${r.result}`,r.result==='win'?'W':r.result==='loss'?'L':'D'),el('time','',new Date(r.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));
    const select=el('select');select.setAttribute('aria-label','Correct game result');
    for(const k of ['win','loss','draw']) { const o=el('option','',k);o.value=k;select.append(o); } select.value=r.result;select.onchange=()=>action({type:'edit-result',id:r.id,result:select.value});
    row.append(select,button('Remove',()=>action({type:'delete-result',id:r.id}),'text-button'));history.append(row);
  }
  if(state.session.results.length>40)history.append(el('p','small-note','Showing the latest 40 results. The backup includes all results.'));
  if(Object.values(state.session.corrections).some(Boolean))history.prepend(el('p','small-note','Manual total corrections are active; streak uses recorded results only.'));
  renderSessionSummary();
}
function renderStats() {
  const host=$('field-list');host.replaceChildren();
  state.fields.forEach((f,index)=>{
    const row=el('div','field-row'),label=el('label'),check=el('input');check.type='checkbox';check.checked=f.visible;check.onchange=()=>change(s=>s.fields.find(x=>x.id===f.id).visible=check.checked);
    label.append(check,el('span','field-symbol',FIELDS[f.id][0]),el('span','',FIELDS[f.id][1]));row.append(label);
    for(const [text,offset] of [['↑',-1],['↓',1]]) { const b=button(text,()=>change(s=>{[s.fields[index],s.fields[index+offset]]=[s.fields[index+offset],s.fields[index]];}),'text-button');b.disabled=index+offset<0||index+offset>=state.fields.length;b.setAttribute('aria-label',`Move ${FIELDS[f.id][1]} ${offset<0?'up':'down'}`);row.append(b); }
    host.append(row);
  });
  const presets=$('field-presets');presets.replaceChildren();for(const [name,fields] of Object.entries(PRESETS))presets.append(button(name,()=>change(s=>s.fields.forEach(f=>f.visible=fields.includes(f.id)))));
  $('active-mode').value=state.activeMode;
  const ratings=$('rating-controls');ratings.replaceChildren();
  for(const m of MODES) {
    const row=el('div','rating-control');row.append(el('h4','',m),el('div','rating-current',`${rating(state,m)??'Unrated'}${state.overrides[m]!=null?' · MANUAL OVERRIDE':' · API'} · Best: ${state.api.stats?.[`chess_${m}`]?.best?.rating??'—'}`));
    const grid=el('div','form-grid');grid.append(inputField('Goal','number',state.goals[m],v=>change(s=>s.goals[m]=v),{min:1,max:10000}),inputField('Manual rating (blank = API)','number',state.overrides[m],(v,input)=>change(s=>s.overrides[m]=input.value===''?null:v),{min:0,max:10000}));row.append(grid);
    if(state.overrides[m]!=null)row.append(button('Use API',()=>change(s=>s.overrides[m]=null),'text-button'));ratings.append(row);
  }
  const parts=$('score-parts');parts.replaceChildren();for(const k of ['win','loss','draw'])parts.append(inputField(k,'checkbox',state.parts[k],v=>change(s=>s.parts[k]=v)));
  parts.append(inputField('Show avatar','checkbox',state.showAvatar,v=>change(s=>s.showAvatar=v)));
}
function renderLayout() {
  renderCanvas($('editor-canvas'),state,{editor:true});
  for(const node of $('editor-canvas').querySelectorAll('[data-widget]'))node.classList.toggle('selected',node.dataset.widget===selected);
  $('lock-layout').textContent=state.layoutLocked?'Unlock layout':'Lock layout';$('snap').checked=state.snap;
  const list=$('widget-list');list.replaceChildren();
  for(const id of WIDGET_IDS) {
    const row=el('div',`widget-select ${id===selected?'selected':''}`),check=el('input');check.type='checkbox';check.checked=state.widgets[id].visible;check.setAttribute('aria-label',`Show ${id}`);check.onchange=()=>change(s=>s.widgets[id].visible=check.checked);
    row.append(check,button(id,()=>{selected=id;renderLayout();},'text-button'));list.append(row);
  }
  const fields=$('widget-fields');fields.replaceChildren();const w=state.widgets[selected];
  fields.append(el('h3','',`${selected.charAt(0).toUpperCase()+selected.slice(1)} position`));
  const grid=el('div','form-grid');
  for(const [k,label,min,max] of [['x','X',0,2560],['y','Y',0,1440],['w','Width',150,2560],['h','Height',40,1440],['z','Layer',0,50],['scale','Content scale',.5,2]])grid.append(inputField(label,'number',w[k],v=>change(s=>s.widgets[selected][k]=v),{min,max,step:k==='scale'?.05:1}));
  fields.append(grid,inputField('Lock this widget','checkbox',w.locked,v=>change(s=>s.widgets[selected].locked=v)));
  if(selected==='stats')fields.append(button('Fit card height',()=>{
    const card=$('editor-canvas').querySelector('.stats-card');const h=Math.ceil(card.scrollHeight*w.scale);change(s=>{s.widgets.stats.h=Math.min(1440-s.widgets.stats.y,Math.max(40,h));});
  },'secondary wide'));
  resizePreviews();
}
function renderTickerEditor() {
  const host=$('message-list');host.replaceChildren();
  state.ticker.messages.forEach((m,index)=>{
    const row=el('div','message-item'),head=el('div','message-head'),buttons=el('div','button-row');
    head.append(inputField(`Message ${index+1}`,'checkbox',m.enabled,v=>change(s=>s.ticker.messages.find(x=>x.id===m.id).enabled=v)));
    for(const [text,offset] of [['↑',-1],['↓',1]]) { const b=button(text,()=>change(s=>{const i=s.ticker.messages.findIndex(x=>x.id===m.id);[s.ticker.messages[i],s.ticker.messages[i+offset]]=[s.ticker.messages[i+offset],s.ticker.messages[i]];}),'text-button');b.disabled=index+offset<0||index+offset>=state.ticker.messages.length;b.setAttribute('aria-label',`Move message ${index+1} ${offset<0?'up':'down'}`);buttons.append(b); }
    buttons.append(button('Remove',()=>change(s=>s.ticker.messages=s.ticker.messages.filter(x=>x.id!==m.id)),'text-button'));head.append(buttons);
    const text=el('textarea');text.value=m.text;text.maxLength=500;text.setAttribute('aria-label',`Message ${index+1} text`);text.onchange=()=>change(s=>s.ticker.messages.find(x=>x.id===m.id).text=text.value);
    row.append(head,text);host.append(row);
  });
  const options=$('ticker-options');options.replaceChildren();
  if(dockMode==='cta'||dockMode==='combined') {
    const toggle=button(document.body.classList.contains('dock-settings-open')?'Hide ticker settings':'Ticker settings',()=>{
      const open=document.body.classList.toggle('dock-settings-open');toggle.textContent=open?'Hide ticker settings':'Ticker settings';toggle.setAttribute('aria-expanded',String(open));
    });
    toggle.classList.add('dock-settings-toggle');toggle.setAttribute('aria-expanded',String(document.body.classList.contains('dock-settings-open')));options.append(toggle);
  }
  options.append(el('p','small-note',`Current mode: ${state.ticker.mode==='scroll'?'Continuous scroll — all enabled messages travel across the ticker.':`Message rotation — one message at a time, changing every ${state.ticker.interval} seconds. Choose Continuous scroll for moving text.`}${state.ticker.paused?' Ticker is paused.':''}`));
  const defs=[['mode','Display mode','select',{items:[['rotate','Message rotation'],['scroll','Continuous scroll']]}],['interval','Rotation interval (seconds)','number',{min:5,max:300}],['speed','Scroll speed (px / second)','number',{min:20,max:300}],['gap','Separator spacing (px)','number',{min:0,max:300}],['pause','Pause between scroll cycles (seconds)','number',{min:0,max:30}],['direction','Scroll direction','select',{items:[['left','Left'],['right','Right']]}],['font','Font size at 1440p','number',{min:18,max:60}],['opacity','Background opacity (%)','number',{min:0,max:100}],['separator','Message separator','text',{maxlength:12}],['paused','Pause ticker','checkbox',{}]];
  for(const [key,label,type,opts] of defs)options.append(inputField(label,type,state.ticker[key],v=>change(s=>s.ticker[key]=v),opts));
  options.append(inputField('Show ticker','checkbox',state.widgets.ticker.visible,v=>change(s=>s.widgets.ticker.visible=v)));
  renderTickerPreview();
}
function renderTickerPreview() {
  const preview=structuredClone(state);for(const id of WIDGET_IDS)if(id!=='ticker')preview.widgets[id].visible=false;
  preview.widgets.ticker={...preview.widgets.ticker,x:0,y:0,w:1000,h:110};renderCanvas($('ticker-preview'),preview);resizePreviews();
}
function renderTheme() {
  document.querySelector('.theme-swatch strong').textContent=state.username;
  const host=$('theme-controls');host.replaceChildren();
  for(const [key,label] of [['accent','Accent'],['background','Card background'],['foreground','Values'],['muted','Labels'],['streak','Streak badge']])host.append(inputField(label,'color',state.theme[key],v=>change(s=>s.theme[key]=v)));
  for(const [key,label,min,max] of [['opacity','Card opacity (%)',0,100],['radius','Corner radius',0,60],['font','Font size at 1440p',18,60],['padding','Card padding',10,60],['gap','Row spacing',4,40]])host.append(inputField(label,'number',state.theme[key],v=>change(s=>s.theme[key]=v),{min,max}));
}
function renderSettings() {
  $('username').value=state.username;$('channel').value=state.channel;
  const dl=$('api-status');dl.replaceChildren();
  const date=state.api.stats?.[`chess_${state.activeMode}`]?.last?.date;
  for(const [key,value] of [['Last checked',readableTime(state.api.checkedAt)],['Last successful response',readableTime(state.api.successAt)],['Rating game timestamp',readableTime(date?date*1000:null)],['Next scheduled check',readableTime(state.api.nextCheck)],['Status',state.api.error||'Ready / using available cached data']])dl.append(el('dt','',key),el('dd','',value));
  renderAdmin();
}
function renderAdmin() {
  $('undo').disabled=!admin.canUndo;
  const required=admin.authRequired!==false;
  $('logout').hidden=!required;$('dock-logout').hidden=!required;$('dock-auth-status').hidden=required;
  $('auth-status').textContent=required?'Authentication enabled: controls require login; sources use read-only tokens.':'Authentication disabled: anyone who can reach this app can view data and change controls.';
  const query=required&&admin.token?`?token=${encodeURIComponent(admin.token)}`:'';
  $('overlay-url').value=`${location.origin}/overlay${query}`;
  $('credits-url').value=`${location.origin}/credits${query}`;
  for(const [field,reveal] of [['overlay-url','reveal-url'],['credits-url','reveal-credits-url']]){
    $(reveal).hidden=!required;if(!required)$(field).type='text';
  }
  const select=$('layout-presets');select.replaceChildren();const first=el('option','','Load preset…');first.value='';select.append(first);
  for(const name of admin.presets||[]) { const o=el('option','',name);o.value=name;select.append(o); }
}
function resizePreviews() {
  bonusControls.resize();
  const wrap=document.querySelector('.stage-wrap');
  if(wrap && !wrap.closest('[hidden]')) {
    const output=$('preview-size').value==='1080', width=output?1920:2560;
    $('stage').style.width=`${width}px`; $('stage').style.height=`${output?1080:1440}px`;
    $('stage').style.transform=`scale(${wrap.clientWidth/width})`;
    const fit=fitCanvas($('editor-canvas'),width,output?1080:1440);
    $('preview-label').textContent=`Viewport ${width} × ${output?1080:1440} · design 2560 × 1440 · scale ${fit.scale}`;
    const guide=document.querySelector('.stage-guide');guide.style.zoom=output?'.75':'1';
  }
  if(state) {
    const mini=document.querySelector('.mini-preview');const scale=Math.min((mini.clientWidth-20)/state.widgets.stats.w,(mini.clientHeight-10)/state.widgets.stats.h);
    $('card-preview').style.transform=`scale(${Math.max(.05,scale)})`;
    const tw=document.querySelector('.ticker-preview-wrap');if(tw.clientWidth)$('ticker-preview').style.transform=`scale(${tw.clientWidth/1000})`;
  }
}
function modal(title,fields=[],message='',submitLabel='Save') {
  return new Promise(resolve=>{
    $('modal-form').querySelector('button[type=submit]').textContent=submitLabel;$('modal-title').textContent=title;const content=$('modal-content');content.replaceChildren();if(message)content.append(el('p','muted',message));
    const inputs={};for(const field of fields) { const label=el('label','',field.label),input=el('input');input.type=field.type||'text';input.value=field.value??'';input.required=true;for(const k of ['min','max','maxlength'])if(field[k]!=null)input.setAttribute(k,field[k]);label.append(input);content.append(label);inputs[field.key]=input; }
    $('modal-form').onsubmit=e=>{e.preventDefault();const values=Object.fromEntries(Object.entries(inputs).map(([k,input])=>[k,input.type==='number'?Number(input.value):input.value]));$('modal').close();resolve(values);};
    $('modal-cancel').onclick=()=>{$('modal').close();resolve(null);};$('modal').oncancel=()=>resolve(null);$('modal').showModal();
  });
}
$('login-form').onsubmit=async e=>{e.preventDefault();try{await api('/api/login',{password:new FormData(e.target).get('password')});e.target.reset();$('login-error').textContent='';await start();}catch(err){$('login-error').textContent=err.message;}};
$('logout').onclick=async()=>{await api('/api/logout',{});showLogin();};
$('dock-logout').onclick=$('logout').onclick;
for(const [id] of dockTabs)$(id).onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
  const index=dockTabs.findIndex(([,value])=>value===tab),next=e.key==='Home'?0:e.key==='End'?dockTabs.length-1:(index+(e.key==='ArrowLeft'?-1:1)+dockTabs.length)%dockTabs.length;
  setTab(dockTabs[next][1]);$(dockTabs[next][0]).focus();
};
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>setTab(b.dataset.tab);
for(const b of document.querySelectorAll('[data-goto]'))b.onclick=()=>setTab(b.dataset.goto);
$('refresh').onclick=async()=>{try{await api('/api/refresh',{});toast('Refresh requested. Upstream cache and retry limits still apply.');}catch(e){toast(e.message);}};
$('undo').onclick=()=>action({type:'undo'});$('timer').onclick=()=>action(()=>({type:'timer',command:state.session.runningSince!==null?'pause':'start'}));
$('restart-timer').onclick=async()=>{if(await modal('Restart session clock?',[],'Restart from 00:00:00 and keep running. Scores, result history, and streak remain unchanged.'))action({type:'timer',command:'restart'});};
$('reset').onclick=async()=>{if(await modal('Start a new session?',[],'Scores, streak, and timer return to zero. You can undo this reset.'))action({type:'reset'});};
$('edit-totals').onclick=async()=>{const t=totals(state.session),values=await modal('Correct session totals',['win','loss','draw'].map(k=>({key:k,label:k,type:'number',value:t[k],min:0,max:10000})),'Corrections change totals; recorded result order and streak stay intact.');if(values)action({type:'totals',totals:values});};
$('active-mode').onchange=e=>change(s=>s.activeMode=e.target.value);
$('show-fields').onclick=()=>change(s=>s.fields.forEach(f=>f.visible=true));$('hide-fields').onclick=()=>change(s=>s.fields.forEach(f=>f.visible=false));
$('lock-layout').onclick=()=>change(s=>s.layoutLocked=!s.layoutLocked);$('snap').onchange=e=>change(s=>s.snap=e.target.checked);
$('preview-size').onchange=e=>{$('preview-label').textContent=e.target.value==='1080'?'1920 × 1080 output · 75% scaling':'2560 × 1440';resizePreviews();toast(e.target.value==='1080'?'Output coordinates scale to 75%. Preview is fitted to this window.':'Editing native 1440p canvas.');};
$('save-layout').onclick=async()=>{const value=await modal('Save layout preset',[{key:'name',label:'Preset name',maxlength:40}]);if(value)action({type:'save-preset',name:value.name});};
$('layout-presets').onchange=e=>{if(e.target.value)action({type:'load-preset',name:e.target.value});};
$('delete-layout').onclick=async()=>{const value=await modal('Delete layout preset',[{key:'name',label:'Exact preset name',maxlength:40}]);if(value)action({type:'delete-preset',name:value.name});};
$('add-message').onclick=()=>change(s=>s.ticker.messages.push({id:createMessageId(),text:'Follow {channel} for more chess!',enabled:true}));
$('identity-form').onsubmit=async e=>{e.preventDefault();const username=$('username').value.trim(),channel=$('channel').value.trim();if(username!==state.username&&!await modal('Change Chess.com player?',[],'Cached stats and rating baselines will be cleared. Session scores remain.'))return;change(s=>{s.username=username;s.channel=channel;});};
$('copy-url').onclick=async()=>{try{await navigator.clipboard.writeText($('overlay-url').value);toast('OBS URL copied.');}catch{toast('Clipboard unavailable here. Reveal the URL and copy it manually.');}};
$('copy-credits-url').onclick=async()=>{try{await navigator.clipboard.writeText($('credits-url').value);toast('Credits URL copied.');}catch{toast('Reveal the credits URL and copy it manually.');}};
$('reveal-credits-url').onclick=()=>{const input=$('credits-url');input.type=input.type==='password'?'text':'password';$('reveal-credits-url').textContent=input.type==='password'?'Reveal URL':'Hide URL';};
$('reveal-url').onclick=()=>{const input=$('overlay-url');input.type=input.type==='password'?'text':'password';$('reveal-url').textContent=input.type==='password'?'Reveal URL':'Hide URL';};
$('open-overlay').onclick=()=>window.open($('overlay-url').value,'_blank','noopener,noreferrer');
$('export').onclick=()=>{location.href='/api/export';};
$('import').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>6000000)throw new Error('Backup is too large');const data=JSON.parse(await file.text());if(await modal('Restore backup?',[],'This replaces settings, layouts, and the current session. Credentials remain unchanged.'))await action({type:'import',data});}catch(err){toast(err.message);}finally{e.target.value='';}
};
const editor=$('editor-canvas');
editor.addEventListener('pointerdown',e=>{
  const widget=e.target.closest('[data-widget]');if(!widget)return;
  const id=widget.dataset.widget;selected=id;const original=structuredClone(state.widgets[id]);
  if(state.layoutLocked||original.locked){renderLayout();return;}
  e.preventDefault();dragging=true;widget.setPointerCapture(e.pointerId);
  const resize=!!e.target.closest('.resize-handle'),startX=e.clientX,startY=e.clientY,scale=editor.getBoundingClientRect().width/2560;let next=original;
  for(const n of editor.querySelectorAll('[data-widget]'))n.classList.toggle('selected',n===widget);
  const move=event=>{
    let dx=(event.clientX-startX)/scale,dy=(event.clientY-startY)/scale;
    const snap=v=>state.snap?Math.round(v/20)*20:Math.round(v);
    next={...original};
    if(resize){next.w=Math.max(150,Math.min(2560-original.x,snap(original.w+dx)));next.h=Math.max(40,Math.min(1440-original.y,snap(original.h+dy)));}
    else {next.x=Math.max(0,Math.min(2560-original.w,snap(original.x+dx)));next.y=Math.max(0,Math.min(1440-original.h,snap(original.y+dy)));if(Math.abs(next.x-(2560-next.w))<20)next.x=2560-next.w;if(Math.abs(next.y-(1440-next.h))<20)next.y=1440-next.h;}
    widget.style.left=`${next.x}px`;widget.style.top=`${next.y}px`;widget.style.width=`${next.w}px`;widget.style.height=`${next.h}px`;
  };
  const finish=()=>{widget.removeEventListener('pointermove',move);widget.removeEventListener('pointerup',finish);widget.removeEventListener('pointercancel',cancel);dragging=false;change(s=>s.widgets[id]=next);};
  const cancel=()=>{widget.removeEventListener('pointermove',move);widget.removeEventListener('pointerup',finish);widget.removeEventListener('pointercancel',cancel);dragging=false;renderLayout();};
  widget.addEventListener('pointermove',move);widget.addEventListener('pointerup',finish);widget.addEventListener('pointercancel',cancel);
});
const socialsControls=createSocialsControls({getState:()=>state,action,change,api,button,inputField,confirmChange:message=>modal('Confirm Socials change',[],message,'Apply to draft')});
const bonusControls=createBonusControls({getState:()=>state,change,action,button,inputField,confirmChange:message=>modal('Confirm tips change',[],message)});
new ResizeObserver(resizePreviews).observe(document.querySelector('.desk'));window.addEventListener('resize',resizePreviews);
setInterval(()=>{if(state){$('session-clock').textContent=clock(elapsed(state.session));for(const id of ['card-preview','editor-canvas'])tickCanvas($(id),state);}},1000);
void start();
