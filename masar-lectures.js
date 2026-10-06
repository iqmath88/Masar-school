/* =========================================================
   مسار التعليم — مصمم المحاضرات v2.3.0 — Function Plotter
   نموذج أولي مستقل مبني فوق مشروع مسار المستقر
   ========================================================= */
(function(){
"use strict";
const LECTURE_KEY="masar-education-v1-lectures";
const DRAFT_KEY="masar-education-v1-lecture-draft";
const PROJECTS_KEY="masar-education-v1-projects";
const BLOCK_LIBRARY_KEY="masar-education-v1-block-library";
let navigation={projectId:null,chapterId:null};
const BLOCK_TYPES={
  heading:{label:"عنوان فرعي",icon:"🔷"},
  objectives:{label:"أهداف المحاضرة",icon:"🎯"},
  text:{label:"فقرة شرح",icon:"📝"},
  definition:{label:"تعريف",icon:"📘"},
  rule:{label:"قاعدة",icon:"📐"},
  theorem:{label:"نظرية",icon:"📙"},
  proof:{label:"برهان",icon:"🧾"},
  example:{label:"مثال محلول",icon:"✳️"},
  note:{label:"ملاحظة",icon:"💡"},
  exercise:{label:"تمرين",icon:"✍️"},
  activity:{label:"نشاط",icon:"🧩"},
  check:{label:"تحقق من فهمك",icon:"🧠"},
  ministerial:{label:"سؤال وزاري",icon:"🏛️"},
  image:{label:"صورة أو رسم",icon:"🖼️"},
  homework:{label:"واجب بيتي",icon:"🏠"},
  math:{label:"معادلة",icon:"∑"},
  graph:{label:"رسم بياني",icon:"📈"},
  summary:{label:"خلاصة",icon:"✅"}
};
let editorLecture=null;
let draggedBlockIndex=null;
let selectedBlockIndex=0;
const history=new (window.MasarDocumentCore?.CommandHistory||class{reset(){} commit(){} undo(){return null} redo(){return null} state(){return {canUndo:false,canRedo:false}}})();
function normalizeLecture(doc){return window.MasarDocumentCore?window.MasarDocumentCore.migrateLecture(doc):doc}
function historyCommit(label){if(editorLecture)history.commit(editorLecture,label||"تعديل") }
function restoreHistory(snapshot){if(!snapshot)return;editorLecture=normalizeLecture(snapshot);selectedBlockIndex=Math.min(selectedBlockIndex,Math.max(0,editorLecture.blocks.length-1));renderLectureEditor()}

function uid(){return "lec_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function storageGet(key,fallback){return window.MasarStorage?window.MasarStorage.get(key,fallback):(function(){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch(_){return fallback}})()}
function storageSet(key,value){return window.MasarStorage?window.MasarStorage.set(key,value):localStorage.setItem(key,JSON.stringify(value))}
function storageRemove(key){return window.MasarStorage?window.MasarStorage.remove(key):localStorage.removeItem(key)}
function loadLectures(){const list=storageGet(LECTURE_KEY,[]);return Array.isArray(list)?list:[]}
function saveLectures(list){storageSet(LECTURE_KEY,list)}
function loadBlockLibrary(){const list=storageGet(BLOCK_LIBRARY_KEY,[]);return Array.isArray(list)?list:[]}
function saveBlockLibrary(list){storageSet(BLOCK_LIBRARY_KEY,list)}
function loadProjects(){let list=storageGet(PROJECTS_KEY,[]);if(!Array.isArray(list))list=[];if(!list.length){const now=new Date().toISOString(),legacy=loadLectures();const project={id:"prj_legacy",title:"مشروعي الأول",grade:legacy[0]?.grade||"السادس العلمي",subject:legacy[0]?.subject||"الرياضيات",createdAt:now,updatedAt:now,chapters:[{id:"ch_legacy",title:legacy[0]?.chapter||"الفصل الأول",order:1}]};list=[project];legacy.forEach(l=>{l.projectId=project.id;l.chapterId=project.chapters[0].id});saveLectures(legacy);saveProjects(list)}return list}
function saveProjects(list){storageSet(PROJECTS_KEY,list)}
function projectById(id){return loadProjects().find(p=>p.id===id)}
function chapterById(project,id){return project?.chapters?.find(c=>c.id===id)}
function blankLecture(){const p=projectById(navigation.projectId),c=chapterById(p,navigation.chapterId);return normalizeLecture({id:uid(),projectId:p?.id||null,chapterId:c?.id||null,title:"الصيغة الجبرية للعدد المركب",subject:"الرياضيات",grade:p?.grade||"السادس العلمي",chapter:c?.title||"الأعداد المركبة",lectureNo:"1",teacher:"الأستاذ فائز الحمداني",theme:"academic",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),blocks:[
  {id:uid(),type:"heading",title:"أهداف المحاضرة",content:"أن يتعرّف الطالب إلى الصيغة الجبرية للعدد المركب ويميّز بين جزئه الحقيقي والتخيلي."},
  {id:uid(),type:"definition",title:"تعريف",content:"العدد المركب هو عدد يُكتب بالصورة $z=a+bi$، حيث $a,b\\in\\mathbb{R}$ و $i^2=-1$."},
  {id:uid(),type:"example",title:"مثال محلول",content:"اكتب العدد $z=3-2i$ محددًا الجزء الحقيقي والجزء التخيلي.",solution:"لدينا $\\operatorname{Re}(z)=3$ و $\\operatorname{Im}(z)=-2$."},
  {id:uid(),type:"exercise",title:"تحقق من فهمك",content:"حدّد الجزء الحقيقي والجزء التخيلي للعدد $w=-5+4i$."},
  {id:uid(),type:"homework",title:"الواجب البيتي",content:"حل تمارين الكتاب المتعلقة بالصورة الجبرية للعدد المركب."}
]})}
function safe(v){return typeof esc==="function"?esc(String(v??"")):String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
function fmtDate(iso){try{return new Date(iso).toLocaleDateString("ar-IQ")}catch(_){return ""}}
function setContent(html){const c=document.getElementById("content");if(c)c.innerHTML=html}
function draftSave(){if(!editorLecture)return;editorLecture.updatedAt=new Date().toISOString();storageSet(DRAFT_KEY,editorLecture);const s=document.getElementById("lectureSaveState");if(s)s.textContent="تم الحفظ تلقائيًا"}
function scheduleDraft(){historyCommit("تحرير");const s=document.getElementById("lectureSaveState");if(s)s.textContent="جارِ الحفظ…";clearTimeout(scheduleDraft.t);scheduleDraft.t=setTimeout(draftSave,350)}

window.renderLectures=function(){renderProjectsDashboard()};
function renderProjectsDashboard(){
  navigation={projectId:null,chapterId:null};
  const projects=loadProjects(),lectures=loadLectures();
  setContent('<section class="eduPage projectWorkspace"><div class="eduHero"><div><span class="eduEyebrow">مسار التعليم</span><h2>مشاريع التأليف</h2><p>نظّم الملازم إلى مشاريع وفصول ومحاضرات، ثم افتح المحرر مباشرة.</p></div><div class="eduHeroActions"><button class="eduGhost" id="backupLecturesBtn">⬇ نسخة احتياطية</button><button class="eduGhost" id="restoreLecturesBtn">⬆ استعادة</button><button class="eduPrimary" id="newProjectBtn">＋ مشروع جديد</button></div></div><div class="eduStats"><div><b>'+projects.length+'</b><span>مشروع</span></div><div><b>'+projects.reduce((n,p)=>n+(p.chapters?.length||0),0)+'</b><span>فصل</span></div><div><b>'+lectures.length+'</b><span>محاضرة</span></div></div>'+(projects.length?'<div class="projectGrid">'+projects.map(p=>{const count=lectures.filter(l=>l.projectId===p.id).length;return '<article class="projectCard"><div class="projectIcon">📘</div><div class="projectCardBody"><span>'+safe(p.subject||"الرياضيات")+'</span><h3>'+safe(p.title)+'</h3><p>'+safe(p.grade||"")+'</p><div class="projectMeta"><span>'+(p.chapters?.length||0)+' فصول</span><span>'+count+' محاضرات</span></div></div><div class="projectActions"><button class="eduSecondary openProject" data-id="'+safe(p.id)+'">فتح المشروع</button><button class="projectMore" data-delete-project="'+safe(p.id)+'" title="حذف">⋯</button></div></article>'}).join('')+'</div>':'<div class="eduEmpty"><div>📚</div><h3>أنشئ مشروعك الأول</h3><p>مثال: ملزمة الرياضيات للسادس العلمي.</p><button class="eduPrimary" id="emptyNewProject">إنشاء مشروع</button></div>')+'</section>');
  const create=()=>createProject();document.getElementById('newProjectBtn').onclick=create;document.getElementById('emptyNewProject')&&(document.getElementById('emptyNewProject').onclick=create);
  document.querySelectorAll('.openProject').forEach(b=>b.onclick=()=>renderProject(b.dataset.id));
  document.querySelectorAll('[data-delete-project]').forEach(b=>b.onclick=()=>deleteProject(b.dataset.deleteProject));
  document.getElementById('backupLecturesBtn').onclick=()=>window.MasarStorage?.downloadBackup();document.getElementById('restoreLecturesBtn').onclick=restoreEducationBackup;
}
function createProject(){const title=prompt('اسم المشروع','ملزمة السادس العلمي');if(!title?.trim())return;const grade=prompt('الصف الدراسي','السادس العلمي')||'';const subject=prompt('المادة','الرياضيات')||'';const now=new Date().toISOString(),p={id:'prj_'+uid(),title:title.trim(),grade:grade.trim(),subject:subject.trim(),createdAt:now,updatedAt:now,chapters:[]};const list=loadProjects();list.unshift(p);saveProjects(list);renderProject(p.id)}
function deleteProject(id){const p=projectById(id);if(!p)return;const count=loadLectures().filter(l=>l.projectId===id).length;if(!confirm('حذف مشروع «'+p.title+'»'+(count?' وجميع محاضراته ('+count+')':'')+'؟'))return;saveProjects(loadProjects().filter(x=>x.id!==id));saveLectures(loadLectures().filter(l=>l.projectId!==id));renderProjectsDashboard()}
function breadcrumb(items){return '<nav class="eduBreadcrumb">'+items.map((x,i)=>'<button '+(x.action?'data-nav="'+x.action+'"':'disabled')+'>'+safe(x.label)+'</button>'+(i<items.length-1?'<span>‹</span>':'')).join('')+'</nav>'}
function bindBreadcrumb(){document.querySelectorAll('[data-nav="projects"]').forEach(b=>b.onclick=renderProjectsDashboard);document.querySelectorAll('[data-nav="project"]').forEach(b=>b.onclick=()=>renderProject(navigation.projectId))}
function renderProject(id){const p=projectById(id);if(!p)return renderProjectsDashboard();navigation={projectId:id,chapterId:null};const lectures=loadLectures();setContent('<section class="eduPage projectWorkspace">'+breadcrumb([{label:'المشاريع',action:'projects'},{label:p.title}])+'<div class="workspaceHeader"><div><span>'+safe(p.subject||'')+' · '+safe(p.grade||'')+'</span><h2>'+safe(p.title)+'</h2><p>اختر فصلًا أو أنشئ فصلًا جديدًا.</p></div><button class="eduPrimary" id="newChapterBtn">＋ فصل جديد</button></div>'+(p.chapters?.length?'<div class="chapterList">'+p.chapters.map((c,i)=>{const n=lectures.filter(l=>l.projectId===p.id&&l.chapterId===c.id).length;return '<article class="chapterRow"><button class="chapterOpen" data-chapter="'+safe(c.id)+'"><span class="chapterNumber">'+String(i+1).padStart(2,'0')+'</span><span><b>'+safe(c.title)+'</b><small>'+n+' محاضرات</small></span></button><button class="chapterDelete" data-delete-chapter="'+safe(c.id)+'">×</button></article>'}).join('')+'</div>':'<div class="eduEmpty compact"><div>📂</div><h3>لا توجد فصول بعد</h3><p>أنشئ الفصل الأول لتبدأ إضافة المحاضرات.</p></div>')+'</section>');bindBreadcrumb();document.getElementById('newChapterBtn').onclick=()=>createChapter(id);document.querySelectorAll('.chapterOpen').forEach(b=>b.onclick=()=>renderChapter(id,b.dataset.chapter));document.querySelectorAll('[data-delete-chapter]').forEach(b=>b.onclick=()=>deleteChapter(id,b.dataset.deleteChapter))}
function createChapter(projectId){const title=prompt('اسم الفصل','الفصل الأول');if(!title?.trim())return;const list=loadProjects(),p=list.find(x=>x.id===projectId);p.chapters=p.chapters||[];const c={id:'ch_'+uid(),title:title.trim(),order:p.chapters.length+1,createdAt:new Date().toISOString()};p.chapters.push(c);p.updatedAt=new Date().toISOString();saveProjects(list);renderChapter(projectId,c.id)}
function deleteChapter(projectId,chapterId){const p=projectById(projectId),c=chapterById(p,chapterId);if(!c)return;const count=loadLectures().filter(l=>l.projectId===projectId&&l.chapterId===chapterId).length;if(!confirm('حذف فصل «'+c.title+'»'+(count?' وجميع محاضراته ('+count+')':'')+'؟'))return;const list=loadProjects(),target=list.find(x=>x.id===projectId);target.chapters=target.chapters.filter(x=>x.id!==chapterId);saveProjects(list);saveLectures(loadLectures().filter(l=>!(l.projectId===projectId&&l.chapterId===chapterId)));renderProject(projectId)}
function renderChapter(projectId,chapterId){const p=projectById(projectId),c=chapterById(p,chapterId);if(!p||!c)return renderProject(projectId);navigation={projectId,chapterId};const list=loadLectures().filter(l=>l.projectId===projectId&&l.chapterId===chapterId);setContent('<section class="eduPage projectWorkspace">'+breadcrumb([{label:'المشاريع',action:'projects'},{label:p.title,action:'project'},{label:c.title}])+'<div class="workspaceHeader"><div><span>'+safe(p.title)+'</span><h2>'+safe(c.title)+'</h2><p>المحاضرات مرتبة داخل هذا الفصل.</p></div><button class="eduPrimary" id="newLectureBtn">＋ محاضرة جديدة</button></div>'+(list.length?'<div class="eduGrid">'+list.map((l,i)=>'<article class="lectureCard"><div class="lectureCardTop"><span>المحاضرة '+safe(l.lectureNo||i+1)+'</span><button class="lectureMenuBtn" data-del="'+safe(l.id)+'">×</button></div><h3>'+safe(l.title||'محاضرة بلا عنوان')+'</h3><p>'+safe(l.grade||'')+' · '+safe(c.title)+'</p><div class="lectureMeta"><span>'+safe(l.subject||'')+'</span><span>'+fmtDate(l.updatedAt)+'</span></div><button class="eduSecondary openLecture" data-id="'+safe(l.id)+'">فتح وتحرير</button></article>').join('')+'</div>':'<div class="eduEmpty compact"><div>📝</div><h3>ابدأ أول محاضرة</h3><p>سيُنشئ التطبيق نموذجًا جاهزًا داخل هذا الفصل.</p><button class="eduPrimary" id="emptyNewLecture">إنشاء المحاضرة الأولى</button></div>')+'</section>');bindBreadcrumb();const create=()=>{editorLecture=blankLecture();editorLecture.lectureNo=String(list.length+1);history.reset(editorLecture);renderLectureEditor()};document.getElementById('newLectureBtn').onclick=create;document.getElementById('emptyNewLecture')&&(document.getElementById('emptyNewLecture').onclick=create);document.querySelectorAll('.openLecture').forEach(b=>b.onclick=()=>{const l=loadLectures().find(x=>x.id===b.dataset.id);if(l){editorLecture=normalizeLecture(clone(l));history.reset(editorLecture);renderLectureEditor()}});document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(!confirm('حذف هذه المحاضرة؟'))return;saveLectures(loadLectures().filter(x=>x.id!==b.dataset.del));renderChapter(projectId,chapterId)})}


function restoreEducationBackup(){
  if(!window.MasarStorage){alert("تعذر تشغيل الاستعادة.");return}
  const input=document.createElement("input");input.type="file";input.accept="application/json,.json";input.style.display="none";document.body.appendChild(input);
  input.onchange=()=>{const file=input.files&&input.files[0];if(!file){input.remove();return}const reader=new FileReader();reader.onload=()=>{try{const payload=JSON.parse(String(reader.result||""));const check=window.MasarStorage.validateBackup(payload);if(!check.ok)throw new Error(check.error);if(!confirm("سيتم دمج بيانات النسخة الاحتياطية مع البيانات الحالية ثم إعادة تحميل التطبيق. هل تريد المتابعة؟"))return;window.MasarStorage.importBackup(payload,{replace:false});alert("تمت استعادة النسخة الاحتياطية بنجاح.");location.reload()}catch(err){alert(err&&err.message?err.message:"تعذر استعادة النسخة الاحتياطية.")}finally{input.remove()}};reader.onerror=()=>{alert("تعذر قراءة الملف.");input.remove()};reader.readAsText(file,"utf-8")};
  input.click();
}

function renderLectureEditor(){
  if(!editorLecture)editorLecture=blankLecture();
  editorLecture=normalizeLecture(editorLecture);
  setContent('<section class="lectureEditor">'+
   '<div class="editorTopbar"><button class="eduGhost" id="backLectures">‹ المحاضرات</button><div class="editorTitle"><b>تحرير المحاضرة</b><span id="lectureSaveState">مسودة محلية</span></div><div class="editorActions"><button class="eduGhost" id="undoLecture" title="تراجع">↶</button><button class="eduGhost" id="redoLecture" title="إعادة">↷</button><button class="eduSecondary" id="previewLecture">معاينة</button><button class="eduPrimary" id="saveLecture">حفظ</button></div></div>'+
   '<div class="lectureInfoPanel"><label>عنوان المحاضرة<input id="lecTitle" value="'+safe(editorLecture.title)+'"></label><label>المادة<input id="lecSubject" value="'+safe(editorLecture.subject)+'"></label><label>الصف<input id="lecGrade" value="'+safe(editorLecture.grade)+'"></label><label>الفصل أو الوحدة<input id="lecChapter" value="'+safe(editorLecture.chapter)+'"></label><label>رقم المحاضرة<input id="lecNo" value="'+safe(editorLecture.lectureNo)+'"></label><label>إعداد<input id="lecTeacher" value="'+safe(editorLecture.teacher)+'"></label></div>'+
   '<div class="builderLayout authorCanvasLayout"><aside class="blockPalette"><div class="paletteTabs"><button class="active" data-palette-tab="types">العناصر</button><button data-palette-tab="library">مكتبتي</button></div><div id="paletteTypes"><h3>إضافة عنصر</h3><p>اختر نوع الكتلة التي تريد إضافتها.</p>'+Object.entries(BLOCK_TYPES).map(([k,v])=>'<button data-add-block="'+k+'"><span>'+v.icon+'</span>'+v.label+'</button>').join("")+'</div><div id="paletteLibrary" hidden>'+libraryPaletteHTML()+'</div></aside><main class="blocksCanvas authorCanvas"><div class="canvasHeader"><div><b>لوحة التأليف</b><span>'+editorLecture.blocks.length+' عناصر · حدد أي عنصر لتخصيصه</span></div><button class="eduGhost" id="addPageBreak">＋ فاصل صفحة</button></div><div id="blocksList" class="smartBlocksList">'+canvasBlocksHTML()+'</div></main><aside class="propertiesPanel" id="propertiesPanel">'+propertiesPanelHTML()+'</aside></div>'+
  '</section>');
  bindEditor();
}
function legacyToRich(text){
  let out=safe(text||"").replace(/\$([^$]+)\$/g,(_,lx)=>'<span class="richEquation" contenteditable="false" data-latex="'+safe(lx)+'">'+safe(lx)+'</span>');
  out=out.replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g,"$1<em>$2</em>");
  return out.split(/\n{2,}/).map(x=>'<p>'+x.replace(/\n/g,'<br>')+'</p>').join('')||'<p><br></p>';
}
function richValue(b,field){const k=field+'Html';return b[k]||legacyToRich(b[field]||'')}
function richToolbar(i,field){return '<div class="richToolbar" data-toolbar-for="'+i+'-'+field+'">'+
 '<select data-rich-block title="نمط الفقرة"><option value="p">فقرة</option><option value="h2">عنوان كبير</option><option value="h3">عنوان فرعي</option><option value="blockquote">اقتباس/تنبيه</option></select>'+
 '<button data-rich-cmd="bold" title="غامق"><b>ع</b></button><button data-rich-cmd="italic" title="مائل"><i>م</i></button><button data-rich-cmd="underline" title="تحته خط"><u>س</u></button>'+
 '<button data-rich-cmd="justifyRight" title="محاذاة يمين">≡⇥</button><button data-rich-cmd="justifyCenter" title="توسيط">≡</button><button data-rich-cmd="justifyLeft" title="محاذاة يسار">⇤≡</button>'+
 '<button data-rich-dir="rtl" title="اتجاه الفقرة من اليمين إلى اليسار">RTL</button><button data-rich-dir="ltr" title="اتجاه الفقرة من اليسار إلى اليمين">LTR</button><button data-rich-dir="auto" title="اتجاه تلقائي">تلقائي</button>'+
 '<button data-rich-cmd="insertUnorderedList" title="تعداد نقطي">• قائمة</button><button data-rich-cmd="insertOrderedList" title="تعداد رقمي">1. قائمة</button>'+
 '<label class="richColor" title="لون النص">A<input type="color" data-rich-color></label><button data-rich-cmd="removeFormat" title="إزالة التنسيق">Tx</button>'+
 '<span class="toolbarDivider"></span><button data-rich-insert="equation">∑ معادلة</button><button data-rich-insert="table">▦ جدول</button><button data-rich-insert="image">🖼 صورة</button><button data-rich-insert="graph">📈 دالة</button></div>'}
function richEditor(i,field,b,extraClass){return '<div class="compoundEditor '+(extraClass||'')+'">'+richToolbar(i,field)+'<div class="richContent" contenteditable="true" spellcheck="true" dir="rtl" data-rich-index="'+i+'" data-rich-field="'+field+'" data-placeholder="اكتب المحتوى، ثم أدرج معادلة أو جدولًا أو صورة في موضع المؤشر…">'+richValue(b,field)+'</div></div>'}
function smartPasteHint(){return '<span class="smartPasteHint" title="يحافظ المحرر على الفقرات والقوائم والجداول الأساسية">📋 لصق من Word</span>'}
function libraryPaletteHTML(){const list=loadBlockLibrary();return '<h3>مكتبتي</h3><p>كتل محفوظة لإعادة استخدامها.</p>'+(list.length?'<div class="savedBlocks">'+list.map((b,i)=>{const t=BLOCK_TYPES[b.type]||BLOCK_TYPES.text;return '<div class="savedBlock"><button data-insert-library="'+i+'"><span>'+t.icon+'</span><b>'+safe(b.title||t.label)+'</b></button><button data-remove-library="'+i+'" title="حذف">×</button></div>'}).join('')+'</div>':'<div class="libraryEmpty">احفظ أي كتلة من زر ☆ لتظهر هنا.</div>')}
function insertHandleHTML(index){return '<button class="canvasInsert" data-insert-at="'+index+'" title="إدراج عنصر هنا">＋ إدراج عنصر هنا</button>'}
function canvasBlocksHTML(){let out=insertHandleHTML(0);editorLecture.blocks.forEach((b,i)=>{out+=blockEditorHTML(b,i)+insertHandleHTML(i+1)});return out}
function selectedBlock(){return editorLecture?.blocks?.[Math.max(0,Math.min(selectedBlockIndex,editorLecture.blocks.length-1))]||null}
const SMART_TYPES=new Set(["definition","rule","theorem","proof","example","exercise","activity","check","ministerial","homework"]);
function ensureSmart(b){if(!b.smart||typeof b.smart!=="object")b.smart={};const s=b.smart;s.autoNumber=s.autoNumber!==false;s.difficulty=["easy","medium","hard"].includes(s.difficulty)?s.difficulty:"medium";s.marks=Number(s.marks)||0;s.tags=Array.isArray(s.tags)?s.tags:String(s.tags||"").split(",").map(x=>x.trim()).filter(Boolean);s.answerLines=Math.max(0,Number(s.answerLines)||0);s.showSolution=s.showSolution!==false;s.referenceLabel=String(s.referenceLabel||"");s.dependencies=Array.isArray(s.dependencies)?s.dependencies:[];return s}
function smartNumberFor(l,index,type){return l.blocks.slice(0,index+1).filter(x=>x.type===type&&ensureSmart(x).autoNumber!==false).length}
function smartLabel(l,b,index){const t=BLOCK_TYPES[b.type]?.label||b.title||"عنصر";return SMART_TYPES.has(b.type)&&ensureSmart(b).autoNumber!==false?t+" "+smartNumberFor(l,index,b.type):t}
function difficultyLabel(v){return v==='easy'?'سهل':v==='hard'?'متقدم':'متوسط'}
function dependencyOptions(current){return editorLecture.blocks.map((x,i)=>x.id!==current.id&&SMART_TYPES.has(x.type)?'<option value="'+safe(x.id)+'" '+(ensureSmart(current).dependencies.includes(x.id)?'selected':'')+'>'+safe(smartLabel(editorLecture,x,i))+' — '+safe(x.title||'')+'</option>':'').join('')}
function propertiesPanelHTML(){const b=selectedBlock();if(!b)return '<div class="propertiesEmpty">حدد عنصرًا لعرض خصائصه.</div>';const d=b.design||{},sm=ensureSmart(b);const math=b.type==='math'?'<div class="mathInspector"><h4>Math Inspector</h4><label>كود LaTeX<textarea data-math-prop="latex" dir="ltr" spellcheck="false">'+safe(b.latex||b.content||'')+'</textarea></label><label class="propCheck"><input type="checkbox" data-math-prop="numbered" '+(b.numbered!==false?'checked':'')+'> ترقيم المعادلة تلقائيًا</label><label>المحاذاة<select data-math-prop="mathAlign"><option value="center">وسط</option><option value="right">يمين</option><option value="left">يسار</option></select></label><label>حجم المعادلة<select data-math-prop="mathSize"><option value="1">عادي</option><option value="1.15">كبير</option><option value="1.3">كبير جدًا</option></select></label><button type="button" class="eduGhost" id="copySelectedLatex">نسخ LaTeX</button></div>':'';const smart=SMART_TYPES.has(b.type)?'<div class="smartInspector"><h4>خصائص العنصر الذكي</h4><label class="propCheck"><input type="checkbox" data-smart-prop="autoNumber" '+(sm.autoNumber!==false?'checked':'')+'> ترقيم تلقائي</label><label>مستوى الصعوبة<select data-smart-prop="difficulty"><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">متقدم</option></select></label><label>الدرجة<input type="number" min="0" step="0.5" data-smart-prop="marks" value="'+safe(sm.marks)+'"></label><label>الوسوم<input type="text" data-smart-prop="tags" value="'+safe(sm.tags.join(', '))+'" placeholder="أعداد مركبة، وزاري"></label><label>أسطر الإجابة<input type="number" min="0" max="30" data-smart-prop="answerLines" value="'+safe(sm.answerLines)+'"></label><label class="propCheck"><input type="checkbox" data-smart-prop="showSolution" '+(sm.showSolution!==false?'checked':'')+'> إظهار الحل في الطباعة</label><label>وسم مرجعي<input type="text" data-smart-prop="referenceLabel" value="'+safe(sm.referenceLabel)+'" placeholder="مثال: thm-complex"></label><label>يعتمد على<select multiple size="4" data-smart-prop="dependencies">'+dependencyOptions(b)+'</select></label></div>':'';return '<div class="propertiesHead"><b>خصائص العنصر</b><span>'+safe(BLOCK_TYPES[b.type]?.label||b.type)+'</span></div>'+math+smart+'<label>لون العنوان<input type="color" data-prop="accent" value="'+safe(d.accent||'#0f172a')+'"></label><label>لون الخلفية<input type="color" data-prop="background" value="'+safe(d.background||'#ffffff')+'"></label><label>حجم النص<select data-prop="fontSize"><option value="13.5">عادي</option><option value="15">متوسط</option><option value="17">كبير</option><option value="19">كبير جدًا</option></select></label><label>المحاذاة<select data-prop="align"><option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option><option value="justify">ضبط</option></select></label><label>شكل الحدود<select data-prop="borderStyle"><option value="solid">متصل</option><option value="dashed">متقطع</option><option value="none">بدون حدود</option></select></label><label>المسافة الداخلية<input type="range" min="6" max="28" step="1" data-prop="padding" value="'+safe(d.padding||12)+'"></label><label class="propCheck"><input type="checkbox" data-prop="hideTitle" '+(d.hideTitle?'checked':'')+'> إخفاء عنوان الكتلة في الطباعة</label><button class="eduGhost resetDesign" type="button">إعادة التصميم الافتراضي</button>'}
function refreshPropertiesPanel(){const p=document.getElementById('propertiesPanel');if(p){p.innerHTML=propertiesPanelHTML();bindPropertiesPanel()}}
function bindPropertiesPanel(){const b=selectedBlock();if(!b)return;const d=b.design||(b.design={});document.querySelectorAll('#propertiesPanel [data-prop]').forEach(el=>{const k=el.dataset.prop;if(el.tagName==='SELECT'&&d[k]!=null)el.value=String(d[k]);el.oninput=()=>{d[k]=el.type==='checkbox'?el.checked:el.value;applyBlockDesign();scheduleDraft()}});document.querySelectorAll('#propertiesPanel [data-math-prop]').forEach(el=>{const k=el.dataset.mathProp;if(el.tagName==='SELECT'&&b[k]!=null)el.value=String(b[k]);el.oninput=()=>{b[k]=el.type==='checkbox'?el.checked:el.value;if(k==='latex')b.content=el.value;renderMathBlockPreview(selectedBlockIndex);scheduleDraft()}});const sm=ensureSmart(b);document.querySelectorAll('#propertiesPanel [data-smart-prop]').forEach(el=>{const k=el.dataset.smartProp;if(el.tagName==='SELECT'&&!el.multiple)el.value=String(sm[k]);el.oninput=()=>{if(k==='tags')sm[k]=el.value.split(',').map(x=>x.trim()).filter(Boolean);else if(k==='dependencies')sm[k]=[...el.selectedOptions].map(o=>o.value);else if(k==='marks'||k==='answerLines')sm[k]=Number(el.value)||0;else sm[k]=el.type==='checkbox'?el.checked:el.value;applyBlockDesign();scheduleDraft()}});const cp=document.getElementById('copySelectedLatex');if(cp)cp.onclick=async()=>{const code=b.latex||b.content||'';try{await navigator.clipboard.writeText(code);if(typeof toast==='function')toast('تم نسخ LaTeX ✓')}catch(_){prompt('انسخ كود LaTeX',code)}};const r=document.querySelector('#propertiesPanel .resetDesign');if(r)r.onclick=()=>{delete b.design;refreshPropertiesPanel();applyBlockDesign();scheduleDraft()}}
function applyBlockDesign(){document.querySelectorAll('.blockEditor').forEach(card=>{const i=Number(card.dataset.index),b=editorLecture.blocks[i],d=b.design||{};card.style.setProperty('--block-accent',d.accent||'#0f172a');card.style.setProperty('--block-bg',d.background||'#ffffff');card.style.setProperty('--block-font-size',(d.fontSize||13.5)+'px');card.style.setProperty('--block-align',d.align||'right');card.style.setProperty('--block-border-style',d.borderStyle||'solid');card.style.setProperty('--block-padding',(d.padding||12)+'px');card.classList.toggle('selectedBlock',i===selectedBlockIndex)})}

function mathBlockEditor(i,b){const code=b.latex||b.content||'';return '<div class="mathBlockEditor"><div class="mathQuickBar"><button type="button" data-math-snippet="\\frac{}{}">كسر</button><button type="button" data-math-snippet="\\sqrt{}">جذر</button><button type="button" data-math-snippet="^{}">أس</button><button type="button" data-math-snippet="\\int_{}^{} \, dx">تكامل</button><button type="button" data-math-snippet="\\lim_{x \to }">نهاية</button><button type="button" data-open-full-equation="'+i+'">المحرر الكامل</button></div><textarea class="mathBlockLatex" data-math-index="'+i+'" dir="ltr" spellcheck="false" placeholder="اكتب LaTeX مثل: \\frac{x+1}{x-1}">'+safe(code)+'</textarea><div class="mathBlockPreview" id="mathBlockPreview-'+i+'"></div></div>'}function blockEditorHTML(b,i){const t=BLOCK_TYPES[b.type]||BLOCK_TYPES.text;const collapsed=!!b.collapsed,sm=ensureSmart(b);let extra='';if(b.type==='theorem')extra='<div class="solutionLabel">الشروط أو الفرضيات</div>'+richEditor(i,'conditions',b,'conditionsEditor');if(b.type==='proof')extra='<div class="solutionLabel">النتيجة</div>'+richEditor(i,'conclusion',b,'conclusionEditor');const hasSolution=['example','exercise','activity','check','ministerial','homework'].includes(b.type);const body=b.type==='math'?mathBlockEditor(i,b):(b.type==='graph'?graphBlockEditor(i,b):richEditor(i,'content',b,'')+extra+(hasSolution?'<div class="solutionLabel">الحل أو الإجابة النموذجية</div>'+richEditor(i,'solution',b,'solutionEditor'):''));const smartBadge=SMART_TYPES.has(b.type)?'<span class="smartObjectBadge">'+safe(sm.autoNumber?smartLabel(editorLecture,b,i):t.label)+' · '+difficultyLabel(sm.difficulty)+(sm.marks?' · '+safe(sm.marks)+' درجات':'')+'</span>':'';return '<article class="blockEditor'+(collapsed?' isCollapsed':'')+(i===selectedBlockIndex?' selectedBlock':'')+'" draggable="true" data-index="'+i+'"><div class="blockEditorHead"><button class="dragHandle" data-drag-handle="'+i+'" title="اسحب لإعادة الترتيب">⋮⋮</button><strong>'+t.icon+' '+t.label+smartBadge+'</strong><div><button data-collapse="'+i+'" title="طي أو فتح">'+(collapsed?'▾':'▴')+'</button><button data-up="'+i+'" title="أعلى">↑</button><button data-down="'+i+'" title="أسفل">↓</button><button data-copy="'+i+'" title="نسخ">⧉</button><button data-save-library="'+i+'" title="حفظ في مكتبتي">☆</button><button data-remove="'+i+'" title="حذف">×</button></div></div><div class="blockEditorBody"><input class="blockTitleInput" data-field="title" value="'+safe(b.title||t.label)+'" placeholder="عنوان الكتلة">'+body+'<div class="blockHints"><span>'+(b.type==='math'?'تظهر المعادلة فورًا في المعاينة والطباعة.':b.type==='graph'?'أضف دالة أو أكثر، وعدّل المعادلة واللون والمجال في أي وقت.':'حدد النص لتنسيقه، أو استخدم أدوات الإدراج داخل موضع المؤشر.')+'</span>'+smartPasteHint()+'<label><input type="checkbox" data-field="keepTogether" '+(b.keepTogether!==false?'checked':'')+'> إبقاء الكتلة معًا عند الطباعة</label></div></div></article>'}
function renderMathBlockPreview(i){const b=editorLecture?.blocks?.[i],box=document.getElementById('mathBlockPreview-'+i);if(!b||!box)return;const code=(b.latex||b.content||'').trim();box.innerHTML='';if(!code){box.textContent='معاينة المعادلة';box.classList.add('empty');return}box.classList.remove('empty');box.style.textAlign=b.mathAlign||'center';box.style.fontSize=(Number(b.mathSize)||1)+'em';if(window.katex){try{window.katex.render(code,box,{throwOnError:false,displayMode:true,strict:'ignore'})}catch(_){box.textContent=code}}else box.textContent=code}
function bindMathBlocks(){document.querySelectorAll('.mathBlockLatex').forEach(area=>{const i=Number(area.dataset.mathIndex),b=editorLecture.blocks[i];area.oninput=()=>{b.latex=area.value;b.content=area.value;renderMathBlockPreview(i);scheduleDraft()};area.closest('.mathBlockEditor').querySelectorAll('[data-math-snippet]').forEach(btn=>btn.onclick=()=>{const start=area.selectionStart||0,end=area.selectionEnd||0,code=btn.dataset.mathSnippet;area.setRangeText(code,start,end,'end');area.dispatchEvent(new Event('input',{bubbles:true}));area.focus()});renderMathBlockPreview(i)});document.querySelectorAll('[data-open-full-equation]').forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.openFullEquation),b=editorLecture.blocks[i];ensureEquationModal();equationTarget={mathBlockIndex:i};const m=document.getElementById('equationEditorModal'),x=document.getElementById('eqLatexInput');x.value=b.latex||b.content||'';document.getElementById('eqDisplayMode').checked=true;document.getElementById('eqDialogTitle').textContent='∑ تعديل المعادلة';m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('eqModalOpen');updateEquationPreview();setTimeout(()=>x.focus(),30)})}
function ensureGraph(b){
  if(!b.graph||typeof b.graph!=="object")b.graph={};
  const g=b.graph;
  g.xMin=Number.isFinite(Number(g.xMin))?Number(g.xMin):-5;g.xMax=Number.isFinite(Number(g.xMax))?Number(g.xMax):5;
  g.yMin=Number.isFinite(Number(g.yMin))?Number(g.yMin):-5;g.yMax=Number.isFinite(Number(g.yMax))?Number(g.yMax):5;
  g.showGrid=g.showGrid!==false;g.showAxes=g.showAxes!==false;g.points=Array.isArray(g.points)?g.points:[];g.segments=Array.isArray(g.segments)?g.segments:[];
  g.functions=Array.isArray(g.functions)?g.functions.map((f,i)=>({id:String(f.id||('fn_'+uid())),expression:String(f.expression||f.expr||'x'),label:String(f.label||('f'+(i+1))),color:/^#[0-9a-f]{6}$/i.test(f.color||'')?f.color:['#0d8bd7','#dc2626','#16a34a','#7c3aed'][i%4],visible:f.visible!==false,lineStyle:['solid','dashed','dotted'].includes(f.lineStyle)?f.lineStyle:'solid',domainMin:Number.isFinite(Number(f.domainMin))?Number(f.domainMin):g.xMin,domainMax:Number.isFinite(Number(f.domainMax))?Number(f.domainMax):g.xMax})) : [];
  return g;
}
function graphExpressionToJS(raw){
 let e=String(raw||'').trim().replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*/i,'');
 e=e.replace(/\\left|\\right/g,'').replace(/\\cdot|\\times/g,'*').replace(/\\pi/g,'pi').replace(/π/g,'pi');
 for(let n=0;n<5;n++)e=e.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,'(($1)/($2))');
 e=e.replace(/\\sqrt\s*\{([^{}]+)\}/g,'sqrt($1)').replace(/\^\s*\{([^{}]+)\}/g,'^($1)');
 e=e.replace(/\bln\s*\(/gi,'log(').replace(/\|([^|]+)\|/g,'abs($1)').replace(/\^/g,'**');
 if(!/^[0-9xX+\-*/().,\s_a-zA-Z*]+$/.test(e))throw new Error('رموز غير مدعومة');
 const allowed=['sin','cos','tan','asin','acos','atan','sqrt','abs','exp','log','floor','ceil','round','min','max','pow'];
 const words=e.match(/[A-Za-z_]+/g)||[];
 if(words.some(w=>!['x','X','pi','e',...allowed].includes(w)))throw new Error('دالة غير مدعومة');
 e=e.replace(/\bpi\b/g,'Math.PI').replace(/\be\b/g,'Math.E');
 allowed.forEach(fn=>{e=e.replace(new RegExp('\\b'+fn+'\\b','g'),'Math.'+fn)});
 e=e.replace(/\bX\b/g,'x');
 return e;
}
function sampleGraphFunction(fn,g,sx,sy){
 let js;try{js=graphExpressionToJS(fn.expression)}catch(err){return {paths:[],error:err.message}}
 let calc;try{calc=Function('x','"use strict";return ('+js+')')}catch(_){return {paths:[],error:'صيغة غير صحيحة'}}
 const lo=Math.max(g.xMin,Number(fn.domainMin)),hi=Math.min(g.xMax,Number(fn.domainMax));if(!(hi>lo))return {paths:[],error:'المجال غير صالح'};
 const paths=[];let current=[];let lastY=null;const steps=520;
 for(let k=0;k<=steps;k++){
   const x=lo+(hi-lo)*k/steps;let y;try{y=Number(calc(x))}catch(_){y=NaN}
   const valid=Number.isFinite(y)&&Math.abs(y)<1e6;
   if(!valid){if(current.length>1)paths.push(current);current=[];lastY=null;continue}
   const px=sx(x),py=sy(y);const jump=lastY!==null&&Math.abs(py-lastY)>180;
   if(jump&&current.length>1){paths.push(current);current=[]}
   if(py>-2000&&py<2500)current.push([px,py]);lastY=py;
 }
 if(current.length>1)paths.push(current);return {paths,error:''};
}
function graphSvg(b,interactive=false,index=-1){
  const g=ensureGraph(b),W=720,H=420,pad=38,sx=x=>pad+(x-g.xMin)/(g.xMax-g.xMin)*(W-pad*2),sy=y=>H-pad-(y-g.yMin)/(g.yMax-g.yMin)*(H-pad*2);
  let out='<svg class="masarGraphSvg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="رسم بياني" data-graph-svg="'+index+'"><defs><clipPath id="graphClip-'+String(b.id||index).replace(/[^a-z0-9_-]/gi,'')+'"><rect x="'+pad+'" y="'+pad+'" width="'+(W-pad*2)+'" height="'+(H-pad*2)+'"/></clipPath></defs>';
  out+='<rect class="graphBg" x="0" y="0" width="'+W+'" height="'+H+'" rx="16"/>';
  if(g.showGrid){for(let x=Math.ceil(g.xMin);x<=Math.floor(g.xMax);x++)out+='<line class="graphGrid" x1="'+sx(x)+'" y1="'+pad+'" x2="'+sx(x)+'" y2="'+(H-pad)+'"/>';for(let y=Math.ceil(g.yMin);y<=Math.floor(g.yMax);y++)out+='<line class="graphGrid" x1="'+pad+'" y1="'+sy(y)+'" x2="'+(W-pad)+'" y2="'+sy(y)+'"/>'}
  if(g.showAxes){if(g.yMin<=0&&g.yMax>=0)out+='<line class="graphAxis" x1="'+pad+'" y1="'+sy(0)+'" x2="'+(W-pad)+'" y2="'+sy(0)+'"/>';if(g.xMin<=0&&g.xMax>=0)out+='<line class="graphAxis" x1="'+sx(0)+'" y1="'+pad+'" x2="'+sx(0)+'" y2="'+(H-pad)+'"/>'}
  const clip='graphClip-'+String(b.id||index).replace(/[^a-z0-9_-]/gi,'');
  g.functions.forEach((fn,j)=>{if(fn.visible===false)return;const r=sampleGraphFunction(fn,g,sx,sy),dash=fn.lineStyle==='dashed'?'12 8':fn.lineStyle==='dotted'?'3 7':'';r.paths.forEach(path=>{const d=path.map((p,k)=>(k?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');out+='<path class="graphFunction" clip-path="url(#'+clip+')" d="'+d+'" style="stroke:'+safe(fn.color)+';stroke-dasharray:'+dash+'"/>'});});
  g.segments.forEach(seg=>{const a=g.points[seg.a],c=g.points[seg.b];if(a&&c)out+='<line class="graphSegment" x1="'+sx(a.x)+'" y1="'+sy(a.y)+'" x2="'+sx(c.x)+'" y2="'+sy(c.y)+'"/>'});
  g.points.forEach((pt,j)=>{const label=pt.label||String.fromCharCode(65+j);out+='<g class="graphPointGroup" data-point="'+j+'"><circle class="graphPoint" cx="'+sx(pt.x)+'" cy="'+sy(pt.y)+'" r="7"/><text class="graphPointLabel" x="'+(sx(pt.x)+10)+'" y="'+(sy(pt.y)-10)+'">'+safe(label)+' ('+pt.x+', '+pt.y+')</text></g>'});
  return out+'</svg>';
}
function graphFunctionRows(g,i){return g.functions.map((fn,j)=>'<div class="graphFunctionRow" data-function-row="'+j+'"><label class="functionVisible"><input type="checkbox" data-fn-field="visible" '+(fn.visible!==false?'checked':'')+' title="إظهار الدالة"></label><input class="functionLabel" data-fn-field="label" value="'+safe(fn.label)+'" aria-label="اسم الدالة"><input class="functionExpression" data-fn-field="expression" dir="ltr" value="'+safe(fn.expression)+'" aria-label="معادلة الدالة"><input type="color" data-fn-field="color" value="'+safe(fn.color)+'" title="لون المنحنى"><select data-fn-field="lineStyle"><option value="solid">متصل</option><option value="dashed">متقطع</option><option value="dotted">منقط</option></select><input type="number" step="0.5" data-fn-field="domainMin" value="'+fn.domainMin+'" title="بداية المجال"><input type="number" step="0.5" data-fn-field="domainMax" value="'+fn.domainMax+'" title="نهاية المجال"><button type="button" data-remove-function="'+i+':'+j+'" title="حذف الدالة">×</button></div>').join('')}
function graphBlockEditor(i,b){const g=ensureGraph(b);return '<div class="graphBlockEditor"><div class="graphModeTabs"><button type="button" class="active">📈 الدوال والنقاط</button><span>اكتب الدالة بصيغة مثل x^2-4x+3 أو sin(x)</span></div><div class="graphControls"><label>س من <input type="number" step="1" data-graph-field="xMin" value="'+g.xMin+'"></label><label>إلى <input type="number" step="1" data-graph-field="xMax" value="'+g.xMax+'"></label><label>ص من <input type="number" step="1" data-graph-field="yMin" value="'+g.yMin+'"></label><label>إلى <input type="number" step="1" data-graph-field="yMax" value="'+g.yMax+'"></label><label class="graphCheck"><input type="checkbox" data-graph-field="showGrid" '+(g.showGrid?'checked':'')+'> شبكة</label><label class="graphCheck"><input type="checkbox" data-graph-field="showAxes" '+(g.showAxes?'checked':'')+'> محاور</label></div><section class="functionPlotterPanel"><div class="functionPlotterHead"><b>الدوال</b><button type="button" data-add-function="'+i+'">＋ إضافة دالة</button></div><div class="functionColumnLabels"><span></span><span>الاسم</span><span>المعادلة</span><span>اللون</span><span>النمط</span><span>من</span><span>إلى</span><span></span></div><div class="graphFunctionList">'+graphFunctionRows(g,i)+'</div></section><div class="graphAddPoint"><input type="text" data-point-label placeholder="الاسم A"><input type="number" step="0.5" data-point-x placeholder="س"><input type="number" step="0.5" data-point-y placeholder="ص"><button type="button" data-add-point="'+i+'">＋ إضافة نقطة</button><button type="button" data-connect-last="'+i+'">ربط آخر نقطتين</button><button type="button" data-clear-graph="'+i+'">مسح النقاط</button></div><div class="graphCanvas" data-graph-canvas="'+i+'">'+graphSvg(b,true,i)+'</div><div class="graphPointList">'+g.points.map((pt,j)=>'<span>'+safe(pt.label||String.fromCharCode(65+j))+' ('+pt.x+', '+pt.y+') <button type="button" data-remove-point="'+i+':'+j+'">×</button></span>').join('')+'</div></div>'}
function bindGraphBlocks(){
 document.querySelectorAll('.graphBlockEditor').forEach(box=>{const card=box.closest('.blockEditor'),i=Number(card.dataset.index),b=editorLecture.blocks[i],g=ensureGraph(b);
  box.querySelectorAll('[data-graph-field]').forEach(inp=>inp.onchange=()=>{const k=inp.dataset.graphField;g[k]=inp.type==='checkbox'?inp.checked:Number(inp.value);if(g.xMax<=g.xMin)g.xMax=g.xMin+1;if(g.yMax<=g.yMin)g.yMax=g.yMin+1;g.functions.forEach(fn=>{if(!Number.isFinite(fn.domainMin))fn.domainMin=g.xMin;if(!Number.isFinite(fn.domainMax))fn.domainMax=g.xMax});renderLectureEditor();scheduleDraft()});
  box.querySelector('[data-add-function]').onclick=()=>{const colors=['#0d8bd7','#dc2626','#16a34a','#7c3aed','#ea580c'];g.functions.push({id:'fn_'+uid(),label:'f'+(g.functions.length+1),expression:g.functions.length?'sin(x)':'x^2',color:colors[g.functions.length%colors.length],visible:true,lineStyle:'solid',domainMin:g.xMin,domainMax:g.xMax});renderLectureEditor();scheduleDraft()};
  box.querySelectorAll('[data-function-row]').forEach(row=>{const j=Number(row.dataset.functionRow),fn=g.functions[j];row.querySelectorAll('[data-fn-field]').forEach(inp=>{if(inp.tagName==='SELECT')inp.value=fn[inp.dataset.fnField];inp.oninput=()=>{const k=inp.dataset.fnField;fn[k]=inp.type==='checkbox'?inp.checked:(inp.type==='number'?Number(inp.value):inp.value);const canvas=box.querySelector('.graphCanvas');if(canvas)canvas.innerHTML=graphSvg(b,true,i);scheduleDraft()}})});
  box.querySelectorAll('[data-remove-function]').forEach(btn=>btn.onclick=()=>{const j=Number(btn.dataset.removeFunction.split(':')[1]);g.functions.splice(j,1);renderLectureEditor();scheduleDraft()});
  const add=box.querySelector('[data-add-point]');add.onclick=()=>{const x=Number(box.querySelector('[data-point-x]').value),y=Number(box.querySelector('[data-point-y]').value);if(!Number.isFinite(x)||!Number.isFinite(y)){alert('أدخل إحداثيي س و ص بصورة صحيحة');return}g.points.push({id:'pt_'+uid(),label:box.querySelector('[data-point-label]').value.trim()||String.fromCharCode(65+g.points.length),x,y});renderLectureEditor();scheduleDraft()};
  box.querySelector('[data-connect-last]').onclick=()=>{if(g.points.length<2){alert('أضف نقطتين على الأقل');return}g.segments.push({a:g.points.length-2,b:g.points.length-1});renderLectureEditor();scheduleDraft()};
  box.querySelector('[data-clear-graph]').onclick=()=>{if(confirm('مسح جميع نقاط الرسم والقطع المستقيمة؟')){g.points=[];g.segments=[];renderLectureEditor();scheduleDraft()}};
  box.querySelectorAll('[data-remove-point]').forEach(btn=>btn.onclick=()=>{const j=Number(btn.dataset.removePoint.split(':')[1]);g.points.splice(j,1);g.segments=g.segments.filter(q=>q.a!==j&&q.b!==j).map(q=>({a:q.a>j?q.a-1:q.a,b:q.b>j?q.b-1:q.b}));renderLectureEditor();scheduleDraft()});
  const svg=box.querySelector('svg');svg.addEventListener('click',e=>{if(e.target.closest('.graphPointGroup'))return;const r=svg.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*720,py=(e.clientY-r.top)/r.height*420,pad=38;let x=g.xMin+(px-pad)/(720-76)*(g.xMax-g.xMin),y=g.yMax-(py-pad)/(420-76)*(g.yMax-g.yMin);x=Math.round(x*2)/2;y=Math.round(y*2)/2;if(x<g.xMin||x>g.xMax||y<g.yMin||y>g.yMax)return;g.points.push({id:'pt_'+uid(),label:String.fromCharCode(65+g.points.length),x,y});renderLectureEditor();scheduleDraft()});
 });
}
function createEditorBlock(type){const t=BLOCK_TYPES[type]||BLOCK_TYPES.text;const base=window.MasarDocumentCore?.createBlock?window.MasarDocumentCore.createBlock(type,{title:t.label,content:'',keepTogether:true}):{id:uid(),type,title:t.label,content:'',keepTogether:true};ensureSmart(base);if(type==='graph')ensureGraph(base);if(['exercise','activity','check','ministerial','homework'].includes(type)&&!base.smart.answerLines)base.smart.answerLines=4;return base}
function syncMeta(){[ ["lecTitle","title"],["lecSubject","subject"],["lecGrade","grade"],["lecChapter","chapter"],["lecNo","lectureNo"],["lecTeacher","teacher"]].forEach(([id,k])=>{const e=document.getElementById(id);if(e)editorLecture[k]=e.value.trim()})}
function bindEditor(){
  document.getElementById("backLectures").onclick=()=>{if(editorLecture){syncMeta();draftSave()}navigation.projectId&&navigation.chapterId?renderChapter(navigation.projectId,navigation.chapterId):renderProjectsDashboard()};
  document.querySelectorAll(".lectureInfoPanel input").forEach(e=>e.oninput=()=>{syncMeta();scheduleDraft()});
  document.querySelectorAll("[data-add-block]").forEach(b=>b.onclick=()=>{const type=b.dataset.addBlock,t=BLOCK_TYPES[type];editorLecture.blocks.push(createEditorBlock(type));renderLectureEditor();setTimeout(()=>{const list=document.getElementById("blocksList");if(list)list.lastElementChild?.scrollIntoView({behavior:"smooth",block:"center"})},20)});
  document.querySelectorAll("[data-palette-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-palette-tab]").forEach(x=>x.classList.toggle("active",x===b));const lib=b.dataset.paletteTab==="library";document.getElementById("paletteTypes").hidden=lib;document.getElementById("paletteLibrary").hidden=!lib});
  document.querySelectorAll("[data-insert-library]").forEach(b=>b.onclick=()=>{const item=clone(loadBlockLibrary()[Number(b.dataset.insertLibrary)]);if(!item)return;item.id=uid();item.collapsed=false;editorLecture.blocks.push(item);renderLectureEditor()});
  document.querySelectorAll("[data-remove-library]").forEach(b=>b.onclick=()=>{const list=loadBlockLibrary();list.splice(Number(b.dataset.removeLibrary),1);saveBlockLibrary(list);renderLectureEditor()});
  document.querySelectorAll(".blockEditor").forEach(card=>{const i=Number(card.dataset.index);card.querySelectorAll("[data-field]").forEach(f=>{f.oninput=()=>{editorLecture.blocks[i][f.dataset.field]=f.type==="checkbox"?f.checked:f.value;scheduleDraft()}})});
  bindCompoundEditors();
  bindMathBlocks();
  bindGraphBlocks();
  bindPropertiesPanel();applyBlockDesign();
  document.querySelectorAll(".blockEditor").forEach(card=>card.addEventListener("click",e=>{if(e.target.closest("button,input,select,textarea,.richContent,.richToolbar"))return;selectedBlockIndex=Number(card.dataset.index);applyBlockDesign();refreshPropertiesPanel()}));
  document.querySelectorAll("[data-insert-at]").forEach(btn=>btn.onclick=()=>{const type=prompt("نوع العنصر: text, example, note, exercise, image, math","text")||"text";const key=BLOCK_TYPES[type]?type:"text",t=BLOCK_TYPES[key];editorLecture.blocks.splice(Number(btn.dataset.insertAt),0,createEditorBlock(key));selectedBlockIndex=Number(btn.dataset.insertAt);renderLectureEditor();scheduleDraft()});
  document.querySelectorAll(".blockEditor").forEach(card=>{card.addEventListener("dragstart",e=>{draggedBlockIndex=Number(card.dataset.index);card.classList.add("dragging");e.dataTransfer.effectAllowed="move"});card.addEventListener("dragend",()=>{draggedBlockIndex=null;card.classList.remove("dragging");document.querySelectorAll(".blockEditor").forEach(x=>x.classList.remove("dragOver"))});card.addEventListener("dragover",e=>{e.preventDefault();if(draggedBlockIndex!==Number(card.dataset.index))card.classList.add("dragOver")});card.addEventListener("dragleave",()=>card.classList.remove("dragOver"));card.addEventListener("drop",e=>{e.preventDefault();const target=Number(card.dataset.index);card.classList.remove("dragOver");if(draggedBlockIndex===null||draggedBlockIndex===target)return;const [item]=editorLecture.blocks.splice(draggedBlockIndex,1);editorLecture.blocks.splice(target,0,item);draggedBlockIndex=null;renderLectureEditor();scheduleDraft()})});
  document.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>moveBlock(Number(b.dataset.up),-1));
  document.querySelectorAll("[data-down]").forEach(b=>b.onclick=()=>moveBlock(Number(b.dataset.down),1));
  document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.copy),c=clone(editorLecture.blocks[i]);c.id=uid();editorLecture.blocks.splice(i+1,0,c);renderLectureEditor()});
  document.querySelectorAll("[data-collapse]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.collapse);editorLecture.blocks[i].collapsed=!editorLecture.blocks[i].collapsed;renderLectureEditor()});
  document.querySelectorAll("[data-save-library]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.saveLibrary),item=clone(editorLecture.blocks[i]);delete item.id;item.libraryId=uid();item.savedAt=new Date().toISOString();const list=loadBlockLibrary();list.unshift(item);saveBlockLibrary(list);if(typeof toast==="function")toast("تم حفظ الكتلة في مكتبتي ✓");else alert("تم حفظ الكتلة في مكتبتي")});
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.remove);if(confirm("حذف هذا العنصر؟")){const removed=editorLecture.blocks[i]?.id;editorLecture.blocks.splice(i,1);editorLecture.blocks.forEach(x=>{const sm=ensureSmart(x);sm.dependencies=sm.dependencies.filter(id=>id!==removed)});renderLectureEditor()}});
  document.getElementById("addPageBreak").onclick=()=>{editorLecture.blocks.push({id:uid(),type:"heading",title:"بداية صفحة جديدة",content:"",pageBreakBefore:true,keepTogether:true});renderLectureEditor()};
  const hs=history.state();const ub=document.getElementById("undoLecture"),rb=document.getElementById("redoLecture");if(ub){ub.disabled=!hs.canUndo;ub.onclick=()=>restoreHistory(history.undo())}if(rb){rb.disabled=!hs.canRedo;rb.onclick=()=>restoreHistory(history.redo())}
  document.getElementById("saveLecture").onclick=saveCurrentLecture;
  document.getElementById("previewLecture").onclick=renderLecturePreview;
}
let activeRichRange=null;
function rememberRichRange(editor){const sel=window.getSelection();if(sel&&sel.rangeCount&&editor.contains(sel.anchorNode))activeRichRange=sel.getRangeAt(0).cloneRange()}
function restoreRichRange(editor){editor.focus();if(activeRichRange&&editor.contains(activeRichRange.commonAncestorContainer)){const sel=window.getSelection();sel.removeAllRanges();sel.addRange(activeRichRange)}}
function syncRichEditor(editor){const i=Number(editor.dataset.richIndex),field=editor.dataset.richField,b=editorLecture.blocks[i];b[field+'Html']=editor.innerHTML;b[field]=editor.innerText.trim();scheduleDraft()}
function cleanRichHTML(html){const doc=new DOMParser().parseFromString(String(html||''),'text/html');doc.querySelectorAll('script,style,meta,link,iframe,object').forEach(n=>n.remove());doc.querySelectorAll('*').forEach(n=>{[...n.attributes].forEach(a=>{if(/^on/i.test(a.name)||a.name==='class'&&n.tagName!=='TABLE')n.removeAttribute(a.name)});});return doc.body.innerHTML}

function currentRichBlock(editor){
  const sel=window.getSelection();
  let n=sel&&sel.rangeCount?sel.anchorNode:null;
  if(n&&n.nodeType===Node.TEXT_NODE)n=n.parentElement;
  const block=n?.closest?.('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,td,th');
  return block&&editor.contains(block)?block:editor;
}
function setRichDirection(editor,dir){
  restoreRichRange(editor);
  const block=currentRichBlock(editor);
  if(dir==='auto'){
    block.removeAttribute('dir');
    block.style.removeProperty('direction');
    block.style.removeProperty('text-align');
  }else{
    block.setAttribute('dir',dir);
    block.style.direction=dir;
    block.style.textAlign=dir==='rtl'?'right':'left';
  }
  syncRichEditor(editor);
  rememberRichRange(editor);
}
function makeMathNode(latex,display,editorMode){
  const el=document.createElement(display?'div':'span');
  el.className=editorMode?'richEquation'+(display?' richEquationDisplay':''):'eduMath'+(display?' eduMathDisplay':'');
  el.dataset.equationId=el.dataset.equationId||('eq_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
  el.dataset.latex=latex;
  el.dataset.display=display?'true':'false';
  if(editorMode){el.setAttribute('contenteditable','false');el.setAttribute('tabindex','0');el.title='انقر مرتين لتعديل المعادلة';}
  el.textContent=latex;
  return el;
}
function transformMathTextNodes(root,editorMode){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    if(!node.nodeValue||node.nodeValue.indexOf('$')<0)return NodeFilter.FILTER_REJECT;
    const p=node.parentElement;
    if(!p||p.closest('.katex,.eduMath,.richEquation,script,style,textarea,code,pre'))return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  const rx=/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  nodes.forEach(node=>{
    const text=node.nodeValue;let m,last=0,changed=false;const frag=document.createDocumentFragment();rx.lastIndex=0;
    while((m=rx.exec(text))){
      const latex=(m[1]??m[2]??'').trim();if(!latex)continue;
      changed=true;if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
      frag.appendChild(makeMathNode(latex,m[1]!=null,editorMode));last=rx.lastIndex;
    }
    if(changed){if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));node.replaceWith(frag)}
  });
}
function convertTypedMathToRich(editor){
  transformMathTextNodes(editor,true);
  syncRichEditor(editor);
  renderKatex(editor);
}
function bindCompoundEditors(){
 document.querySelectorAll('.richContent').forEach(ed=>{ed.ondblclick=e=>{const node=e.target.closest('.richEquation');if(node&&ed.contains(node)){e.preventDefault();openEquationEditor(Number(ed.dataset.richIndex),ed.dataset.richField,ed,node)}};ed.oninput=()=>syncRichEditor(ed);ed.onkeyup=()=>rememberRichRange(ed);ed.onmouseup=()=>rememberRichRange(ed);ed.onfocus=()=>rememberRichRange(ed);ed.onblur=()=>convertTypedMathToRich(ed);ed.onpaste=e=>{const html=e.clipboardData?.getData('text/html'),plain=e.clipboardData?.getData('text/plain');if(!html)return;e.preventDefault();document.execCommand('insertHTML',false,cleanRichHTML(html));syncRichEditor(ed);showPasteNotice('تم لصق المحتوى مع الحفاظ على الفقرات ✓')}});
 document.querySelectorAll('.richToolbar').forEach(tb=>{const ed=tb.nextElementSibling;tb.onmousedown=e=>{if(e.target.closest('button'))e.preventDefault()};tb.querySelectorAll('[data-rich-cmd]').forEach(b=>b.onclick=()=>{restoreRichRange(ed);document.execCommand(b.dataset.richCmd,false,null);syncRichEditor(ed)});const fmt=tb.querySelector('[data-rich-block]');fmt.onchange=()=>{restoreRichRange(ed);document.execCommand('formatBlock',false,fmt.value);syncRichEditor(ed)};tb.querySelector('[data-rich-color]').oninput=e=>{restoreRichRange(ed);document.execCommand('foreColor',false,e.target.value);syncRichEditor(ed)};tb.querySelectorAll('[data-rich-dir]').forEach(b=>b.onclick=()=>setRichDirection(ed,b.dataset.richDir));tb.querySelectorAll('[data-rich-insert]').forEach(b=>b.onclick=()=>{rememberRichRange(ed);const kind=b.dataset.richInsert;if(kind==='equation')openEquationEditor(Number(ed.dataset.richIndex),ed.dataset.richField,ed);if(kind==='table')insertRichTable(ed);if(kind==='image')insertRichImage(ed);if(kind==='graph')insertRichGraph(ed)})});
 renderKatex(document);
}
function insertHTMLAtRich(editor,html){restoreRichRange(editor);document.execCommand('insertHTML',false,html);syncRichEditor(editor);rememberRichRange(editor)}
function insertRichTable(editor){const r=Math.max(1,Math.min(12,parseInt(prompt('عدد الصفوف','3'))||3)),c=Math.max(1,Math.min(8,parseInt(prompt('عدد الأعمدة','3'))||3));let h='<div class="richEmbed richTableWrap" contenteditable="false"><div class="embedLabel">جدول</div><table contenteditable="true"><tbody>';for(let i=0;i<r;i++){h+='<tr>';for(let j=0;j<c;j++)h+=(i===0?'<th>عنوان</th>':'<td>بيانات</td>');h+='</tr>'}h+='</tbody></table><button class="removeEmbed" onclick="this.parentElement.remove()">حذف الجدول</button></div><p><br></p>';insertHTMLAtRich(editor,h)}
function insertRichImage(editor){const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=()=>{const f=input.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{const caption=prompt('عنوان الصورة (اختياري)','')||'';insertHTMLAtRich(editor,'<figure class="richEmbed richImage" contenteditable="false"><img src="'+rd.result+'" alt="'+safe(caption)+'"><figcaption contenteditable="true">'+safe(caption)+'</figcaption><button class="removeEmbed" onclick="this.parentElement.remove()">حذف الصورة</button></figure><p><br></p>')};rd.readAsDataURL(f)};input.click()}
function graphSVG(expr){let pts=[];const js=expr.replace(/\^/g,'**').replace(/\bx\b/g,'(x)').replace(/sqrt/gi,'Math.sqrt').replace(/sin/gi,'Math.sin').replace(/cos/gi,'Math.cos').replace(/tan/gi,'Math.tan');for(let k=0;k<=120;k++){const x=-6+k/10;let y;try{y=Function('x','return ('+js+')')(x)}catch(_){return null}if(Number.isFinite(y)&&Math.abs(y)<=10)pts.push([20+(x+6)*30,200-y*18])}const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');return '<svg viewBox="0 0 400 400" role="img"><line x1="20" y1="200" x2="380" y2="200"/><line x1="200" y1="20" x2="200" y2="380"/><path d="'+d+'"/></svg>'}
function insertRichGraph(editor){const expr=prompt('اكتب الدالة بدلالة x، مثال: x^2-4','x^2-4');if(!expr)return;const svg=graphSVG(expr);if(!svg){alert('تعذر قراءة الدالة. استخدم صيغة مثل x^2-4 أو sin(x).');return}insertHTMLAtRich(editor,'<figure class="richEmbed richGraph" contenteditable="false">'+svg+'<figcaption>y = '+safe(expr)+'</figcaption><button class="removeEmbed" onclick="this.parentElement.remove()">حذف الرسم</button></figure><p><br></p>')}
function normalizePastedText(text){return String(text||"").replace(/\r\n?/g,"\n").replace(/[\u00a0\u2007\u202f]/g," ").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim()}
function wordHTMLToMarkup(html){
  const doc=new DOMParser().parseFromString(String(html||""),"text/html");
  doc.querySelectorAll("script,style,meta,link,xml,iframe,object").forEach(n=>n.remove());
  doc.querySelectorAll("o\\:p").forEach(n=>n.replaceWith(" "));
  const walk=node=>{
    if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||"";
    if(node.nodeType!==Node.ELEMENT_NODE)return "";
    const tag=node.tagName.toLowerCase();
    let inner=Array.from(node.childNodes).map(walk).join("");
    if(tag==="br")return "\n";
    if(tag==="b"||tag==="strong")return inner.trim()?"**"+inner.trim()+"**":"";
    if(tag==="i"||tag==="em")return inner.trim()?"*"+inner.trim()+"*":"";
    if(tag==="li")return "• "+inner.trim()+"\n";
    if(/^h[1-6]$/.test(tag))return inner.trim()?"\n**"+inner.trim()+"**\n":"";
    if(["p","div","section","article","tr"].includes(tag))return inner.trim()?inner.trim()+"\n":"";
    if(tag==="td"||tag==="th")return inner.trim()+" | ";
    return inner;
  };
  return normalizePastedText(walk(doc.body));
}
function insertAtSelection(area,text){const start=area.selectionStart??area.value.length,end=area.selectionEnd??start;area.setRangeText(text,start,end,"end");area.dispatchEvent(new Event("input",{bubbles:true}))}
function showPasteNotice(message){if(typeof toast==="function")toast(message);else{const s=document.getElementById("lectureSaveState");if(s)s.textContent=message}}
function handleSmartPaste(e,index,field,area){
  const data=e.clipboardData;if(!data)return;
  const html=data.getData("text/html"),plain=data.getData("text/plain");
  if(!html&&!plain)return;
  const cleaned=html?wordHTMLToMarkup(html):normalizePastedText(plain);
  if(!cleaned)return;
  e.preventDefault();
  if(cleaned.length>12000&&!confirm("المحتوى كبير. للحصول على نتيجة أفضل عند نقل فصل أو ملزمة كاملة استخدم استيراد ملف Word في الإصدار المخصص لذلك. هل تريد متابعة اللصق الآن؟"))return;
  insertAtSelection(area,cleaned);
  editorLecture.blocks[index][field]=area.value;scheduleDraft();
  showPasteNotice(html?"تم لصق المحتوى وتنظيف تنسيق Word ✓":"تم لصق النص ✓");
}
function moveBlock(i,d){const j=i+d;if(j<0||j>=editorLecture.blocks.length)return;[editorLecture.blocks[i],editorLecture.blocks[j]]=[editorLecture.blocks[j],editorLecture.blocks[i]];renderLectureEditor()}
function saveCurrentLecture(){syncMeta();editorLecture=normalizeLecture(editorLecture);const validation=window.MasarDocumentCore?.validateLecture(editorLecture);if(validation&&!validation.ok){alert("تعذر الحفظ:\n"+validation.errors.join("\n"));return}const ids=new Set(editorLecture.blocks.map(x=>x.id));const broken=editorLecture.blocks.flatMap((x,i)=>ensureSmart(x).dependencies.filter(id=>!ids.has(id)).map(()=>"العنصر "+(i+1)+" يحتوي مرجعًا مفقودًا"));if(broken.length){alert("تعذر الحفظ:\n"+broken.join("\n"));return}if(!editorLecture.title){alert("اكتب عنوان المحاضرة أولًا");return}editorLecture.updatedAt=new Date().toISOString();const list=loadLectures(),i=list.findIndex(x=>x.id===editorLecture.id);if(i>=0)list[i]=clone(editorLecture);else list.unshift(clone(editorLecture));saveLectures(list);storageRemove(DRAFT_KEY);const s=document.getElementById("lectureSaveState");if(s)s.textContent="محفوظة";if(typeof toast==="function")toast("تم حفظ المحاضرة ✓")}
function mathHTML(text){
  let out=safe(text||"");
  out=out.replace(/\$\$([\s\S]+?)\$\$/g,(_,lx)=>'<div class="eduMath eduMathDisplay" data-display="true" data-latex="'+safe(lx.trim())+'">'+safe(lx.trim())+'</div>');
  out=out.replace(/\$([^$\n]+?)\$/g,(_,lx)=>'<span class="eduMath" data-display="false" data-latex="'+safe(lx.trim())+'">'+safe(lx.trim())+'</span>');
  return out.replace(/\n/g,'<br>')
}
function richPreview(b,field){let html=b[field+'Html'];if(!html)return mathHTML(b[field]||'');const box=document.createElement('div');box.innerHTML=html;box.querySelectorAll('script,style,button').forEach(n=>n.remove());box.querySelectorAll('.richEquation').forEach(n=>{n.className='eduMath'+(n.dataset.display==='true'||n.classList.contains('richEquationDisplay')?' eduMathDisplay':'');n.textContent=n.dataset.latex||n.textContent;n.dataset.display=n.dataset.display||'false'});transformMathTextNodes(box,false);return box.innerHTML}
function lectureDocumentHTML(l){return '<div class="lecturePaper">'+
 '<header class="lectureDocHead"><div><span>'+safe(l.subject)+'</span><h1>'+safe(l.title)+'</h1><p>'+safe(l.grade)+(l.chapter?' — '+safe(l.chapter):'')+'</p></div><div class="lectureNumber">المحاضرة<br><b>'+safe(l.lectureNo||"—")+'</b></div></header>'+
 '<div class="lectureDocMeta"><span>إعداد: '+safe(l.teacher)+'</span><span>مسار التعليم</span></div>'+
 '<div class="lectureDocBody">'+l.blocks.map((b,i)=>{const d=b.design||{},eqNo=b.type==='math'&&b.numbered!==false?l.blocks.slice(0,i+1).filter(x=>x.type==='math'&&x.numbered!==false).length:null,style='--print-accent:'+safe(d.accent||'#0f172a')+';--print-bg:'+safe(d.background||'#ffffff')+';--print-font:'+(Number(d.fontSize)||13.5)+'px;--print-align:'+safe(d.align||'right')+';--print-border:'+safe(d.borderStyle||'solid')+';--print-padding:'+(Number(d.padding)||12)+'px';return '<section style="'+style+'" class="lectureBlock type-'+safe(b.type)+(b.pageBreakBefore?' forcePageBreak':'')+(b.keepTogether!==false?' keepTogether':'')+(d.hideTitle?' hideBlockTitle':'')+'"><div class="lectureBlockTitle"><span>'+(BLOCK_TYPES[b.type]?.icon||"•")+'</span><h2>'+safe((SMART_TYPES.has(b.type)&&ensureSmart(b).autoNumber!==false?smartLabel(l,b,i)+' — ':'')+(b.title||BLOCK_TYPES[b.type]?.label||"عنصر"))+'</h2></div>'+(SMART_TYPES.has(b.type)?'<div class="smartPrintMeta"><span>'+difficultyLabel(ensureSmart(b).difficulty)+'</span>'+(ensureSmart(b).marks?'<span>'+safe(ensureSmart(b).marks)+' درجات</span>':'')+(ensureSmart(b).tags.length?'<span>'+ensureSmart(b).tags.map(safe).join(' · ')+'</span>':'')+'</div>':'')+'<div class="lectureBlockContent">'+(b.type==='math'?'<div class="standaloneEquation" style="text-align:'+safe(b.mathAlign||'center')+';font-size:'+(Number(b.mathSize)||1)+'em"><span class="eduMath eduMathDisplay" data-display="true" data-latex="'+safe(b.latex||b.content||'')+'">'+safe(b.latex||b.content||'')+'</span>'+(eqNo?'<span class="equationNumber">('+eqNo+')</span>':'')+'</div>':b.type==='graph'?'<div class="graphPrintObject">'+graphSvg(b,false,-1)+'</div>':richPreview(b,'content'))+((b.solutionHtml||b.solution)&&ensureSmart(b).showSolution!==false?'<div class="lectureSolution"><b>الحل:</b>'+richPreview(b,'solution')+'</div>':'')+(SMART_TYPES.has(b.type)&&ensureSmart(b).answerLines>0?'<div class="answerLines">'+Array.from({length:ensureSmart(b).answerLines},()=>'<span></span>').join('')+'</div>':'')+'</div></section>'}).join("")+'</div>'+
 '<footer class="lectureDocFoot"><span>'+safe(l.teacher)+'</span><span>مسار التعليم</span></footer></div>'}
function renderKatex(root){if(!window.katex)return;root.querySelectorAll(".eduMath,.richEquation").forEach(n=>{if(n.dataset.rendered==="true"&&n.querySelector(".katex"))return;try{window.katex.render(n.dataset.latex||n.textContent,n,{throwOnError:false,displayMode:n.dataset.display==="true"||n.classList.contains("eduMathDisplay")||n.classList.contains("richEquationDisplay"),strict:"ignore"});n.dataset.rendered="true"}catch(_){n.dataset.rendered="false"}})}
function renderLecturePreview(){syncMeta();setContent('<section class="previewShell"><div class="previewToolbar"><button class="eduGhost" id="backEditor">‹ رجوع للتحرير</button><div><b>معاينة A4</b><span>راجع المحتوى قبل الطباعة</span></div><button class="eduPrimary" id="printLecture">🖨 طباعة / PDF</button></div><div id="lecturePreviewArea">'+lectureDocumentHTML(editorLecture)+'</div></section>');renderKatex(document.getElementById("lecturePreviewArea"));document.getElementById("backEditor").onclick=renderLectureEditor;document.getElementById("printLecture").onclick=()=>{document.getElementById("printArea").innerHTML=lectureDocumentHTML(editorLecture);renderKatex(document.getElementById("printArea"));document.body.classList.add("printingLecture");setTimeout(()=>window.print(),100)}}

const EQ_GROUPS={
  "أساسيات":[
    ["كسر","\\frac{}{}",6],["جذر","\\sqrt{}",6],["أس","^{}",2],["أس سفلي","_{}",2],["قيمة مطلقة","\\left|  \right|",7],["قوسان","\\left(  \right)",7],["±","\\pm",3],["≠","\\ne",3],["≤","\\le",3],["≥","\\ge",3]
  ],
  "تفاضل وتكامل":[
    ["تكامل","\\int \, dx",5],["تكامل محدد","\\int_{}^{} \, dx",6],["مشتقة","\\frac{d}{dx}\left(  \right)",19],["مشتقة ثانية","\\frac{d^2}{dx^2}\left(  \right)",23],["نهاية","\\lim_{x \to }",12],["مجموع","\\sum_{}^{}",6],["حاصل ضرب","\\prod_{}^{}",7],["لانهاية","\\infty",6]
  ],
  "جبر وأعداد مركبة":[
    ["مرافق","\\overline{}",10],["الجزء الحقيقي","\\operatorname{Re}()",19],["الجزء التخيلي","\\operatorname{Im}()",19],["زاوية θ","\\theta",6],["ألفا α","\\alpha",6],["بيتا β","\\beta",5],["باي π","\\pi",3],["ينتمي","\\in",3],["الأعداد الحقيقية","\\mathbb{R}",10],["الأعداد المركبة","\\mathbb{C}",10]
  ],
  "مصفوفات":[
    ["مصفوفة 2×2","\\begin{pmatrix} a & b \\\\ c & d \end{pmatrix}",16],["مصفوفة 3×3","\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \end{pmatrix}",16],["محدد 2×2","\\begin{vmatrix} a & b \\\\ c & d \end{vmatrix}",16],["نظام معادلات","\\begin{cases} x+y=0 \\\\ x-y=0 \end{cases}",14]
  ]
};
let equationTarget=null;
function ensureEquationModal(){
  if(document.getElementById("equationEditorModal"))return;
  const wrap=document.createElement("div");
  wrap.id="equationEditorModal";wrap.className="eqModal";wrap.setAttribute("aria-hidden","true");
  wrap.innerHTML='<div class="eqDialog" role="dialog" aria-modal="true" aria-labelledby="eqDialogTitle"><div class="eqHeader"><div><b id="eqDialogTitle">∑ محرر المعادلات</b><span>اختر الرموز واكتب القيم من دون الحاجة إلى حفظ أكواد LaTeX</span></div><button type="button" id="eqClose" aria-label="إغلاق">×</button></div><div class="eqTabs" id="eqTabs"></div><div class="eqSymbols" id="eqSymbols"></div><div class="eqModeBar"><label><input type="checkbox" id="eqDisplayMode"> عرض كسطر مستقل</label><button type="button" class="eduGhost" id="eqHistoryToggle">سجل المعادلات</button></div><div id="eqHistory" class="eqHistory" hidden></div><label class="eqInputLabel">محتوى المعادلة<textarea id="eqLatexInput" dir="ltr" rows="3" spellcheck="false" placeholder="اكتب المعادلة أو استخدم الأزرار أعلاه"></textarea></label><div class="eqPreview"><span>معاينة مباشرة</span><small id="eqValidation" class="eqValidation"></small><div id="eqPreviewBox">ابدأ بكتابة المعادلة</div></div><details class="eqAdvanced"><summary>عرض كود LaTeX المتقدم</summary><p>يمكن تعديل الكود مباشرة عند الحاجة. سيُحفظ داخل المحاضرة تلقائيًا.</p></details><div class="eqActions"><button type="button" class="eduGhost" id="eqClear">مسح</button><div><button type="button" class="eduSecondary" id="eqCancel">إلغاء</button><button type="button" class="eduPrimary" id="eqInsert">حفظ المعادلة</button></div></div></div>';
  document.body.appendChild(wrap);
  document.getElementById("eqClose").onclick=closeEquationEditor;document.getElementById("eqCancel").onclick=closeEquationEditor;
  wrap.onclick=e=>{if(e.target===wrap)closeEquationEditor()};
  document.getElementById("eqClear").onclick=()=>{const x=document.getElementById("eqLatexInput");x.value="";x.focus();updateEquationPreview()};
  document.getElementById("eqLatexInput").oninput=updateEquationPreview;
  document.getElementById("eqInsert").onclick=insertEquationIntoBlock;document.getElementById("eqHistoryToggle").onclick=toggleEquationHistory;
  const tabs=document.getElementById("eqTabs");Object.keys(EQ_GROUPS).forEach((name,i)=>{const b=document.createElement("button");b.type="button";b.textContent=name;b.dataset.group=name;b.className=i===0?"active":"";b.onclick=()=>renderEquationGroup(name);tabs.appendChild(b)});
  renderEquationGroup(Object.keys(EQ_GROUPS)[0]);
}
function renderEquationGroup(name){
  document.querySelectorAll("#eqTabs button").forEach(b=>b.classList.toggle("active",b.dataset.group===name));
  const box=document.getElementById("eqSymbols");box.innerHTML="";
  EQ_GROUPS[name].forEach(([label,code,cursor])=>{const b=document.createElement("button");b.type="button";b.title=label;b.innerHTML='<span class="eqSymbolMath" data-latex="'+safe(code)+'">'+safe(code)+'</span><small>'+label+'</small>';b.onclick=()=>insertEquationSnippet(code,cursor);box.appendChild(b)});
  renderKatex(box);
}
function insertEquationSnippet(code,cursor){const x=document.getElementById("eqLatexInput"),start=x.selectionStart||0,end=x.selectionEnd||0;x.setRangeText(code,start,end,"end");const pos=start+Math.min(cursor||code.length,code.length);x.setSelectionRange(pos,pos);x.focus();updateEquationPreview()}
const EQ_HISTORY_KEY="masar-equation-history-v1";
function loadEquationHistory(){try{return JSON.parse(localStorage.getItem(EQ_HISTORY_KEY)||"[]")}catch(_){return []}}
function rememberEquation(code){const latex=String(code||"").trim();if(!latex)return;const list=loadEquationHistory().filter(x=>x!==latex);list.unshift(latex);localStorage.setItem(EQ_HISTORY_KEY,JSON.stringify(list.slice(0,100)))}
function toggleEquationHistory(){const box=document.getElementById("eqHistory");box.hidden=!box.hidden;if(box.hidden)return;const list=loadEquationHistory();box.innerHTML=list.length?list.map(x=>'<button type="button" data-eq-history="'+safe(x)+'"><span class="eqHistoryMath" data-latex="'+safe(x)+'">'+safe(x)+'</span></button>').join(''):'<p>لا توجد معادلات محفوظة بعد.</p>';box.querySelectorAll('[data-eq-history]').forEach(b=>b.onclick=()=>{const x=document.getElementById("eqLatexInput");x.value=b.dataset.eqHistory;updateEquationPreview();x.focus()});renderKatex(box)}
function openEquationEditor(index,field,richEditor,existingNode){ensureEquationModal();equationTarget={index,field,richEditor,existingNode:existingNode||null};const m=document.getElementById("equationEditorModal"),x=document.getElementById("eqLatexInput"),display=document.getElementById("eqDisplayMode");x.value=existingNode?(existingNode.dataset.latex||""):"";display.checked=!!existingNode&&(existingNode.dataset.display==="true"||existingNode.classList.contains("richEquationDisplay"));document.getElementById("eqDialogTitle").textContent=existingNode?"∑ تعديل المعادلة":"∑ محرر المعادلات";m.classList.add("open");m.setAttribute("aria-hidden","false");document.body.classList.add("eqModalOpen");updateEquationPreview();setTimeout(()=>x.focus(),30)}
function closeEquationEditor(){const m=document.getElementById("equationEditorModal");if(m){m.classList.remove("open");m.setAttribute("aria-hidden","true")}document.body.classList.remove("eqModalOpen");equationTarget=null}
function validateLatex(code){if(!code)return {ok:false,message:"اكتب المعادلة أولًا"};if(!window.katex)return {ok:true,message:""};try{window.katex.renderToString(code,{throwOnError:true,strict:"ignore"});return {ok:true,message:"الصيغة صحيحة ✓"}}catch(err){return {ok:false,message:(err&&err.message?err.message:"خطأ في صيغة LaTeX").replace(/^KaTeX parse error:\s*/i,"")}}}
function updateEquationPreview(){const x=document.getElementById("eqLatexInput"),box=document.getElementById("eqPreviewBox"),status=document.getElementById("eqValidation");if(!x||!box)return;const code=x.value.trim(),check=validateLatex(code);if(status){status.textContent=check.message;status.classList.toggle("invalid",!check.ok)}if(!code){box.textContent="ابدأ بكتابة المعادلة";box.classList.add("empty");return}box.classList.remove("empty");if(window.katex){try{window.katex.render(code,box,{throwOnError:false,displayMode:true,strict:"ignore"})}catch(_){box.textContent=code}}else box.textContent=code}
function insertEquationIntoBlock(){if(!equationTarget)return;const code=document.getElementById("eqLatexInput").value.trim(),check=validateLatex(code);if(!check.ok){alert("تعذر حفظ المعادلة: "+check.message);return}rememberEquation(code);if(equationTarget.mathBlockIndex!=null){const i=equationTarget.mathBlockIndex,b=editorLecture.blocks[i];b.latex=code;b.content=code;b.equation=b.equation||{id:'eq_'+uid()};b.equation.latex=code;b.equation.updatedAt=new Date().toISOString();closeEquationEditor();renderLectureEditor();scheduleDraft();return}const {index,field,richEditor,existingNode}=equationTarget,display=document.getElementById("eqDisplayMode").checked;if(richEditor){if(existingNode){existingNode.dataset.latex=code;existingNode.dataset.display=display?"true":"false";existingNode.classList.toggle("richEquationDisplay",display);existingNode.textContent=code;existingNode.dataset.rendered="false";syncRichEditor(richEditor);renderKatex(richEditor)}else{insertHTMLAtRich(richEditor,'<span class="richEquation'+(display?' richEquationDisplay':'')+'" contenteditable="false" tabindex="0" title="انقر مرتين لتعديل المعادلة" data-equation-id="eq_'+uid()+'" data-display="'+(display?'true':'false')+'" data-latex="'+safe(code)+'">'+safe(code)+'</span>&nbsp;');renderKatex(richEditor)}closeEquationEditor();return}const area=document.querySelector('.blockEditor[data-index="'+index+'"] [data-field="'+field+'"]');if(!area)return;const start=area.selectionStart??area.value.length,end=area.selectionEnd??start,mark=display?"$$":"$";area.setRangeText(mark+code+mark,start,end,"end");editorLecture.blocks[index][field]=area.value;scheduleDraft();closeEquationEditor()}

window.addEventListener("afterprint",()=>{document.body.classList.remove("printingLecture");const p=document.getElementById("printArea");if(p)p.innerHTML=""});
})();
