import {channelLabel} from './identity.mjs';
// A clock independent of renders: API updates must not restart message rotation.
export class TickerClock {
  constructor(now=0) { this.elapsed=0; this.last=now; this.paused=false; }
  update(now,paused=this.paused) {
    if(!this.paused)this.elapsed+=Math.max(0,now-this.last);
    this.last=now;this.paused=paused;return this.elapsed;
  }
}
export function rotationIndex(ms,interval,count) { return count ? Math.floor(ms/(Math.max(1,interval)*1000))%count : 0; }
// Measure after each font change: wrapping is nonlinear, so a single height
// ratio is not sufficient. The callback applies the size and measures the DOM.
export function fitTextFont(requested,width,height,measure) {
  const fits=size=>{const box=measure(size);return box.width<=width+1&&box.height<=height+1;};
  if(fits(requested))return requested;
  let low=1,high=requested;
  for(let i=0;i<12;i++){const mid=(low+high)/2;if(fits(mid))low=mid;else high=mid;}
  measure(low);return low;
}
export function scrollOffset(ms,width,speed,pause,direction) {
  if(width<=0)return 0;
  const travel=width/Math.max(1,speed)*1000, hold=Math.max(0,pause)*1000;
  const phase=ms%(travel+hold),distance=Math.min(width,phase/1000*speed);
  return (direction==='right' ? -width+distance : -distance) || 0;
}
const make=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;if(text!=null)node.textContent=text;return node;};
export function createTicker(wrapper) {
  wrapper.replaceChildren();
  const surface=make('div','ticker-surface'),tag=make('span','ticker-tag'),viewport=make('div','ticker-window'),line=make('span','ticker-line');
  const tagText=make('span','ticker-tag-text');tag.append(tagText);
  viewport.append(line);surface.append(tag,viewport);wrapper.append(surface);
  let clock=new TickerClock(performance.now()),mode,options,messages=[],contentKey='',width=0,needsMeasure=true,index=-1,ids=[],anchor=null,fitKey='';
  function buildScroll() {
    line.replaceChildren();line.classList.remove('ticker-rotation');
    const group=make('span','ticker-group');
    for(const message of messages) {
      group.append(make('span','ticker-message',message));
      const separator=make('span','ticker-separator',options.separator);separator.style.margin=`0 ${options.gap}px`;group.append(separator);
    }
    line.append(group);width=0;needsMeasure=true;
  }
  const observer=new ResizeObserver(()=>{needsMeasure=true;});observer.observe(viewport);
  function draw(now) {
    if(!wrapper.isConnected) { observer.disconnect();return; }
    let ms=clock.update(now);
    if(messages.length && options) {
      if(mode==='rotate') {
        const next=rotationIndex(ms,options.interval,messages.length);
        if(next!==index) { index=next;line.textContent=messages[index]; }
        if(options.fitText){
          const key=JSON.stringify([line.textContent,viewport.clientWidth,viewport.clientHeight,options.font]);
          if(key!==fitKey&&viewport.clientWidth>0&&viewport.clientHeight>0){fitKey=key;fitTextFont(options.font,viewport.clientWidth,Math.max(1,viewport.clientHeight-2),size=>{line.style.fontSize=`${size}px`;return {width:line.scrollWidth,height:line.scrollHeight};});}
        }
      } else {
        if(needsMeasure && viewport.clientWidth>0) {
          // Repeat short sets until they fill the viewport, then duplicate the
          // complete group so either direction always has visible content.
          const group=line.firstElementChild;
          while(line.children.length>1)line.lastElementChild.remove();
          const unit=group.cloneNode(true);group.replaceChildren(...unit.childNodes);
          // offsetWidth is unscaled, unlike the layout editor's transformed rect.
          const natural=group.offsetWidth;
          if(natural>0) {
            const repeat=Math.min(100,Math.max(1,Math.ceil(viewport.clientWidth/natural)));
            for(let i=1;i<repeat;i++)for(const child of [...unit.childNodes])group.append(child.cloneNode(true));
            width=group.offsetWidth;line.append(group.cloneNode(true));needsMeasure=false;
            if(anchor){
              const position=ids.indexOf(anchor.id),child=group.children[Math.max(0,position)*2];
              const distance=child?child.offsetLeft+(position>=0?Math.min(anchor.offset,child.offsetWidth):0):0;
              clock.elapsed=(options.direction==='right'?width-distance:distance)/options.speed*1000;
              ms=clock.elapsed;anchor=null;
            }
          }
        }
        line.style.transform=`translateX(${scrollOffset(ms,width,options.speed,options.pause,options.direction)}px)`;
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  return { update(nextMessages,nextOptions,channel,background) {
    const now=performance.now();clock.update(now,nextOptions.paused);
    const modeChanged=mode!==nextOptions.mode;
    if(modeChanged) {mode=nextOptions.mode;clock=new TickerClock(now);clock.paused=nextOptions.paused;contentKey='';anchor=null;}
    const nextIds=nextMessages.map((m,i)=>typeof m==='string'?String(i):m.id);
    const nextText=nextMessages.map(m=>typeof m==='string'?m:m.text);
    const changed=JSON.stringify([ids,messages])!==JSON.stringify([nextIds,nextText]);
    if(!modeChanged&&mode==='rotate'&&options&&(changed||options.interval!==nextOptions.interval)){
      const oldIndex=rotationIndex(clock.elapsed,options.interval,messages.length);
      const retained=nextIds.indexOf(ids[oldIndex]);
      const nextIndex=retained>=0?retained:Math.min(oldIndex,Math.max(0,nextIds.length-1));
      const fraction=(clock.elapsed%(options.interval*1000))/(options.interval*1000);
      clock.elapsed=(nextIndex+(retained>=0?fraction:0))*nextOptions.interval*1000;
      index=-1;
    }
    if(!modeChanged&&mode==='scroll'&&changed&&width>0&&options&&line.firstElementChild){
      const distance=-scrollOffset(clock.elapsed,width,options.speed,options.pause,options.direction);
      const children=[...line.firstElementChild.children];
      const at=children.findLastIndex((child,i)=>i%2===0&&child.offsetLeft<=distance);
      if(at>=0)anchor={id:ids[(at/2)%ids.length],offset:distance-children[at].offsetLeft};
    }
    options=nextOptions;messages=nextText;ids=nextIds;
    if(mode!=='rotate'||!options.fitText){line.style.fontSize='';fitKey='';}
    surface.style.background=background;surface.style.fontSize=`${options.font}px`;const label=channelLabel(channel);if(tagText.textContent!==label)tagText.textContent=label;tag.title=label;
    surface.hidden=!messages.length;
    const key=JSON.stringify([ids,messages,options.gap,options.separator,options.font]);
    if(contentKey!==key) {
      contentKey=key;index=-1;
      if(mode==='scroll')buildScroll();
      else {line.replaceChildren();line.classList.add('ticker-rotation');line.style.transform='none';index=rotationIndex(clock.elapsed,options.interval,messages.length);line.textContent=messages[index]||'';}
    }
  }};
}
