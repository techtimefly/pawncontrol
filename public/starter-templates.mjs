// Fresh copies shared by first installs and explicit restoration. Never migrate saved content.
export const starterTips=()=>([
      {id:'threats',title:'Before you move',category:'Thinking',text:'Check your opponent’s checks, captures, and threats.',enabled:true},
      {id:'develop',title:'Bring your pieces into play',category:'Opening',text:'Develop your minor pieces, protect your king, and fight for the center.',enabled:true},
      {id:'endgame',title:'Activate your king',category:'Endgame',text:'As pieces leave the board, your king can become an active fighting piece.',enabled:true}
    ]);
export const starterMessages=()=>([
      { id: 'follow', text: 'Enjoying the games? Follow {channel} for more chess!', enabled: true },
      { id: 'notify', text: 'Follow and enable notifications for the next stream.', enabled: true },
      { id: 'session', text: 'Today: {wins}W · {losses}L · {draws}D', enabled: true },
      { id: 'goal', text: 'Blitz climb: {blitz_rating} / {blitz_goal}', enabled: true }
    ]);
export function starterList(kind){
  if(kind==='tips')return starterTips();
  if(kind==='cta')return starterMessages();
  throw new Error('Invalid template list');
}
// Same ID OR exact content (ignoring enabled) counts as present. Never replace edits.
export function addMissingDefaults(kind,current){
  const content=item=>JSON.stringify(kind==='tips'?[item.title,item.category,item.text]:[item.text]);
  const missing=starterList(kind).filter(item=>!current.some(saved=>saved.id===item.id||content(saved)===content(item)));
  return structuredClone([...current,...missing]);
}
