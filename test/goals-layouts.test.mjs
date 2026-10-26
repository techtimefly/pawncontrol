import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../public/model.mjs';
import {upgradeLayouts,layoutState} from '../public/layouts.mjs';
import {settingsOf,validateSettings,applyAction} from '../lib/state.mjs';

test('legacy goal widget migration is hidden, idempotent and preserves both compositions',()=>{
  const legacy=settingsOf(defaults());delete legacy.widgets.goal;delete legacy.portrait.widgets.goal;
  legacy.widgets.stats.x=2010;legacy.portrait.widgets.stats.x=75;
  const before=structuredClone(legacy),next=upgradeLayouts(legacy);
  validateSettings(next);assert.deepEqual(legacy,before);
  assert.equal(next.widgets.goal.visible,false);assert.equal(next.portrait.widgets.goal.visible,false);
  for(const id of Object.keys(legacy.widgets))assert.deepEqual(next.widgets[id],legacy.widgets[id]);
  for(const id of Object.keys(legacy.portrait.widgets))assert.deepEqual(next.portrait.widgets[id],legacy.portrait.widgets[id]);
  assert.deepEqual(upgradeLayouts(next),next);
});

test('goal widget layouts and visibility are independent and survive layout presets',()=>{
  let s=defaults();s.widgets.goal.visible=true;s.widgets.goal.w=500;s.portrait.widgets.goal.w=700;
  assert.equal(layoutState(s,'portrait').widgets.goal.visible,false);
  assert.equal(layoutState(s,'landscape').widgets.goal.w,500);
  s=applyAction(s,{type:'save-preset',name:'Goals'});
  s.widgets.goal.w=650;s.portrait.widgets.goal.w=900;
  s=applyAction(s,{type:'load-preset',name:'Goals'});
  assert.equal(s.widgets.goal.w,500);assert.equal(s.portrait.widgets.goal.w,700);
});
