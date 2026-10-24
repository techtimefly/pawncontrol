import {createSocials} from './socials-render.mjs';
import { createTicker } from './ticker.mjs';
import {createCredits,createTips} from './bonus-render.mjs';
import { FIELDS, rating, totals, streaks, elapsed, clock, tickerEntries, historyStats,WIDGET_IDS } from './model.mjs';
export const el=(tag,cls,text)=>{ const e=document.createElement(tag); if(cls)e.className=cls; if(text!=null)e.textContent=text; return e; };
const rgba=(hex,opacity)=>`${hex}${Math.round(opacity/100*255).toString(16).padStart(2,'0')}`;
export function statValues(s) {
  const t=totals(s.session), count=t.win+t.loss+t.draw, streak=streaks(s.session), r=rating(s,s.activeMode), baseline=s.session.baseline[s.activeMode], h=historyStats(s);
  return {
    username:s.username, blitz:rating(s,'blitz')??'Unrated', rapid:rating(s,'rapid')??'Unrated', bullet:rating(s,'bullet')??'Unrated',
    session:['win','loss','draw'].filter(k=>s.parts[k]).map(k=>`${t[k]}${k==='win'?'W':k==='loss'?'L':'D'}`).join(' · ') || '—',
    streak:streak.label, bestStreak:`${streak.best}W`, winRate:count?`${Math.round(t.win/count*100)}%`:'—',
    delta:r!=null&&baseline!=null?`${r-baseline>=0?'+':''}${r-baseline} ${s.activeMode}`:'—',
    best:s.api.stats?.[`chess_${s.activeMode}`]?.best?.rating??'—', goal:r!=null?`${r} / ${s.goals[s.activeMode]}`:'—',
    recent:s.session.results.slice(-10).map(r=>r.result==='win'?'W':r.result==='loss'?'L':'D').join(' ') || '—',
    timer:clock(elapsed(s.session)), form:h.form, whiteRate:h.whiteRate, blackRate:h.blackRate, opponent:h.opponent, opening:h.opening,
    endings:h.endings, accuracy:h.accuracy, puzzle:s.api.stats?.puzzle_rush?.best?.score??'—'
  };
}
export function renderCanvas(canvas,s,{editor=false}={}) {
  canvas.style.setProperty('--accent',s.theme.accent); canvas.style.setProperty('--card-bg',rgba(s.theme.background,s.theme.opacity));
  canvas.style.setProperty('--ink',s.theme.foreground); canvas.style.setProperty('--quiet',s.theme.muted);
  canvas.style.setProperty('--streak',s.theme.streak); canvas.style.setProperty('--radius',`${s.theme.radius}px`);
  canvas.style.setProperty('--font-size',`${s.theme.font}px`); canvas.style.setProperty('--padding',`${s.theme.padding}px`); canvas.style.setProperty('--row-gap',`${s.theme.gap}px`);
  const values=statValues(s);
  for(const id of WIDGET_IDS) {
    let wrapper=canvas.querySelector(`[data-widget="${id}"]`);
    if(!wrapper) { wrapper=el('div',`broadcast-widget ${id}-widget`); wrapper.dataset.widget=id; canvas.append(wrapper); }
    const w=s.widgets[id];
    wrapper.style.cssText=`left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px;z-index:${w.z};display:${w.visible?'block':'none'}`;
    wrapper.classList.toggle('position-locked',s.layoutLocked||w.locked);
    if(id==='credits') {
      if(!wrapper._credits){const content=el('div','credits-content');wrapper.append(content);wrapper._credits=createCredits(content,{autoplay:w.visible});}
      if(w.visible&&!wrapper._wasVisible)wrapper._credits.command('restart');
      wrapper._wasVisible=w.visible;wrapper._credits.update({...s.credits,font:s.credits.font*w.scale,heading:s.credits.heading*w.scale,brandSize:s.credits.brandSize*w.scale,gap:s.credits.gap*w.scale},s.creditsPlayback);
    }
    else if(id==='tips') {
      if(!wrapper._tips){const content=el('div','tips-content');wrapper.append(content);wrapper._tips=createTips(content);}
      wrapper._tips.update({...s.tips,font:s.tips.font*w.scale},s.tipsPlayback);
    }
    else if(id==='socials') {
      if(!wrapper._socials){const content=el('div','socials-root');wrapper.append(content);wrapper._socials=createSocials(content);}
      wrapper._socials.update({...s.socials,font:s.socials.font*w.scale},s.socialsPlayback);
    }
    else if(id==='ticker') { renderTicker(wrapper,s); }
    else {
      wrapper.replaceChildren(); const card=el('div',`broadcast-card ${id}-card`); wrapper.append(card); card.style.width=`${w.w/w.scale}px`;
      if(id==='stats') {
        for(const field of s.fields.filter(f=>f.visible)) {
          const [icon,label]=FIELDS[field.id];
          if(field.id==='username') {
            const header=el('div','player-header');
            if(s.showAvatar && s.api.profile?.avatar && /^https:\/\//.test(s.api.profile.avatar)) { const img=el('img','player-avatar'); img.src=s.api.profile.avatar; img.alt=''; img.referrerPolicy='no-referrer'; header.append(img); }
            else header.append(el('span','crown','♛'));
            header.append(el('span','player-name',s.username)); card.append(header); continue;
          }
          const row=el('div',`stat-row ${field.id===s.activeMode?'active-rating':''}`);
          const left=el('span','stat-label'); left.append(el('span','stat-icon',icon),el('span','',label));
          const val=el('span','stat-value',values[field.id]);
          if(field.id==='timer') val.dataset.timer='true';
          if(field.id==='streak') { val.classList.add('streak-badge'); val.classList.toggle('loss',streaks(s.session).kind==='loss'); }
          if(field.id==='recent') val.classList.add('result-strip');
          if(['opening','endings'].includes(field.id)) row.classList.add('long-value');
          row.append(left,val); card.append(row);
          if(field.id==='goal' && rating(s,s.activeMode)!=null) {
            const track=el('div','goal-track'), bar=el('div','goal-fill'); bar.style.width=`${Math.min(100,rating(s,s.activeMode)/s.goals[s.activeMode]*100)}%`; track.append(bar); card.append(track);
          }
        }
      } else {
        card.append(el('div','scoreboard-heading','THIS SESSION'));
        const scores=el('div','scoreboard-values'), t=totals(s.session);
        for(const [k,label] of [['win','WINS'],['loss','LOSSES'],['draw','DRAWS']]) if(s.parts[k]) { const cell=el('div',`scoreboard-cell ${k}`); cell.append(el('strong','',t[k]),el('span','',label)); scores.append(cell); }
        card.append(scores);
      }
      requestAnimationFrame(()=>{
        const fit=Math.min(w.scale,w.h/Math.max(1,card.scrollHeight)); card.style.transform=`scale(${fit})`;
      });
    }
    if(editor && !wrapper.querySelector('.resize-handle')) { const handle=el('button','resize-handle'); handle.type='button'; handle.setAttribute('aria-label',`Resize ${id}`); wrapper.append(handle); }
  }
}
function renderTicker(wrapper,s) {
  if(!wrapper._ticker)wrapper._ticker=createTicker(wrapper);
  wrapper._ticker.update(tickerEntries(s),s.ticker,s.channel,rgba(s.theme.background,s.ticker.opacity));
}
export function tickCanvas(canvas,s) { for(const e of canvas.querySelectorAll('[data-timer]')) e.textContent=clock(elapsed(s.session)); }
