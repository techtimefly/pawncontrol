import {createMessageId} from './model.mjs';

export const CTA_LIMITS={items:50,text:500,id:80};
const encode=value=>value.trim()!==value||/[\r\n]/.test(value)||value.startsWith('"')?JSON.stringify(value):value;
export const sameMessages=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const serializeMessages=items=>items.map(m=>`ID: ${encode(m.id)}\nEnabled: ${m.enabled?'yes':'no'}\nText: ${encode(m.text)}`).join('\n\n');
export function parseMessages(source,format,existing=[],operation='replace') {
  if(!['structured','simple'].includes(format)||!['append','replace'].includes(operation))throw new Error('Unknown text mode');
  const errors=[],items=[],seen=new Set(),byId=new Map(existing.map(m=>[m.id,m]));
  const error=(line,message)=>errors.push({line,message});
  let fields={},lines={},start=1;
  function finish(){
    if(!Object.keys(fields).length)return;
    const hasId=Object.hasOwn(fields,'ID'),old=hasId?byId.get(fields.ID):null;
    if(hasId&&(!old||operation==='append'))error(lines.ID,'ID must belong to an existing message in Replace all. Remove ID to create a new message.');
    if(hasId&&seen.has(fields.ID))error(lines.ID,'Duplicate ID');
    if(hasId)seen.add(fields.ID);
    if(!Object.hasOwn(fields,'Text')||!fields.Text.trim())error(lines.Text||start,'Text is required and cannot be empty');
    for(const [key,max] of [['ID',CTA_LIMITS.id],['Text',CTA_LIMITS.text]])if(fields[key]?.length>max)error(lines[key],`${key} exceeds ${max} characters`);
    if(Object.hasOwn(fields,'Enabled')&&!['yes','no'].includes(fields.Enabled))error(lines.Enabled,'Enabled must be yes or no');
    items.push({...old,id:old?.id??createMessageId(),enabled:fields.Enabled===undefined?(old?.enabled??true):fields.Enabled==='yes',text:fields.Text??''});
    if(items.length+(operation==='append'?existing.length:0)>CTA_LIMITS.items)error(start,'Maximum 50 messages');
    fields={};lines={};
  }
  source.replace(/\r\n?/g,'\n').split('\n').forEach((raw,i)=>{
    const line=i+1;
    if(format==='simple'){if(raw.trim()){start=line;fields={Text:raw.trim()};lines={Text:line};finish();}return;}
    if(!raw.trim()){finish();return;}
    if(!Object.keys(fields).length)start=line;
    const match=/^\s*(ID|Enabled|Text):[ \t]?(.*)$/.exec(raw);
    if(!match){error(line,'Expected ID, Enabled, or Text followed by a colon; separate blocks with a blank line');return;}
    const [,key,value]=match;
    if(Object.hasOwn(fields,key))error(line,`Duplicate ${key}; separate messages with a blank line`);
    let decoded=value.trim();
    if(decoded.startsWith('"')){try{decoded=JSON.parse(decoded);if(typeof decoded!=='string')throw new Error();}catch{error(line,'Invalid quoted string; use JSON escapes');decoded='';}}
    fields[key]=decoded;lines[key]=line;
  });
  finish();return {items,errors};
}
