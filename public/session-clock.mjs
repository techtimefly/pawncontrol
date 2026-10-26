export function clockStyleDefaults() { return {font:64,family:'sans-serif',color:'#f2f4fa',background:'#272f40',opacity:95,showStatus:true}; }
export function sessionClockDefaults() { return {landscape:clockStyleDefaults(),portrait:clockStyleDefaults()}; }
export function clockWidget(layout='landscape') { return {x:60,y:layout==='portrait'?350:970,w:480,h:150,scale:1,visible:false,locked:false,z:4}; }
export function validateSessionClock(value) {
  if(!value||Object.keys(value).some(k=>!['landscape','portrait'].includes(k)))throw Error('Invalid session clock settings');
  for(const layout of ['landscape','portrait']) {
    const s=value[layout];
    if(!s||Object.keys(s).some(k=>!['font','family','color','background','opacity','showStatus'].includes(k))||!Number.isFinite(s.font)||s.font<18||s.font>160||!['sans-serif','serif','monospace'].includes(s.family)||!/^#[a-fA-F0-9]{6}$/.test(s.color)||!/^#[a-fA-F0-9]{6}$/.test(s.background)||!Number.isFinite(s.opacity)||s.opacity<0||s.opacity>100||typeof s.showStatus!=='boolean')throw Error('Invalid session clock style');
  }
}
export function sessionClockStatus(session) { return session.runningSince!==null?'Running':session.elapsed>0?'Paused':'Not started'; }
// Pure sizing keeps the clock inside even a minimum-size widget; no timer state is owned here.
export function clockFontSize(style,widget,text) {
  return Math.max(1,Math.min(style.font*widget.scale,(widget.w-12)/(text.length*.65), (widget.h-8)/(style.showStatus?1.9:1.2)));
}
