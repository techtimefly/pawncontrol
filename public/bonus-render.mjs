import {creditsProgress,nextTipIndex} from './bonus-model.mjs';
import {TickerClock,fitTextFont} from './ticker.mjs';
const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!=null)e.textContent=text;return e;};
const rgba=(hex,opacity)=>hex+Math.round(opacity*2.55).toString(16).padStart(2,'0');
export class CreditsTimeline {
  constructor(now=0,autoplay=true){this.elapsed=0;this.last=now;this.running=autoplay;this.stopped=!autoplay;}
  tick(now){if(this.running)this.elapsed+=Math.max(0,now-this.last);this.last=now;return this.elapsed;}
  command(command,now,done=false){this.tick(now);if(command==='restart'){this.elapsed=0;this.running=true;this.stopped=false;}else if(command==='play'){if(done)this.elapsed=0;this.running=true;this.stopped=false;}else if(command==='pause')this.running=false;else if(command==='stop'){this.elapsed=0;this.running=false;this.stopped=true;}}
}
export function createCredits(root,{autoplay=true}={}) {
  const crawl=el('div','credits-crawl'),final=el('div','credits-final'),finalText=el('span','credits-final-text');final.append(finalText);root.replaceChildren(crawl,final);root.classList.add('credits-surface');
  const timeline=new CreditsTimeline(performance.now(),autoplay);let options,key='',lastSequence=null,done=false,contentHeight=0,finalFitKey='';
  function command(cmd){timeline.command(cmd,performance.now(),done);if(cmd==='restart'||cmd==='stop')done=false;}
  function draw(now){
    if(!root.isConnected)return;
    const ms=timeline.tick(now);
    if(options&&root.clientWidth>0&&root.clientHeight>0){
      root.style.visibility=timeline.stopped?'hidden':'visible';
      if(!crawl.hidden)contentHeight=crawl.scrollHeight;
      const frame=creditsProgress(ms,root.clientHeight,contentHeight,options);done=frame.done;
      crawl.style.transform=`translateY(${frame.y}px)`;crawl.hidden=done;final.hidden=!done;
      // Long closing copy remains inside the source at either logical aspect ratio.
      const fitKey=JSON.stringify([done,root.clientWidth,root.clientHeight,options.brandSize,options.final]);
      if(done&&fitKey!==finalFitKey){
        finalFitKey=fitKey;let size=options.brandSize;finalText.style.fontSize=`${size}px`;
        const available=Math.max(1,root.clientHeight*.8);
        for(let i=0;i<4&&finalText.scrollHeight>available;i++){
          size=Math.max(1,size*available/finalText.scrollHeight*.98);finalText.style.fontSize=`${size}px`;
        }
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  return {command,update(next,playback=null){
    if(!options&&autoplay)timeline.command('restart',performance.now());
    options=next;root.style.background=rgba(next.background,next.opacity);root.style.setProperty('--credit-accent',next.accent);root.style.setProperty('--credit-heading',next.headingColor);root.style.setProperty('--credit-detail',next.detailColor);
    root.style.setProperty('--credit-font',`${next.font}px`);root.style.setProperty('--credit-heading-size',`${next.heading}px`);root.style.setProperty('--credit-brand-size',`${next.brandSize}px`);root.style.setProperty('--credit-gap',`${next.gap}px`);
    const content=JSON.stringify([next.brand,next.subtitle,next.final,next.sections]);
    if(content!==key){
      key=content;crawl.hidden=false;crawl.replaceChildren(el('div','credits-brand',next.brand),el('div','credits-subtitle',next.subtitle));
      for(const section of next.sections.filter(s=>s.enabled)){
        const block=el('section','credits-section');block.append(el('h2','',section.title));
        for(const entry of section.entries.filter(e=>e.enabled)){const item=el('div','credit-entry');item.append(el('p','credit-label',entry.label),el('p','credit-detail',entry.detail));block.append(item);}
        crawl.append(block);
      }
      crawl.append(el('div','credits-outro',next.final));finalText.textContent=next.final;
    }
    if(playback){if(lastSequence!==null&&playback.seq!==lastSequence)command(playback.command);lastSequence=playback.seq;}
  }};
}
export function createTips(root) {
  root.classList.add('tips-surface');const category=el('div','tip-category'),title=el('h3','tip-title'),text=el('p','tip-text');root.replaceChildren(category,title,text);
  let settings,items=[],index=0,lastSeq=null,clock=new TickerClock(performance.now()),lastAdvance=0,currentId=null,fitKey='';
  function render(){const item=items[index];root.style.visibility=item?'visible':'hidden';category.textContent=item?.category||'CHESS TIP';title.textContent=item?.title||'';text.textContent=item?.text||'';currentId=item?.id;root.dataset.tipId=currentId||'';}
  function draw(now){if(!root.isConnected)return;const ms=clock.update(now);if(settings&&items.length&&ms-lastAdvance>=settings.interval*1000){index=nextTipIndex(index,items.length,1,settings.order);lastAdvance=ms;render();}
    if(settings?.fitText&&root.clientWidth>0&&root.clientHeight>0){
      const key=JSON.stringify([root.textContent,root.clientWidth,root.clientHeight,settings.font]);
      if(key!==fitKey){fitKey=key;root.style.padding=`${Math.min(26,root.clientHeight/8)}px`;fitTextFont(settings.font,root.clientWidth,root.clientHeight,size=>{root.style.fontSize=`${size}px`;return {width:root.scrollWidth,height:root.scrollHeight};});}
    }
    requestAnimationFrame(draw);}
  requestAnimationFrame(draw);
  return {update(next,playback){
    settings=next;items=next.items.filter(t=>t.enabled&&t.text.trim());
    clock.update(performance.now(),playback.paused);
    if(lastSeq===null||lastSeq!==playback.seq){index=items.length?playback.index%items.length:0;lastAdvance=clock.elapsed;}
    else {const retained=items.findIndex(t=>t.id===currentId);index=retained>=0?retained:Math.min(index,Math.max(0,items.length-1));}
    lastSeq=playback.seq;root.style.fontSize=`${next.font}px`;fitKey='';if(!next.fitText)root.style.padding='';render();
  }};
}
