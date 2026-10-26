import {channelText} from './identity.mjs';
import {portraitDefaults,guideDefaults} from './layouts.mjs';
import {starterMessages} from './starter-templates.mjs';
import {socialDefaults,socialWidget} from './socials-model.mjs';
import {bonusDefaults} from './bonus-model.mjs';
export const MODES = ['blitz', 'rapid', 'bullet'];
export const WIDGET_IDS = ['stats','scoreboard','ticker','tips','credits','socials'];
// CTA identifiers are local record keys, not authentication credentials.
let messageSequence=0;
export function createMessageId(cryptoProvider=globalThis.crypto) {
  if(typeof cryptoProvider?.randomUUID==='function')return cryptoProvider.randomUUID();
  if(typeof cryptoProvider?.getRandomValues==='function') {
    const bytes=cryptoProvider.getRandomValues(new Uint8Array(16));
    return 'cta-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  return `cta-${Date.now().toString(36)}-${(++messageSequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export const FIELDS = {
  username: ['♛', 'Player'], blitz: ['ϟ', 'Blitz'], rapid: ['◷', 'Rapid'], bullet: ['↗', 'Bullet'],
  session: ['♜', 'Session'], streak: ['♨', 'Session streak'], bestStreak: ['★', 'Best session streak'],
  winRate: ['%', 'Session win rate'], delta: ['↗', 'Rating change'], best: ['♛', 'Personal best'],
  goal: ['◎', 'Rating goal'], recent: ['▦', 'Session results'], timer: ['◷', 'Session time'],
  form: ['▤', 'Recent form'], whiteRate: ['♙', 'White win rate'], blackRate: ['♟', 'Black win rate'],
  opponent: ['♟', 'Avg. opponent'], opening: ['♞', 'Top opening'], endings: ['⚑', 'Win endings'],
  accuracy: ['◎', 'Accuracy'], puzzle: ['◇', 'Puzzle Rush best']
};
export const HISTORICAL = ['form', 'whiteRate', 'blackRate', 'opponent', 'opening', 'endings', 'accuracy'];
export const PRESETS = {
  Minimal: ['username', 'blitz', 'session', 'streak'],
  Session: ['username', 'blitz', 'rapid', 'bullet', 'session', 'streak', 'winRate', 'recent'],
  Full: Object.keys(FIELDS)
};
export function defaults() {
  const bonus=bonusDefaults();
  return {
    socials:socialDefaults(),socialIcons:{},socialsPlayback:{seq:0,paused:false,command:null,currentId:null},
    credits:bonus.credits,tips:bonus.tips,creditsPlayback:bonus.creditsPlayback,tipsPlayback:bonus.tipsPlayback,
    portrait:portraitDefaults(),landscapeGuides:guideDefaults(),
    version: 1, username: 'your_chess_username', channel: '', activeMode: 'blitz', showAvatar: false,
    fields: Object.keys(FIELDS).map(id => ({ id, visible: ['username','blitz','rapid','bullet','session','streak'].includes(id) })),
    parts: { win: true, loss: true, draw: true },
    goals: { blitz: 1500, rapid: 1500, bullet: 1000 }, overrides: { blitz: null, rapid: null, bullet: null },
    theme: { accent: '#27baf3', background: '#272f40', foreground: '#f2f4fa', muted: '#a5b2c6', streak: '#ff622d', opacity: 95, radius: 22, font: 26, padding: 26, gap: 14 },
    widgets: {
      ...bonus.widgets,socials:socialWidget(),
      stats: { x: 2070, y: 70, w: 430, h: 390, scale: 1, visible: true, locked: false, z: 2 },
      scoreboard: { x: 70, y: 1190, w: 650, h: 160, scale: 1, visible: false, locked: false, z: 3 },
      ticker: { x: 70, y: 1350, w: 2420, h: 60, scale: 1, visible: true, locked: false, z: 1 }
    },
    layoutLocked: false, snap: true,
    ticker: { mode: 'scroll', interval: 25, speed: 100, gap: 40, pause: 2, direction: 'left', paused: false, font: 28, opacity: 95, separator: '♟', messages: starterMessages() },
    session: newSession(), undo: [], presets: {},
    api: { profile: null, stats: null, games: [], checkedAt: null, successAt: null, error: null, nextCheck: null }
  };
}
export function newSession(baseline = {}) { return { startedAt: Date.now(), results: [], corrections: { win: 0, loss: 0, draw: 0 }, baseline, elapsed: 0, runningSince: null }; }
export function totals(session) {
  const t = { ...session.corrections };
  for (const r of session.results) t[r.result]++;
  return t;
}
export function streaks(session) {
  let current = 0, kind = null, best = 0, wins = 0;
  for (const { result } of session.results) {
    wins = result === 'win' ? wins + 1 : 0; best = Math.max(best, wins);
    if (result === 'draw') { current = 0; kind = null; }
    else { current = kind === result ? current + 1 : 1; kind = result; }
  }
  return { current, kind, best, label: current ? `${current}${kind === 'win' ? 'W' : 'L'}` : '—' };
}
export function rating(state, mode) { return state.overrides[mode] ?? state.api.stats?.[`chess_${mode}`]?.last?.rating ?? null; }
export function elapsed(session, now = Date.now()) { return session.elapsed + (session.runningSince!==null ? Math.max(0, now - session.runningSince) : 0); }
export function clock(ms) { const s = Math.floor(ms / 1000); return [Math.floor(s/3600), Math.floor(s/60)%60, s%60].map(n => String(n).padStart(2,'0')).join(':'); }
export const tickerMessages=state=>tickerEntries(state).map(m=>m.text);
export function tickerEntries(state) {
  const t = totals(state.session), values = { username: state.username, channel: channelText(state.channel), wins: t.win, losses: t.loss, draws: t.draw, streak: streaks(state.session).label };
  for (const mode of MODES) { values[`${mode}_rating`] = rating(state, mode); values[`${mode}_goal`] = state.goals[mode]; }
  return state.ticker.messages.filter(m => m.enabled).map(m => {
    let missing = false;
    const text = m.text.replace(/\{([a-z_]+)\}/g, (match, key) => {
      if (!(key in values)) return match;
      if (values[key] == null) { missing = true; return ''; }
      return values[key];
    });
    return missing || !text.trim() ? null : {...m,text};
  }).filter(Boolean);
}
export function historyStats(state) {
  const games = state.api.games.filter(g => g.time_class === state.activeMode && g.rules === 'chess')
    .sort((a,b) => b.end_time-a.end_time).slice(0,50);
  let wins=0, white=0, whiteWins=0, black=0, blackWins=0, opponents=[], accuracies=[], openings={}, endings={};
  for (const g of games) {
    const color = g.white.username.toLowerCase() === state.username.toLowerCase() ? 'white' : 'black';
    const me = g[color], opponent = g[color === 'white' ? 'black' : 'white'];
    const won = me.result === 'win'; wins += Number(won);
    if (color === 'white') { white++; whiteWins += Number(won); } else { black++; blackWins += Number(won); }
    if (Number.isFinite(opponent.rating)) opponents.push(opponent.rating);
    if (Number.isFinite(g.accuracies?.[color])) accuracies.push(g.accuracies[color]);
    if (g.eco) { const name = g.eco.split('/').pop().replaceAll('-', ' '); openings[name] = (openings[name] || 0) + 1; }
    if (won) endings[opponent.result] = (endings[opponent.result] || 0) + 1;
  }
  const pct = (a,b) => b ? `${Math.round(a/b*100)}% (${b})` : '—';
  const top = Object.entries(openings).sort((a,b)=>b[1]-a[1])[0];
  return { n: games.length, form: pct(wins,games.length), whiteRate: pct(whiteWins,white), blackRate: pct(blackWins,black),
    opponent: opponents.length ? String(Math.round(opponents.reduce((a,b)=>a+b,0)/opponents.length)) : '—',
    opening: top ? `${top[0]} · ${top[1]}` : '—',
    endings: Object.entries(endings).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v]) => `${k} ${v}`).join(' · ') || '—',
    accuracy: accuracies.length ? `${(accuracies.reduce((a,b)=>a+b,0)/accuracies.length).toFixed(1)}% (${accuracies.length}/${games.length})` : '—' };
}
