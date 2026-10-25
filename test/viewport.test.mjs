import {test} from 'node:test';
import assert from 'node:assert/strict';
import {containViewport,observeViewport} from '../public/viewport.mjs';
import {layoutDimensions} from '../public/layouts.mjs';

for(const [width,height,scale,x,y] of [[1080,1920,1,0,0],[720,1280,2/3,0,0],[1920,1080,.5625,656.25,0]]) {
  test(`portrait contain ${width} x ${height}`,()=>{
    const fit=containViewport(width,height,layoutDimensions('portrait'));
    for(const [key,value] of Object.entries({scale,x,y}))assert.ok(Math.abs(fit[key]-value)<1e-9);
  });
}

test('simultaneous portrait and landscape resize independently without changing transparency',()=>{
  const portrait=new EventTarget(),landscape=new EventTarget();
  Object.assign(portrait,{innerWidth:1080,innerHeight:1920});
  Object.assign(landscape,{innerWidth:1920,innerHeight:1080});
  const a={style:{width:'1080px',height:'1920px',background:'transparent'}},b={style:{}};
  observeViewport(a,portrait,layoutDimensions('portrait'));
  observeViewport(b,landscape,layoutDimensions('landscape'));
  assert.equal(a.style.transform,'translate(0px, 0px) scale(1)');
  assert.equal(b.style.transform,'translate(0px, 0px) scale(0.75)');
  portrait.innerWidth=720;portrait.innerHeight=1280;portrait.dispatchEvent(new Event('resize'));
  assert.equal(a.style.transform,`translate(0px, 0px) scale(${2/3})`);
  assert.equal(b.style.transform,'translate(0px, 0px) scale(0.75)');
  assert.equal(a.style.width,'1080px');assert.equal(a.style.height,'1920px');assert.equal(a.style.background,'transparent');
});

for (const [width,height,scale,x,y] of [
  [2560,1440,1,0,0],[1920,1080,.75,0,0],[1280,720,.5,0,0],[3840,2160,1.5,0,0],
  [2560,1400,1400/1440,(2560-2560*1400/1440)/2,0],
  [3440,1440,1,440,0],[1080,1920,1080/2560,0,(1920-1440*1080/2560)/2],
  [800,600,800/2560,0,75],[0,0,0,0,0],[0,720,0,0,360],[-1,NaN,0,0,0],
]) test(`contain ${width} x ${height}`,()=>{
  const fit=containViewport(width,height);
  for(const [key,value] of Object.entries({scale,x,y}))assert.ok(Math.abs(fit[key]-value)<1e-9);
  assert.ok(fit.x>=0&&fit.y>=0);
  assert.ok(2560*fit.scale<=fit.width&&1440*fit.scale<=fit.height);
});

test('resize is presentation-only, independent per source, and removable',()=>{
  const a=new EventTarget(),b=new EventTarget();
  Object.assign(a,{innerWidth:1920,innerHeight:1080});Object.assign(b,{innerWidth:2560,innerHeight:1440});
  const canvas={style:{width:'2560px',height:'1440px',background:'transparent'}}, other={style:{}};
  const dispose=observeViewport(canvas,a);observeViewport(other,b);
  a.innerWidth=1280;a.innerHeight=720;a.dispatchEvent(new Event('resize'));
  assert.equal(canvas.style.transform,'translate(0px, 0px) scale(0.5)');
  assert.equal(other.style.transform,'translate(0px, 0px) scale(1)');
  assert.equal(canvas.style.width,'2560px');assert.equal(canvas.style.height,'1440px');assert.equal(canvas.style.background,'transparent');
  dispose();a.innerWidth=2560;a.dispatchEvent(new Event('resize'));
  assert.equal(canvas.style.transform,'translate(0px, 0px) scale(0.5)');
});
