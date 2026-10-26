import {recapDefaults,recapStats,recapSessionKey} from './public/recap-model.mjs';
import {randomUUID} from 'node:crypto';
import {validatePNG,validateIconRegistry,iconReferenced} from './lib/social-icons.mjs';
import {PLATFORMS} from './public/socials-model.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { authenticationConfig } from './lib/auth-config.mjs';
import { Store } from './lib/store.mjs';
import { applyAction, settingsOf } from './lib/state.mjs';
import { ChessClient } from './lib/chess.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const safeEqual=(a,b)=> typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function createApp(config) {
  config={...config,...authenticationConfig(config)};
  const store=new Store(config.dataDir), sessions=new Map(), streams=new Map(), attempts=new Map();
  const passwordSalt=randomBytes(16), passwordHash=config.authRequired?scryptSync(config.password,passwordSalt,32):null;
  let state=store.state(config.username);
  if(!/^[a-zA-Z0-9_-]{2,50}$/.test(state.username) || state.username==='your_chess_username') {
    store.close(); throw new Error('Set CHESS_USERNAME to your Chess.com username before first startup.');
  }
  store.set('state',state);
  const chess=new ChessClient(store,{fetcher:config.fetcher,agent:config.agent || `PawnControl/1.0 (Chess.com username: ${state.username})`});
  const instance=randomBytes(12).toString('hex');
  const publicState=()=>({...settingsOf(state),version:1,goalTracker:state.goalTracker,session:state.session,api:state.api,creditsPlayback:state.creditsPlayback,tipsPlayback:state.tipsPlayback,socialsPlayback:state.socialsPlayback,revision,instance});
  let revision=0;
  const send=(res,event,data)=>res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const commit=next=>{
    store.set('state',next); state=next; revision++;
    const payload=publicState();
    for(const [res,client] of streams) {
      if(client.expires && client.expires<Date.now()) { res.end(); streams.delete(res); continue; }
      if(res.writableLength>2000000) { res.destroy(); streams.delete(res); continue; }
      send(res,'state',payload);
    }
  };
  const json=(res,status,data)=>{ res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
  const body=async req=>{
    const chunks=[]; let n=0;
    for await(const c of req) { n+=c.length; if(n>6000000) throw new Error('Request too large'); chunks.push(c); }
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  };
  const authenticated=req=>{
    const id=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('pawn_session='))?.slice(13);
    const entry=id && sessions.get(id);
    if(entry && entry.expires>Date.now()) return {id,...entry};
    return null;
  };
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('X-Frame-Options','SAMEORIGIN');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
    const url=new URL(req.url,'http://local'), auth=config.authRequired?authenticated(req):{};
    const readonly=!config.authRequired||safeEqual(url.searchParams.get('token'),config.token);
    try {
      if(req.method==='POST') {
        const origin=req.headers.origin;
        if(req.headers['sec-fetch-site']==='cross-site' || (origin && new URL(origin).host!==req.headers.host)) return json(res,403,{error:'Cross-origin request rejected'});
        if(!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'JSON required'});
      }
      if(url.pathname==='/health' && req.method==='GET') return json(res,200,{ok:true});
      if(!config.authRequired&&['/api/login','/api/logout'].includes(url.pathname)&&req.method==='POST')return json(res,200,{ok:true});
      if(url.pathname==='/api/login' && req.method==='POST') {
        const ip=req.socket.remoteAddress, now=Date.now();
        let attempt=attempts.get(ip); if(!attempt || attempt.until<now) { attempt={count:0,until:now+900000}; attempts.set(ip,attempt); }
        if(attempt.count>=10) return json(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
        const data=await body(req); attempt.count++;
        if(typeof data.password!=='string' || data.password.length>1024 || !timingSafeEqual(scryptSync(data.password,passwordSalt,32),passwordHash)) return json(res,401,{error:'Incorrect password'});
        attempts.delete(ip);
        const id=randomBytes(32).toString('hex'), expires=now+12*3600000;
        sessions.set(id,{expires});
        res.setHeader('Set-Cookie',`pawn_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${config.secure?'; Secure':''}`);
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/logout' && req.method==='POST' && auth) {
        sessions.delete(auth.id); for(const [r,c] of streams) if(c.session===auth.id) { r.end(); streams.delete(r); }
        res.setHeader('Set-Cookie','pawn_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'); return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/state' && req.method==='GET') {
        if(!auth&&!readonly) return json(res,401,{error:'Sign in required'});
        return json(res,200,publicState());
      }
      if(url.pathname==='/api/events' && req.method==='GET') {
        if(!auth&&!readonly) return json(res,401,{error:'Sign in required'});
        if(streams.size>=100) return json(res,503,{error:'Too many clients'});
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
        res.flushHeaders(); streams.set(res,{session:auth?.id,expires:auth?.expires}); send(res,'state',publicState());
        req.on('close',()=>streams.delete(res)); return;
      }
      if(url.pathname.startsWith('/api/social-icons/') && req.method==='GET') {
        if(!auth&&!readonly)return json(res,401,{error:'Sign in required'});
        const id=url.pathname.slice('/api/social-icons/'.length);
        if(!/^[a-f0-9]{32}$/.test(id)||!Object.hasOwn(state.socialIcons,id))return json(res,404,{error:'Icon not found'});
        res.writeHead(200,{'Content-Type':'image/png'});res.end(Buffer.from(state.socialIcons[id],'base64'));return;
      }
      if(url.pathname.startsWith('/api/')) {
        if(!auth) return json(res,401,{error:'Sign in required'});
        if(url.pathname==='/api/social-icons'&&req.method==='GET')return json(res,200,{icons:Object.keys(state.socialIcons).map(id=>({id,referenced:iconReferenced(state,id)}))});
        if(url.pathname==='/api/social-icons'&&req.method==='POST') {
          const upload=await body(req),data=validatePNG(upload.data),id=randomUUID().replaceAll('-','');
          const icons=validateIconRegistry({...state.socialIcons,[id]:data});commit({...state,socialIcons:icons});return json(res,200,{id});
        }
        if(url.pathname==='/api/social-icons/delete'&&req.method==='POST') {
          const {id}=await body(req);if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id))throw Error('Invalid icon identifier');
          if(iconReferenced(state,id))throw Error('Icon is still used by an entry or preset');
          const icons={...state.socialIcons};delete icons[id];commit({...state,socialIcons:icons});return json(res,200,{ok:true});
        }
        if(url.pathname==='/api/recap' && req.method==='GET')return json(res,200,{recap:state.recap??recapDefaults(),stats:recapStats(state),sessionKey:recapSessionKey(state)});
        if(url.pathname==='/api/admin' && req.method==='GET') return json(res,200,{authRequired:config.authRequired,...(config.authRequired?{token:config.token}:{}),presets:Object.keys(state.presets),canUndo:!!state.undo.length});
        if(url.pathname==='/api/export' && req.method==='GET') { res.setHeader('Content-Disposition','attachment; filename="pawn-control-backup.json"'); return json(res,200,{version:1,settings:settingsOf(state),session:state.session,presets:state.presets,socialIcons:state.socialIcons,recap:state.recap,goalTracker:state.goalTracker}); }
        if(url.pathname==='/api/action' && req.method==='POST') {
          const action=await body(req); commit(applyAction(state,action));
          if(action.type==='settings' || action.type==='import') void refresh();
          return json(res,200,{ok:true,state:publicState(),...(action.type==='recap'?{recap:state.recap,stats:recapStats(state),sessionKey:recapSessionKey(state)}:{})});
        }
        if(url.pathname==='/api/refresh' && req.method==='POST') { void refresh(); return json(res,202,{ok:true}); }
        return json(res,404,{error:'Not found'});
      }
      const files={'/timer-controls.mjs':'timer-controls.mjs','/identity.mjs':'identity.mjs','/recap-model.mjs':'recap-model.mjs','/recap-controls.mjs':'recap-controls.mjs','/layouts.mjs':'layouts.mjs','/starter-templates.mjs':'starter-templates.mjs','/starter-controls.mjs':'starter-controls.mjs',...Object.fromEntries(['socials-model.mjs','socials-render.mjs','socials-controls.mjs','goals-model.mjs','goals-controls.mjs','goals-render.mjs'].map(f=>['/'+f,f])),...Object.fromEntries(Object.keys(PLATFORMS).map(k=>['/social-icons/'+k+'.svg','social-icons/'+k+'.svg'])),'/pawn-logo.svg':'pawn-logo.svg','/viewport.mjs':'viewport.mjs','/cta-text.mjs':'cta-text.mjs','/cta-text-controls.mjs':'cta-text-controls.mjs','/tips-text.mjs':'tips-text.mjs','/tips-text-controls.mjs':'tips-text-controls.mjs','/':'control.html','/control':'control.html','/dock':'control.html','/dock/':'control.html','/dock/score':'control.html','/dock/cta':'control.html','/overlay':'overlay.html','/credits':'credits.html','/credits.mjs':'credits.mjs','/credits-source.mjs':'credits-source.mjs','/bonus-model.mjs':'bonus-model.mjs','/bonus-render.mjs':'bonus-render.mjs','/bonus-controls.mjs':'bonus-controls.mjs','/control.mjs':'control.mjs','/overlay.mjs':'overlay.mjs','/render.mjs':'render.mjs','/ticker.mjs':'ticker.mjs','/model.mjs':'model.mjs','/styles.css':'styles.css'};
      if(req.method==='GET' && files[url.pathname]) {
        const file=files[url.pathname], ext=file.split('.').pop();
        res.writeHead(200,{'Content-Type':{html:'text/html; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'}[ext]});
        res.end(await readFile(join(root,'public',file))); return;
      }
      json(res,404,{error:'Not found'});
    } catch(e) { if(!res.headersSent) json(res,400,{error:e.message}); else res.end(); }
  });
  const refresh=async()=>{ try { await chess.refresh(()=>state,commit); } catch(e) { console.error('API refresh:',e.message); } };
  const heartbeat=setInterval(()=>{
    const now=Date.now();
    for(const [id,s] of sessions) if(s.expires<now) sessions.delete(id);
    for(const [ip,a] of attempts) if(a.until<now) attempts.delete(ip);
    for(const [res,c] of streams) if(c.expires && c.expires<now) { res.end(); streams.delete(res); } else res.write(': keepalive\n\n');
  },15000); heartbeat.unref();
  let poll;
  if(config.poll!==false) { server.on('listening',()=>void refresh()); poll=setInterval(()=>void refresh(),300000); poll.unref(); }
  return {server,store,getState:()=>state,refresh,close:async()=>{
    clearInterval(heartbeat); clearInterval(poll);
    for(const res of streams.keys()) res.end();
    await new Promise(resolve=>server.close(resolve)); store.close();
  }};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(existsSync(join(root,'.env'))) process.loadEnvFile(join(root,'.env'));
  let auth;
  try { auth=authenticationConfig({authRequired:process.env.AUTH_REQUIRED,password:process.env.CONTROL_PASSWORD,token:process.env.OVERLAY_TOKEN}); }
  catch(e) { console.error(e.message); process.exit(1); }
  const app=createApp({...auth,username:process.env.CHESS_USERNAME,dataDir:resolve(process.env.DATA_DIR||join(root,'data')),secure:process.env.COOKIE_SECURE==='true',agent:process.env.CHESS_USER_AGENT});
  app.server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log(`Pawn Control: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3000}/control`));
  app.server.on('error',e=>{ console.error(e.message); process.exitCode=1; });
  for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
