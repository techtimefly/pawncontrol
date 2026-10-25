import {totals,streaks,rating} from './model.mjs';

export function recapDefaults() {
  return {version:1,revision:0,templates:{
    live:'Live session update: {wins}W / {losses}L / {draws}D in {games} games. Win rate: {win_rate}. Best winning streak: {best_streak}. {time_control} rating: {rating}. {stream_link} {hashtags}',
    complete:'Session complete! {wins}W / {losses}L / {draws}D — {games} games, {win_rate} win rate. Best winning streak: {best_streak}. {time_control} rating: {rating}. {stream_link} {hashtags}'
  },streamLink:'',hashtags:'',draft:null,snapshots:[]};
}
export function recapStats(state) {
  const t=totals(state.session),games=t.win+t.loss+t.draw;
  return {username:state.username,wins:t.win,losses:t.loss,draws:t.draw,games,
    winRate:games?Math.round(t.win/games*100):null,bestStreak:streaks(state.session).best,
    rating:rating(state,state.activeMode),mode:state.activeMode,startedAt:state.session.startedAt,
    hasCorrections:Object.values(state.session.corrections).some(n=>n!==0)};
}
// Excludes timer ticks; includes ordered results, identity, active rating and corrections.
export function recapSessionKey(state) {
  return JSON.stringify({stats:recapStats(state),results:state.session.results,corrections:state.session.corrections});
}
export function renderRecapTemplate(template,stats,{streamLink='',hashtags=''}={}) {
  const values={username:stats.username,wins:stats.wins,losses:stats.losses,draws:stats.draws,games:stats.games,
    win_rate:stats.winRate===null?'N/A':`${stats.winRate}%`,best_streak:stats.bestStreak,
    rating:stats.rating??'unavailable',time_control:stats.mode[0].toUpperCase()+stats.mode.slice(1),stream_link:streamLink,hashtags};
  return template.replace(/\{([a-z_]+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
}
