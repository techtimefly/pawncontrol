import {renderRecapTemplate} from './recap-model.mjs';
import {clock} from './model.mjs';

// A rejected clipboard promise is never reported as success. Selection is the fallback.
export async function copyRecap(textarea, clipboard=globalThis.navigator?.clipboard) {
  try { if(!clipboard?.writeText)throw Error('Clipboard unavailable');await clipboard.writeText(textarea.value);return true; }
  catch { textarea.focus();textarea.select();return false; }
}
export const recapCharacterCount = text => Array.from(text).length;

export function createRecapControls({api,accept,confirmChange,resetSession}) {
  const $=id=>document.getElementById(id);
  let data=null,loading=false,busy=false,dirty=false,prefsDirty=false,selected=null;
  const status=text=>{$('recap-status').textContent=text;};
  const text=$('recap-text');
  function count(){ $('recap-count').textContent=`${recapCharacterCount(text.value)} characters · platform limits vary`; }
  function mark(){dirty=true;count();status('Unsaved text. Save draft to keep it after restart.');}
  text.oninput=mark;
  $('recap-kind').onchange=mark;
  for(const id of ['recap-live-template','recap-complete-template','recap-link','recap-hashtags'])$(id).oninput=()=>{prefsDirty=true;status('Unsaved template preferences.');};
  function statsView(stats) {
    const host=$('recap-metrics');host.replaceChildren();
    for(const [label,value] of [['Wins',stats.wins],['Losses',stats.losses],['Draws',stats.draws],['Games played',stats.games],['Win rate',stats.winRate===null?'N/A':`${stats.winRate}%`],['Best winning streak',stats.bestStreak],['Current rating',`${stats.mode} · ${stats.rating??'unavailable'}`]]){
      const item=document.createElement('div');item.className='metric';const caption=document.createElement('span');caption.textContent=label;const number=document.createElement('strong');number.textContent=value;item.append(caption,number);host.append(item);
    }
    const duration=document.createElement('div');duration.className='metric';const label=document.createElement('span');label.textContent='Captured duration';const value=document.createElement('strong');value.textContent=stats.duration===undefined?'unavailable':clock(stats.duration);duration.append(label,value);host.append(duration);
    $('recap-stats-note').textContent='Duration is captured with statistics; refresh explicitly before completing to include more time. Completed recaps stay frozen. Win rate = wins / all games (including draws), rounded. No games = N/A. Best streak uses ordered recorded results only.'+(stats.hasCorrections?' Manual total corrections are active and do not change the recorded streak.':'');
  }
  function draw(){
    if(!data)return;
    const snapshot=data.recap.snapshots.find(s=>s.id===selected),draft=data.recap.draft;
    statsView(snapshot?.stats??draft?.stats??data.stats);
    $('recap-context').textContent=snapshot?`Completed ${new Date(snapshot.completedAt).toLocaleString()} · statistics frozen`:
      draft?`Draft statistics captured ${new Date(draft.capturedAt).toLocaleString()} · refresh explicitly when ready`:'Session statistics when opened · refresh explicitly to capture the latest data';
    $('recap-live-actions').hidden=!!snapshot;$('recap-snapshot-actions').hidden=!snapshot;
    $('recap-kind').disabled=!!snapshot;$('recap-apply-template').disabled=!!snapshot;
    const list=$('recap-snapshots');list.replaceChildren();
    if(!data.recap.snapshots.length)list.textContent='No completed recaps yet.';
    for(const s of data.recap.snapshots){
      const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=`${new Date(s.completedAt).toLocaleString()} · ${s.stats.wins}W / ${s.stats.losses}L / ${s.stats.draws}D`;b.onclick=()=>choose(s.id);list.append(b);
    }
    count();
  }
  function populate(){
    selected=null;const r=data.recap;
    $('recap-kind').value=r.draft?.kind??'live';text.value=r.draft?.text??renderRecapTemplate(r.templates.live,data.stats,r);
    $('recap-live-template').value=r.templates.live;$('recap-complete-template').value=r.templates.complete;$('recap-link').value=r.streamLink;$('recap-hashtags').value=r.hashtags;
    dirty=!r.draft;prefsDirty=false;draw();
  }
  async function load(discard=false){
    if(loading||busy)return;
    if(discard&&(dirty||prefsDirty)&&!await confirmChange('Reload saved recap data and discard unsaved text and template preferences?'))return;
    loading=true;$('recap-editor').disabled=true;
    try{data=await api('/api/recap');populate();status('Recap data loaded. Posting is manual; nothing is published.');}
    catch(e){status(e.message);}finally{loading=false;$('recap-editor').disabled=false;}
  }
  async function choose(id){
    if(busy||!data)return;
    if(dirty&&!await confirmChange('Discard unsaved text and open this recap?'))return;
    selected=id;const s=id?data.recap.snapshots.find(s=>s.id===id):data.recap.draft;
    text.value=s?.text??renderRecapTemplate(data.recap.templates.live,data.stats,data.recap);$('recap-kind').value=s?.kind??'live';dirty=!s;draw();status(id?'Edit text, then Save revision. Frozen statistics stay unchanged.':'Draft opened.');
  }
  async function command(operation,extra={}){
    if(busy||!data)return false;
    busy=true;$('recap-editor').disabled=true;
    try{
      const result=await api('/api/action',{type:'recap',operation,expectedRevision:data.recap.revision,...extra});
      data={recap:result.recap,stats:result.stats,sessionKey:result.sessionKey};accept(result.state,true);return true;
    }catch(e){status(`${e.message} Your edits are retained. Reload saved data only when ready to discard them.`);return false;}
    finally{busy=false;$('recap-editor').disabled=false;}
  }
  async function save(refreshStats=false){
    if(selected)return false;
    // Fetch only the key/data for an explicit refresh; never replace manually edited text.
    let key=data?.sessionKey;
    if(refreshStats){try{const current=await api('/api/recap');key=current.sessionKey;}catch(e){status(e.message);return false;}}
    if(await command('save-draft',{kind:$('recap-kind').value,text:text.value,refreshStats,expectedSessionKey:key})){
      dirty=false;draw();status(refreshStats?'Draft statistics refreshed and saved. Your text is unchanged; use Apply template to regenerate it.':'Draft saved. Captured statistics and text will survive restart.');return true;
    }return false;
  }
  $('recap-save').onclick=()=>save();$('recap-refresh').onclick=()=>save(true);
  $('recap-reload').onclick=()=>load(true);$('recap-open-draft').onclick=()=>choose(null);
  $('recap-apply-template').onclick=async()=>{
    if(!data||selected||busy)return;
    if(!await confirmChange('Replace the message text with the selected template, using the displayed captured statistics?'))return;
    // Pin the first template to authoritative saved statistics, including duration.
    if(!data.recap.draft&&!await save(true))return;
    const kind=$('recap-kind').value,template=$(kind==='live'?'recap-live-template':'recap-complete-template').value;
    text.value=renderRecapTemplate(template,data.recap.draft?.stats??data.stats,{streamLink:$('recap-link').value,hashtags:$('recap-hashtags').value});mark();
  };
  $('recap-copy').onclick=async()=>status(await copyRecap(text)?'Copied to clipboard. Paste it into your social app to post.':'Copy failed. Message selected: press Ctrl+C (or use your manual Copy command).');
  $('recap-save-preferences').onclick=async()=>{
    if(await command('save-preferences',{templates:{live:$('recap-live-template').value,complete:$('recap-complete-template').value},streamLink:$('recap-link').value,hashtags:$('recap-hashtags').value})){prefsDirty=false;draw();status('Reusable templates and optional additions saved. Message text is unchanged.');}
  };
  async function complete(reset){
    if(busy||!data||selected)return;
    if(!data.recap.draft){
      if(await save(true))status('Statistics captured. Review the captured duration and text, or Apply template, then save the completed recap.');
      return;
    }
    if(!await confirmChange(reset?'Save this completed recap, then reset session scores, result history and timer? Other settings stay unchanged.':'Save this text and the displayed statistics as a completed recap? Statistics will freeze.'))return;
    if(!await save(false))return;
    if(await command('complete',{text:text.value,reset,expectedSessionKey:data.sessionKey})){
      selected=data.recap.snapshots[0].id;dirty=false;draw();status(reset?'Completed recap saved and session reset.':'Completed recap saved. Statistics are frozen.');
    }
  }
  $('recap-complete').onclick=()=>complete(false);$('recap-complete-reset').onclick=()=>complete(true);
  $('recap-revise').onclick=async()=>{if(selected&&await command('revise',{id:selected,text:text.value})){dirty=false;draw();status('Text revision saved. Statistics remain frozen.');}};
  $('recap-delete').onclick=async()=>{if(selected&&await confirmChange('Permanently delete this completed recap? Export a backup first if you need to keep it.')&&await command('delete',{id:selected})){dirty=false;await choose(null);status('Completed recap deleted.');}};
  $('recap-reset-only').onclick=async()=>{
    if(busy||!data)return;
    if(await confirmChange('Reset scores, recorded results and timer WITHOUT saving a completed recap? Existing saved recaps remain.')){
      if(await resetSession(data.sessionKey)){status('Session reset. Existing recaps retained. Reload or refresh to capture the new session.');}
    }
  };
  window.addEventListener('beforeunload',e=>{if(dirty||prefsDirty||busy){e.preventDefault();e.returnValue='';}});
  return {render(){if(!data&&!loading)void load();},clear(){data=null;selected=null;dirty=false;prefsDirty=false;text.value='';},async canLeave(){return !busy;}};
}
