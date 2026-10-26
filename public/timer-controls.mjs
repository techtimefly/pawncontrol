export function createTimerControls({getState,action,confirmChange,document:doc=globalThis.document}) {
  const $=id=>doc.getElementById(id);
  let pending=false;
  function render(){
    const session=getState()?.session;if(!session)return;
    const running=session.runningSince!==null;
    $('timer').textContent=running?'Pause timer':session.elapsed>0?'Resume timer':'Start timer';
    $('timer-status').textContent=running?'Running':session.elapsed>0?'Paused':'Not started';
    for(const id of ['timer','reset-timer','restart-timer'])$(id).disabled=pending;
    $('timer-status').setAttribute('aria-busy',String(pending));
  }
  async function send(command,message){
    if(pending)return;
    pending=true;render();
    try {
      if(message&&!await confirmChange(message))return;
      await action({type:'timer',command});
    } finally {pending=false;render();}
  }
  // Capture intent before entering the shared action queue.
  $('timer').onclick=()=>send(getState().session.runningSince!==null?'pause':'start');
  $('reset-timer').onclick=()=>send('reset','Reset timer to 00:00:00 and leave it stopped? Scores, result history and streak stay unchanged.');
  $('restart-timer').onclick=()=>send('restart','Restart & run from 00:00:00 immediately? Scores, result history and streak stay unchanged.');
  return {render};
}
