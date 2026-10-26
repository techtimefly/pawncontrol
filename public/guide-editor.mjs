import {layoutDimensions} from './layouts.mjs';

export function reservationGeometry(original,dx,dy,{layout='landscape',resize=false,snap=false}={}) {
  const {width,height}=layoutDimensions(layout),round=v=>snap?Math.round(v/20)*20:Math.round(v);
  const next={...original};
  if(resize){
    if(original.aspectLocked){
      const ratio=original.w/original.h;
      const proposed=Math.abs(dx)>=Math.abs(dy*ratio)?round(original.w+dx):round(original.h+dy)*ratio;
      next.w=Math.max(Math.max(1,ratio),Math.min(width-original.x,(height-original.y)*ratio,proposed));
      next.h=next.w/ratio;
    }else{
      next.w=Math.max(1,Math.min(width-original.x,round(original.w+dx)));
      next.h=Math.max(1,Math.min(height-original.y,round(original.h+dy)));
    }
  }else{
    next.x=Math.max(0,Math.min(width-original.w,round(original.x+dx)));
    next.y=Math.max(0,Math.min(height-original.h,round(original.y+dy)));
    if(snap&&Math.abs(next.x-(width-next.w))<20)next.x=width-next.w;
    if(snap&&Math.abs(next.y-(height-next.h))<20)next.y=height-next.h;
  }
  return next;
}

// One pointer transaction owns its captured orientation and geometry until commit/cancel.
export function bindGuideEditor(host,{getContext,setDragging,save,render}) {
  let active=null;
  const cancel=()=>active?.cancel();
  host.addEventListener('pointerdown',event=>{
    const node=event.target.closest('[data-reservation]');
    if(!node||active||event.button!==0)return;
    const context=getContext(),key=node.dataset.reservation,original=structuredClone(context.guides[key]);
    if(context.locked)return;
    const scale=host.getBoundingClientRect().width/layoutDimensions(context.layout).width;
    if(!Number.isFinite(scale)||scale<=0)return;
    event.preventDefault();event.stopPropagation();
    const pointer=event.pointerId,startX=event.clientX,startY=event.clientY,resize=!!event.target.closest('.guide-resize');
    let next=original,done=false;
    const move=e=>{
      if(e.pointerId!==pointer)return;
      next=reservationGeometry(original,(e.clientX-startX)/scale,(e.clientY-startY)/scale,{...context,resize});
      Object.assign(node.style,{left:`${next.x}px`,top:`${next.y}px`,width:`${next.w}px`,height:`${next.h}px`});
    };
    const cleanup=()=>{
      done=true;active=null;setDragging(false);
      for(const [name,fn] of [['pointermove',move],['pointerup',finish],['pointercancel',abort],['lostpointercapture',abort]])node.removeEventListener(name,fn);
      if(node.hasPointerCapture(pointer))node.releasePointerCapture(pointer);
    };
    const abort=e=>{if(done||(e&&e.pointerId!==pointer))return;cleanup();render();};
    const finish=e=>{
      if(done||e.pointerId!==pointer)return;move(e);cleanup();
      if(JSON.stringify(next)!==JSON.stringify(original))save(context.layout,key,original,next);else render();
    };
    active={cancel:()=>abort()};setDragging(true);node.setPointerCapture(pointer);
    for(const [name,fn] of [['pointermove',move],['pointerup',finish],['pointercancel',abort],['lostpointercapture',abort]])node.addEventListener(name,fn);
  });
  return {cancel};
}
