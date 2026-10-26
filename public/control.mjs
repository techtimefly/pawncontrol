import {bindGuideEditor,reservationGeometry} from './guide-editor.mjs';
import {layoutState,layoutDimensions,portraitDefaults} from './layouts.mjs';
import {createRecapControls} from './recap-controls.mjs';
import {createGoalsControls} from './goals-controls.mjs';
import {createTimerControls} from './timer-controls.mjs';
import {createStarterControls} from './starter-controls.mjs';
import {createCtaTextControls} from './cta-text-controls.mjs';
import {createSocialsControls} from './socials-controls.mjs';
import {fitCanvas} from './viewport.mjs';
import { FIELDS, MODES, PRESETS, defaults, totals, streaks, rating, elapsed, clock, createMessageId,WIDGET_IDS } from './model.mjs';
import {createBonusControls} from './bonus-controls.mjs';
import { el, renderCanvas, tickCanvas } from './render.mjs';
const $=id=>document.getElementById(id);
const dockMode=location.pathname==='/dock'||location.pathname==='/dock/'?'combined':location.pathname==='/dock/score'?'score':location.pathname==='/dock/cta'?'cta':null;
if(dockMode){document.body.classList.add('dock-mode',`dock-${dockMode}`);document.title=`Pawn Control · ${dockMode==='combined'?'Stream':dockMode==='score'?'Score':'CTA'} dock`;}
let editorLayout='landscape';
let state, admin={}, events, tab='session', selected='stats', dragging=false, queue=Promise.resolve(), toastTimer;
const title={goals:'Goals',recap:'Session recap & share',session:'Session overview',layout:'Layout studio',stats:'Stats & visibility',ticker:'CTA ticker',credits:'End credits',tips:'Chess tips',socials:'Social handle callouts',appearance:'Appearance',settings:'Settings & connections'};
const dockTabs=[['dock-score-tab','session'],['dock-goals-tab','goals'],['dock-cta-tab','ticker'],['dock-credits-tab','credits'],['dock-tips-tab','tips'],['dock-socials-tab','socials']];
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
  }).catch(e=>{toast(e.message);$('save-state').textContent='Change not saved'; if(state&&!starterControls.busy)renderTab();});
  return queue;
}
function change(mutator) { return action(()=>{const settings=structuredClone(Object.fromEntries(['username','channel','activeMode','showAvatar','fields','parts','goals','overrides','theme','portrait','landscapeGuides','widgets','layoutLocked','snap','ticker','credits','tips','socials'].map(k=>[k,state[k]])));const before=structuredClone(settings);mutator(settings);return {type:'settings',expectedGoalRevision:state.goalTracker.revision,settings:Object.fromEntries(Object.entries(settings).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(before[k])))};}); }
function changeLayout(mutator) { const target=editorLayout;return change(s=>mutator(target==='portrait'?s.portrait:s)); }
function editorState(){return layoutState(state,editorLayout);}
function renderGuides(){
 const host=$('layout-guides');host.replaceChildren();const guides=editorLayout==='portrait'?state.portrait.guides:state.landscapeGuides;const {width,height}=layoutDimensions(editorLayout);
 for(const key of ['safeArea','board','camera']){const g=guides[key];if(!g.enabled)continue;const node=el('div',`composition-guide ${key}`,key==='safeArea'?'SAFE AREA':`${key.toUpperCase()} · reservation`);if(key!=='safeArea'){node.dataset.reservation=key;node.classList.toggle('guide-locked',editorState().layoutLocked);const handle=el('span','guide-resize');handle.title='Resize reservation';node.append(handle);}const box=key==='safeArea'?{x:g.left,y:g.top,w:width-g.left-g.right,h:height-g.top-g.bottom}:g;Object.assign(node.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${box.w}px`,height:`${box.h}px`});host.append(node);}
}
function renderGuideControls(){
 const host=$('guide-fields');host.replaceChildren();const guides=editorLayout==='portrait'?state.portrait.guides:state.landscapeGuides;const {width,height}=layoutDimensions(editorLayout);
 const target=editorLayout;
 const update=(key,field,value)=>{
   const original=structuredClone(guides[key]);let next={...original,[field]:value};
   if(key!=='safeArea'&&original.aspectLocked&&['w','h'].includes(field))next=reservationGeometry(original,field==='w'?value-original.w:0,field==='h'?value-original.h:0,{layout:target,resize:true});
   return action({type:'layout-guide',layout:target,key,expected:original,value:next});
 };
 for(const key of ['safeArea','board','camera']){const group=el('div');group.append(inputField(key==='safeArea'?'Safe area':`${key} reservation`,'checkbox',guides[key].enabled,v=>update(key,'enabled',v)));if(guides[key].enabled){const grid=el('div','form-grid');for(const field of key==='safeArea'?['top','right','bottom','left']:['x','y','w','h'])grid.append(inputField(field,'number',guides[key][field],v=>update(key,field,v),{min:0,max:['x','w','left','right'].includes(field)?width:height}));if(key!=='safeArea')grid.append(inputField('Lock aspect ratio','checkbox',!!guides[key].aspectLocked,v=>update(key,'aspectLocked',v)));group.append(grid);}host.append(group);}
 if(editorLayout==='portrait'){host.append(el('h3','','Portrait typography'));for(const [key,label,min,max] of [['font','Stats font',18,60],['padding','Card padding',10,60],['gap','Row gap',4,40],['tickerFont','CTA font',18,60],['tipsFont','Tips font',18,60],['socialsFont','Socials font',18,60],['creditsFont','Credits font',20,90],['creditsHeading','Credits heading',24,120],['creditsBrandSize','Credits brand',30,180],['creditsGap','Credits gap',10,180]])host.append(inputField(label,'number',state.portrait.typography[key],v=>changeLayout(s=>s.typography[key]=v),{min,max}));}
}
function showLogin() { recapControls.clear(); goalsControls.clear(); events?.close(); $('app').hidden=true; $('login').hidden=false; }
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
function accept(next,force=false) { if(!next || (next.instance===state?.instance && next.revision<state?.revision))return;state=next;starterControls.update();ctaTextControls.update();render(force); }
function setConnection(connected){
  for(const id of ['connection-dot','dock-connection-dot'])$(id).classList.toggle('connected',connected);
  for(const id of ['connection-label','dock-connection-label'])$(id).textContent=connected?'Server connected':'Reconnecting…';
}
async function setTab(next) {
  guideEditor.cancel();
  if(tab==='ticker'&&next!==tab&&!await ctaTextControls.canLeave())return;
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
  if((!busy||force)&&!dragging&&!starterControls.busy)renderTab();
  else if(tab==='layout'&&!dragging)renderCanvas($('editor-canvas'),editorState(),{editor:true});
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
  if(tab==='recap')recapControls.render();
  if(tab==='goals')goalsControls.render();
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
  $('session-clock').textContent=clock(elapsed(state.session));timerControls.render();
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
 const widgetId=selected,view=editorState(),{width,height}=layoutDimensions(editorLayout);$('layout-select').value=editorLayout;renderGuides();renderGuideControls();
  renderCanvas($('editor-canvas'),editorState(),{editor:true});
  for(const node of $('editor-canvas').querySelectorAll('[data-widget]'))node.classList.toggle('selected',node.dataset.widget===selected);
  $('lock-layout').textContent=view.layoutLocked?'Unlock layout':'Lock layout';$('snap').checked=view.snap;
  const list=$('widget-list');list.replaceChildren();
  for(const id of WIDGET_IDS) {
    const row=el('div',`widget-select ${id===selected?'selected':''}`),check=el('input');check.type='checkbox';check.checked=view.widgets[id].visible;check.setAttribute('aria-label',`Show ${id}`);check.onchange=()=>changeLayout(s=>s.widgets[id].visible=check.checked);
    row.append(check,button(id,()=>{selected=id;renderLayout();},'text-button'));list.append(row);
  }
  const fields=$('widget-fields');fields.replaceChildren();const w=view.widgets[selected];
  fields.append(el('h3','',`${selected.charAt(0).toUpperCase()+selected.slice(1)} position`));
  const grid=el('div','form-grid');
  for(const [k,label,min,max] of [['x','X',0,width],['y','Y',0,height],['w','Width',150,width],['h','Height',40,height],['z','Layer',0,50],['scale','Content scale',.5,2]])grid.append(inputField(label,'number',w[k],v=>changeLayout(s=>s.widgets[widgetId][k]=v),{min,max,step:k==='scale'?.05:1}));
  fields.append(grid,inputField('Lock this widget','checkbox',w.locked,v=>changeLayout(s=>s.widgets[widgetId].locked=v)));
  if(selected==='stats')fields.append(button('Fit card height',()=>{
    const card=$('editor-canvas').querySelector('.stats-card');const h=Math.ceil(card.scrollHeight*w.scale);changeLayout(s=>{s.widgets.stats.h=Math.min(height-s.widgets.stats.y,Math.max(40,h));});
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
  $('overlay-url').value=`${location.origin}/overlay${query}${query?'&':'?'}layout=landscape`;
  $('credits-url').value=`${location.origin}/credits${query}${query?'&':'?'}layout=landscape`;
  for(const kind of ['overlay','credits'])$(`portrait-${kind}-url`).value=`${location.origin}/${kind}${query}${query?'&':'?'}layout=portrait`;
  for(const [field,reveal] of [['overlay-url','reveal-url'],['credits-url','reveal-credits-url'],['portrait-overlay-url','reveal-portrait-overlay-url'],['portrait-credits-url','reveal-portrait-credits-url']]){
    $(reveal).hidden=!required;if(!required)$(field).type='text';
  }
  const select=$('layout-presets');select.replaceChildren();const first=el('option','','Load both layouts…');first.value='';select.append(first);
  for(const name of admin.presets||[]) { const o=el('option','',name);o.value=name;select.append(o); }
}
function resizePreviews() {
  bonusControls.resize();
  const wrap=document.querySelector('.stage-wrap');
  if(wrap && !wrap.closest('[hidden]')) {
    const design=layoutDimensions(editorLayout),reduced=$('preview-size').value==='1080';
    const width=reduced?(editorLayout==='portrait'?720:1920):design.width,height=reduced?(editorLayout==='portrait'?1280:1080):design.height;
    wrap.style.aspectRatio=`${width} / ${height}`;wrap.style.maxWidth=editorLayout==='portrait'?'540px':'';
    $('stage').style.width=`${width}px`;$('stage').style.height=`${height}px`;$('stage').style.transform=`scale(${wrap.clientWidth/width})`;
    $('editor-canvas').style.width=`${design.width}px`;$('editor-canvas').style.height=`${design.height}px`;
    const fit=fitCanvas($('editor-canvas'),width,height,design);Object.assign($('layout-guides').style,{width:`${design.width}px`,height:`${design.height}px`,transform:`scale(${fit.scale})`,transformOrigin:'0 0'});
    $('preview-label').textContent=`Viewport ${width} × ${height} · design ${design.width} × ${design.height}`;
  }
  if(state) {
    const mini=document.querySelector('.mini-preview');const scale=Math.min((mini.clientWidth-20)/state.widgets.stats.w,(mini.clientHeight-10)/state.widgets.stats.h);
    $('card-preview').style.transform=`scale(${Math.max(.05,scale)})`;
    const tw=document.querySelector('.ticker-preview-wrap');if(tw.clientWidth)$('ticker-preview').style.transform=`scale(${tw.clientWidth/1000})`;
  }
}
function modal(title,fields=[],message='',submitLabel='Save') {
  return new Promise(resolve=>{
    $('modal').classList.toggle('starter-dialog',title==='Starter templates');
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
// Display ordinals follow sidebar order; they are not keyboard shortcuts.
for(const [index,button] of [...document.querySelectorAll('#nav .nav-item')].entries())button.querySelector('small').textContent=String(index+1).padStart(2,'0');
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>setTab(b.dataset.tab);
for(const b of document.querySelectorAll('[data-goto]'))b.onclick=()=>setTab(b.dataset.goto);
$('refresh').onclick=async()=>{try{await api('/api/refresh',{});toast('Refresh requested. Upstream cache and retry limits still apply.');}catch(e){toast(e.message);}};
$('undo').onclick=()=>action({type:'undo'});
$('reset').onclick=()=>setTab('recap');
$('edit-totals').onclick=async()=>{const t=totals(state.session),values=await modal('Correct session totals',['win','loss','draw'].map(k=>({key:k,label:k,type:'number',value:t[k],min:0,max:10000})),'Corrections change totals; recorded result order and streak stay intact.');if(values)action({type:'totals',totals:values});};
$('active-mode').onchange=e=>change(s=>s.activeMode=e.target.value);
$('show-fields').onclick=()=>change(s=>s.fields.forEach(f=>f.visible=true));$('hide-fields').onclick=()=>change(s=>s.fields.forEach(f=>f.visible=false));
$('lock-layout').onclick=()=>changeLayout(s=>s.layoutLocked=!s.layoutLocked);$('snap').onchange=e=>changeLayout(s=>s.snap=e.target.checked);
$('layout-select').onchange=async e=>{const target=e.target.value;guideEditor.cancel();await queue;if(dragging){$('layout-select').value=editorLayout;return;}editorLayout=target;renderLayout();};
$('portrait-preset').onclick=async()=>{if(await modal('Reset portrait composition?',[],'Replace portrait positions, typography and guides with the portrait preset. Shared content and landscape stay unchanged.'))change(s=>s.portrait=portraitDefaults());};
$('preview-size').onchange=()=>{guideEditor.cancel();resizePreviews();};
$('save-layout').onclick=async()=>{const value=await modal('Save layout preset',[{key:'name',label:'Preset name',maxlength:40}]);if(value)action({type:'save-preset',name:value.name});};
$('layout-presets').onchange=async e=>{const name=e.target.value;if(name&&await modal('Load both layouts?',[],'Replace both compositions, appearance and shared overlay content with this preset. Session results and player identity stay unchanged.'))action({type:'load-preset',name});};
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
  try{if(file.size>6000000)throw new Error('Backup is too large');const data=JSON.parse(await file.text());const expectedRecapRevision=(await api('/api/recap')).recap.revision;const expectedGoalRevision=state.goalTracker.revision;if(await modal('Restore backup?',[],'This replaces settings, layouts, the current session, and goal tracking. A legacy backup without goal data clears all current goals. Backups containing recap data also replace saved recaps and templates; older backups preserve them. Credentials remain unchanged.'))await action({type:'import',data,expectedRecapRevision,expectedGoalRevision});}catch(err){toast(err.message);}finally{e.target.value='';}
};
const guideEditor=bindGuideEditor($('layout-guides'),{
  getContext:()=>({layout:editorLayout,guides:editorLayout==='portrait'?state.portrait.guides:state.landscapeGuides,locked:editorState().layoutLocked,snap:editorState().snap}),
  setDragging:value=>{dragging=value;},render:()=>renderLayout(),
  save:(layout,key,expected,value)=>action({type:'layout-guide',layout,key,expected,value})
});
window.addEventListener('blur',()=>guideEditor.cancel());
window.addEventListener('resize',()=>guideEditor.cancel());
window.addEventListener('keydown',e=>{if(e.key==='Escape')guideEditor.cancel();});
const editor=$('editor-canvas');
editor.addEventListener('pointerdown',e=>{
  const widget=e.target.closest('[data-widget]');if(!widget)return;
  const view=editorState(),{width,height}=layoutDimensions(editorLayout);
  const id=widget.dataset.widget;selected=id;const original=structuredClone(view.widgets[id]);
  if(view.layoutLocked||original.locked){renderLayout();return;}
  e.preventDefault();dragging=true;widget.setPointerCapture(e.pointerId);
  const resize=!!e.target.closest('.resize-handle'),startX=e.clientX,startY=e.clientY,scale=editor.getBoundingClientRect().width/width;let next=original;
  for(const n of editor.querySelectorAll('[data-widget]'))n.classList.toggle('selected',n===widget);
  const move=event=>{
    let dx=(event.clientX-startX)/scale,dy=(event.clientY-startY)/scale;
    const snap=v=>view.snap?Math.round(v/20)*20:Math.round(v);
    next={...original};
    if(resize){next.w=Math.max(150,Math.min(width-original.x,snap(original.w+dx)));next.h=Math.max(40,Math.min(height-original.y,snap(original.h+dy)));}
    else {next.x=Math.max(0,Math.min(width-original.w,snap(original.x+dx)));next.y=Math.max(0,Math.min(height-original.h,snap(original.y+dy)));if(Math.abs(next.x-(width-next.w))<20)next.x=width-next.w;if(Math.abs(next.y-(height-next.h))<20)next.y=height-next.h;}
    widget.style.left=`${next.x}px`;widget.style.top=`${next.y}px`;widget.style.width=`${next.w}px`;widget.style.height=`${next.h}px`;
  };
  const finish=()=>{widget.removeEventListener('pointermove',move);widget.removeEventListener('pointerup',finish);widget.removeEventListener('pointercancel',cancel);dragging=false;changeLayout(s=>s.widgets[id]=next);};
  const cancel=()=>{widget.removeEventListener('pointermove',move);widget.removeEventListener('pointerup',finish);widget.removeEventListener('pointercancel',cancel);dragging=false;renderLayout();};
  widget.addEventListener('pointermove',move);widget.addEventListener('pointerup',finish);widget.addEventListener('pointercancel',cancel);
});
const timerControls=createTimerControls({getState:()=>state,action,confirmChange:message=>modal('Session timer',[],message,'Confirm')});
const recapControls=createRecapControls({api,accept,confirmChange:message=>modal('Session recap',[],message,'Confirm'),resetSession:expectedSessionKey=>action({type:'reset',expectedSessionKey})});
const goalsControls=createGoalsControls({getState:()=>state,api,accept,change,confirmChange:message=>modal('Goals',[],message,'Confirm')});
const starterControls=createStarterControls({getState:()=>state,action,confirmChange:message=>modal('Starter templates',[],message,'Confirm'),settle:()=>queue,render:()=>renderTab()});
const ctaTextControls=createCtaTextControls({getState:()=>state,action,confirmChange:message=>modal('Confirm CTA change',[],message)});
const socialsControls=createSocialsControls({getState:()=>state,action,change,api,button,inputField,confirmChange:message=>modal('Confirm Socials change',[],message,'Apply to draft')});
const bonusControls=createBonusControls({getState:()=>state,change,action,button,inputField,confirmChange:message=>modal('Confirm tips change',[],message)});
new ResizeObserver(resizePreviews).observe(document.querySelector('.desk'));window.addEventListener('resize',resizePreviews);
setInterval(()=>{if(state){if(tab==='goals')goalsControls.tick();$('session-clock').textContent=clock(elapsed(state.session));for(const id of ['card-preview','editor-canvas'])tickCanvas($(id),id==='editor-canvas'?editorState():state);}},1000);
void start();

for(const kind of ['overlay','credits']){const field=$(`portrait-${kind}-url`);$(`copy-portrait-${kind}-url`).onclick=async()=>{try{await navigator.clipboard.writeText(field.value);toast('Portrait URL copied.');}catch{toast('Reveal the URL and copy it manually.');}};$(`reveal-portrait-${kind}-url`).onclick=()=>field.type=field.type==='password'?'text':'password';}
