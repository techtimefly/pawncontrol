import {socialPlatforms} from '../public/socials-model.mjs';
import {inflateSync} from 'node:zlib';
export const ICON_BYTES=200*1024,TOTAL_ICON_BYTES=1024*1024,ICON_COUNT=30;
export function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
// Strict PNG subset, fully checks compressed scanlines and CRCs. No metadata,
// animation, palettes, interlace, alternate bit depths or trailing payloads.
export function validatePNG(base64){
  const fail=()=>{throw Error('Use a non-interlaced 8-bit RGB/RGBA PNG, 1–512px, at most 200 KiB');};
  if(typeof base64!=='string'||base64.length>Math.ceil(ICON_BYTES/3)*4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))fail();
  const b=Buffer.from(base64,'base64');if(b.length>ICON_BYTES||b.length<57||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')fail();
  let pos=8,w,h,channels,ended=false,data=[],seenData=false;
  while(pos<b.length){
    if(pos+12>b.length)fail();const n=b.readUInt32BE(pos),type=b.toString('ascii',pos+4,pos+8);if(n>b.length-pos-12)fail();
    const chunk=b.subarray(pos+8,pos+8+n);if(crc32(b.subarray(pos+4,pos+8+n))!==b.readUInt32BE(pos+8+n))fail();
    if(pos===8){if(type!=='IHDR'||n!==13)fail();w=chunk.readUInt32BE(0);h=chunk.readUInt32BE(4);channels=chunk[9]===2?3:chunk[9]===6?4:0;if(!w||!h||w>512||h>512||chunk[8]!==8||!channels||chunk[10]||chunk[11]||chunk[12])fail();}
    else if(type==='IDAT'){if(ended)fail();data.push(chunk);seenData=true;}
    else if(type==='IEND'){if(n||!seenData||pos+12!==b.length)fail();ended=true;}
    // Ancillary metadata is stripped on upload; reject unknown critical chunks and APNG.
    else if(!['sRGB','gAMA','pHYs','tEXt','iTXt','zTXt','cHRM','iCCP','bKGD','tIME'].includes(type))fail();
    pos+=12+n;
  }
  if(!ended)fail();const size=(w*channels+1)*h;let raw;
  try{const compressed=Buffer.concat(data),decoded=inflateSync(compressed,{maxOutputLength:size,info:true});if(decoded.engine.bytesWritten!==compressed.length)fail();raw=decoded.buffer;}catch{fail();}
  if(raw.length!==size)fail();for(let y=0;y<h;y++)if(raw[y*(w*channels+1)]>4)fail();
  // Only structurally validated essential PNG chunks are retained.
  const chunks=[b.subarray(0,33)];pos=33;while(pos<b.length){const n=b.readUInt32BE(pos),type=b.toString('ascii',pos+4,pos+8);if(type==='IDAT'||type==='IEND')chunks.push(b.subarray(pos,pos+n+12));pos+=n+12;}
  return Buffer.concat(chunks).toString('base64');
}
export function validateIconRegistry(icons){
  if(!icons||typeof icons!=='object'||Array.isArray(icons)||Object.keys(icons).length>ICON_COUNT)throw Error('Maximum 30 custom icons');
  let total=0;const clean={};for(const [id,data] of Object.entries(icons)){if(!/^[a-f0-9]{32}$/.test(id))throw Error('Invalid icon identifier');clean[id]=validatePNG(data);total+=Buffer.byteLength(clean[id],'base64');}
  if(total>TOTAL_ICON_BYTES)throw Error('Custom icons exceed 1 MiB total');return clean;
}
export function iconReferenced(state,id){return [state,...Object.values(state.presets)].some(s=>s.socials.items.some(e=>socialPlatforms(e).some(p=>p.icon===id)));}
export function validateIconReferences(state){for(const s of [state,...Object.values(state.presets)])for(const entry of s.socials.items)for(const e of socialPlatforms(entry))if(e.icon&&!Object.hasOwn(state.socialIcons,e.icon))throw Error('Custom icon missing from backup or library');}
