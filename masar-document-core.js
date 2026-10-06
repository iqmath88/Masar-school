/* =========================================================
   مسار التعليم v2.3.0 — Function Plotter
   Structured document model, block registry, migrations,
   validation and command history. No UI dependencies.
   ========================================================= */
(function(){
'use strict';
const SCHEMA_VERSION=6;
const listeners=new Map();
const registry=new Map();
const clone=v=>JSON.parse(JSON.stringify(v));
const makeId=(prefix='node')=>prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const now=()=>new Date().toISOString();

function emit(name,payload){(listeners.get(name)||[]).forEach(fn=>{try{fn(payload)}catch(err){console.error(err)}})}
function on(name,fn){const arr=listeners.get(name)||[];arr.push(fn);listeners.set(name,arr);return()=>listeners.set(name,arr.filter(x=>x!==fn))}
function registerBlock(type,definition){if(!type||typeof definition!=='object')throw new Error('Invalid block registration');registry.set(type,Object.freeze({type,...definition}));}
function getBlock(type){return registry.get(type)||registry.get('text')}
function createBlock(type='text',data={}){const def=getBlock(type)||{label:type,defaults:{}};return {id:makeId('blk'),type,version:1,createdAt:now(),updatedAt:now(),...clone(def.defaults||{}),...clone(data)};}
function normalizeBlock(input,index=0){const raw=input&&typeof input==='object'?clone(input):{};const type=registry.has(raw.type)?raw.type:'text';const def=getBlock(type)||{};const block={id:raw.id||makeId('blk'),type,version:Number(raw.version)||1,createdAt:raw.createdAt||now(),updatedAt:raw.updatedAt||now(),...clone(def.defaults||{}),...raw};block.type=type;block.id=String(block.id);block.order=Number.isFinite(Number(block.order))?Number(block.order):index;return block;}
function normalizeSmartMeta(block){
 const smart=block.smart&&typeof block.smart==='object'?block.smart:{};
 block.smart={
  autoNumber:smart.autoNumber!==false,
  difficulty:['easy','medium','hard'].includes(smart.difficulty)?smart.difficulty:'medium',
  marks:Number.isFinite(Number(smart.marks))?Number(smart.marks):0,
  tags:Array.isArray(smart.tags)?smart.tags.map(String).filter(Boolean):String(smart.tags||'').split(',').map(x=>x.trim()).filter(Boolean),
  answerLines:Number.isFinite(Number(smart.answerLines))?Math.max(0,Number(smart.answerLines)):0,
  showSolution:smart.showSolution!==false,
  referenceLabel:String(smart.referenceLabel||''),
  dependencies:Array.isArray(smart.dependencies)?smart.dependencies.map(String).filter(Boolean):[]
 };
 return block;
}
function normalizeEquation(block){
 if(block.type!=='math')return block;
 const eq=block.equation&&typeof block.equation==='object'?block.equation:{};
 const latex=String(eq.latex??block.latex??block.content??'');
 block.equation={
  id:String(eq.id||makeId('eq')),
  latex,
  displayMode:eq.displayMode!==false,
  numbered:eq.numbered!==false&&block.numbered!==false,
  alignment:['right','center','left'].includes(eq.alignment)?eq.alignment:(block.mathAlign||'center'),
  size:Number(eq.size||block.mathSize||1),
  label:String(eq.label||''),
  updatedAt:eq.updatedAt||now()
 };
 block.latex=latex;block.content=latex;block.numbered=block.equation.numbered;block.mathAlign=block.equation.alignment;block.mathSize=block.equation.size;
 return block;
}
function normalizeGraph(block){
 if(block.type!=='graph')return block;
 const g=block.graph&&typeof block.graph==='object'?block.graph:{};
 block.graph={
  xMin:Number.isFinite(Number(g.xMin))?Number(g.xMin):-5,xMax:Number.isFinite(Number(g.xMax))?Number(g.xMax):5,
  yMin:Number.isFinite(Number(g.yMin))?Number(g.yMin):-5,yMax:Number.isFinite(Number(g.yMax))?Number(g.yMax):5,
  showGrid:g.showGrid!==false,showAxes:g.showAxes!==false,
  points:Array.isArray(g.points)?g.points:[],segments:Array.isArray(g.segments)?g.segments:[],
  functions:Array.isArray(g.functions)?g.functions.map((f,i)=>({id:String(f.id||makeId('fn')),label:String(f.label||('f'+(i+1))),expression:String(f.expression||f.expr||'x'),color:/^#[0-9a-f]{6}$/i.test(f.color||'')?f.color:'#0d8bd7',visible:f.visible!==false,lineStyle:['solid','dashed','dotted'].includes(f.lineStyle)?f.lineStyle:'solid',domainMin:Number.isFinite(Number(f.domainMin))?Number(f.domainMin):Number(g.xMin??-5),domainMax:Number.isFinite(Number(f.domainMax))?Number(f.domainMax):Number(g.xMax??5)})):[],
  width:720,height:420
 };
 return block;
}
function migrateLecture(input){const raw=input&&typeof input==='object'?clone(input):{};const blocks=Array.isArray(raw.blocks)?raw.blocks.map((b,i)=>normalizeGraph(normalizeEquation(normalizeSmartMeta(normalizeBlock(b,i))))):[];return {...raw,id:raw.id||makeId('lec'),schemaVersion:SCHEMA_VERSION,documentType:'masar-lecture',createdAt:raw.createdAt||now(),updatedAt:raw.updatedAt||now(),blocks};}
function validateLecture(doc){const errors=[];if(!doc||typeof doc!=='object')errors.push('المستند غير صالح');if(!doc?.id)errors.push('معرّف المستند مفقود');if(!Array.isArray(doc?.blocks))errors.push('قائمة العناصر غير صالحة');else{const ids=new Set();doc.blocks.forEach((b,i)=>{if(!b?.id)errors.push('العنصر '+(i+1)+' بلا معرّف');else if(ids.has(b.id))errors.push('معرّف عنصر مكرر: '+b.id);else ids.add(b.id);if(!registry.has(b?.type))errors.push('نوع عنصر غير مسجل: '+b?.type)})}return {ok:errors.length===0,errors};}
function serialize(doc){const normalized=migrateLecture(doc);const check=validateLecture(normalized);if(!check.ok)throw new Error(check.errors.join('\n'));return JSON.stringify(normalized);}
function deserialize(text){const parsed=typeof text==='string'?JSON.parse(text):text;return migrateLecture(parsed);}

class CommandHistory{
 constructor(limit=100){this.limit=limit;this.undoStack=[];this.redoStack=[];this.current=null;}
 reset(snapshot){this.undoStack=[];this.redoStack=[];this.current=clone(snapshot);emit('historychange',this.state());}
 commit(snapshot,label='تعديل'){if(this.current&&JSON.stringify(this.current)===JSON.stringify(snapshot))return;this.undoStack.push({snapshot:clone(this.current),label});if(this.undoStack.length>this.limit)this.undoStack.shift();this.current=clone(snapshot);this.redoStack=[];emit('historychange',this.state());}
 undo(){if(!this.undoStack.length)return null;this.redoStack.push({snapshot:clone(this.current),label:'إعادة'});const entry=this.undoStack.pop();this.current=clone(entry.snapshot);emit('historychange',this.state());return clone(this.current);}
 redo(){if(!this.redoStack.length)return null;this.undoStack.push({snapshot:clone(this.current),label:'تراجع'});const entry=this.redoStack.pop();this.current=clone(entry.snapshot);emit('historychange',this.state());return clone(this.current);}
 state(){return {canUndo:this.undoStack.length>0,canRedo:this.redoStack.length>0,undoCount:this.undoStack.length,redoCount:this.redoStack.length};}
}

[
 ['heading','عنوان فرعي',{title:'عنوان فرعي',content:'',keepTogether:true}],
 ['objectives','أهداف المحاضرة',{title:'أهداف المحاضرة',content:'',keepTogether:true}],
 ['text','فقرة شرح',{title:'فقرة شرح',content:'',keepTogether:true}],
 ['definition','تعريف',{title:'تعريف',content:'',keepTogether:true,smart:{autoNumber:true,difficulty:'medium',marks:0,tags:[],answerLines:0,showSolution:true,referenceLabel:'',dependencies:[]}}],
 ['rule','قاعدة',{title:'قاعدة',content:'',keepTogether:true,smart:{autoNumber:true,difficulty:'medium',marks:0,tags:[],answerLines:0,showSolution:true,referenceLabel:'',dependencies:[]}}],
 ['theorem','نظرية',{title:'نظرية',content:'',conditions:'',keepTogether:true,smart:{autoNumber:true,difficulty:'medium',marks:0,tags:[],answerLines:0,showSolution:true,referenceLabel:'',dependencies:[]}}],
 ['proof','برهان',{title:'برهان',content:'',conclusion:'',keepTogether:true,smart:{autoNumber:true,difficulty:'medium',marks:0,tags:[],answerLines:0,showSolution:true,referenceLabel:'',dependencies:[]}}],
 ['example','مثال محلول',{title:'مثال محلول',content:'',solution:'',keepTogether:true}],
 ['note','ملاحظة',{title:'ملاحظة',content:'',keepTogether:true}],
 ['exercise','تمرين',{title:'تمرين',content:'',keepTogether:true,smart:{autoNumber:true,difficulty:'medium',marks:0,tags:[],answerLines:4,showSolution:true,referenceLabel:'',dependencies:[]}}],
 ['activity','نشاط',{title:'نشاط',content:'',keepTogether:true,smart:{autoNumber:true,difficulty:'medium',marks:0,tags:[],answerLines:3,showSolution:true,referenceLabel:'',dependencies:[]}}],
 ['check','تحقق من فهمك',{title:'تحقق من فهمك',content:'',keepTogether:true}],
 ['ministerial','سؤال وزاري',{title:'سؤال وزاري',content:'',keepTogether:true}],
 ['image','صورة أو رسم',{title:'صورة أو رسم',content:'',keepTogether:true}],
 ['homework','واجب بيتي',{title:'واجب بيتي',content:'',keepTogether:true}],
 ['math','معادلة',{title:'معادلة',content:'',latex:'',numbered:true,mathAlign:'center',mathSize:1,keepTogether:true,equation:{latex:'',displayMode:true,numbered:true,alignment:'center',size:1,label:''}}],
 ['graph','رسم بياني',{title:'رسم بياني',content:'',keepTogether:true,graph:{xMin:-5,xMax:5,yMin:-5,yMax:5,showGrid:true,showAxes:true,points:[],segments:[],functions:[],width:720,height:420}}],
 ['summary','خلاصة',{title:'خلاصة',content:'',keepTogether:true}]
].forEach(([type,label,defaults])=>registerBlock(type,{label,defaults}));

window.MasarDocumentCore={SCHEMA_VERSION,makeId,clone,on,emit,registerBlock,getBlock,createBlock,migrateLecture,normalizeBlock,validateLecture,serialize,deserialize,CommandHistory,registry};
})();
