import {observeViewport} from './viewport.mjs';
import {createCredits} from './bonus-render.mjs';
import {createCreditsSource} from './credits-source.mjs';
import {layoutState,layoutDimensions} from './layouts.mjs';
const params=new URLSearchParams(location.search),token=params.get('token'),root=document.getElementById('credits-root'),error=document.getElementById('overlay-error');
const layout=params.get('layout')==='portrait'?'portrait':'landscape',dimensions=layoutDimensions(layout);
root.style.width=`${dimensions.width}px`;root.style.height=`${dimensions.height}px`;root.dataset.layout=layout;
const player=createCreditsSource(createCredits(root,{autoplay:true}),window);
observeViewport(root,window,dimensions);
const source=new EventSource(token?`/api/events?token=${encodeURIComponent(token)}`:'/api/events');
source.addEventListener('state',event=>{try{const state=layoutState(JSON.parse(event.data),layout);player.update(state.credits,state.creditsPlayback);error.hidden=true;}catch{error.hidden=false;error.textContent='Credits could not load. Update the app and refresh the source.';}});
source.onerror=()=>{if(!root.querySelector('.credits-brand')){error.hidden=false;error.textContent='Waiting for credits connection. Check the server and, when authentication is enabled, use the full credits URL.';}};

