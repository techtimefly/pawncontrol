import {fitCanvas} from './viewport.mjs';
import {resolveAppearance} from './appearance.mjs';
import {createTipsTextControls} from './tips-text-controls.mjs';
import {createMessageId} from './model.mjs';
import {createCredits,createTips} from './bonus-render.mjs';
const node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!=null)e.textContent=text;return e;};
export function createBonusControls({getState,change,action,button,inputField,confirmChange}) {
  const $=id=>document.getElementById(id);
  const textControls=createTipsTextControls({getState,action,confirmChange});
  const creditsPreview=createCredits($('credits-preview'),{autoplay:false}),tipsPreview=createTips($('tips-preview'));
  for(const cmd of ['play','pause','restart','stop']){
    $(`credits-live-${cmd}`).onclick=()=>action({type:'credits-playback',command:cmd});
    $(`credits-preview-${cmd}`).onclick=()=>creditsPreview.command(cmd);
  }
  for(const cmd of ['previous','next'])$(`tips-${cmd}`).onclick=()=>action({type:'tips-playback',command:cmd,currentId:$('tips-preview').dataset.tipId});
  $('tips-pause').onclick=()=>action({type:'tips-playback',command:getState().tipsPlayback.paused?'play':'pause'});
  $('credits-add-section').onclick=()=>change(s=>s.credits.sections.push({id:createMessageId(),title:'New section',enabled:true,entries:[]}));
  $('tips-add').onclick=()=>change(s=>s.tips.items.push({id:createMessageId(),title:'New tip',category:'Chess tip',text:'Write your chess tip here.',enabled:true}));
  const textField=(label,value,save,max=400)=>inputField(label,'text',value,save,{maxlength:max});
  function reorderButtons(host,index,length,move){
    for(const [label,offset] of [['↑',-1],['↓',1]]){const b=button(label,()=>move(offset),'text-button');b.disabled=index+offset<0||index+offset>=length;b.setAttribute('aria-label',offset<0?'Move up':'Move down');host.append(b);}
  }
  function renderCredits(){
    const state=getState(),c=resolveAppearance(state).credits,options=$('credits-options');options.replaceChildren();
    for(const [key,label,max] of [['brand','Brand',120],['subtitle','Subtitle',200],['final','Final message',200]])options.append(textField(label,c[key],v=>change(s=>s.credits[key]=v),max));
    options.append(inputField('Timing','select',c.timing,v=>change(s=>s.credits.timing=v),{items:[['duration','Total duration'],['speed','Scroll speed']]}));
    for(const [key,label,min,max] of [['duration','Duration (seconds)',5,1800],['speed','Speed (px / second)',10,300],['font','Text size',20,90],['heading','Heading size',24,120],['brandSize','Brand size',30,180],['gap','Section spacing',10,180],['opacity','Background opacity (%)',0,100]])options.append(inputField(label,'number',c[key],v=>change(s=>s.credits[key]=v),{min,max}));
    for(const [key,label] of [['background','Background'],['accent','Brand color'],['headingColor','Heading color'],['detailColor','Detail color']])options.append(inputField(label,'color',c[key],v=>action({type:'credits-color',key,value:v,expected:state.credits[key]})));
    options.append(inputField('Loop credits','checkbox',c.loop,v=>change(s=>s.credits.loop=v)));
    const host=$('credits-sections');host.replaceChildren();
    c.sections.forEach((section,index)=>{
      const block=node('section','bonus-editor-card'),head=node('div','button-row');
      const sectionIn=s=>s.credits.sections.find(x=>x.id===section.id);
      head.append(inputField('Include section','checkbox',section.enabled,v=>change(s=>sectionIn(s).enabled=v)));
      reorderButtons(head,index,c.sections.length,offset=>change(s=>{const a=s.credits.sections,i=a.findIndex(x=>x.id===section.id);[a[i],a[i+offset]]=[a[i+offset],a[i]];}));
      head.append(button('Remove section',()=>change(s=>s.credits.sections=s.credits.sections.filter(x=>x.id!==section.id)),'text-button'));
      block.append(head,textField('Section heading',section.title,v=>change(s=>sectionIn(s).title=v),120));
      section.entries.forEach((entry,i)=>{
        const row=node('div','credit-editor-entry'),controls=node('div','button-row'),entryIn=s=>sectionIn(s).entries.find(x=>x.id===entry.id);
        controls.append(inputField('Include entry','checkbox',entry.enabled,v=>change(s=>entryIn(s).enabled=v)));
        reorderButtons(controls,i,section.entries.length,offset=>change(s=>{const a=sectionIn(s).entries,j=a.findIndex(x=>x.id===entry.id);[a[j],a[j+offset]]=[a[j+offset],a[j]];}));
        controls.append(button('Remove',()=>change(s=>sectionIn(s).entries=sectionIn(s).entries.filter(x=>x.id!==entry.id)),'text-button'));
        row.append(controls,textField('Label',entry.label,v=>change(s=>entryIn(s).label=v),200),textField('Details',entry.detail,v=>change(s=>entryIn(s).detail=v)));block.append(row);
      });
      block.append(button('+ Add entry',()=>change(s=>sectionIn(s).entries.push({id:createMessageId(),label:'Label',detail:'Details',enabled:true}))));host.append(block);
    });
    creditsPreview.update(c);resize();
  }
  function renderTips(){
    textControls.update();
    const state=getState(),t=state.tips,host=$('tips-items'),options=$('tips-options');host.replaceChildren();options.replaceChildren();
    options.append(inputField('Rotation interval (seconds)','number',t.interval,v=>change(s=>s.tips.interval=v),{min:5,max:300}),inputField('Order','select',t.order,v=>change(s=>s.tips.order=v),{items:[['sequential','Sequential'],['shuffle','Shuffle']]}),inputField('Tip text size','number',t.font,v=>change(s=>s.tips.font=v),{min:18,max:60}));
    t.items.forEach((tip,index)=>{
      const item=node('section','bonus-editor-card'),controls=node('div','button-row'),tipIn=s=>s.tips.items.find(x=>x.id===tip.id);
      controls.append(inputField('Enable tip','checkbox',tip.enabled,v=>change(s=>tipIn(s).enabled=v)));
      reorderButtons(controls,index,t.items.length,offset=>change(s=>{const a=s.tips.items,i=a.findIndex(x=>x.id===tip.id);[a[i],a[i+offset]]=[a[i+offset],a[i]];}));
      controls.append(button('Remove',()=>change(s=>s.tips.items=s.tips.items.filter(x=>x.id!==tip.id)),'text-button'));
      item.append(controls,textField('Title',tip.title,v=>change(s=>tipIn(s).title=v),120),textField('Category',tip.category,v=>change(s=>tipIn(s).category=v),60));
      const label=node('label','','Tip'),text=node('textarea','');text.value=tip.text;text.maxLength=600;text.onchange=()=>change(s=>tipIn(s).text=text.value);label.append(text);item.append(label);host.append(item);
    });
    $('tips-pause').textContent=state.tipsPlayback.paused?'Resume tips':'Pause tips';tipsPreview.update(t,state.tipsPlayback);resize();
  }
  function resize(){const shell=$('credits-preview').parentElement;fitCanvas($('credits-preview'),shell.clientWidth,shell.clientHeight);}
  return {canLeave:textControls.canLeave,render(tab){if(tab==='credits')renderCredits();if(tab==='tips')renderTips();},resize};
}
