import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../public/model.mjs';
import {socialPlatforms,asSocialGroup,matchingSocialGroups,groupSocials,splitSocialPlatform,validateSocials,enabledSocials,SocialTimeline} from '../public/socials-model.mjs';
import {applyAction,settingsOf} from '../lib/state.mjs';
import {iconReferenced,validateIconReferences} from '../lib/social-icons.mjs';
const old=(id,patch={})=>({id,platform:'twitch',icon:null,text:'@fixture',cta:'Follow',enabled:true,...patch});
const settings=(items)=>({...defaults().socials,items});
test('legacy entries become independent single-platform groups without changing content or flags',()=>{
 const entries=[old('a'),old('b',{enabled:false,platform:'x'})],s=settings(entries);
 assert.equal(matchingSocialGroups(entries).length,0);assert.equal(s.items.length,2);
 for(const e of entries){const g=asSocialGroup(e);assert.equal(g.text,e.text);assert.equal(g.cta,e.cta);assert.equal(g.enabled,e.enabled);assert.deepEqual(g.platforms,[{id:e.id,platform:e.platform,icon:null,enabled:true}]);validateSocials(settings([g]));}
 const state=defaults();state.socials=s;const migrated=applyAction(defaults(),{type:'import',data:{version:1,settings:settingsOf(state),session:state.session,presets:{Old:settingsOf(state)}}});assert.deepEqual(migrated.socials,s);assert.deepEqual(migrated.presets.Old.socials,s);assert.deepEqual(migrated.session,state.session);
});
test('exact candidates exclude case, whitespace, @, URL, CTA and enable differences',()=>{
 const entries=[old('a'),old('b'),...['@Fixture','fixture','@fixture ','https://fixture'].map((text,i)=>old('text'+i,{text})),old('cta',{cta:'Join'}),old('off',{enabled:false})];assert.deepEqual(matchingSocialGroups(entries),[['a','b']]);
 for(const id of ['text0','text1','cta','off'])assert.throws(()=>groupSocials(settings(entries),['a',id]),/exactly/);
 assert.throws(()=>groupSocials(settings(entries),['a','a']));assert.throws(()=>groupSocials(settings(entries),['a','missing']));
});
test('group and split preserve position, custom refs and flags; snapshots recover original',()=>{
 const custom='a'.repeat(32),first=asSocialGroup(old('a'));first.platforms[0].enabled=false;
 const before=settings([old('unrelated',{text:'other'}),first,old('b',{platform:'x',icon:custom}),old('tail',{text:'different'})]),snapshot=structuredClone(before);
 const grouped=groupSocials(before,['a','b']);assert.deepEqual(before,snapshot);assert.deepEqual(grouped.items.map(e=>e.id),['unrelated','a','tail']);assert.deepEqual(grouped.items[1].platforms.map(p=>[p.platform,p.icon,p.enabled]),[['twitch',null,false],['x',custom,true]]);
 const split=splitSocialPlatform(grouped,'a','platform-1','split');assert.deepEqual(split.items.map(e=>e.id),['unrelated','a','split','tail']);assert.equal(split.items[2].platforms[0].icon,custom);assert.equal(split.items[2].cta,'Follow');assert.equal(split.items[1].platforms[0].enabled,false);assert.throws(()=>splitSocialPlatform(grouped,'a','platform-1','tail'));
});
test('groups validate count, types, lengths, duplicate and unsafe IDs, mixed schemas and unknown keys',()=>{
 const group=asSocialGroup(old('a'));for(const platforms of [[],Array.from({length:21},(_,i)=>({...group.platforms[0],id:String(i)})),[...group.platforms,...group.platforms],null])assert.throws(()=>validateSocials(settings([{...group,platforms}])));
 for(const patch of [{id:'__proto__'},{id:'constructor'},{platform:'__proto__'},{icon:'../x'},{enabled:1},{html:'x'}])assert.throws(()=>validateSocials(settings([{...group,platforms:[{...group.platforms[0],...patch}]}])));
 for(const patch of [{text:'x'.repeat(121)},{cta:'x'.repeat(81)},{platform:'x'},{icon:null}])assert.throws(()=>validateSocials(settings([{...group,...patch}])));
 validateSocials(settings([{...group,text:'<img onerror=alert(1)>',platforms:Array.from({length:20},(_,i)=>({...group.platforms[0],id:String(i)}))}]));
 assert.throws(()=>splitSocialPlatform(settings(Array.from({length:20},(_,i)=>({...group,id:String(i),platforms:[...group.platforms,{...group.platforms[0],id:'second'}]}))),'0','second','new'));
});
test('group edit reorder hide remove and repeated writes preserve stale protection and playback',()=>{
 const start=defaults();start.socials=settings([old('a'),old('b')]);const grouped=groupSocials(start.socials,['a','b']);const next=applyAction(start,{type:'socials-edit',expected:start.socials,socials:grouped});assert.deepEqual(next.session,start.session);assert.deepEqual(next.socialsPlayback,start.socialsPlayback);
 assert.throws(()=>applyAction(next,{type:'socials-edit',expected:start.socials,socials:grouped}),/changed elsewhere/);assert.deepEqual(applyAction(next,{type:'socials-edit',expected:grouped,socials:grouped}).socials,grouped);
 const edit=structuredClone(grouped);edit.items[0].text='once';edit.items[0].platforms.reverse();edit.items[0].platforms[0].enabled=false;const saved=applyAction(next,{type:'socials-edit',expected:grouped,socials:edit});assert.equal(enabledSocials(saved.socials).length,1);edit.items[0].platforms.pop();assert.equal(enabledSocials(edit).length,0);
});
test('group assets in presets prevent deletion and missing grouped assets reject import',()=>{
 const state=defaults(),icon='a'.repeat(32);state.socials=settings([asSocialGroup(old('a',{icon}))]);assert.equal(iconReferenced(state,icon),true);assert.throws(()=>validateIconReferences(state),/missing/);state.presets.Saved=settingsOf(state);state.socials=settings([]);assert.equal(iconReferenced(state,icon),true);
 const backup={version:1,settings:settingsOf(state),presets:state.presets,session:state.session};assert.throws(()=>applyAction(defaults(),{type:'import',data:backup}),/missing/);
 const clean=defaults();clean.socials=groupSocials(settings([old('a'),old('b')]),['a','b']);clean.presets.Saved=settingsOf(clean);const copy=applyAction(defaults(),{type:'import',data:{version:1,settings:settingsOf(clean),presets:clean.presets,session:clean.session}});assert.deepEqual(copy.socials,clean.socials);assert.deepEqual(copy.presets,clean.presets);
});
test('group counts as one rotation item, survives SSE and icon reordering; hidden empty groups skip',()=>{
 const group=groupSocials(settings([old('a'),old('b')]),['a','b']).items[0],s=settings([group,old('c')]),t=new SocialTimeline(),p={seq:0,paused:false};t.update(s,p,0);t.update(s,p,4000);const edit=structuredClone(s);edit.items[0].platforms.reverse();t.update(edit,p,5000);assert.equal(t.id,'a');assert.equal(t.elapsed,5000);t.update(edit,{seq:1,paused:true,command:'next',currentId:'a'},6000);assert.equal(t.id,'c');t.update(edit,{seq:2,paused:true,command:'previous',currentId:'c'},7000);assert.equal(t.id,'a');t.tick(50000);assert.equal(t.id,'a');edit.items[0].platforms.forEach(p=>p.enabled=false);t.update(edit,{seq:2,paused:true},50000);assert.equal(t.id,'c');assert.equal(enabledSocials(settings([{...group,text:' '}])).length,0);
});
