import { HISTORICAL, MODES, rating } from '../public/model.mjs';
export class ChessClient {
  constructor(store, { fetcher=fetch, agent='PawnControl/1.0', now=()=>Date.now() }={}) {
    this.store=store; this.fetcher=fetcher; this.agent=agent; this.now=now; this.busy=false;
  }
  async resource(path, interval) {
    const key=`cache:${path}`, c=this.store.get(key), now=this.now();
    if (c && c.next>now) {
      if (c.error) throw new Error(c.error);
      return c.data;
    }
    const headers={'User-Agent':this.agent, Accept:'application/json'};
    if(c?.etag) headers['If-None-Match']=c.etag;
    if(c?.modified) headers['If-Modified-Since']=c.modified;
    try {
      const response=await this.fetcher(`https://api.chess.com/pub/player/${path}`,{headers,signal:AbortSignal.timeout(15000)});
      if (!response.ok && response.status!==304) {
        const error=new Error(response.status===404 ? 'Player or archive not found (404)' : `Chess.com returned ${response.status}`);
        const retry=response.headers.get('retry-after');
        error.retry=retry ? (/^\d+$/.test(retry)?Number(retry)*1000:Math.max(0,Date.parse(retry)-now)) : 0;
        throw error;
      }
      const maxAge=Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 0)*1000;
      const age=Number(response.headers.get('age') || 0)*1000;
      const data=response.status===304 ? c?.data : await response.json();
      if (!data || typeof data!=='object') throw new Error('Invalid API response');
      this.store.set(key,{data,etag:response.headers.get('etag') || c?.etag,modified:response.headers.get('last-modified') || c?.modified,next:now+Math.max(interval,maxAge-age),failures:0,error:null});
      return data;
    } catch(e) {
      const failures=(c?.failures||0)+1;
      const retry=Math.min(86400000,Math.max(e.retry||0,300000*2**Math.min(failures-1,6)));
      this.store.set(key,{...c,failures,next:now+retry,error:e.message});
      throw e;
    }
  }
  async refresh(getState, commit) {
    if(this.busy) return false;
    this.busy=true;
    const username=getState().username, u=encodeURIComponent(username.toLowerCase());
    const patch={checkedAt:this.now()}, errors=[];
    let success=false;
    try {
      for (const [key,path,interval] of [['stats',`${u}/stats`,300000],['profile',u,86400000]]) {
        try { patch[key]=await this.resource(path,interval); success=true;if(key==='stats'){patch.statsSuccessAt=this.now();patch.statsError=null;} } catch(e) { errors.push(`${key}: ${e.message}`);if(key==='stats')patch.statsError=e.message; }
      }
      if(getState().fields.some(f=>f.visible && HISTORICAL.includes(f.id))) {
        const date=new Date(this.now()), games=[];
        let complete=true;
        for(let offset=0;offset<2;offset++) {
          const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-offset,1));
          const p=`${u}/games/${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;
          try {
            const data=await this.resource(p,300000);
            for(const g of data.games || []) if(g.white?.username && g.black?.username && (g.white.username.toLowerCase()===u || g.black.username.toLowerCase()===u)) games.push(Object.fromEntries(['white','black','time_class','rules','end_time','eco','accuracies','url'].map(k=>[k,g[k]])));
          } catch(e) { errors.push(`archive: ${e.message}`); complete=false; }
        }
        if(complete) patch.games=games.sort((a,b)=>b.end_time-a.end_time).slice(0,1000);
      }
      patch.error=errors.length ? errors.join(' · ') : null;
      if(success) patch.successAt=this.now();
      patch.nextCheck=this.now()+300000;
      const s=getState();
      if(s.username!==username) return false;
      const next=structuredClone(s); Object.assign(next.api,patch);
      for(const m of MODES) if(next.session.baseline[m]==null && rating(next,m)!=null) next.session.baseline[m]=rating(next,m);
      commit(next); return true;
    } finally { this.busy=false; }
  }
}
