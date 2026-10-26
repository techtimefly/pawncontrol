// Disposable, loopback-only visual QA fixture. Never reads production data or Chess.com.
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
const port=Number(process.env.QA_PORT||3148),dataDir=mkdtempSync(join(tmpdir(),'pawn-presentation-qa-'));
const app=createApp({dataDir,username:'qa_player',authRequired:false,poll:false,fetcher:async()=>new Response('{}',{status:200,headers:{'Content-Type':'application/json','Cache-Control':'max-age=86400'}})});
await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${port}`;
let state=app.getState();
async function action(value){const response=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const result=await response.json();if(!response.ok)throw Error(result.error);state=result.state;}
let operation=0;
const goal=(operationName,values)=>action({type:'goal',operation:operationName,operationId:`qa-${++operation}`,expectedRevision:state.goalTracker.revision,...values});
await goal('add',{goal:{title:'Win five thoughtful games',kind:'wins',target:5}});
await goal('add',{goal:{title:'Review every critical endgame — a deliberately long goal title for narrow widgets',kind:'manual',target:8,scope:'ongoing'}});
await goal('add',{goal:{title:'Blitz rating with unavailable baseline',kind:'rating',mode:'blitz',target:1800}});
await goal('feature',{id:state.goalTracker.items[0].id});
await goal('manual',{id:state.goalTracker.items[1].id,delta:1});
await goal('manual',{id:state.goalTracker.items[1].id,delta:1});
await action({type:'record',result:'win'});await action({type:'record',result:'win'});
const widgets=structuredClone(state.widgets),portrait=structuredClone(state.portrait),landscapeGuides=structuredClone(state.landscapeGuides);
Object.assign(widgets.goal,{visible:true,x:900,y:1040,w:1550,h:270});widgets.clock.visible=true;
Object.assign(portrait.widgets.goal,{visible:true,x:60,y:1500,w:960,h:280});portrait.widgets.clock.visible=true;
landscapeGuides.board.enabled=true;landscapeGuides.camera.enabled=true;portrait.guides.board.enabled=true;portrait.guides.camera.enabled=true;
await action({type:'settings',settings:{widgets,portrait,landscapeGuides}});
for(const layout of ['landscape','portrait'])await action({type:'goal-presentation',layout,expectedPresentation:state.goalPresentation[layout],presentation:{...state.goalPresentation[layout],mode:layout==='landscape'?'horizontal':'stacked',selectedIds:state.goalTracker.items.map(g=>g.id),chart:layout==='landscape'?'bar':'donut',dwell:3}});
console.log(`QA fixture: ${base}/control | ${base}/overlay | ${base}/overlay?layout=portrait | ${base}/dock`);
console.log(`Disposable data: ${dataDir}. Stop with Ctrl+C. No physical OBS test is implied.`);
process.on('SIGINT',()=>{app.server.closeAllConnections();void app.close().then(()=>process.exit(0));});

