import {SocialTimeline,PLATFORMS,enabledSocials,socialPlatforms} from './socials-model.mjs';
const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
export function socialIconURL(entry){
  if(!entry.icon)return `/social-icons/${entry.platform}.svg`;
  const token=new URLSearchParams(location.search).get('token');
  return `/api/social-icons/${entry.icon}${token?'?token='+encodeURIComponent(token):''}`;
}
export function createSocials(root,{fit=true}={}){
  root.classList.add('socials-surface');const content=el('div','socials-content');root.replaceChildren(content);
  const timeline=new SocialTimeline();let settings,key='';
  function render(){
    if(!settings)return;
    const items=settings.mode==='row'?enabledSocials(settings):timeline.items.filter(e=>e.id===timeline.id);
    const nextKey=JSON.stringify([items,settings.font,settings.mode]);root.dataset.socialId=timeline.id??'';root.style.visibility=items.length?'visible':'hidden';
    if(nextKey!==key){key=nextKey;content.replaceChildren();content.style.fontSize=`${settings.font}px`;
      for(const item of items){const card=el('div','social-entry'),cluster=el('div','social-icons');for(const platform of socialPlatforms(item).filter(p=>p.enabled)){const image=el('img','social-icon');image.src=socialIconURL(platform);image.alt=PLATFORMS[platform.platform];image.width=40;image.height=40;cluster.append(image);}
        const copy=el('div','social-copy');if(item.cta)copy.append(el('div','social-cta',item.cta));copy.append(el('div','social-handle',item.text));card.append(cluster,copy);content.append(card);}
    }
    const width=root.clientWidth,height=root.clientHeight;if(!width||!height)return;
    content.style.width=`${width}px`;content.style.transform='';if(!fit)return;
    const scale=Math.min(1,height/Math.max(1,content.scrollHeight),width/Math.max(1,content.scrollWidth));content.style.transform=`scale(${scale})`;
  }
  function draw(now){if(!root.isConnected)return;const id=timeline.id;timeline.tick(now);if(id!==timeline.id)render();requestAnimationFrame(draw);}
  requestAnimationFrame(draw);new ResizeObserver(render).observe(root);
  return {timeline,update(s,p){settings=s;timeline.update(s,p,performance.now());render();}};
}
