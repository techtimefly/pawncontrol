// Disposable loopback QA only. No .env, real user data or external polling.
import {createApp} from '../server.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'pawn-cta-qa-'));
const app=createApp({dataDir:dir,authRequired:false,username:'cta_fixture',poll:false,fetcher:async()=>new Response('{}',{status:404})});
const handler=app.server.listeners('request')[0];app.server.removeListener('request',handler);
app.server.on('request',async(req,res)=>{if(req.url==='/qa'){res.writeHead(200,{'Content-Type':'text/html'});res.end(await readFile(new URL('./cta-qa.html',import.meta.url)));}else handler(req,res);});
app.server.listen(3327,'127.0.0.1',()=>console.log('Disposable cta QA http://127.0.0.1:3327/qa'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await app.close();rmSync(dir,{recursive:true,force:true});process.exit(0);});
