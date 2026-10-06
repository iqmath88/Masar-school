"use strict";
/* ============ ثوابت ============ */
const GRADES=["الأول متوسط","الثاني متوسط","الثالث متوسط","الرابع إعدادي","الخامس إعدادي","السادس إعدادي"];
const ALL_GRADES=["الأول ابتدائي","الثاني ابتدائي","الثالث ابتدائي","الرابع ابتدائي","الخامس ابتدائي","السادس ابتدائي","الأول متوسط","الثاني متوسط","الثالث متوسط","الرابع إعدادي","الخامس إعدادي","السادس إعدادي"];
const GRADE_PRESETS=[
  ["ابتدائية (٦ مراحل)",ALL_GRADES.slice(0,6)],
  ["متوسطة (٣ مراحل)",ALL_GRADES.slice(6,9)],
  ["إعدادية (٣ مراحل)",ALL_GRADES.slice(9,12)],
  ["ثانوية — متوسط وإعدادي (٦ مراحل)",ALL_GRADES.slice(6,12)],
  ["كل المراحل (١٢ مرحلة)",ALL_GRADES.slice()]
];
const gradesFor=inst=>{const g=instMeta(inst||"").grades;return (g&&g.length)?g:GRADES};
const SECTIONS=["أ","ب","ج","د","هـ","و"];
const BRANCHES=["-","علمي","أدبي"];
const STATUSES=["مستمر","منقول","راقن قيده","متخرج"];
const ATT=[["حاضر","selG"],["غائب","selR"],["مجاز","selY"]];
function subjectsFor(grade,branch){
  const mid=["التربية الإسلامية","اللغة العربية","اللغة الإنكليزية","الرياضيات","العلوم","الاجتماعيات","الحاسوب"];
  const sci=["التربية الإسلامية","اللغة العربية","اللغة الإنكليزية","الرياضيات","الفيزياء","الكيمياء","الأحياء"];
  const lit=["التربية الإسلامية","اللغة العربية","اللغة الإنكليزية","الرياضيات","التاريخ","الجغرافية","الاقتصاد"];
  if((grade||"").includes("متوسط"))return mid;
  if(branch==="أدبي")return lit;
  return sci;
}
const GFIELDS=[["m1","شهر أول ف1"],["m2","شهر ثاني ف1"],["mid","نصف السنة"],["m3","شهر أول ف2"],["m4","شهر ثاني ف2"],["fin","الامتحان النهائي"],["r2","الدور الثاني"]];
const MONTHS=["m1","m2","m3","m4"];
const isMonth=f=>MONTHS.includes(f);
const DAILY_MAX=4;
function examCount(f){
  const names=(S.settings.examNames||{})[f];
  return names&&names.length?names.length:DAILY_MAX;
}
function examName(f,i){
  const names=(S.settings.examNames||{})[f];
  return (names&&names[i])||("يومي "+(i+1));
}
function hydrateExamNames(f){
  const cur=(S.settings.examNames||{})[f];
  if(cur&&cur.length)return cur.slice();
  return Array.from({length:DAILY_MAX},(_,i)=>"يومي "+(i+1));
}
function setExamName(f,i,name){
  name=(name||"").trim();if(!name)return false;
  S.settings.examNames=S.settings.examNames||{};
  const cur=hydrateExamNames(f);
  cur[i]=name;
  S.settings.examNames[f]=cur;
  save.settings();
  return true;
}
function addExamSlot(f){
  S.settings.examNames=S.settings.examNames||{};
  const cur=hydrateExamNames(f);
  cur.push("يومي "+(cur.length+1));
  S.settings.examNames[f]=cur;
  save.settings();
}
function removeExamSlot(f){
  S.settings.examNames=S.settings.examNames||{};
  const cur=hydrateExamNames(f);
  if(cur.length<=1){toast("يجب أن يبقى امتحان واحد على الأقل");return false}
  const idx=cur.length-1;
  cur.pop();
  S.settings.examNames[f]=cur;
  save.settings();
  // نحذف درجة هذا الامتحان من سجلات كل الطلبة بهذا الشهر حتى لا تبقى بيانات يتيمة
  Object.keys(S.grades).forEach(sid=>{
    const rec=(S.grades[sid]||{})[MYSUB()];
    if(rec&&rec[f]&&rec[f].d&&rec[f].d.length>idx)rec[f].d.splice(idx,1);
  });
  save.grades();
  return true;
}
const num=v=>(v===undefined||v===null||v===""||isNaN(Number(v)))?null:Number(v);
function gradeConfigFor(grade){
  return (S.settings.gradeConfigByGrade||{})[grade]||null;
}
const gradeMode=grade=>{
  const ov=grade?gradeConfigFor(grade):null;
  return (ov&&ov.mode)||S.settings.gradeMode||"standard";
};
function gradeWeights(grade){
  const ov=grade?gradeConfigFor(grade):null;
  const w=(ov&&ov.gradeWeights)||S.settings.gradeWeights||{};
  return {daily:w.daily??50,written:w.written??50,saay:w.saay??50,final:w.final??50};
}
function languageWeights(grade){
  const ov=grade?gradeConfigFor(grade):null;
  const w=(ov&&ov.languageWeights)||S.settings.languageWeights||{};
  return {listen:w.listen??10,read:w.read??10,speak:w.speak??10,written:w.written??70};
}
const LANG_SKILL_KEYS=["listen","read","speak","w"];
function monthScore(m,grade){
  if(m===undefined||m===null||m==="")return null;
  if(typeof m!=="object")return num(m); // توافق مع بيانات قديمة مدخلة كدرجة شهر جاهزة
  if(gradeMode(grade)==="language"){
    const listen=num(m.listen),read=num(m.read),speak=num(m.speak),written=num(m.w);
    if(listen===null||read===null||speak===null||written===null)return null;
    return listen+read+speak+written;
  }
  const d=(m.d||[]).map(num).filter(v=>v!==null);
  const w=num(m.w);
  if(d.length<2||w===null)return null; // يوميان على الأقل + تحريري
  const dAvg=d.reduce((a,b)=>a+b,0)/d.length;
  const gw=gradeWeights(grade);
  return dAvg*(gw.daily/100)+w*(gw.written/100);
}
function getCell(rec,f,sub){
  if(!isMonth(f))return rec[f]??"";
  const m=rec[f];
  if(m===undefined||m===null||typeof m!=="object")return "";
  if(gradeMode()==="language")return m[sub]??"";
  if(sub==="w")return m.w??"";
  const i=Number(sub.slice(1));
  return (m.d&&m.d[i]!==undefined)?m.d[i]:"";
}
function setCell(rec,f,sub,val){
  if(!isMonth(f)){rec[f]=val;return}
  if(typeof rec[f]!=="object"||rec[f]===null)rec[f]=gradeMode()==="language"?{}:{d:[],w:""};
  if(gradeMode()==="language"){rec[f][sub]=val;return}
  if(sub==="w")rec[f].w=val;
  else{
    const i=Number(sub.slice(1));
    rec[f].d=rec[f].d||[];
    rec[f].d[i]=val;
  }
}
function subjectCalc(rec,grade){
  rec=rec||{};
  const M1=monthScore(rec.m1,grade),M2=monthScore(rec.m2,grade),mid=num(rec.mid),M3=monthScore(rec.m3,grade),M4=monthScore(rec.m4,grade),fin=num(rec.fin),r2=num(rec.r2);
  let saay=null;
  if(M1!==null&&M2!==null&&mid!==null&&M3!==null&&M4!==null)saay=((M1+M2)/2+mid+(M3+M4)/2)/3;
  let final=null;
  const gw=gradeWeights(grade);
  if(saay!==null&&fin!==null)final=saay*(gw.saay/100)+fin*(gw.final/100);
  let status=null;
  if(final!==null){
    if(final>=50)status="ناجح";
    else if(r2===null)status="مكمل";
    else status=r2>=50?"ناجح (دور ثاني)":"راسب";
  }
  return {saay,final,status,M1,M2,M3,M4,r2};
}
function seqVals(rec,grade){
  const c=subjectCalc(rec,grade);
  return [c.M1,c.M2,num((rec||{}).mid),c.M3,c.M4,num((rec||{}).fin)];
}
const SEQ_LBL=["شهر1 ف1","شهر2 ف1","نصف السنة","شهر1 ف2","شهر2 ف2","النهائي"];
function trendOf(rec,grade){
  const v=seqVals(rec,grade).filter(x=>x!==null);
  if(v.length<2)return null;
  return Math.round((v[v.length-1]-v[v.length-2])*10)/10;
}
function lastVal(rec,grade){
  const v=seqVals(rec,grade).filter(x=>x!==null);
  return v.length?v[v.length-1]:null;
}
function sparkSVG(rec){
  const vals=seqVals(rec);
  const pts=[];vals.forEach((v,i)=>{if(v!==null)pts.push([i,v])});
  if(pts.length<2)return "";
  const w=150,h=42,px=8;
  const xs=i=>px+(i/5)*(w-2*px);
  const ys=v=>h-5-((v/100)*(h-10));
  const poly=pts.map(p=>xs(p[0]).toFixed(1)+","+ys(p[1]).toFixed(1)).join(" ");
  const last=pts[pts.length-1],prev=pts[pts.length-2];
  const col=last[1]>=prev[1]?"#0F172A":"#B3453F";
  return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" style="display:block"><polyline points="'+poly+'" fill="none" stroke="'+col+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+xs(last[0]).toFixed(1)+'" cy="'+ys(last[1]).toFixed(1)+'" r="3.5" fill="'+col+'"/></svg>';
}
function studentResult(id,subs,grade){
  let sum=0,cnt=0,fails=0,complete=true;
  subs.forEach(sub=>{
    const c=subjectCalc((S.grades[id]||{})[sub],grade);
    if(c.final===null){complete=false;return}
    sum+=c.final;cnt++;if(c.final<50)fails++;
  });
  const avg=cnt?sum/cnt:null;
  let status=null;
  if(complete&&cnt)status=fails===0?"ناجح":(fails<=3?"مكمل بـ"+fails+(fails===1?" مادة":" مواد"):"راسب");
  return {avg,fails,status};
}
function absCount(id){return Object.values(S.attendance).filter(m=>m[id]==="غائب").length}
function normPhone(p){
  let d=(p||"").replace(/\D/g,"");
  if(!d)return "";
  if(d.startsWith("964"))return d;
  if(d.startsWith("0"))return "964"+d.slice(1);
  return "964"+d;
}
/* ============ بنك القوالب ============ */
const TPL_DEF={
  msg:[
    "السلام عليكم ورحمة الله،\nنود إشادتكم بأداء الطالب/ة ({الطالب}) المتميز في مادة {المادة}، ونشكر متابعتكم المستمرة.\n{التوقيع}",
    "السلام عليكم،\nنرجو متابعة الطالب/ة ({الطالب}) في مادة {المادة} لوجود تراجع في مستواه مؤخراً، ونحن بخدمتكم لأي استفسار.\n{التوقيع}",
    "السلام عليكم،\nنذكّركم بقرب موعد امتحان مادة {المادة}، نرجو حث الطالب/ة ({الطالب}) على المراجعة والاستعداد.\n{التوقيع}",
    "السلام عليكم،\nنرجو تحديد موعد للقاء بخصوص وضع الطالب/ة ({الطالب}) الدراسي في أقرب وقت ممكن.\n{التوقيع}",
    "السلام عليكم،\nنود تنبيهكم بضرورة التزام الطالب/ة ({الطالب}) بجلب الكتاب والدفتر لمادة {المادة}.\nشكراً لتعاونكم\n{التوقيع}"
  ],
  note:["مشاركة فعّالة بالدرس","أداء متميز بالامتحان اليومي","لم يجلب الدفتر أو الكتاب","تأخر عن الحصة","إزعاج أثناء الدرس","لم يحل الواجب البيتي","تحسن ملحوظ بالمستوى"]
};
function tplArr(k){
  S.settings.tpl=S.settings.tpl||{};
  if(!S.settings.tpl[k]||!S.settings.tpl[k].length)S.settings.tpl[k]=TPL_DEF[k].slice();
  return S.settings.tpl[k];
}
const TPLS=k=>(S.settings.tpl&&S.settings.tpl[k]&&S.settings.tpl[k].length)?S.settings.tpl[k]:TPL_DEF[k];
function fillTpl(t,s){
  return t.replace(/\n?{التوقيع}/g,"").replace(/{الطالب}/g,s.name).replace(/{المؤسسة}/g,instOf(s))
    .replace(/{المادة}/g,MYSUB()).replace(/{التاريخ}/g,todayStr())
    .replace(/الطالب\/ة/g,genderNoun(s))
    .replace(/{المدرس}/g,S.settings.teacher?("المدرس "+S.settings.teacher):"إدارة المدرسة").trim();
}
function openMsgTplSheet(s){
  let target="guardian";
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>💬 مراسلة بخصوص '+esc(s.name)+'</h3><button class="x" id="mtX">✕</button></div>'+
    '<div class="form">'+
      (s.sphone?'<div class="addRow" style="grid-template-columns:1fr 1fr"><button class="att selG" id="mtToG" style="padding:9px">ولي الأمر</button><button class="att" id="mtToS" style="padding:9px">الطالب نفسه</button></div>':'')+
      '<p class="empty" style="padding:4px 8px;font-size:11.5px">اضغط قالباً حتى يتعبّأ بالأسفل باسم الطالب ومؤسسته تلقائياً، وعدّله كما تشاء قبل الإرسال.</p>'+
      '<div id="mtList" class="payList"></div>'+
      '<label>نص الرسالة<textarea id="mtText" rows="5" placeholder="اكتب الرسالة أو اختر قالباً من الأعلى…"></textarea></label>'+
      '<button class="btn ghost full" id="mtSaveTpl" style="margin-top:0">💾 حفظ النص الحالي كقالب جديد</button>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn ghostD" id="mtBack">رجوع</button><button class="btn" id="mtSend">🖼 إرسال كبطاقة مصوّرة</button></div>'+
  '</div></div>';
  if(s.sphone){
    el("mtToG").onclick=()=>{target="guardian";el("mtToG").className="att selG";el("mtToS").className="att"};
    el("mtToS").onclick=()=>{target="student";el("mtToS").className="att selG";el("mtToG").className="att"};
  }
  const renderTpls=()=>{
    el("mtList").innerHTML=TPLS("msg").map((t,i)=>
      '<div class="behavRow"><div class="bd" data-mt="'+i+'" style="cursor:pointer;font-size:12px;white-space:pre-line">'+esc(t.length>90?t.slice(0,90)+"…":t)+'</div>'+
      '<button class="bDel" data-mtd="'+i+'">✕</button></div>').join("");
    el("mtList").querySelectorAll("[data-mt]").forEach(d=>d.onclick=()=>{
      el("mtText").value=fillTpl(TPLS("msg")[Number(d.dataset.mt)],s);
      el("mtText").scrollIntoView({behavior:"smooth",block:"center"});
    });
    el("mtList").querySelectorAll("[data-mtd]").forEach(b=>b.onclick=()=>{
      if(!confirm("حذف هذا القالب؟"))return;
      tplArr("msg").splice(Number(b.dataset.mtd),1);
      save.settings();renderTpls();
    });
  };
  el("mtSaveTpl").onclick=()=>{
    const txt=el("mtText").value.trim();
    if(!txt){toast("اكتب نص الرسالة أولاً");return}
    tplArr("msg").push(txt);save.settings();renderTpls();
    toast("حُفظ القالب — استخدم {الطالب} و{المؤسسة} و{المادة} كمتغيرات");
  };
  el("mtSend").onclick=async()=>{
    const txt=el("mtText").value.trim();
    if(!txt){toast("اكتب الرسالة أو اختر قالباً");return}
    const btn=el("mtSend");btn.disabled=true;btn.textContent="⏳ جارِ التحضير…";
    const toStudent=target==="student";
    await shareItemCard(s,{badge:toStudent?"💬 رسالة للطالب":"💬 رسالة لولي الأمر",chip:"رسالة عامة",tone:"info",filePrefix:"رسالة",bodyText:txt,
      toPhone:toStudent?s.sphone:s.phone,recipientLabel:toStudent?"الطالب":"ولي الأمر"});
    if(el("mtSend")){btn.disabled=false;btn.textContent="🖼 إرسال كبطاقة مصوّرة"}
  };
  el("mtX").onclick=el("mtBack").onclick=()=>openDetail(s.id);
  attachMathBar(el("mtText"));
  renderTpls();
}
function lessonForDate(grade,section,inst,dateStr){
  const d=new Date(dateStr+"T00:00:00").getDay();
  const matches=S.timetable.filter(t=>t.day===d&&t.grade===grade&&t.section===section&&(!inst||(t.inst||INSTS()[0])===inst));
  return matches.length?matches[0]:null;
}
function absMsg(s){
  const where=isPrivate(s)?("عن درس مادة "+MYSUB()+" اليوم"):"عن الدوام اليوم";
  const lesson=lessonForDate(s.grade,s.section,instOf(s),todayStr());
  const timeStr=lesson?periodTimeStr(lesson.period,lesson.shift||"صباحي"):"";
  const timeInfo=lesson?(" (الحصة "+lesson.period+(timeStr?"، من "+timeStr:"")+")"):"";
  return "السلام عليكم ورحمة الله،\nنود إعلامكم بأن "+genderNoun(s)+" ("+s.name+") - "+s.grade+" "+secTerm(instOf(s))+" "+s.section+" قد تغيب "+where+" بتاريخ "+todayStr()+timeInfo+".\n"+instFollowLine(s);
}
const absCardOpts=s=>({badge:"🚫 تنبيه غياب اليوم",chip:"غياب يومي",tone:"warn",filePrefix:"غياب",bodyText:absMsg(s)});
function praiseMsg(s){
  return "🌟 أحسنت يا "+s.name+"!\nنود الإشادة بأدائك المتميز وجهدك الملحوظ بمادة "+MYSUB()+". استمر بهذا التميز، نحن فخورون بك.\n— "+(S.settings.teacher?("الأستاذ "+S.settings.teacher):"أستاذك");
}
const praiseCardOpts=s=>({badge:"🌟 بطاقة ثناء وتقدير",chip:"ثناء",tone:"good",filePrefix:"ثناء",bodyText:praiseMsg(s)});
const todayStr=()=>new Date().toISOString().slice(0,10);
function academicYearStr(){
  if(S.settings.acadYear&&S.settings.acadYear.trim())return S.settings.acadYear.trim();
  const y=new Date().getFullYear();
  return y+" - "+(y+1);
}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ============ الحالة والتخزين ============ */
const S={students:[],grades:{},attendance:{},payments:{},behavior:{},homework:[],timetable:[],exams:[],messages:{},events:[],qbank:[],examTemplates:[],dailyPlans:[],settings:{school:"ثانويتي",subject:"الرياضيات",teacher:""},
  wsId:"",curInst:"",
  tab:"home",q:"",fg:"",fs:"",aDate:todayStr(),aGrade:GRADES[0],aSection:"أ",
  gGrade:GRADES[0],gSection:"أ",gField:"m1",gSub:"d0",pGrade:GRADES[0],pSection:"أ",pSid:"",
  hGrade:GRADES[0],hSection:"أ",hOpen:""};
let META={schools:[{id:"",name:""}],current:""};
const APP_VER=document.querySelector('meta[name="application-version"]')?.content||"1.4.0";
const MASAR_SCHEMA_VERSION=2; // إصدار بنية النسخة الاحتياطية (يسمح بمعالجة نسخ قديمة/جديدة بشكل صحيح لاحقًا)
const ROLE_LABEL={teacher:"معلم",student:"طالب",parent:"ولي أمر"};
const DAYS=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const MYSUB=()=>S.settings.subject||"المادة الدراسية";
const SUBS=()=>[MYSUB()];
const INSTS=()=>(S.settings.insts&&S.settings.insts.length)?S.settings.insts:[S.settings.school||"مدرستي"];
const instOf=s=>(s&&s.inst)||INSTS()[0];
/* نوع المؤسسة وشعارها وخطابها */
const instMeta=n=>((S.settings.instMeta||{})[n])||{};
const DEFAULT_PRIVATE_INSTS=["التميز في الرياضيات للاستاذ فائز الحمداني"];
const instType=n=>instMeta(n).type||(DEFAULT_PRIVATE_INSTS.includes((n||"").trim())?"private":"school");
const instLogo=n=>instMeta(n).logo||"";
const instAddress=n=>instMeta(n).address||"";
const COLOR_PRESETS=["#0F172A","#7A1F2B","#1E3A6E","#1E7A4C","#5B2C8D","#0E6E7A","#8A5A10","#374151","#9D174D","#134E4A"];
const COLOR_PRESETS_LIGHT=["#E2E8F0","#FDECC8","#CFFAFE","#EDE4FB","#DCFCE7","#DBEAFE","#FBE0E3","#E5E7EB","#FBDCE8","#D6F3EC"];
const PRINT_FONT_OPTIONS=[
  {id:"cairo",label:"Cairo — عصري وأنيق (يحتاج إنترنت أول مرة فقط)",css:"'Cairo',Tahoma,sans-serif"},
  {id:"tajawal",label:"Tajawal — أنيق وحديث (مضمّن بالتطبيق، بدون إنترنت نهائيًا)",css:"'Tajawal',Tahoma,sans-serif"},
  {id:"system",label:"خط نظام جهازك — أنيق ومتوفر دائمًا بدون إنترنت",css:"system-ui,-apple-system,'Segoe UI',Roboto,Tahoma,sans-serif"},
  {id:"naskh",label:"نسخ تقليدي — طابع كلاسيكي رسمي",css:"'Traditional Arabic','Al Bayan','Geeza Pro','Simplified Arabic',serif"},
  {id:"tahoma",label:"Tahoma كلاسيكي — بسيط وواضح",css:"Tahoma,Arial,sans-serif"}
];
const instColor=n=>instMeta(n).color||"";
function shadeColor(hex,pct){
  const n=parseInt(hex.replace("#",""),16);
  const r=Math.max(0,Math.min(255,(n>>16)+pct));
  const g=Math.max(0,Math.min(255,((n>>8)&0xff)+pct));
  const b=Math.max(0,Math.min(255,(n&0xff)+pct));
  return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function hexToRgba(hex,alpha){
  const n=parseInt((hex||"#D9E2EC").replace("#",""),16);
  return "rgba("+(n>>16)+","+((n>>8)&0xff)+","+(n&0xff)+","+alpha+")";
}
/* مصطلح الشعبة/المجموعة وقائمتها القابلة للتخصيص لكل مؤسسة */
const DEFAULT_GROUP_TERM_INSTS=["التميز في الرياضيات للاستاذ فائز الحمداني"];
const secTerm=n=>instMeta(n).sectionTerm||(DEFAULT_GROUP_TERM_INSTS.includes((n||"").trim())?"مجموعة":"شعبة");
const secList=n=>{const l=instMeta(n).sections;return (l&&l.length)?l:SECTIONS};
function secAllLabel(inst){
  const t=secTerm(inst);
  if(t==="شعبة")return "كل الشعب";
  if(t==="مجموعة")return "كل المجموعات";
  return "الكل";
}
function renameSection(inst,oldName,newName){
  newName=(newName||"").trim();
  if(!newName||newName===oldName)return false;
  const list=secList(inst);
  if(list.includes(newName)){toast("الاسم موجود مسبقاً");return false}
  const newList=list.map(x=>x===oldName?newName:x);
  setInstMeta(inst,{sections:newList});
  S.students.forEach(s=>{if(instOf(s)===inst&&s.section===oldName)s.section=newName});
  S.timetable.forEach(t=>{if((t.inst||INSTS()[0])===inst&&t.section===oldName)t.section=newName});
  save.students();save.timetable();
  // نحدّث فلاتر الشعبة "الحالية" بكل التبويبات حتى لا تبقى عالقة على الاسم القديم
  if(S.aSection===oldName)S.aSection=newName;
  if(S.gSection===oldName)S.gSection=newName;
  if(S.hSection===oldName)S.hSection=newName;
  if(S.pSection===oldName)S.pSection=newName;
  if(S.fs===oldName)S.fs=newName;
  return true;
}
function addSection(inst,name){
  name=(name||"").trim();
  if(!name){toast("اكتب اسماً");return false}
  const list=secList(inst).slice();
  if(list.includes(name)){toast("الاسم موجود مسبقاً");return false}
  list.push(name);
  setInstMeta(inst,{sections:list});
  return true;
}
function deleteSection(inst,name){
  const list=secList(inst);
  if(list.length<=1){toast("يجب أن تبقى "+secTerm(inst)+" واحدة على الأقل");return false}
  const others=list.filter(x=>x!==name);
  S.students.forEach(s=>{if(instOf(s)===inst&&s.section===name)s.section=others[0]});
  S.timetable.forEach(t=>{if((t.inst||INSTS()[0])===inst&&t.section===name)t.section=others[0]});
  setInstMeta(inst,{sections:others});
  save.students();save.timetable();
  if(S.aSection===name)S.aSection=others[0];
  if(S.gSection===name)S.gSection=others[0];
  if(S.hSection===name)S.hSection=others[0];
  if(S.pSection===name)S.pSection=others[0];
  if(S.fs===name)S.fs=others[0];
  return true;
}
function setInstMeta(n,patch){
  S.settings.instMeta=S.settings.instMeta||{};
  S.settings.instMeta[n]=Object.assign({},S.settings.instMeta[n]||{},patch);
  save.settings();
}
const isPrivate=s=>instType(instOf(s))==="private";
const principalTitle=inst=>(inst||"").includes("معهد")?"مدير المعهد":"مدير المدرسة";
const genderNoun=s=>(s&&s.gender==="أنثى")?"الطالبة":"الطالب";
function instSign(s){
  const inst=instOf(s),t=S.settings.teacher;
  if(instType(inst)==="private")return "— "+(t?("الأستاذ "+t):"مدرّسكم")+"\n"+inst;
  return "— "+(t?("المدرس "+t+" — "):"")+"إدارة "+inst;
}
function instFollowLine(s){return isPrivate(s)?"وللاستفسار يمكنكم التواصل معي مباشرة.":"يرجى مراجعة إدارة المدرسة عند الحاجة."}
/* بطاقة تواصل الأستاذ */
const CONTACT_TYPES=[["whatsapp","واتساب","💬"],["telegram","تليغرام","✈️"],["instagram","إنستغرام","📷"],["facebook","فيسبوك","📘"],["youtube","يوتيوب","▶️"],["tiktok","تيك توك","🎵"],["web","موقع إلكتروني","🌐"],["other","أخرى","📌"]];
const ctIcon=t=>{const c=CONTACT_TYPES.find(x=>x[0]===t);return c?c[2]:"📌"};
const ctName=t=>{const c=CONTACT_TYPES.find(x=>x[0]===t);return c?c[1]:"تواصل"};
const CT_SVG={
  whatsapp:'<svg viewBox="0 0 32 32" width="15" height="15" style="vertical-align:-3px"><circle cx="16" cy="16" r="16" fill="#25D366"/><path fill="#fff" d="M16 7.3c-4.9 0-8.9 4-8.9 8.9 0 1.6.4 3.1 1.2 4.4L7 24.7l4.3-1.3c1.3.7 2.7 1.1 4.2 1.1h0c4.9 0 8.9-4 8.9-8.9.1-4.9-3.9-8.9-8.4-9.3zm5.2 12.7c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.8-.3-1.4-.5-2.5-1.1-4.1-3.6-4.2-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .5.4.2.5.7 1.8.7 1.9.1.1.1.3 0 .4-.1.2-.1.3-.3.4-.1.2-.3.4-.4.5-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.7.8.2.1.4.2.4.3.1.4.0.7-.1 1.3z"/></svg>',
  telegram:'<svg viewBox="0 0 32 32" width="15" height="15" style="vertical-align:-3px"><circle cx="16" cy="16" r="16" fill="#26A5E4"/><path fill="#fff" d="M23.9 10.4l-2.8 13.2c-.2.9-.8 1.1-1.5.7l-4.3-3.1-2 1.9c-.2.2-.4.4-.9.4l.3-4.5 8.1-7.4c.4-.3-.1-.5-.5-.2l-10.1 6.3-4.3-1.3c-.9-.3-.9-.9.2-1.4l17-6.5c.8-.3 1.5.2 1.2 1.3z"/></svg>'
};
const ctIconHTML=t=>CT_SVG[t]||('<span>'+ctIcon(t)+'</span>');
const myPhone=()=>S.settings.phone||"";
const myContacts=()=>S.settings.contacts||[];
function contactStripHTML(){
  const items=[];
  if(myPhone())items.push('<span class="pCt">📞 '+esc(myPhone())+'</span>');
  myContacts().forEach(c=>{if(c.value)items.push('<span class="pCt">'+ctIconHTML(c.type)+' '+esc(ctName(c.type))+': '+esc(c.value)+'</span>')});
  if(!items.length)return "";
  return '<div class="pContact"><span class="pCtLbl">للتواصل مع '+(S.settings.teacher?("الأستاذ "+esc(S.settings.teacher)):"الأستاذ")+'</span>'+items.join("")+'</div>';
}
function openContactSheet(){
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>📇 بطاقة التواصل</h3><button class="x" id="ctX">✕</button></div>'+
    '<div class="form">'+
      '<label>رقم هاتف الأستاذ (يظهر بالتقارير)<input id="ctPhone" inputmode="tel" placeholder="07XXXXXXXXX" value="'+esc(myPhone())+'"></label>'+
      '<h3 class="h2" style="margin:4px 0 0">حسابات التواصل الاجتماعي</h3>'+
      '<div id="ctList" class="payList"></div>'+
      '<div class="addRow" style="grid-template-columns:auto 1fr auto">'+
        '<select id="ctType">'+CONTACT_TYPES.map(c=>'<option value="'+c[0]+'">'+c[2]+' '+c[1]+'</option>').join("")+'</select>'+
        '<input id="ctVal" placeholder="المعرّف أو الرقم أو الرابط">'+
        '<button class="btn" id="ctAdd">+</button>'+
      '</div>'+
      '<p class="empty" style="padding:8px;font-size:11.5px">كل وسيلة تضيفها تظهر بشريط أنيق أسفل كل تقرير مطبوع وبالبطاقة المصوّرة، بأيقونتها المميزة. احذف أي وسيلة بزر ✕.</p>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="ctDone">تم</button></div>'+
  '</div></div>';
  const renderCt=()=>{
    el("ctList").innerHTML=myContacts().length===0?'<p class="empty" style="padding:8px">لا توجد حسابات مضافة بعد.</p>':
      myContacts().map((c,i)=>'<div class="behavRow"><span class="bChip p">'+ctIconHTML(c.type)+'</span>'+
        '<div class="bd"><b>'+esc(ctName(c.type))+'</b> — '+esc(c.value)+'</div>'+
        '<button class="bDel" data-ctd="'+i+'">✕</button></div>').join("");
    el("ctList").querySelectorAll("[data-ctd]").forEach(b=>b.onclick=()=>{
      S.settings.contacts.splice(Number(b.dataset.ctd),1);save.settings();renderCt();
    });
  };
  el("ctPhone").onchange=e=>{S.settings.phone=e.target.value.trim();save.settings()};
  el("ctAdd").onclick=()=>{
    const v=el("ctVal").value.trim();
    if(!v){toast("اكتب المعرّف أو الرابط");return}
    S.settings.contacts=myContacts().concat([{type:el("ctType").value,value:v}]);
    save.settings();el("ctVal").value="";renderCt();toast("أُضيفت ✓");
  };
  el("ctX").onclick=el("ctDone").onclick=()=>{closeModal();if(S.tab==="home")render()};
  renderCt();
}
/* ============ الامتحانات الإلكترونية ============ */
function openExamsSheet(){
  S.exams=S.exams||[];
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>📝 الامتحانات الإلكترونية (Google Forms)</h3><button class="x" id="exX">✕</button></div>'+
    '<div class="form">'+
      '<div class="addRow" style="grid-template-columns:1fr auto"><input id="exTitle" placeholder="عنوان الامتحان (مثال: امتحان يومي - الأعداد المركبة)" style="grid-column:1/-1"><input id="exLink" placeholder="رابط Google Form هنا…" style="grid-column:1/-1"><label style="grid-column:1/-1;font-size:11px">تاريخ الامتحان (اختياري — يظهر بالتقويم)<input type="date" id="exDate"></label><button class="btn" id="exAdd" style="grid-column:1/-1">+ إضافة</button></div>'+
      '<p class="empty" style="padding:8px;font-size:11.5px">احفظ روابط امتحاناتك الإلكترونية هنا للوصول السريع ومشاركتها مع الطلبة بضغطة زر عبر واتساب أو تليكرام.</p>'+
      '<div id="exList" class="payList" style="margin-top:4px"></div>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="exClose">تم</button></div>'+
  '</div></div>';
  const renderExams=()=>{
    el("exList").innerHTML=S.exams.length===0?'<p class="empty" style="padding:10px">لا توجد امتحانات مسجلة.</p>':
      S.exams.map(e=>'<div class="behavRow"><span class="bChip p" style="background:var(--green);color:var(--gold)">امتحان</span>'+
        '<div class="bd" data-exopen="'+e.id+'" style="cursor:pointer;font-weight:700">'+esc(e.title)+(e.date?'<div style="font-size:10px;font-weight:400;color:#94A3B8">📅 '+e.date+'</div>':'')+'</div>'+
        '<button class="wa" data-exwa="'+e.id+'">واتساب</button>'+
        '<button class="wa" data-extg="'+e.id+'" style="background:#26A5E4">تليكرام</button>'+
        '<button class="bDel" data-exd="'+e.id+'">✕</button></div>').join("");
    el("exList").querySelectorAll("[data-exopen]").forEach(d=>d.onclick=()=>{
      const ex=S.exams.find(x=>x.id===d.dataset.exopen);
      if(ex)window.open(ex.link,"_blank");
    });
    el("exList").querySelectorAll("[data-exwa]").forEach(b=>b.onclick=()=>{
      const ex=S.exams.find(x=>x.id===b.dataset.exwa);
      if(!ex)return;
      const text="السلام عليكم،\nرابط الامتحان اليومي الإلكتروني لمادة "+MYSUB()+" ("+ex.title+"):\n"+ex.link+"\nبالتوفيق لجميع الطلبة.";
      window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank");
    });
    el("exList").querySelectorAll("[data-extg]").forEach(b=>b.onclick=()=>{
      const ex=S.exams.find(x=>x.id===b.dataset.extg);
      if(!ex)return;
      const text="السلام عليكم،\nرابط الامتحان اليومي الإلكتروني لمادة "+MYSUB()+" ("+ex.title+"):\nبالتوفيق لجميع الطلبة.";
      window.open("https://t.me/share/url?url="+encodeURIComponent(ex.link)+"&text="+encodeURIComponent(text),"_blank");
    });
    el("exList").querySelectorAll("[data-exd]").forEach(b=>b.onclick=()=>{
      if(!confirm("حذف هذا الامتحان؟"))return;
      S.exams=S.exams.filter(x=>x.id!==b.dataset.exd);
      save.exams();renderExams();
    });
  };
  el("exAdd").onclick=()=>{
    const title=el("exTitle").value.trim(),link=el("exLink").value.trim(),date=el("exDate").value;
    if(!title||!link){toast("أدخل العنوان والرابط");return}
    S.exams.unshift({id:uid(),title,link,date});
    save.exams();el("exTitle").value="";el("exLink").value="";el("exDate").value="";renderExams();toast("تمت إضافة الامتحان ✓");
  };
  el("exX").onclick=el("exClose").onclick=()=>{closeModal();if(S.tab==="settings")render()};
  renderExams();
}
const VIS=()=>S.curInst?S.students.filter(s=>instOf(s)===S.curInst):S.students;
const DATA_KEYS=["students","grades","attendance","payments","behavior","homework","timetable","settings","exams","messages","events","qbank","examTemplates","dailyPlans"];
const hasCloud=typeof window!=="undefined"&&!!window.storage;
let hasLocal=false;
try{localStorage.setItem("__t","1");localStorage.removeItem("__t");hasLocal=true}catch(e){}
let canSave=hasCloud||hasLocal;
let storeMode=hasCloud?"cloud":(hasLocal?"local":"none");
const memStore={};
let downgraded=false;
function updateStorageBanner(){
  const box=document.getElementById("storageBanner");
  if(!box)return;
  if(storeMode==="none"){
    box.innerHTML='<div class="storageBannerBar">⚠️ تعذّر حفظ البيانات على هذا الجهاز — أي تعديل حالياً غير محفوظ ويُفقد عند إغلاق التطبيق. خذ نسخة احتياطية فوراً.'+
      '<button class="btn ghost" id="stBkNow" style="padding:6px 10px;background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.4);color:#fff">⬇ نسخة احتياطية الآن</button></div>';
    const b=document.getElementById("stBkNow");if(b)b.onclick=()=>exportBackup();
  }else if(storeMode==="local"&&hasCloud){
    box.innerHTML='<div class="storageBannerBar" style="background:#B8860B">⚠️ تعذّر الاتصال بالتخزين السحابي — يُحفظ محلياً على هذا الجهاز فقط حالياً.</div>';
  }else{
    box.innerHTML="";
  }
}
function downgrade(){
  if(storeMode==="cloud"&&hasLocal){storeMode="local";downgraded=true}
  else if(storeMode!=="none"){storeMode="none";canSave=false;downgraded=true}
  updateStorageBanner();
}
async function cloudSet(k,s){
  try{await window.storage.set(k,s);return true}
  catch(e1){
    await new Promise(r=>setTimeout(r,400));
    try{await window.storage.set(k,s);return true}
    catch(e2){console.error("cloud set failed:",e2);return false}
  }
}
async function loadRaw(k,fb){
  if(storeMode==="cloud"){
    try{const r=await window.storage.get(k);if(r)return JSON.parse(r.value)}catch(e){}
  }
  if(hasLocal){
    try{const v=localStorage.getItem("sdb:"+k);if(v!==null)return JSON.parse(v)}catch(e){}
  }
  if(k in memStore)return JSON.parse(memStore[k]);
  return fb;
}
async function saveRaw(k,v){
  const s=JSON.stringify(v);
  memStore[k]=s;
  if(storeMode==="cloud"){
    if(await cloudSet(k,s))return;
    downgrade();
  }
  if(storeMode==="local"||hasLocal){
    try{localStorage.setItem("sdb:"+k,s);return}catch(e){downgrade()}
  }
}
async function delRaw(k){
  delete memStore[k];
  if(hasCloud){try{await window.storage.delete(k)}catch(e){}}
  if(hasLocal){try{localStorage.removeItem("sdb:"+k)}catch(e){}}
}
/* ============ تخزين صور الطلبة بـ IndexedDB (سعته أكبر بكثير من localStorage، يمنع امتلاء التخزين) ============ */
const photoCache={};
const photoSrcOf=s=>photoCache[s.id]||(s&&s.photo&&s.photo.indexOf("data:")===0?s.photo:"");
let _photoDBPromise=null;
function openPhotoDB(){
  if(_photoDBPromise)return _photoDBPromise;
  _photoDBPromise=new Promise((resolve,reject)=>{
    try{
      const req=indexedDB.open("masarPhotosDB",1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("photos"))req.result.createObjectStore("photos")};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    }catch(e){reject(e)}
  });
  return _photoDBPromise;
}
async function idbSetPhoto(id,dataURL){
  try{
    const db=await openPhotoDB();
    await new Promise((res,rej)=>{
      const tx=db.transaction("photos","readwrite");
      tx.objectStore("photos").put(dataURL,id);
      tx.oncomplete=res;tx.onerror=()=>rej(tx.error);
    });
  }catch(e){console.error("idb photo set failed",e)}
}
async function idbDeletePhoto(id){
  try{
    const db=await openPhotoDB();
    await new Promise((res,rej)=>{
      const tx=db.transaction("photos","readwrite");
      tx.objectStore("photos").delete(id);
      tx.oncomplete=res;tx.onerror=()=>rej(tx.error);
    });
  }catch(e){}
}
async function idbGetAllPhotos(){
  try{
    const db=await openPhotoDB();
    return await new Promise((res,rej)=>{
      const tx=db.transaction("photos","readonly");
      const out={};
      const req=tx.objectStore("photos").openCursor();
      req.onsuccess=()=>{
        const cur=req.result;
        if(cur){out[cur.key]=cur.value;cur.continue()}
        else res(out);
      };
      req.onerror=()=>rej(req.error);
    });
  }catch(e){return {}}
}
function setStudentPhoto(id,dataURL){
  if(dataURL){photoCache[id]=dataURL;idbSetPhoto(id,dataURL)}
  else{delete photoCache[id];idbDeletePhoto(id)}
}
/* ============ أدوات تشفير مشتركة (رمز القفل + النسخ الاحتياطية) ============ */
const hasCrypto=typeof window!=="undefined"&&window.crypto&&window.crypto.subtle;
// تنظيف نص غني (HTML) قادم من مصدر خارجي (استيراد/مزامنة سحابية) — منفصل عن sanitizeHTML الخاص باللصق المحلي
// لأنه يحتاج يسمح بخصائص/أصناف KaTeX (data-latex, contenteditable) حتى لا تنكسر المعادلات المحفوظة
function sanitizeRichHTML(input){
  const tpl=document.createElement("template");
  tpl.innerHTML=String(input||"");
  const allowed=new Set(["B","STRONG","I","EM","U","S","BR","P","DIV","SPAN","UL","OL","LI","SUB","SUP"]);
  const walk=node=>{
    [...node.childNodes].forEach(ch=>{
      if(ch.nodeType===Node.ELEMENT_NODE){
        if(!allowed.has(ch.tagName)){ch.replaceWith(...ch.childNodes);return}
        [...ch.attributes].forEach(a=>{
          const n=a.name.toLowerCase(),v=a.value||"";
          const ok=(n==="class"&&/^(katex|katex-|math|mord|mrel|mbin|mopen|mclose|mpunct|mspace|base|strut|vlist|pstrut|sizing|reset-size|size|frac-line|sqrt|root|accent|delimsizing|nulldelimiter|mtight|text|mathrm|mathbf|mathnormal|amsrm|mathit|mainrm|mainit|mainbf|cal|frak|bb|tt|sansserif|boldsymbol|mathbb|mathcal|mathfrak|mathtt|mathsf|mathscr|katex-wrap)/.test(v))||n==="dir"||n==="data-latex"||n==="contenteditable"||n==="title";
          if(!ok||n.startsWith("on")||/javascript:/i.test(v))ch.removeAttribute(a.name);
        });
        walk(ch);
      } else if(ch.nodeType!==Node.TEXT_NODE) ch.remove();
    });
  };
  walk(tpl.content);
  return tpl.innerHTML;
}
// يمشي على كامل شجرة بيانات مستوردة/قادمة من السحابة وينظّف أي حقل نصي يُحتمل احتواؤه على HTML غني
function sanitizeImportedData(d){
  const seen=new WeakSet();
  const recur=(v,k="")=>{
    if(!v||typeof v!=="object")return (typeof v==="string"&&/(text|answer|notes|postNotes|field|content|body|question)/i.test(k))?sanitizeRichHTML(v):v;
    if(seen.has(v))return v;seen.add(v);
    if(Array.isArray(v)){v.forEach((x,i)=>v[i]=recur(x,k));return v}
    Object.keys(v).forEach(key=>v[key]=recur(v[key],key));return v;
  };
  return recur(d);
}
async function sha256Hex(str){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function hashPin(pin,salt){return sha256Hex(salt+":"+pin)}
function b64Of(buf){return btoa(String.fromCharCode(...new Uint8Array(buf)))}
function bytesOfB64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function deriveAesKey(password,saltB64){
  const salt=bytesOfB64(saltB64);
  const baseKey=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:150000,hash:"SHA-256"},baseKey,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encryptBackupText(plainText,password){
  const saltBytes=crypto.getRandomValues(new Uint8Array(16));
  const saltB64=b64Of(saltBytes);
  const key=await deriveAesKey(password,saltB64);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const enc=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(plainText));
  return JSON.stringify({masarEncrypted:true,v:1,salt:saltB64,iv:b64Of(iv),data:b64Of(enc)});
}
async function decryptBackupObj(obj,password){
  const key=await deriveAesKey(password,obj.salt);
  const iv=bytesOfB64(obj.iv);
  const data=bytesOfB64(obj.data);
  const dec=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,data);
  return new TextDecoder().decode(dec);
}
const wsKey=(k,id)=>{const w=(id===undefined?S.wsId:id);return (w?("w:"+w+":"):"")+k};
async function loadKey(k,fb){return loadRaw(wsKey(k),fb)}
async function saveKey(k,v){return saveRaw(wsKey(k),v)}
if("serviceWorker" in navigator&&location.protocol==="https:"){
  navigator.serviceWorker.register("./sw.js").then(reg=>{
    const notifyUpdate=worker=>{
      const box=document.createElement("div");
      box.style.cssText="position:fixed;left:12px;right:12px;bottom:70px;z-index:9999;background:#0F172A;color:#fff;padding:12px 16px;border-radius:14px;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;align-items:center;gap:10px;justify-content:space-between";
      box.innerHTML='<span>🔄 تحديث جديد للتطبيق متوفر</span><button style="background:#D4AF37;border:none;color:#0F172A;border-radius:999px;padding:6px 14px;font-weight:700">تحديث الآن</button>';
      box.querySelector("button").onclick=()=>{worker.postMessage({type:"SKIP_WAITING"});box.remove()};
      document.body.appendChild(box);
    };
    if(reg.waiting)notifyUpdate(reg.waiting);
    reg.addEventListener("updatefound",()=>{
      const nw=reg.installing;
      if(!nw)return;
      nw.addEventListener("statechange",()=>{
        if(nw.state==="installed"&&navigator.serviceWorker.controller)notifyUpdate(nw);
      });
    });
    // التطبيقات المثبّتة (PWA) نادراً ما تتحقق من وجود تحديث تلقائياً عند إعادة الفتح —
    // نجبر الفحص يدويًا كل مرة يرجع التطبيق للواجهة، بدل الاعتماد على فحص المتصفح الخامل (كل 24 ساعة أحيانًا)
    reg.update().catch(()=>{});
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible")reg.update().catch(()=>{});
    });
    window.addEventListener("focus",()=>reg.update().catch(()=>{}));
    let reloading=false;
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if(reloading)return;reloading=true;location.reload();
    });
  }).catch(()=>{});
}
const save={
  students:()=>{saveKey("students",S.students);scheduleSync()},
  grades:()=>{saveKey("grades",S.grades);scheduleSync()},
  attendance:()=>{saveKey("attendance",S.attendance);scheduleSync()},
  payments:()=>{saveKey("payments",S.payments);scheduleSync()},
  behavior:()=>{saveKey("behavior",S.behavior);scheduleSync()},
  homework:()=>{saveKey("homework",S.homework);scheduleSync()},
  dailyPlans:()=>{saveKey("dailyPlans",S.dailyPlans);scheduleSync()},
  timetable:()=>{saveKey("timetable",S.timetable);scheduleSync()},
  settings:()=>{saveKey("settings",S.settings);scheduleSync()},
  exams:()=>{saveKey("exams",S.exams);scheduleSync()},
  messages:()=>{saveKey("messages",S.messages);scheduleSync()},
  events:()=>{saveKey("events",S.events);scheduleSync()},
  qbank:()=>{saveKey("qbank",S.qbank);scheduleSync()},
  examTemplates:()=>{saveKey("examTemplates",S.examTemplates);scheduleSync()}
};
