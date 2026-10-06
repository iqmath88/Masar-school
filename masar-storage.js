/* =========================================================
   مسار التعليم — طبقة التخزين الآمن — متوافقة مع v1.3.1
   واجهة موحدة متوافقة مع التخزين الحالي، تمهيداً لـ IndexedDB والمزامنة.
   ========================================================= */
(function(){
"use strict";
const PREFIX="masar-education-";
const BACKUP_SCHEMA="masar-education-backup";
const BACKUP_VERSION=1;

function parseJSON(raw,fallback){
  if(raw===null||raw===undefined||raw==="")return fallback;
  try{return JSON.parse(raw)}catch(_){return fallback}
}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value))}
function keyAllowed(key){return typeof key==="string"&&key.startsWith(PREFIX)}

const storage={
  get(key,fallback=null){return clone(parseJSON(localStorage.getItem(key),fallback))},
  set(key,value){localStorage.setItem(key,JSON.stringify(value));return true},
  remove(key){localStorage.removeItem(key)},
  has(key){return localStorage.getItem(key)!==null},
  keys(){return Object.keys(localStorage).filter(keyAllowed).sort()},
  exportBackup(){
    const data={};
    this.keys().forEach(k=>{data[k]=parseJSON(localStorage.getItem(k),null)});
    return {
      schema:BACKUP_SCHEMA,
      schemaVersion:BACKUP_VERSION,
      appVersion:document.querySelector('meta[name="application-version"]')?.content||"unknown",
      exportedAt:new Date().toISOString(),
      data
    };
  },
  validateBackup(payload){
    if(!payload||typeof payload!=="object")return {ok:false,error:"ملف النسخة الاحتياطية غير صالح."};
    if(payload.schema!==BACKUP_SCHEMA)return {ok:false,error:"هذا الملف لا يخص مسار التعليم."};
    if(payload.schemaVersion!==BACKUP_VERSION)return {ok:false,error:"إصدار النسخة الاحتياطية غير مدعوم."};
    if(!payload.data||typeof payload.data!=="object"||Array.isArray(payload.data))return {ok:false,error:"بيانات النسخة الاحتياطية ناقصة."};
    const invalid=Object.keys(payload.data).filter(k=>!keyAllowed(k));
    if(invalid.length)return {ok:false,error:"تحتوي النسخة على مفاتيح غير مسموح بها."};
    return {ok:true};
  },
  importBackup(payload,{replace=false}={}){
    const check=this.validateBackup(payload);if(!check.ok)throw new Error(check.error);
    const rollback={};
    this.keys().forEach(k=>{rollback[k]=localStorage.getItem(k)});
    try{
      if(replace)this.keys().forEach(k=>localStorage.removeItem(k));
      Object.entries(payload.data).forEach(([k,v])=>localStorage.setItem(k,JSON.stringify(v)));
      localStorage.setItem(PREFIX+"last-backup-import",JSON.stringify({importedAt:new Date().toISOString(),sourceExportedAt:payload.exportedAt||null}));
      return true;
    }catch(err){
      this.keys().forEach(k=>localStorage.removeItem(k));
      Object.entries(rollback).forEach(([k,v])=>localStorage.setItem(k,v));
      throw err;
    }
  },
  downloadBackup(filename){
    const payload=this.exportBackup();
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename||("masar-education-backup-"+new Date().toISOString().slice(0,10)+".json");
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
};
Object.freeze(storage);
window.MasarStorage=storage;
})();
