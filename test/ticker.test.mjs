import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TickerClock,rotationIndex,scrollOffset,createTicker } from '../public/ticker.mjs';

test('real rotation renderer retains identity and progress across edits, pause, high-rate updates and removal',t=>{
  const previous={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,ResizeObserver:globalThis.ResizeObserver,performance:globalThis.performance};
  let now=0,frame;
  const element=()=>({children:[],style:{},classList:{add(){},remove(){}},isConnected:true,textContent:'',append(...children){this.children.push(...children);},replaceChildren(){this.children=[];}});
  globalThis.document={createElement:element};globalThis.requestAnimationFrame=fn=>frame=fn;globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.performance={now:()=>now};
  t.after(()=>Object.assign(globalThis,previous));
  const wrapper=element(),renderer=createTicker(wrapper),line=wrapper.children[0].children[1].children[0];
  let items=[{id:'a',text:'A'},{id:'b',text:'B'},{id:'c',text:'C'}],options={mode:'rotate',interval:5,paused:false,gap:40,separator:'|',font:28};
  const update=()=>renderer.update(items,options,'channel','#000');
  update();now=6500;frame(now);assert.equal(line.textContent,'B');
  items=[items[2],{id:'b',text:'B edited'},items[0]];update();assert.equal(line.textContent,'B edited');
  for(let i=0;i<100;i++){now+=10;update();}assert.equal(line.textContent,'B edited');
  options={...options,paused:true};update();now=30000;frame(now);assert.equal(line.textContent,'B edited');
  options={...options,paused:false};update();now+=2499;frame(now);assert.equal(line.textContent,'B edited');now+=2;frame(now);assert.equal(line.textContent,'A');
  items=items.slice(0,2);update();assert.equal(line.textContent,'B edited');now+=4999;frame(now);assert.equal(line.textContent,'B edited');
  items=[];update();assert.equal(wrapper.children[0].hidden,true);
  items=[{id:'new',text:'New'}];update();assert.equal(line.textContent,'New');assert.equal(wrapper.children[0].hidden,false);
});
test('rotation advances across repeated state updates without restarting',()=>{
  const c=new TickerClock(0);c.update(2000,false);c.update(4000,false);c.update(6000,false);
  assert.equal(rotationIndex(c.elapsed,5,3),1);c.update(16000,false);assert.equal(rotationIndex(c.elapsed,5,3),0);
});
test('pause freezes elapsed time and resume continues from the same point',()=>{
  const c=new TickerClock(0);c.update(3000,true);c.update(20000,true);assert.equal(c.elapsed,3000);
  c.update(25000,false);c.update(28000,false);assert.equal(c.elapsed,6000);assert.equal(rotationIndex(c.elapsed,5,3),1);
});
test('scroll starts with content visible, supports both directions, and holds content at loop end',()=>{
  assert.equal(scrollOffset(0,1000,100,2,'left'),0);
  assert.equal(scrollOffset(5000,1000,100,2,'left'),-500);
  assert.equal(scrollOffset(11000,1000,100,2,'left'),-1000);
  assert.equal(scrollOffset(12000,1000,100,2,'left'),0);
  assert.equal(scrollOffset(0,1000,100,2,'right'),-1000);
  assert.equal(scrollOffset(5000,1000,100,2,'right'),-500);
});
