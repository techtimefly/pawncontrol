import {sessionClockDefaults,clockWidget} from './session-clock.mjs';
import {goalPresentationDefaults} from './goals-presentation.mjs';
export const LAYOUTS = ['landscape', 'portrait'];
export function layoutDimensions(layout='landscape') {
  return layout==='portrait' ? {width:1080,height:1920} : {width:2560,height:1440};
}
export function guideDefaults(layout='landscape') {
  const portrait=layout==='portrait';
  return {
    safeArea:{enabled:false,top:60,right:60,bottom:60,left:60},
    board:{enabled:false,x:portrait?60:70,y:portrait?360:70,w:portrait?960:1080,h:portrait?960:1080},
    camera:{enabled:false,x:portrait?60:1300,y:portrait?1500:700,w:portrait?360:640,h:portrait?160:360}
  };
}
export function portraitDefaults() {
  const widget=(x,y,w,h,z,visible=true)=>({x,y,w,h,z,visible,scale:1,locked:false});
  return {
    widgets:{
      clock:clockWidget('portrait'),stats:widget(60,60,960,280,2),scoreboard:widget(60,1330,960,160,3),
      tips:widget(450,1500,570,250,4,false),socials:widget(60,1690,960,100,4,false),
      ticker:widget(60,1810,960,70,1),credits:widget(0,0,1080,1920,10,false),
      goal:widget(60,1500,960,180,4,false)
    },
    typography:{font:28,padding:24,gap:12,tickerFont:30,tipsFont:28,socialsFont:30,creditsFont:38,creditsHeading:48,creditsBrandSize:76,creditsGap:44},
    layoutLocked:false,snap:true,guides:guideDefaults('portrait')
  };
}
// The landscape representation is deliberately unchanged so old installations,
// backups and presets retain their exact composition when portrait is added.
export function upgradeLayouts(settings) {
  const portrait=settings.portrait??portraitDefaults();
  return {...settings,goalPresentation:settings.goalPresentation??goalPresentationDefaults(),sessionClock:settings.sessionClock??sessionClockDefaults(),
    widgets:{...settings.widgets,clock:settings.widgets?.clock??clockWidget(),goal:settings.widgets?.goal??{x:1800,y:1080,w:650,h:220,scale:1,visible:false,locked:false,z:4}},
    portrait:{...portrait,widgets:{...portrait.widgets,clock:portrait.widgets?.clock??clockWidget('portrait'),goal:portrait.widgets?.goal??portraitDefaults().widgets.goal}},
    landscapeGuides:settings.landscapeGuides??guideDefaults()};
}
export function layoutState(state,layout='landscape') {
  if(layout!=='portrait')return {...state,layout:'landscape'};
  const p=state.portrait??portraitDefaults(),t=p.typography;
  return {...state,layout:'portrait',widgets:p.widgets,layoutLocked:p.layoutLocked,snap:p.snap,
    theme:{...state.theme,font:t.font,padding:t.padding,gap:t.gap},
    ticker:{...state.ticker,font:t.tickerFont},tips:{...state.tips,font:t.tipsFont},
    socials:{...state.socials,font:t.socialsFont},
    credits:{...state.credits,font:t.creditsFont,heading:t.creditsHeading,brandSize:t.creditsBrandSize,gap:t.creditsGap}};
}

// Gestures write only changed geometry, never a captured visibility/playback state.
export function widgetGeometryPatch(before,after) {
  return Object.fromEntries(['x','y','w','h'].filter(key=>before[key]!==after[key]).map(key=>[key,after[key]]));
}
