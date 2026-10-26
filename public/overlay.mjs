import {suppressGoalAnimation} from './goals-render.mjs';
import {observeViewport} from './viewport.mjs';
import { renderCanvas, tickCanvas } from './render.mjs';
import {layoutState,layoutDimensions} from './layouts.mjs';
const canvas=document.getElementById('overlay-canvas'), error=document.getElementById('overlay-error');
const params=new URLSearchParams(location.search),token=params.get('token');
// Each browser source owns its composition for its entire lifetime.
const layout=params.get('layout')==='portrait'?'portrait':'landscape',dimensions=layoutDimensions(layout);let state,goalReconnect=false;
canvas.style.width=`${dimensions.width}px`;canvas.style.height=`${dimensions.height}px`;
canvas.dataset.layout=layout;
observeViewport(canvas,window,dimensions);
const source=new EventSource(token?`/api/events?token=${encodeURIComponent(token)}`:'/api/events');
source.addEventListener('state',event=>{if(goalReconnect)suppressGoalAnimation(canvas);goalReconnect=false;state=layoutState(JSON.parse(event.data),layout); renderCanvas(canvas,state); error.hidden=true;});
source.onerror=()=>{ goalReconnect=true;suppressGoalAnimation(canvas); if(!state) { error.hidden=false; error.textContent='Waiting for overlay connection. Check the server and, when authentication is enabled, use the URL from Settings.'; } };
setInterval(()=>{if(state)tickCanvas(canvas,state);},1000);

