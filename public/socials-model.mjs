export const PLATFORMS={twitch:'Twitch',youtube:'YouTube',discord:'Discord',instagram:'Instagram',tiktok:'TikTok',x:'X',bluesky:'Bluesky',website:'Website'};
export const socialDefaults=()=>({mode:'rotate',interval:12,font:32,items:[]});
export const socialWidget=()=>({x:70,y:1050,w:900,h:120,scale:1,visible:false,locked:false,z:4});
// Legacy entries are losslessly interpreted as single-platform groups.
export const socialPlatforms=e=>e.platforms??[{id:e.id,platform:e.platform,icon:e.icon,enabled:true}];
export const asSocialGroup=e=>({id:e.id,text:e.text,cta:e.cta,enabled:e.enabled,platforms:structuredClone(socialPlatforms(e))});
export const enabledSocials=s=>s.items.filter(e=>e.enabled&&e.text.trim()&&socialPlatforms(e).some(p=>p.enabled));
export function matchingSocialGroups(items){
  const sets=[];
  for(const e of items){if(!e.text.trim())continue;let set=sets.find(s=>s[0].text===e.text&&s[0].cta===e.cta&&s[0].enabled===e.enabled);if(!set)sets.push(set=[]);set.push(e);}
  return sets.filter(s=>s.length>1&&s.reduce((n,e)=>n+socialPlatforms(e).length,0)<=20).map(s=>s.map(e=>e.id));
}
export function groupSocials(s,ids){
  validateSocials(s);const chosen=s.items.filter(e=>ids.includes(e.id));
  if(chosen.length<2||new Set(ids).size!==ids.length||chosen.length!==ids.length)throw Error('Choose at least two current callouts');
  if(chosen.some(e=>e.text!==chosen[0].text||e.cta!==chosen[0].cta||e.enabled!==chosen[0].enabled))throw Error('Handle, CTA and enabled state must match exactly');
  const group=asSocialGroup(chosen[0]);group.platforms=chosen.flatMap(e=>socialPlatforms(e)).map((p,i)=>({...p,id:`platform-${i}`}));
  const result={...s,items:s.items.flatMap(e=>e.id===group.id?[group]:ids.includes(e.id)?[]:[structuredClone(e)])};validateSocials(result);return result;
}
export function splitSocialPlatform(s,id,platformId,newId){
  validateSocials(s);const result=structuredClone(s),index=result.items.findIndex(e=>e.id===id);
  if(index<0||result.items.some(e=>e.id===newId))throw Error('Callout changed or identifier already exists');
  const group=asSocialGroup(result.items[index]),i=group.platforms.findIndex(p=>p.id===platformId);
  if(i<0||group.platforms.length<2)throw Error('Choose a platform from a shared group');
  const [platform]=group.platforms.splice(i,1);result.items.splice(index,1,group,{...group,id:newId,platforms:[platform]});validateSocials(result);return result;
}
export function validateSocials(s){
  const text=(v,max)=>typeof v==='string'&&v.length<=max;
  if(!s||typeof s!=='object'||Object.keys(s).some(k=>!['mode','interval','font','items'].includes(k)))throw Error('Unknown socials setting');
  if(!s||!['row','rotate'].includes(s.mode)||!Number.isFinite(s.interval)||s.interval<5||s.interval>300||!Number.isFinite(s.font)||s.font<18||s.font>60||!Array.isArray(s.items)||s.items.length>20)throw Error('Invalid socials settings (maximum 20 entries)');
  const ids=new Set();
  for(const e of s.items){
    const grouped=e&&Object.hasOwn(e,'platforms');
    if(e&&Object.keys(e).some(k=>!(grouped?['id','text','cta','enabled','platforms']:['id','platform','text','cta','enabled','icon']).includes(k)))throw Error('Unknown social entry field');
    const safeId=v=>text(v,80)&&v&&!['__proto__','constructor','prototype'].includes(v);
    if(!e||!safeId(e.id)||ids.has(e.id)||!text(e.text,120)||!text(e.cta,80)||typeof e.enabled!=='boolean')throw Error('Invalid social entry');
    const platforms=socialPlatforms(e),pids=new Set();
    if(!Array.isArray(platforms)||platforms.length<1||platforms.length>20)throw Error('Each callout needs 1–20 platforms');
    for(const p of platforms){
      if(!p||Object.keys(p).some(k=>!['id','platform','icon','enabled'].includes(k))||!safeId(p.id)||pids.has(p.id)||!Object.hasOwn(PLATFORMS,p.platform)||typeof p.enabled!=='boolean'||!(p.icon===null||typeof p.icon==='string'&&/^[a-f0-9]{32}$/.test(p.icon)))throw Error('Invalid social platform');
      pids.add(p.id);
    }
    ids.add(e.id);
  }
}
// A local elapsed-time clock: unrelated SSE updates never restart the rotation.
export class SocialTimeline {
  constructor(){this.items=[];this.id=null;this.index=0;this.elapsed=0;this.last=null;this.seq=null;this.paused=false;this.interval=12000;this.mode='rotate';}
  tick(now){if(this.last!==null&&!this.paused&&this.mode==='rotate'&&this.items.length){this.elapsed+=Math.max(0,now-this.last);if(this.elapsed>=this.interval){this.index=(this.index+Math.floor(this.elapsed/this.interval))%this.items.length;this.elapsed%=this.interval;this.id=this.items[this.index].id;}}this.last=now;return this.id;}
  update(settings,p,now){
    this.tick(now);const oldId=this.id;this.items=enabledSocials(settings);this.interval=settings.interval*1000;this.mode=settings.mode;
    const retained=this.items.findIndex(e=>e.id===oldId);this.index=retained>=0?retained:Math.min(this.index,Math.max(0,this.items.length-1));
    this.id=this.items[this.index]?.id??null;if(this.id!==oldId)this.elapsed=0;
    if(this.seq!==p.seq&&this.seq!==null&&['next','previous'].includes(p.command)){
      const from=this.items.findIndex(e=>e.id===p.currentId);this.index=((from>=0?from:this.index)+(p.command==='next'?1:-1)+this.items.length)%this.items.length||0;this.id=this.items[this.index]?.id??null;this.elapsed=0;
    }
    this.seq=p.seq;this.paused=p.paused;return this.id;
  }
}
