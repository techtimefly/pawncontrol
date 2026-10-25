// Disposable local QA only: no .env, external fetches, credentials or production data.
import {createApp} from '../server.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'pawn-starter-qa-'));
const app=createApp({dataDir:dir,authRequired:false,username:'starter_fixture',poll:false,fetcher:async()=>new Response('{}',{status:404})});
let failNext=false;
const handler=app.server.listeners('request')[0];app.server.removeListener('request',handler);
app.server.on('request',async(req,res)=>{
  if(req.url==='/qa'){res.writeHead(200,{'Content-Type':'text/html'});res.end(await readFile(new URL('./starter-qa.html',import.meta.url)));return;}
  if(req.url==='/qa/fail'&&req.method==='POST'){failNext=true;res.end('armed');return;}
  if(req.url==='/api/action'&&failNext){failNext=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Disposable QA simulated failure'}));return;}
  handler(req,res);
});
app.server.listen(3328,'127.0.0.1',()=>console.log('Disposable starter QA: http://127.0.0.1:3328/qa'));
process.on('SIGINT',()=>{app.server.closeAllConnections();app.server.close(()=>{app.store.close();rmSync(dir,{recursive:true,force:true});process.exit();});});
