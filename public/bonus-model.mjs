import {starterTips} from './starter-templates.mjs';
import {socialDefaults,socialWidget} from './socials-model.mjs';
export function bonusDefaults() {
  const section=(id,title,entries)=>({id,title,enabled:true,entries:entries.map(([label,detail],i)=>({id:`${id}-${i}`,label,detail,enabled:true}))});
  return {
    credits:{brand:'PAWN CONTROL',subtitle:'Thanks for watching',final:'// END TRANSMISSION',timing:'duration',duration:60,speed:80,font:48,heading:64,brandSize:100,gap:60,background:'#000000',opacity:100,accent:'#00e5ff',headingColor:'#ffd700',detailColor:'#70a1ff',loop:false,sections:[
      section('broadcast','Broadcasting & Control', [['Broadcast Suite & Hardware','OBS Studio + StreamDeck + DJI Osmo Pocket 3']]),
      section('plugins','OBS Automation & Plugins', [['Scene Transitions & Movement','Move Plugin'],['AI Voice & Audio Isolation','Local Vocal'],['Automation & Event Logic','Advanced Scene Switcher'],['File Management','Record Rename'],['Layout & Structure Management','Scene Collection Manager & Scene Anchor'],['Audio Visualizer','WaveForm']]),
      section('hardware','The Battlestation', [['Operating System','Windows 11 Pro'],['Motherboard','Gigabyte B650 Gaming X AX V2'],['Processor','AMD Ryzen 7 7700X'],['Graphics Processing','NVIDIA GeForce RTX 3080 (12GB VRAM)'],['System Memory','Crucial Pro DDR5-6000 (32GB Dual-Channel)'],['Audio Monitoring','Microsoft Surface Headphones Gen 1']]),
      section('creative','Creative & Post-Production', [['Video Editing & Grading','DaVinci Resolve Studio'],['Generative & Graphic Design','Adobe Firefly / Adobe Express / Canva']]),
      section('thanks','Special Thanks', [['To the Chat, the Viewers, & the Open Source Community','']])
    ]},
    tips:{interval:20,order:'sequential',font:30,items:starterTips()},
    creditsPlayback:{seq:0,command:'stop'},tipsPlayback:{seq:0,index:0,paused:false},
    widgets:{credits:{x:0,y:0,w:2560,h:1440,scale:1,visible:false,locked:false,z:10},tips:{x:1860,y:650,w:640,h:260,scale:1,visible:false,locked:false,z:4}}
  };
}
// Add only the new fields to older settings/backups; existing settings stay intact.
export function upgradeBonusSettings(settings) {
  const d=bonusDefaults();return {...settings,socials:settings.socials??socialDefaults(),credits:settings.credits??d.credits,tips:settings.tips??d.tips,widgets:{socials:socialWidget(),...d.widgets,...settings.widgets}};
}
export function creditsProgress(ms,viewportHeight,contentHeight,options) {
  const finalY=Math.max(0,(viewportHeight-contentHeight)/2);
  const distance=Math.max(0,viewportHeight-finalY);
  const duration=options.timing==='speed'?Math.max(1,(contentHeight+viewportHeight)/options.speed*1000):options.duration*1000;
  const progress=options.loop?(ms%duration)/duration:Math.min(1,ms/duration);
  // The last frame is handled separately so the final card holds at center.
  return {y:viewportHeight-progress*(contentHeight+viewportHeight),done:!options.loop&&ms>=duration,duration,finalY,distance};
}
export function nextTipIndex(index,count,direction=1,order='sequential',random=Math.random) {
  if(count<2)return 0;
  if(order==='shuffle'&&direction>0){const offset=1+Math.min(count-2,Math.floor(random()*(count-1)));return ((index+offset)%count+count)%count;}
  return ((index+direction)%count+count)%count;
}
