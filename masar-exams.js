/* ============ إعداد وطباعة ورقة الأسئلة ============ */
const ARABIC_ENUM=["أ","ب","ج","د","هـ","و","ز","ح","ط","ي","ك","ل"];
/* ============ بنك الأسئلة ============ */
const DIFFICULTY_LEVELS=[["easy","🟢 سهل"],["medium","🟡 متوسط"],["hard","🔴 صعب"]];
const diffLabel=d=>(DIFFICULTY_LEVELS.find(x=>x[0]===d)||["",""])[1];
function qbankFilters(){
  const chapters=[...new Set(S.qbank.map(q=>q.chapter).filter(Boolean))];
  const topics=[...new Set(S.qbank.map(q=>q.topic).filter(Boolean))];
  return {chapters,topics};
}
function openQuestionBank(pickMode,onPick,onCancel){
  let filterChapter="",filterTopic="",filterDiff="";
  const draw=()=>{
    const {chapters,topics}=qbankFilters();
    const list=S.qbank.filter(q=>
      (!filterChapter||q.chapter===filterChapter)&&
      (!filterTopic||q.topic===filterTopic)&&
      (!filterDiff||q.difficulty===filterDiff)
    );
    el("modal").innerHTML=
    '<div class="overlay"><div class="sheet">'+
      '<div class="sheetHead"><h3>📚 بنك الأسئلة'+(pickMode?" — اختر أسئلة":"")+'</h3><button class="x" id="qbX">✕</button></div>'+
      '<div class="form">'+
        (pickMode?'<p class="empty" style="padding:6px;font-size:11.5px">اختر الأسئلة اللي تريد إضافتها للامتحان الحالي.</p>':
          '<button class="btn ghost full" id="qbAddNew" style="margin-top:0">+ إضافة سؤال جديد للبنك</button>')+
        '<div class="filters three">'+
          '<select id="qbFChapter"><option value="">كل الفصول</option>'+chapters.map(c=>'<option'+(filterChapter===c?" selected":"")+'>'+esc(c)+'</option>').join("")+'</select>'+
          '<select id="qbFTopic"><option value="">كل المواضيع</option>'+topics.map(t=>'<option'+(filterTopic===t?" selected":"")+'>'+esc(t)+'</option>').join("")+'</select>'+
          '<select id="qbFDiff"><option value="">كل المستويات</option>'+DIFFICULTY_LEVELS.map(([v,l])=>'<option value="'+v+'"'+(filterDiff===v?" selected":"")+'>'+l+'</option>').join("")+'</select>'+
        '</div>'+
        (pickMode?'<div class="actions"><button class="btn ghost" id="qbRandom">🎲 اختيار عشوائي (5 أسئلة)</button></div>':'')+
        '<div id="qbList" class="payList">'+
          (list.length===0?'<p class="empty" style="padding:14px">لا توجد أسئلة مطابقة بالبنك بعد.</p>':
            list.map(q=>'<div class="behavRow" data-qbid="'+q.id+'">'+
              (pickMode?'<input type="checkbox" data-qbcheck="'+q.id+'" style="width:20px;height:20px;align-self:center">':'')+
              '<div class="bd"><b>'+esc(q.text.slice(0,60))+(q.text.length>60?"…":"")+'</b>'+
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:2px">'+(q.chapter?esc(q.chapter)+" — ":"")+(q.topic?esc(q.topic)+" — ":"")+diffLabel(q.difficulty)+(q.parts&&q.parts.length?" — "+q.parts.length+" فرع":"")+'</div></div>'+
              (pickMode?'':'<button class="bDel" data-qbdel="'+q.id+'">✕</button>')+
            '</div>').join(""))+
        '</div>'+
      '</div>'+
      '<div class="sheetFoot">'+(pickMode?'<button class="btn ghost" id="qbCancel">إلغاء</button><button class="btn" id="qbConfirm">إضافة المحدد للامتحان</button>':'<button class="btn" id="qbClose">تم</button>')+'</div>'+
    '</div></div>';
    el("qbFChapter").onchange=e=>{filterChapter=e.target.value;draw()};
    el("qbFTopic").onchange=e=>{filterTopic=e.target.value;draw()};
    el("qbFDiff").onchange=e=>{filterDiff=e.target.value;draw()};
    el("qbX").onclick=onCancel||closeModal;
    if(pickMode){
      el("qbCancel").onclick=onCancel||closeModal;
      el("qbConfirm").onclick=()=>{
        const ids=Array.from(el("modal").querySelectorAll("[data-qbcheck]:checked")).map(cb=>cb.dataset.qbcheck);
        const picked=S.qbank.filter(q=>ids.includes(q.id));
        if(!picked.length){toast("اختر سؤالاً واحداً على الأقل");return}
        onPick(picked);
      };
      el("qbRandom").onclick=()=>{
        const shuffled=list.slice().sort(()=>Math.random()-0.5).slice(0,5);
        if(!shuffled.length){toast("لا توجد أسئلة مطابقة للفلتر الحالي");return}
        onPick(shuffled);
      };
    }else{
      el("qbClose").onclick=closeModal;
      el("qbAddNew").onclick=()=>openQuestionEditor(null,draw);
      el("modal").querySelectorAll("[data-qbid]").forEach(row=>{
        if(!row.querySelector("[data-qbdel]"))return;
        row.querySelector(".bd").onclick=()=>openQuestionEditor(row.dataset.qbid,draw);
      });
      el("modal").querySelectorAll("[data-qbdel]").forEach(b=>b.onclick=e=>{
        e.stopPropagation();
        if(!confirm("حذف هذا السؤال من البنك؟"))return;
        S.qbank=S.qbank.filter(q=>q.id!==b.dataset.qbdel);
        save.qbank();draw();
      });
    }
  };
  draw();
}
function openQuestionEditor(id,onDone,prefill){
  const q=id?S.qbank.find(x=>x.id===id):Object.assign({id:uid(),text:"",marks:"",chapter:"",topic:"",difficulty:"medium",parts:[]},prefill||{});
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>'+(id?"تعديل سؤال":"سؤال جديد للبنك")+'</h3><button class="x" id="qeX">✕</button></div>'+
    '<div class="form">'+
      '<div class="fieldLbl">نص السؤال<div id="qeTextHost"></div></div>'+
      '<div class="grid2">'+
        '<label>الفصل/الوحدة<input id="qeChapter" value="'+esc(q.chapter)+'" placeholder="مثال: الفصل الثالث"></label>'+
        '<label>الموضوع<input id="qeTopic" value="'+esc(q.topic)+'" placeholder="مثال: المعادلات"></label>'+
      '</div>'+
      '<div class="grid2">'+
        '<label>مستوى الصعوبة<select id="qeDiff">'+DIFFICULTY_LEVELS.map(([v,l])=>'<option value="'+v+'"'+(q.difficulty===v?" selected":"")+'>'+l+'</option>').join("")+'</select></label>'+
        '<label>الدرجة (اختياري)<input id="qeMarks" inputmode="numeric" value="'+esc(q.marks)+'"></label>'+
      '</div>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn ghost" id="qeCancel">إلغاء</button><button class="btn" id="qeSave">حفظ بالبنك</button></div>'+
  '</div></div>';
  const toolbar=createMathToolbar();
  el("qeTextHost").appendChild(toolbar.bar);
  el("qeTextHost").appendChild(toolbar.tplMenu);
  el("qeTextHost").appendChild(toolbar.qtplMenu);
  el("qeTextHost").appendChild(toolbar.imgInput);
  const qeEditor=makeSimpleEditor("اكتب نص السؤال…",q.text,toolbar);
  el("qeTextHost").appendChild(qeEditor);
  toolbar.setActive(qeEditor);
  el("qeX").onclick=el("qeCancel").onclick=()=>{onDone&&onDone()};
  el("qeSave").onclick=()=>{
    q.text=qeEditor.innerHTML.trim();
    if(!stripHTML(q.text).trim()){toast("اكتب نص السؤال أولاً");return}
    q.chapter=el("qeChapter").value.trim();
    q.topic=el("qeTopic").value.trim();
    q.difficulty=el("qeDiff").value;
    q.marks=el("qeMarks").value.trim();
    if(!id)S.qbank.push(q);
    save.qbank();
    toast("تم الحفظ بالبنك ✓");
    onDone&&onDone();
  };
}
function openLessonPlanBuilder(){
  const data={
    topic:"",grade:gradesFor(S.curInst||INSTS()[0])[0],section:secList(S.curInst||INSTS()[0])[0],date:todayStr(),
    objectives:"",aids:"",intro:"",presentation:"",application:"",evaluation:"",homework:"",notes:""
  };
  let toolbar=null;
  const SECTIONS=[
    ["objectives","🎯 الأهداف السلوكية"],["aids","🧰 الوسائل التعليمية"],
    ["intro","🔔 التمهيد"],["presentation","📖 العرض"],
    ["application","✍️ التطبيق"],["evaluation","✅ التقويم"],
    ["homework","📋 الواجب البيتي"],["notes","🗒️ ملاحظات (اختياري)"]
  ];
  const draw=()=>{
    el("modal").innerHTML=
    '<div class="overlay"><div class="sheet">'+
      '<div class="sheetHead"><h3>📅 الخطة اليومية</h3><button class="x" id="lpX">✕</button></div>'+
      '<div class="form">'+
        '<label>عنوان الدرس<input id="lpTopic" value="'+esc(data.topic)+'" placeholder="مثال: المعادلات التربيعية"></label>'+
        '<div class="grid2">'+
          '<label>الصف<select id="lpGrade">'+opts(gradesFor(S.curInst||INSTS()[0]),data.grade)+'</select></label>'+
          '<label>'+secTerm(S.curInst||INSTS()[0])+'<select id="lpSection">'+opts(secList(S.curInst||INSTS()[0]),data.section)+'</select></label>'+
        '</div>'+
        '<label>التاريخ<input type="date" id="lpDate" value="'+esc(data.date)+'"></label>'+
        '<div id="lpToolbarHost" class="stickyToolbar"></div>'+
        '<p class="empty" style="padding:2px 4px;font-size:10.5px">💡 اضغط داخل أي قسم أدناه ثم استخدم الشريط أعلاه لتنسيقه.</p>'+
        SECTIONS.map(([key,label])=>'<div class="fieldLbl">'+label+'<div id="lp_'+key+'_host"></div></div>').join("")+
      '</div>'+
      '<div class="sheetFoot"><button class="btn ghost" id="lpClose">إغلاق</button><button class="btn" id="lpPrint">🖨 طباعة الخطة</button></div>'+
    '</div></div>';
    el("lpTopic").onchange=e=>data.topic=e.target.value;
    el("lpGrade").onchange=e=>data.grade=e.target.value;
    el("lpSection").onchange=e=>data.section=e.target.value;
    el("lpDate").onchange=e=>data.date=e.target.value;
    toolbar=createMathToolbar();
    el("lpToolbarHost").appendChild(toolbar.bar);
    el("lpToolbarHost").appendChild(toolbar.tplMenu);
    el("lpToolbarHost").appendChild(toolbar.qtplMenu);
    el("lpToolbarHost").appendChild(toolbar.imgInput);
    SECTIONS.forEach(([key])=>{
      const ed=makeSimpleEditor("اكتب هنا…",data[key],toolbar);
      ed.oninput=()=>data[key]=ed.innerHTML;
      el("lp_"+key+"_host").appendChild(ed);
    });
    toolbar.setActive(el("lp_"+SECTIONS[0][0]+"_host").querySelector(".richEdit"));
    el("lpX").onclick=el("lpClose").onclick=closeModal;
    el("lpPrint").onclick=()=>{
      if(!data.topic.trim()){toast("اكتب عنوان الدرس أولاً");return}
      printLessonPlan(data);
    };
  };
  draw();
}
function printLessonPlan(data){
  const inst=S.curInst||INSTS()[0];
  const sectionHTML=(label,val)=>stripHTML(val).trim()?
    '<div class="lpSection"><div class="lpSecTitle">'+label+'</div><div class="lpSecBody">'+val+'</div></div>':'';
  const body=
    '<div class="pInfo"><b>'+esc(data.grade)+'</b> — '+secTerm(inst)+' '+esc(data.section)+' &nbsp;|&nbsp; <b>المادة:</b> '+esc(MYSUB())+' &nbsp;|&nbsp; <b>التاريخ:</b> '+esc(data.date)+'</div>'+
    '<div class="lpTopicBox"><b>عنوان الدرس:</b> '+esc(data.topic)+'</div>'+
    sectionHTML("🎯 الأهداف السلوكية",data.objectives)+
    sectionHTML("🧰 الوسائل التعليمية",data.aids)+
    sectionHTML("🔔 التمهيد",data.intro)+
    sectionHTML("📖 العرض",data.presentation)+
    sectionHTML("✍️ التطبيق",data.application)+
    sectionHTML("✅ التقويم",data.evaluation)+
    sectionHTML("📋 الواجب البيتي",data.homework)+
    sectionHTML("🗒️ ملاحظات",data.notes);
  printHTML("الخطة اليومية — "+data.topic,body,false,inst);
}
function openExamTemplatesSheet(onLoad,onCancel){
  const draw=()=>{
    el("modal").innerHTML=
    '<div class="overlay"><div class="sheet">'+
      '<div class="sheetHead"><h3>📂 النماذج المحفوظة</h3><button class="x" id="etX">✕</button></div>'+
      '<div class="form">'+
        (S.examTemplates.length===0?'<p class="empty" style="padding:16px">لا توجد نماذج محفوظة بعد. من محرر الأسئلة، اضغط «💾 حفظ كنموذج كامل».</p>':
          '<div class="payList">'+S.examTemplates.map(t=>
            '<div class="behavRow"><div class="bd" data-etload="'+t.id+'" style="cursor:pointer"><b>'+esc(t.name)+'</b>'+
            '<div style="font-size:10.5px;color:#94A3B8;margin-top:2px">'+(t.data.questions?t.data.questions.length:0)+' سؤال — حُفظ بتاريخ '+esc(t.savedAt)+'</div></div>'+
            '<button class="bDel" data-etdel="'+t.id+'">✕</button></div>'
          ).join("")+'</div>')+
      '</div>'+
      '<div class="sheetFoot"><button class="btn ghost" id="etCancel">إلغاء</button></div>'+
    '</div></div>';
    el("etX").onclick=el("etCancel").onclick=onCancel||closeModal;
    el("modal").querySelectorAll("[data-etload]").forEach(d=>d.onclick=()=>{
      const tpl=S.examTemplates.find(t=>t.id===d.dataset.etload);
      if(tpl)onLoad(tpl);
    });
    el("modal").querySelectorAll("[data-etdel]").forEach(b=>b.onclick=()=>{
      if(!confirm("حذف هذا النموذج نهائياً؟"))return;
      S.examTemplates=S.examTemplates.filter(t=>t.id!==b.dataset.etdel);
      save.examTemplates();draw();
    });
  };
  draw();
}
function openExamBuilder(){
  const draftKey=wsKey("examBuilderDraft");
  const defaultData=()=>({
    title:"امتحان الشهر الأول",grade:gradesFor(S.curInst||INSTS()[0])[0],section:secList(S.curInst||INSTS()[0])[0],
    duration:"",notes:"",questions:[{id:uid(),text:"",marks:"",answer:"",parts:[{id:uid(),text:""}]}],
    headerColor:instColor(S.curInst||INSTS()[0])||"#0F3D2E",mono:false,qBoxColor:"#D9E2EC"
  });
  let data=defaultData();
  try{
    const saved=JSON.parse(localStorage.getItem(draftKey)||"null");
    if(saved&&saved.data&&Array.isArray(saved.data.questions)&&saved.data.questions.length){
      const age=Date.now()-(saved.savedAt||0);
      if(age<1000*60*60*24*14&&confirm("توجد مسودة امتحان غير مكتملة محفوظة تلقائياً. هل تريد استعادتها؟")) data=sanitizeImportedData(saved.data);
    }
  }catch(_){/* تجاهل المسودة التالفة */}
  let loadedTemplateId=null; // النموذج المفتوح حالياً (إن وُجد) — لحفظ التعديلات عليه مباشرة بدل إنشاء نموذج جديد كل مرة
  let toolbar=null,draftTimer=null;
  const saveDraft=()=>{
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>{
      try{
        localStorage.setItem(draftKey,JSON.stringify({version:APP_VER,savedAt:Date.now(),data}));
        const st=el("ebDraftStatus");if(st)st.textContent="تم حفظ المسودة تلقائياً ✓";
      }catch(_){/* التخزين قد يكون ممتلئاً أو محظوراً */}
    },700);
  };
  const clearDraft=()=>{try{localStorage.removeItem(draftKey)}catch(_){}};
  const validateBeforePrint=()=>{
    const questions=data.questions.filter(q=>stripHTML(q.text).trim()||q.parts.some(p=>stripHTML(p.text).trim()));
    const errors=[],warnings=[];
    if(!String(data.title||"").trim())errors.push("عنوان الامتحان غير مكتوب");
    if(!questions.length)errors.push("لا يوجد سؤال مكتوب");
    questions.forEach((q,i)=>{
      if(!stripHTML(q.text).trim()&&!q.parts.some(p=>stripHTML(p.text).trim()))warnings.push("السؤال "+(i+1)+" لا يحتوي نصاً واضحاً");
      if(q.marks!==""&&(!Number.isFinite(Number(q.marks))||Number(q.marks)<0))errors.push("درجة السؤال "+(i+1)+" غير صحيحة");
      if(q.marks==="")warnings.push("لم تحدد درجة السؤال "+(i+1));
    });
    const total=questions.reduce((sum,q)=>sum+(Number(q.marks)||0),0);
    return {questions,errors,warnings,total};
  };
  const draw=()=>{
    el("modal").innerHTML=
    '<div class="overlay"><div class="sheet">'+
      '<div class="sheetHead"><h3>📝 إعداد ورقة أسئلة</h3><button class="x" id="ebX">✕</button></div>'+
      '<div class="form">'+
        '<label>عنوان الامتحان<input id="ebTitle" value="'+esc(data.title)+'" placeholder="مثال: امتحان الشهر الأول"></label>'+
        '<div class="grid2">'+
          '<label>الصف<select id="ebGrade">'+opts(gradesFor(S.curInst||INSTS()[0]),data.grade)+'</select></label>'+
          '<label>'+secTerm(S.curInst||INSTS()[0])+'<select id="ebSection">'+opts(secList(S.curInst||INSTS()[0]),data.section)+'</select></label>'+
        '</div>'+
        '<label>مدة الامتحان (اختياري)<input id="ebDuration" value="'+esc(data.duration)+'" placeholder="مثال: 90 دقيقة"></label>'+
        '<div class="subCard">'+
          '<div class="subHead"><span class="subName">🎨 ألوان ورقة الأسئلة</span></div>'+
          '<div class="grid2">'+
            '<label style="font-size:11px;flex-direction:row;align-items:center;justify-content:space-between">لون الرأس<input type="color" id="ebHeaderClr" value="'+esc(data.headerColor)+'" style="width:40px;height:30px;padding:2px;border-radius:8px"'+(data.mono?" disabled":"")+'></label>'+
            '<label style="font-size:11px;flex-direction:row;align-items:center;justify-content:space-between">لون صناديق الأسئلة<input type="color" id="ebQBoxClr" value="'+esc(data.qBoxColor)+'" style="width:40px;height:30px;padding:2px;border-radius:8px"></label>'+
          '</div>'+
          '<div style="font-size:10.5px;color:var(--muted);margin-top:2px">ألوان جاهزة للرأس (غامقة، تناسب الكتابة البيضاء):</div>'+
          '<div class="colorSwatches" id="ebHeaderSwatches">'+COLOR_PRESETS.map(c=>'<button type="button" class="swatch" data-ebswatch="header|'+c+'" style="background:'+c+'"></button>').join("")+'</div>'+
          '<div style="font-size:10.5px;color:var(--muted);margin-top:6px">ألوان جاهزة لصناديق الأسئلة (فاتحة، أوضح للقراءة):</div>'+
          '<div class="colorSwatches" id="ebQBoxSwatches" style="margin-top:4px">'+COLOR_PRESETS_LIGHT.map(c=>'<button type="button" class="swatch" data-ebswatch="qbox|'+c+'" style="background:'+c+';border:1px solid #cbd5e1"></button>').join("")+'</div>'+
          '<label style="flex-direction:row;align-items:center;gap:8px;font-size:11.5px;margin-top:6px"><input type="checkbox" id="ebMono" style="width:auto"'+(data.mono?" checked":"")+'> بدون ألوان (للطباعة بالأبيض والأسود)</label>'+
        '</div>'+
        '<div id="ebToolbarHost" class="stickyToolbar"></div>'+
        '<p class="empty" style="padding:2px 4px;font-size:10.5px">💡 اضغط داخل أي حقل نص أدناه (ملاحظات، سؤال، فرع) ثم استخدم الشريط أعلاه لتنسيقه.</p>'+
        '<div class="fieldLbl">ملاحظات تظهر أعلى الأسئلة (اختياري)<div id="ebNotesHost"></div></div>'+
        '<div id="ebQuestions"></div>'+
        '<div class="actions"><button class="btn ghost" id="ebFromBank">📚 إضافة من البنك</button><button class="btn ghost" id="ebAddQ">+ سؤال جديد</button></div>'+
        '<div class="actions"><button class="btn ghost" id="ebSaveTpl">💾 '+(loadedTemplateId?"حفظ التعديلات بنفس النموذج":"حفظ كنموذج كامل")+'</button>'+(loadedTemplateId?'<button class="btn ghost" id="ebSaveTplNew">📄 حفظ كنموذج جديد</button>':'')+'<button class="btn ghost" id="ebLoadTpl">📂 فتح نموذج محفوظ</button></div>'+
      '</div>'+
      '<div class="sheetFoot"><span id="ebDraftStatus" style="font-size:10.5px;color:var(--muted);margin-inline-end:auto">الحفظ التلقائي مفعّل</span><button class="btn ghost" id="ebClose">إغلاق</button><button class="btn ghost" id="ebPrintAnswers">✅ نموذج الإجابة</button><button class="btn" id="ebPrint">🖨 طباعة ورقة الأسئلة</button></div>'+
    '</div></div>';
    el("ebTitle").oninput=e=>{data.title=e.target.value;saveDraft()};
    el("ebGrade").onchange=e=>{data.grade=e.target.value;saveDraft()};
    el("ebSection").onchange=e=>{data.section=e.target.value;saveDraft()};
    el("ebDuration").oninput=e=>{data.duration=e.target.value;saveDraft()};
    el("ebHeaderClr").onchange=e=>{data.headerColor=e.target.value;saveDraft()};
    el("ebQBoxClr").onchange=e=>{data.qBoxColor=e.target.value;saveDraft()};
    document.querySelectorAll("[data-ebswatch]").forEach(b=>{
      b.onclick=()=>{
        const [which,color]=b.dataset.ebswatch.split("|");
        if(which==="header"){if(el("ebHeaderClr").disabled)return;el("ebHeaderClr").value=color;data.headerColor=color;}
        else{el("ebQBoxClr").value=color;data.qBoxColor=color;}
        saveDraft();
      };
    });
    el("ebMono").onchange=e=>{data.mono=e.target.checked;saveDraft();draw()};
    toolbar=createMathToolbar();
    el("ebToolbarHost").appendChild(toolbar.bar);
    el("ebToolbarHost").appendChild(toolbar.tplMenu);
    el("ebToolbarHost").appendChild(toolbar.qtplMenu);
    el("ebToolbarHost").appendChild(toolbar.imgInput);
    const notesEditor=makeSimpleEditor("مثال: أجب عن الأسئلة التالية، يمنع استخدام الآلة الحاسبة",data.notes,toolbar);
    el("ebNotesHost").appendChild(notesEditor);
    notesEditor.oninput=()=>{data.notes=notesEditor.innerHTML;saveDraft()};
    drawQuestions();
    el("ebAddQ").onclick=()=>{data.questions.push({id:uid(),text:"",marks:"",answer:"",parts:[{id:uid(),text:""}]});saveDraft();drawQuestions()};
    el("ebFromBank").onclick=()=>{
      openQuestionBank(true,(picked)=>{
        const firstIsEmpty=data.questions.length===1&&!stripHTML(data.questions[0].text).trim()&&!data.questions[0].parts.some(p=>stripHTML(p.text).trim());
        picked.forEach((q,i)=>{
          const newQ={id:uid(),text:q.text,marks:q.marks||"",answer:q.answer||"",parts:(q.parts||[]).map(p=>({id:uid(),text:p.text}))};
          if(i===0&&firstIsEmpty)data.questions[0]=newQ;
          else data.questions.push(newQ);
        });
        draw();
        toast("أُضيف "+picked.length+" سؤال من البنك ✓");
      },draw);
    };
    el("ebSaveTpl").onclick=()=>{
      if(!data.questions.some(q=>stripHTML(q.text).trim()||q.parts.some(p=>stripHTML(p.text).trim()))){toast("أضف سؤالاً واحداً على الأقل قبل الحفظ");return}
      const existing=loadedTemplateId&&S.examTemplates.find(t=>t.id===loadedTemplateId);
      if(existing){
        existing.data=JSON.parse(JSON.stringify(data));
        existing.savedAt=todayStr();
        save.examTemplates();
        toast("تم تحديث النموذج ✓");
        return;
      }
      const name=prompt("اسم النموذج (مثال: امتحان الشهر الأول - نمط أ):",data.title);
      if(!name||!name.trim())return;
      const newTpl={id:uid(),name:name.trim(),savedAt:todayStr(),data:JSON.parse(JSON.stringify(data))};
      S.examTemplates.unshift(newTpl);
      loadedTemplateId=newTpl.id; // التعديلات الجاية تحدّث نفس هذا النموذج بدل ما تكرر نماذج جديدة
      save.examTemplates();
      draw();
      toast("تم حفظ النموذج ✓");
    };
    el("ebSaveTplNew")&&(el("ebSaveTplNew").onclick=()=>{
      if(!data.questions.some(q=>stripHTML(q.text).trim()||q.parts.some(p=>stripHTML(p.text).trim()))){toast("أضف سؤالاً واحداً على الأقل قبل الحفظ");return}
      const name=prompt("اسم النموذج الجديد (نسخة منفصلة):",data.title+" (نسخة)");
      if(!name||!name.trim())return;
      const newTpl={id:uid(),name:name.trim(),savedAt:todayStr(),data:JSON.parse(JSON.stringify(data))};
      S.examTemplates.unshift(newTpl);
      loadedTemplateId=newTpl.id;
      save.examTemplates();
      draw();
      toast("تم حفظ نسخة جديدة ✓");
    });
    el("ebLoadTpl").onclick=()=>openExamTemplatesSheet((tpl)=>{
      Object.assign(data,JSON.parse(JSON.stringify(tpl.data)));
      loadedTemplateId=tpl.id;
      saveDraft();
      draw();
      toast("تم فتح النموذج «"+tpl.name+"» ✓");
    },draw);
    el("ebX").onclick=el("ebClose").onclick=()=>{saveDraft();closeModal()};
    el("ebPrint").onclick=()=>{
      const check=validateBeforePrint();
      if(check.errors.length){toast("تعذر الطباعة: "+check.errors[0]);return}
      if(check.warnings.length){
        const msg="فحص ما قبل الطباعة\n\n"+check.warnings.slice(0,6).map(x=>"• "+x).join("\n")+(check.warnings.length>6?"\n• وملاحظات أخرى…":"")+"\n\nعدد الأسئلة: "+check.questions.length+" — مجموع الدرجات المدخلة: "+check.total+"\n\nهل تريد المتابعة؟";
        if(!confirm(msg))return;
      }else toast("جاهز للطباعة — "+check.questions.length+" أسئلة، المجموع "+check.total+" درجة ✓");
      saveDraft();
      printExamPaper(data);
    };
    el("ebPrintAnswers").onclick=()=>{
      if(!data.questions.some(q=>stripHTML(q.answer||"").trim())){toast("لم تكتب أي إجابة نموذجية بعد");return}
      printAnswerKey(data);
    };
  };
  const drawQuestions=()=>{
    el("ebQuestions").innerHTML=data.questions.map((q,i)=>
      '<div class="subCard" data-qid="'+q.id+'">'+
        '<div class="subHead"><span class="subName">السؤال '+(i+1)+'</span>'+
          '<div style="display:flex;gap:6px">'+
          '<button class="btn ghost" data-savebank="'+q.id+'" style="padding:4px 10px;font-size:10.5px;margin:0">💾 حفظ بالبنك</button>'+
          (data.questions.length>1?'<button class="bDel" data-delq="'+q.id+'">✕</button>':'')+
          '</div>'+
        '</div>'+
        '<div class="grid2" style="grid-template-columns:1fr 90px;align-items:start">'+
          '<div class="fieldLbl" style="font-size:11px">نص السؤال<div data-qtexthost="'+q.id+'"></div></div>'+
          '<label style="font-size:11px">الدرجة<input data-qmarks="'+q.id+'" inputmode="numeric" value="'+esc(q.marks)+'" placeholder="—"></label>'+
        '</div>'+
        (q.parts.length?'<div style="margin-top:6px;display:flex;flex-direction:column;gap:8px">'+q.parts.map((p,j)=>
          '<div class="fieldLbl" style="font-size:11px">فرع ('+ARABIC_ENUM[j]+')<div style="display:flex;gap:6px;align-items:start"><div data-ptexthost="'+q.id+'|'+p.id+'" style="flex:1"></div><button type="button" class="bDel" data-delp="'+q.id+'|'+p.id+'" style="align-self:center">✕</button></div></div>'
        ).join("")+'</div>':"")+
        '<button class="btn ghost" data-addp="'+q.id+'" style="margin-top:6px;font-size:11.5px;padding:6px 12px">+ إضافة فرع لهذا السؤال (أ، ب، ج…)</button>'+
        '<div class="fieldLbl" style="font-size:11px;margin-top:10px;border-top:1px dashed var(--line);padding-top:8px">✅ الإجابة النموذجية (اختياري)<div data-qanshost="'+q.id+'"></div></div>'+
      '</div>'
    ).join("");
    data.questions.forEach(q=>{
      const qEditor=makeSimpleEditor("اكتب نص السؤال…",q.text,toolbar);
      el("ebQuestions").querySelector('[data-qtexthost="'+q.id+'"]').appendChild(qEditor);
      qEditor.oninput=()=>{q.text=qEditor.innerHTML;saveDraft()};
      const mk=el("ebQuestions").querySelector('[data-qmarks="'+q.id+'"]');
      mk.oninput=e=>{q.marks=e.target.value;saveDraft()};
      q.parts.forEach(p=>{
        const pEditor=makeSimpleEditor("نص الفرع…",p.text,toolbar);
        el("ebQuestions").querySelector('[data-ptexthost="'+q.id+'|'+p.id+'"]').appendChild(pEditor);
        pEditor.oninput=()=>{p.text=pEditor.innerHTML;saveDraft()};
      });
      const ansEditor=makeSimpleEditor("اكتب الحل النموذجي لهذا السؤال (اختياري)…",q.answer||"",toolbar);
      el("ebQuestions").querySelector('[data-qanshost="'+q.id+'"]').appendChild(ansEditor);
      ansEditor.oninput=()=>{q.answer=ansEditor.innerHTML;saveDraft()};
    });
    el("ebQuestions").querySelectorAll("[data-addp]").forEach(b=>b.onclick=()=>{
      const q=data.questions.find(x=>x.id===b.dataset.addp);
      if(q.parts.length>=ARABIC_ENUM.length){toast("وصلت الحد الأقصى للفروع");return}
      q.parts.push({id:uid(),text:""});saveDraft();drawQuestions();
    });
    el("ebQuestions").querySelectorAll("[data-delq]").forEach(b=>b.onclick=()=>{
      data.questions=data.questions.filter(x=>x.id!==b.dataset.delq);saveDraft();drawQuestions();
    });
    el("ebQuestions").querySelectorAll("[data-savebank]").forEach(b=>b.onclick=()=>{
      const q=data.questions.find(x=>x.id===b.dataset.savebank);
      if(!stripHTML(q.text).trim()){toast("اكتب نص السؤال أولاً");return}
      openQuestionEditor(null,()=>{draw()},{text:q.text,marks:q.marks||""});
    });
    el("ebQuestions").querySelectorAll("[data-delp]").forEach(b=>b.onclick=()=>{
      const[qid,pid]=b.dataset.delp.split("|");
      const q=data.questions.find(x=>x.id===qid);
      q.parts=q.parts.filter(x=>x.id!==pid);saveDraft();drawQuestions();
    });
  };
  draw();
}
function examQuestionOrdinal(i){
  const words=["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر","الحادي عشر","الثاني عشر","الثالث عشر","الرابع عشر","الخامس عشر","السادس عشر","السابع عشر","الثامن عشر","التاسع عشر","العشرون"];
  return words[i]||String(i+1);
}
function printExamPaper(data){
  const inst=S.curInst||INSTS()[0];
  const qBlocks=data.questions.filter(q=>stripHTML(q.text).trim()||q.parts.some(p=>stripHTML(p.text).trim())).map((q,i)=>
      '<div class="examQ examQGlass" style="--examCardColor:'+(data.mono?"#ffffff":esc(data.qBoxColor))+'">'+
        '<div class="examIdentityTab" data-number="'+String(i+1).padStart(2,"0")+'">'+
          '<span class="examIdentityMark" aria-hidden="true">✥</span>'+ 
          '<span class="examIdentityLabel">السؤال</span>'+ 
          '<span class="examIdentityNum">'+String(i+1).padStart(2,"0")+'</span>'+ 
        '</div>'+
        '<div class="examQHead">'+
          '<div class="examQText">'+(q.text||"")+'</div>'+
          (q.marks?'<div class="examMarks"><span aria-hidden="true">★</span> '+esc(q.marks)+' درجات</div>':'')+
        '</div>'+
        (q.parts.filter(p=>stripHTML(p.text).trim()).length?'<div class="examParts">'+q.parts.filter(p=>stripHTML(p.text).trim()).map((p,j)=>'<div class="examPart">'+ARABIC_ENUM[j]+') '+p.text+'</div>').join("")+'</div>':'')+
      '</div>'
  );
  const blocks=(stripHTML(data.notes).trim()?['<div class="examNotesBox">'+data.notes+'</div>']:[]).concat(qBlocks);
  const body=blocks.join("");
  printHTML(data.title,body,false,inst,true,{
    grade:"الصف: "+esc(data.grade)+" — "+secTerm(inst)+" "+esc(data.section),
    subject:"المادة: "+esc(MYSUB()),
    duration:data.duration?"الوقت: "+esc(data.duration):"",
    headerColor:data.mono?"#ffffff":data.headerColor,
    mono:data.mono
  },blocks);
}
function printAnswerKey(data){
  const inst=S.curInst||INSTS()[0];
  // نفس ترقيم ورقة الأسئلة بالضبط (نفس الفلترة) حتى يطابق س1 بورقة الأسئلة نفس س1 هنا
  const numberedQuestions=data.questions.filter(q=>stripHTML(q.text).trim()||q.parts.some(p=>stripHTML(p.text).trim()));
  const qBlocks=numberedQuestions.map((q,i)=>stripHTML(q.answer||"").trim()?
      '<div class="examQ" style="--examCardColor:'+(data.mono?"#ffffff":esc(data.qBoxColor))+';background:'+(data.mono?"#fff":hexToRgba(data.qBoxColor,.24))+'"><div class="examQHead">'+
        '<div class="examQText"><strong>السؤال '+examQuestionOrdinal(i)+'</strong> '+(q.marks?'<span style="color:#94A3B8;font-size:12px">('+esc(q.marks)+' درجة)</span>':'')+'</div>'+
      '</div>'+
      '<div class="examParts"><div class="examPart">'+q.answer+'</div></div>'+
      '</div>':''
  ).filter(Boolean);
  const blocks=['<div class="examNotesBox">🔑 نموذج الإجابة — للاستخدام الخاص بالمدرس فقط</div>'].concat(qBlocks);
  const body=blocks.join("");
  printHTML("🔑 نموذج الإجابة — "+data.title,body,false,inst,true,{
    grade:"الصف: "+esc(data.grade)+" — "+secTerm(inst)+" "+esc(data.section),
    subject:"المادة: "+esc(MYSUB()),
    duration:"",
    headerColor:data.mono?"#ffffff":data.headerColor,
    mono:data.mono
  },blocks);
}
const MATH_SYMBOLS=["√","∛","π","×","÷","±","∓","≤","≥","≠","≈","≡","∞","°","½","⅓","¼","¾","⅔","²","³","ⁿ","∑","∏","∫","∬","∆","∇","θ","α","β","γ","δ","λ","μ","Ω","∈","∉","∪","∩","⊂","⊆","→","⇒","⇔","∴","∵","∠","⊥","∥","%","‰","√( )","( )²","( )/( )"];
function attachMathBar(input){
  if(!input)return;
  const bar=document.createElement("div");
  bar.className="mathBar";
  bar.innerHTML=MATH_SYMBOLS.map(sym=>'<button type="button">'+sym+'</button>').join("");
  input.insertAdjacentElement("afterend",bar);
  bar.querySelectorAll("button").forEach((b,i)=>{
    b.onclick=e=>{
      e.preventDefault();
      const sym=MATH_SYMBOLS[i];
      const start=input.selectionStart??input.value.length,end=input.selectionEnd??input.value.length;
      const val=input.value;
      input.value=val.slice(0,start)+sym+val.slice(end);
      const pos=start+sym.length;
      input.focus({preventScroll:true});
      if(input.setSelectionRange)input.setSelectionRange(pos,pos);
      input.dispatchEvent(new Event("input",{bubbles:true}));
    };
  });
}
function insertHTMLAtCursor(html){
  const sel=window.getSelection();
  if(!sel||!sel.rangeCount)return;
  const range=sel.getRangeAt(0);
  range.deleteContents();
  const frag=range.createContextualFragment(html);
  const lastNode=frag.lastChild;
  range.insertNode(frag);
  if(lastNode){
    range.setStartAfter(lastNode);
    range.setEndAfter(lastNode);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}
function stripHTML(html){
  const d=document.createElement("div");
  d.innerHTML=html||"";
  return d.textContent||"";
}
/* ============ لوحة معادلات بصرية تفاعلية (MathLive يُحمَّل عند الحاجة فقط، يتطلب إنترنت أول استخدام) ============ */
let katexLoadPromise=null;
function loadKatex(){
  if(window.katex)return Promise.resolve();
  if(katexLoadPromise)return katexLoadPromise;
  katexLoadPromise=new Promise((resolve,reject)=>{
    let cssReady=false,jsReady=false;
    const maybeResolve=()=>{if(cssReady&&jsReady)resolve()};
    const link=document.createElement("link");
    link.rel="stylesheet";
    // محلي أولاً (يعمل بدون إنترنت)، مع سقوط تلقائي إلى CDN
    link.href="katex/katex.min.css";
    link.onload=()=>{cssReady=true;maybeResolve()};
    link.onerror=()=>{link.href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"};
    document.head.appendChild(link);
    const script=document.createElement("script");
    script.src="katex/katex.min.js";
    script.onload=()=>{jsReady=true;maybeResolve()};
    script.onerror=()=>{
      // سقوط إلى CDN
      const s2=document.createElement("script");
      s2.src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
      s2.onload=()=>{jsReady=true;maybeResolve()};
      s2.onerror=()=>{katexLoadPromise=null;reject(new Error("تعذّر تحميل محرك عرض المعادلات"))};
      document.head.appendChild(s2);
    };
    document.head.appendChild(script);
  });
  return katexLoadPromise;
}

let mathliveLoadPromise=null;
function loadMathlive(){
  if(customElements.get("math-field"))return Promise.resolve();
  if(mathliveLoadPromise)return mathliveLoadPromise;
  mathliveLoadPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.defer=true;
    script.src="https://cdn.jsdelivr.net/npm/mathlive";
    script.onload=()=>{
      const check=()=>{
        if(customElements.get("math-field"))resolve();
        else setTimeout(check,50);
      };
      check();
    };
    script.onerror=()=>{mathliveLoadPromise=null;reject(new Error("تعذّر تحميل لوحة المعادلات — تأكد من اتصالك بالإنترنت وحاول مرة أخرى"))};
    document.head.appendChild(script);
    setTimeout(()=>{
      if(!customElements.get("math-field")){mathliveLoadPromise=null;reject(new Error("انتهت المهلة أثناء تحميل لوحة المعادلات — تأكد من اتصالك بالإنترنت"))}
    },15000);
  });
  return mathliveLoadPromise;
}
function openLatexDialog(targetEditor,savedRange,editSpan){
  if(!targetEditor){toast("اضغط داخل حقل نص السؤال أولاً");return}
  const scrollYBeforeOpen=window.scrollY; // نحفظ موضع التمرير الحالي حتى ما تفقد مكانك عند إغلاق المحرر
  const overlay=document.createElement("div");
  overlay.className="overlay";
  overlay.style.zIndex="600";
  overlay.style.alignItems="center"; // يظهر بمنتصف الشاشة الظاهرة حاليًا بدل تثبيته أعلى الصفحة دائمًا
  const restoreScroll=()=>{requestAnimationFrame(()=>window.scrollTo(0,scrollYBeforeOpen))};
  const loading=!customElements.get("math-field");
  const initialLatex=editSpan?(editSpan.dataset.latex||""):"";
  overlay.innerHTML=
    '<div class="sheet" style="max-height:88vh;overflow-y:auto;border-radius:20px">'+
      '<div class="sheetHead"><h3>🧮 '+(editSpan?"تعديل معادلة":"إدراج معادلة")+'</h3>'+
        '<div style="display:flex;gap:8px;align-items:center">'+
          '<button class="btn" id="latexInsert" style="padding:8px 14px;font-size:13px;margin:0">✓ '+(editSpan?"حفظ التعديل":"إدراج بالسؤال")+'</button>'+
          '<button class="x" id="latexX">✕</button>'+
        '</div>'+
      '</div>'+
      '<div class="form">'+
        '<div id="latexLoadMsg" class="empty" style="padding:10px'+(loading?'':';display:none')+'">⏳ جارِ تحميل لوحة المعادلات (يحتاج إنترنت أول استخدام فقط)…</div>'+
        '<div class="fieldLbl">اضغط بالمربع وابدأ الكتابة — لوحة رياضية ستظهر أسفل الشاشة تلقائياً<div id="mathFieldHost" style="border:1.5px solid var(--line);border-radius:12px;padding:14px;background:#fff;min-height:56px"></div></div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(overlay);
  const closeThis=()=>{overlay.remove();restoreScroll()};
  el("latexX").onclick=closeThis;
  let mf=null;
  const buildField=()=>{
    if(!customElements.get("math-field"))return;
    document.body.style.setProperty("--keyboard-zindex","700");
    el("mathFieldHost").innerHTML='<math-field id="mfInput" style="width:100%;font-size:20px;border:none;direction:ltr" math-virtual-keyboard-policy="onfocus">'+esc(initialLatex)+'</math-field>';
    mf=el("mfInput");
    if(mf)mf.mathVirtualKeyboardPolicy="onfocus";
    setTimeout(()=>{if(mf){mf.mathVirtualKeyboardPolicy="onfocus";mf.focus()}},150);
  };
  el("latexInsert").onclick=()=>{
    if(!mf){toast("لسا تحمّل، انتظر قليلاً وحاول ثانية");return}
    const latexVal=(mf.value||mf.getValue&&mf.getValue()||"").trim();
    if(!latexVal){toast("اكتب معادلة أولاً");return}
    if(!window.katex){toast("محرك العرض لسا يحمّل، حاول ثانية بعد لحظة");return}
    const tmp=document.createElement("span");
    try{window.katex.render(latexVal,tmp,{throwOnError:false,displayMode:true})}catch(e){tmp.textContent=latexVal}
    const wrapHtml='<span class="katex-wrap" contenteditable="false" dir="ltr" data-latex="'+esc(latexVal)+'" style="display:inline-block;vertical-align:middle;cursor:pointer;unicode-bidi:isolate" title="اضغط لتعديل المعادلة">'+tmp.innerHTML+'</span>&nbsp;';
    if(editSpan&&editSpan.parentNode){
      const holder=document.createElement("span");
      holder.innerHTML=wrapHtml;
      editSpan.replaceWith(...holder.childNodes);
    }else{
      targetEditor.focus({preventScroll:true});
      const sel=window.getSelection();
      sel.removeAllRanges();
      if(savedRange){try{sel.addRange(savedRange)}catch(e){}}
      insertHTMLAtCursor(wrapHtml);
    }
    targetEditor.dispatchEvent(new Event("input",{bubbles:true}));
    closeThis();
  };
  Promise.all([loadMathlive(),loadKatex()]).then(()=>{
    if(el("latexLoadMsg"))el("latexLoadMsg").style.display="none";
    buildField();
  }).catch(err=>{
    if(el("latexLoadMsg"))el("latexLoadMsg").textContent="❌ "+err.message;
  });
}
function createMathToolbar(){
  let activeEditor=null;
  const bar=document.createElement("div");
  bar.className="richBar";
  bar.innerHTML=
    '<button type="button" data-cmd="latex" title="لوحة معادلات بصرية تفاعلية" style="background:var(--green2);color:#fff;font-weight:800">🧮 إدراج معادلة</button>'+
    '<button type="button" data-cmd="undo" title="تراجع عن آخر تعديل">↩️ تراجع</button>'+
    '<button type="button" data-cmd="redo" title="إعادة التعديل بعد التراجع">↪️ إعادة</button>'+
    '<button type="button" data-cmd="bold" title="عريض (Ctrl+B)"><b>B</b></button>'+
    '<button type="button" data-cmd="italic" title="مائل (Ctrl+I)"><i>I</i></button>'+
    '<button type="button" data-cmd="underline" title="تحته خط (Ctrl+U)"><u>U</u></button>'+
    '<button type="button" data-cmd="mark" title="تمييز بالأصفر">🖍️</button>'+
    '<button type="button" data-cmd="ol" title="قائمة مرقّمة">1.</button>'+
    '<button type="button" data-cmd="ul" title="قائمة نقطية">•</button>'+
    '<button type="button" data-cmd="alignRight" title="محاذاة يمين">⇥</button>'+
    '<button type="button" data-cmd="alignCenter" title="توسيط">↔</button>'+
    '<button type="button" data-cmd="alignLeft" title="محاذاة يسار">⇤</button>'+
    '<button type="button" data-cmd="sup" title="أُس (مرفوع)">x²</button>'+
    '<button type="button" data-cmd="sub" title="دليل (منخفض)">x₂</button>'+
    '<button type="button" data-cmd="ltr" title="اتجاه نص (LTR) — حدّد النص أو اضغط قبل الكتابة">🔤LTR</button>'+
    '<button type="button" data-cmd="img" title="إدراج صورة (شكل هندسي، رسم بياني...)">🖼️</button>'+
    '<button type="button" data-cmd="tpl" title="إدراج قالب جاهز">📐 قالب</button>'+
    '<button type="button" data-cmd="qtpl" title="نوع سؤال (اختيار من متعدد، صح وخطأ...)">📋 نوع سؤال</button>';
  const imgInput=document.createElement("input");
  imgInput.type="file";imgInput.accept="image/*";imgInput.style.display="none";
  const tplMenu=document.createElement("div");
  tplMenu.className="mathBar";
  tplMenu.style.display="none";
  const TEMPLATES=[["تعريف","<b>تعريف:</b> "],["نظرية","<b>نظرية:</b> "],["مثال","<b>مثال:</b> "],["برهان","<b>البرهان:</b> "],["ملاحظة","<b>ملاحظة:</b> "],["تعليمات الإجابة","<b>ملاحظة:</b> أجب عن خمسة أسئلة فقط (لكل سؤال 20 درجة). "]];
  tplMenu.innerHTML=TEMPLATES.map(([l])=>'<button type="button" style="width:auto;padding:0 12px">'+l+'</button>').join("");
  const qtplMenu=document.createElement("div");
  qtplMenu.className="mathBar";
  qtplMenu.style.display="none";
  const QTEMPLATES=[
    ["اختيار من متعدد",'<div class="qOpts"><div>أ) </div><div>ب) </div><div>ج) </div><div>د) </div></div>'],
    ["صح أو خطأ",'<div class="qOpts"><div>(　) العبارة صحيحة</div><div>(　) العبارة خاطئة</div></div>'],
    ["أكمل الفراغ",'..............................'],
    ["وصّل",'<div class="qOpts"><div>1) ..................... ‏ ‏ ‏ ‏ (　)</div><div>2) ..................... ‏ ‏ ‏ ‏ (　)</div></div>']
  ];
  qtplMenu.innerHTML=QTEMPLATES.map(([l])=>'<button type="button" style="width:auto;padding:0 12px">'+l+'</button>').join("");
  const doCmd=cmd=>{
    if(!activeEditor)return;
    activeEditor.focus({preventScroll:true});
    if(cmd==="bold")document.execCommand("bold");
    else if(cmd==="italic")document.execCommand("italic");
    else if(cmd==="underline")document.execCommand("underline");
    else if(cmd==="mark")document.execCommand("hiliteColor","false","#FDE68A");
    else if(cmd==="ol")document.execCommand("insertOrderedList");
    else if(cmd==="ul")document.execCommand("insertUnorderedList");
    else if(cmd==="alignRight")document.execCommand("justifyRight");
    else if(cmd==="alignCenter")document.execCommand("justifyCenter");
    else if(cmd==="alignLeft")document.execCommand("justifyLeft");
    else if(cmd==="sup")document.execCommand("superscript");
    else if(cmd==="sub")document.execCommand("subscript");
    else if(cmd==="img")imgInput.click();
    else if(cmd==="undo"){if(activeEditor._undo)activeEditor._undo();}
    else if(cmd==="redo"){if(activeEditor._redo)activeEditor._redo();}
    else if(cmd==="latex"){
      const savedEditor=activeEditor;
      let savedRange=null;
      const sel0=window.getSelection();
      if(sel0&&sel0.rangeCount)savedRange=sel0.getRangeAt(0).cloneRange();
      openLatexDialog(savedEditor,savedRange);
      return;
    }
    else if(cmd==="ltr"){
      const sel=window.getSelection();
      if(sel&&sel.rangeCount&&!sel.getRangeAt(0).collapsed){
        const range=sel.getRangeAt(0);
        const content=range.extractContents();
        const span=document.createElement("span");
        span.dir="ltr";span.className="meqltr";
        span.appendChild(content);
        range.insertNode(span);
        sel.removeAllRanges();
        const r2=document.createRange();r2.selectNodeContents(span);r2.collapse(false);
        sel.addRange(r2);
      }else{
        const sel2=window.getSelection();
        if(!sel2||!sel2.rangeCount)return;
        const range=sel2.getRangeAt(0);
        range.deleteContents();
        const span=document.createElement("span");
        span.className="meqltr";span.dir="ltr";
        span.appendChild(document.createTextNode("\u200C"));
        range.insertNode(span);
        const space=document.createTextNode("\u00A0");
        span.after(space);
        const r2=document.createRange();
        r2.setStart(span.firstChild,1);r2.setEnd(span.firstChild,1);
        sel2.removeAllRanges();sel2.addRange(r2);
      }
    }
    activeEditor.dispatchEvent(new Event("input",{bubbles:true}));
  };
  imgInput.onchange=()=>{
    const file=imgInput.files[0];
    if(!file||!activeEditor)return;
    const editorRef=activeEditor;
    const reader=new FileReader();
    reader.onload=()=>{
      editorRef.focus({preventScroll:true});
      insertHTMLAtCursor('<img src="'+reader.result+'" style="max-width:100%;max-height:220px;display:block;margin:6px auto">');
      editorRef.dispatchEvent(new Event("input",{bubbles:true}));
    };
    reader.readAsDataURL(file);
    imgInput.value="";
  };
  // نمنع فقدان مكان المؤشر (Selection) بحقل الكتابة عند الضغط على أزرار الشريط
  // (بدون هذا، لمس أي زر خارج الحقل يفقد مكان المؤشر السابق، فتنفّذ الأوامر بمكان غلط زي آخر النص)
  bar.addEventListener("mousedown",e=>{if(e.target.closest("button"))e.preventDefault()});
  tplMenu.addEventListener("mousedown",e=>{if(e.target.closest("button"))e.preventDefault()});
  qtplMenu.addEventListener("mousedown",e=>{if(e.target.closest("button"))e.preventDefault()});
  bar.querySelectorAll("button[data-cmd]").forEach(b=>{
    b.onclick=e=>{
      e.preventDefault();
      if(b.dataset.cmd==="tpl"){
        tplMenu.style.display=tplMenu.style.display==="none"?"flex":"none";
        qtplMenu.style.display="none";
        return;
      }
      if(b.dataset.cmd==="qtpl"){
        qtplMenu.style.display=qtplMenu.style.display==="none"?"flex":"none";
        tplMenu.style.display="none";
        return;
      }
      doCmd(b.dataset.cmd);
    };
  });
  qtplMenu.querySelectorAll("button").forEach((b,i)=>{
    b.onclick=e=>{
      e.preventDefault();
      if(!activeEditor)return;
      activeEditor.focus({preventScroll:true});
      insertHTMLAtCursor(QTEMPLATES[i][1]);
      activeEditor.dispatchEvent(new Event("input",{bubbles:true}));
      qtplMenu.style.display="none";
    };
  });
  tplMenu.querySelectorAll("button").forEach((b,i)=>{
    b.onclick=e=>{
      e.preventDefault();
      if(!activeEditor)return;
      activeEditor.focus({preventScroll:true});
      insertHTMLAtCursor(TEMPLATES[i][1]);
      activeEditor.dispatchEvent(new Event("input",{bubbles:true}));
      tplMenu.style.display="none";
    };
  });
  return {bar,tplMenu,qtplMenu,imgInput,setActive:ed=>{activeEditor=ed}};
}
const MATH_SHORTCUTS={sqrt:"√",alpha:"α",beta:"β",gamma:"γ",delta:"δ",theta:"θ",lambda:"λ",mu:"μ",sigma:"Σ",omega:"Ω",pi:"π",int:"∫",sum:"Σ",infty:"∞",inf:"∞",leq:"≤",geq:"≥",neq:"≠",approx:"≈",times:"×",div:"÷",pm:"±",subset:"⊂",cup:"∪",cap:"∩",forall:"∀",exists:"∃",to:"→",implies:"⇒",iff:"⇔",perp:"⊥",parallel:"∥",cdot:"·",partial:"∂",nabla:"∇",deg:"°"};
function tryInlineLatexExpand(editor){
  const sel=window.getSelection();
  if(!sel||!sel.rangeCount||!sel.isCollapsed)return;
  const range=sel.getRangeAt(0);
  const node=range.startContainer;
  if(node.nodeType!==3)return;
  const text=node.textContent.slice(0,range.startOffset);
  const m=text.match(/\$([^$\n]{1,300})\$$/);
  if(!m)return;
  const latexSrc=m[1].trim();
  if(!latexSrc)return;
  const fullMatchLen=m[0].length;
  const start=range.startOffset-fullMatchLen;
  const doReplace=()=>{
    if(!window.katex)return;
    const tmp=document.createElement("span");
    try{window.katex.render(latexSrc,tmp,{throwOnError:false,displayMode:false})}
    catch(e){return}
    const curSel=window.getSelection();
    if(!curSel||!curSel.rangeCount)return;
    // نتأكد النص لسا موجود بنفس المكان قبل الاستبدال (تحسباً لتأخر تحميل المحرك)
    if(node.textContent.slice(Math.max(0,start),start+fullMatchLen)!==m[0])return;
    const selectRange=document.createRange();
    selectRange.setStart(node,start);
    selectRange.setEnd(node,start+fullMatchLen);
    curSel.removeAllRanges();
    curSel.addRange(selectRange);
    document.execCommand("insertHTML",false,'<span class="katex-wrap" contenteditable="false" dir="ltr" data-latex="'+esc(latexSrc)+'" style="display:inline-block;vertical-align:middle;cursor:pointer" title="اضغط لتعديل المعادلة">'+tmp.innerHTML+'</span>&nbsp;');
    editor.dispatchEvent(new Event("input",{bubbles:true}));
  };
  if(window.katex)doReplace();
  else loadKatex().then(doReplace).catch(()=>{});
}
function tryShortcutExpand(){
  const sel=window.getSelection();
  if(!sel||!sel.rangeCount||!sel.isCollapsed)return;
  const range=sel.getRangeAt(0);
  const node=range.startContainer;
  if(node.nodeType!==3)return;
  const text=node.textContent.slice(0,range.startOffset);
  const m=text.match(/(?:^|[\s(])([a-zA-Z]+)\s$/);
  if(!m)return;
  const sym=MATH_SHORTCUTS[m[1]];
  if(!sym)return;
  const wordLen=m[1].length+1; // +1 للمسافة اللي تُكتب بعده وتُحذف
  const start=range.startOffset-wordLen;
  const selectRange=document.createRange();
  selectRange.setStart(node,start);
  selectRange.setEnd(node,range.startOffset);
  sel.removeAllRanges();
  sel.addRange(selectRange);
  document.execCommand("insertText",false,sym+" ");
}
function sanitizeHTML(html){
  // قائمة سماح (allowlist) بدل قائمة حظر — أي وسم أو خاصية غير مذكورة صراحة تُحذف افتراضيًا،
  // بدل الاعتماد على تعداد كل شي خطير (احتمال ننسى وسمًا جديدًا خطيرًا لاحقًا)
  const REMOVE_ENTIRELY=new Set(["script","style","iframe","object","embed","link","meta","noscript","svg","math","form","base","template"]);
  const ALLOWED_TAGS=new Set(["b","strong","i","em","u","span","sup","sub","ol","ul","li","br","p","div","mark","img","table","thead","tbody","tr","td","th","h1","h2","h3","h4","blockquote","a"]);
  const ALLOWED_ATTRS={span:["style"],div:["style"],p:["style"],img:["src","alt","width","height","style"],a:["href"],td:["colspan","rowspan"],th:["colspan","rowspan"]};
  const ALLOWED_STYLE_PROPS=new Set(["color","background-color","text-align","font-weight","font-style","text-decoration","width","height"]);
  const cleanStyleValue=styleStr=>{
    if(!styleStr)return"";
    return styleStr.split(";").map(r=>r.trim()).filter(rule=>{
      if(!rule)return false;
      const prop=(rule.split(":")[0]||"").trim().toLowerCase();
      return prop&&ALLOWED_STYLE_PROPS.has(prop)&&!/expression|url\(|javascript:/i.test(rule);
    }).join(";");
  };
  const doc=new DOMParser().parseFromString("<div>"+html+"</div>","text/html");
  const root=doc.body.firstChild;
  if(!root)return"";
  const walk=node=>{
    [...node.childNodes].forEach(child=>{
      if(child.nodeType===3)return; // نص عادي — آمن دائمًا، نتركه
      if(child.nodeType!==1){child.remove();return} // تعليقات وغيرها — نحذفها
      const tag=child.tagName.toLowerCase();
      if(REMOVE_ENTIRELY.has(tag)){child.remove();return}
      if(!ALLOWED_TAGS.has(tag)){
        // وسم غير معروف/غير مسموح: نحافظ على النص داخله فقط ونشيل الوسم نفسه (بدل حذف المحتوى بالكامل)
        child.replaceWith(doc.createTextNode(child.textContent));
        return;
      }
      const allowedAttrs=ALLOWED_ATTRS[tag]||[];
      [...child.attributes].forEach(attr=>{
        const name=attr.name.toLowerCase();
        if(name==="style"){
          const cleaned=cleanStyleValue(attr.value);
          if(cleaned)child.setAttribute("style",cleaned);else child.removeAttribute("style");
          return;
        }
        if(!allowedAttrs.includes(name)){child.removeAttribute(attr.name);return}
        if((name==="href"||name==="src")&&!/^(https?:|data:image\/|\/|\.|#)/i.test(attr.value.trim())){
          child.removeAttribute(attr.name); // يمنع javascript: وأي مخطط رابط غير متوقع
        }
      });
      if(tag==="a")child.setAttribute("rel","noopener noreferrer");
      walk(child);
    });
  };
  walk(root);
  return root.innerHTML;
}
function makeSimpleEditor(placeholder,initialHTML,toolbar){
  const editor=document.createElement("div");
  editor.className="richEdit";
  editor.contentEditable="true";
  editor.dataset.placeholder=placeholder||"";
  editor.innerHTML=initialHTML||"";
  // === نظام تراجع/إعادة مخصص (أدق من تراجع المتصفح الافتراضي، خصوصاً بعد إدراج معادلات/قوالب) ===
  let hist=[editor.innerHTML],histIdx=0,restoringHist=false,pushTimer=null;
  const pushHist=()=>{
    if(restoringHist)return;
    const cur=editor.innerHTML;
    if(cur===hist[histIdx])return;
    if(histIdx<hist.length-1)hist=hist.slice(0,histIdx+1);
    hist.push(cur);
    if(hist.length>60)hist.shift();
    histIdx=hist.length-1;
  };
  const schedulePush=()=>{clearTimeout(pushTimer);pushTimer=setTimeout(pushHist,450)};
  editor._undo=()=>{
    clearTimeout(pushTimer);pushHist();
    if(histIdx<=0){toast("ما فيه شي أقدم تتراجع له");return}
    histIdx--;restoringHist=true;
    editor.innerHTML=hist[histIdx];
    restoringHist=false;
    editor.dispatchEvent(new Event("input",{bubbles:true}));
  };
  editor._redo=()=>{
    if(histIdx>=hist.length-1){toast("ما فيه تعديل لاحق تقدر تعيده");return}
    histIdx++;restoringHist=true;
    editor.innerHTML=hist[histIdx];
    restoringHist=false;
    editor.dispatchEvent(new Event("input",{bubbles:true}));
  };
  editor.addEventListener("paste",e=>{
    e.preventDefault();
    const html=e.clipboardData.getData("text/html");
    const plain=e.clipboardData.getData("text/plain");
    const clean=html?sanitizeHTML(html):esc(plain).replace(/\n/g,"<br>");
    document.execCommand("insertHTML",false,clean);
  });
  editor.addEventListener("focus",()=>toolbar.setActive(editor));
  editor.addEventListener("input",e=>{
    if(e.data===" ")tryShortcutExpand();
    else if(e.data==="$")tryInlineLatexExpand(editor);
    schedulePush();
  });
  editor.addEventListener("click",e=>{
    const wrap=e.target.closest(".katex-wrap");
    if(wrap&&editor.contains(wrap)){
      e.preventDefault();
      toolbar.setActive(editor);
      openLatexDialog(editor,null,wrap);
    }
  });
  editor.addEventListener("keydown",e=>{
    if(!(e.ctrlKey||e.metaKey))return;
    const k=e.key.toLowerCase();
    if(k==="b"){e.preventDefault();document.execCommand("bold")}
    else if(k==="i"){e.preventDefault();document.execCommand("italic")}
    else if(k==="u"){e.preventDefault();document.execCommand("underline")}
    else if(k==="z"){e.preventDefault();editor._undo()}
    else if(k==="y"){e.preventDefault();editor._redo()}
  });
  return editor;
}
const BH_CLS={"ثناء":"p","تنبيه":"w","مخالفة":"v"};
function renderBhList(id){
  const list=S.behavior[id]||[];
  el("bhList").innerHTML=list.length===0?'<p class="empty" style="padding:10px">لا توجد ملاحظات سلوكية.</p>':
    list.map(b=>'<div class="behavRow"><span class="bChip '+BH_CLS[b.type]+'">'+b.type+'</span>'+
      '<div class="bd">'+esc(b.text)+'<div class="bDate">'+b.date+'</div></div>'+
      '<button class="bDel" data-bh="'+b.id+'">✕</button></div>').join("");
  el("bhList").querySelectorAll("[data-bh]").forEach(btn=>btn.onclick=()=>{
    S.behavior[id]=(S.behavior[id]||[]).filter(x=>x.id!==btn.dataset.bh);
    save.behavior();renderBhList(id);
  });
}
function payInfo(id){
  const p=S.payments[id];
  if(!p||!num(p.total))return null;
  const paid=(p.list||[]).reduce((a,x)=>a+(num(x.amount)||0),0);
  return {total:Number(p.total),paid,rest:Number(p.total)-paid};
}
function payPairHTML(id){
  const p=payInfo(id);
  if(!p)return "";
  return '<div class="pairs"><div class="pair"><span>القسط الكلي</span><b>'+p.total.toLocaleString()+'</b></div>'+
    '<div class="pair"><span>المدفوع</span><b style="color:var(--green)">'+p.paid.toLocaleString()+'</b></div>'+
    '<div class="pair"><span>المتبقي</span><b style="color:'+(p.rest>0?"var(--red)":"var(--green)")+'">'+p.rest.toLocaleString()+'</b></div></div>';
}
function printReportCard(id){
  const s=S.students.find(x=>x.id===id);if(!s)return;
  const subs=SUBS();
  const g=S.grades[id]||{};
  const res=studentResult(id,subs,s.grade);
  printHTML("كشف درجات الطالب",
    '<div class="pInfo"><b>الاسم:</b> '+esc(s.name)+(s.examNo?' &nbsp;|&nbsp; <b>الرقم الامتحاني:</b> '+esc(s.examNo):'')+' &nbsp;|&nbsp; <b>الصف:</b> '+s.grade+' — '+secTerm(instOf(s))+' '+s.section+(s.branch!=="-"?' — '+s.branch:'')+' &nbsp;|&nbsp; <b>المواليد:</b> '+(s.birth||"—")+'</div>'+
    '<table class="pTable"><thead><tr><th>المادة</th><th>شهر أول ف1</th><th>شهر ثاني ف1</th><th>نصف السنة</th><th>شهر أول ف2</th><th>شهر ثاني ف2</th><th>السعي السنوي</th><th>الامتحان النهائي</th><th>الدرجة النهائية</th><th>الدور الثاني</th><th>النتيجة</th></tr></thead><tbody>'+
    subs.map(sub=>{
      const r=g[sub]||{};const c=subjectCalc(r,s.grade);
      const cell=v=>(v===undefined||v==="")?"—":esc(v);
      return '<tr><td style="text-align:right">'+sub+'</td><td>'+fmt(c.M1)+'</td><td>'+fmt(c.M2)+'</td><td>'+cell(r.mid)+'</td><td>'+fmt(c.M3)+'</td><td>'+fmt(c.M4)+'</td><td>'+fmt(c.saay)+'</td><td>'+cell(r.fin)+'</td><td><b>'+fmt(c.final)+'</b></td><td>'+cell(r.r2)+'</td><td>'+(c.status||"—")+'</td></tr>';
    }).join("")+'</tbody></table>'+
    '<div class="pInfo" style="margin-top:10px"><b>المعدل النهائي:</b> '+fmt(res.avg)+' &nbsp;|&nbsp; <b>النتيجة السنوية:</b> '+(res.status||"غير مكتملة")+'</div>',true,instOf(s));
}

/* ============ بطاقة الطالب ============ */
function openDetail(id){
  const s=S.students.find(x=>x.id===id);if(!s)return;
  const g=S.grades[id]||{};
  const subs=SUBS();
  const days=Object.values(S.attendance).filter(m=>m[id]);
  const absent=days.filter(m=>m[id]==="غائب").length;
  const excused=days.filter(m=>m[id]==="مجاز").length;
  const res=studentResult(id,subs,s.grade);
  const hw=hwStats(id);
  const msgs=S.messages[id]||[];
  const pair=(k,v)=>'<div class="pair"><span>'+k+'</span><b>'+esc(v)+'</b></div>';
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead">'+
      '<div style="display:flex;align-items:center;gap:10px">'+
        (photoSrcOf(s)?'<img src="'+photoSrcOf(s)+'" style="width:40px;height:40px;border-radius:10px;object-fit:cover">':'')+
        '<h3>'+esc(s.name)+'</h3>'+
      '</div><button class="x" id="dx">✕</button></div>'+
    '<div class="form"><div class="pairs">'+
      (s.examNo?pair("الرقم الامتحاني",s.examNo):"")+pair("المؤسسة",instOf(s))+pair("الصف",s.grade+" — "+secTerm(instOf(s))+" "+s.section)+
      (s.branch!=="-"?pair("الفرع",s.branch):"")+
      pair("الجنس",s.gender)+pair("المواليد",s.birth||"—")+
      pair("ولي الأمر",s.guardian||"—")+pair("هاتف ولي الأمر",s.phone||"—")+pair("هاتف الطالب",s.sphone||"—")+(s.telegram?pair("تليكرام الطالب",s.telegram):"")+
      pair("العنوان",s.address||"—")+pair("حالة القيد",s.status)+
      (s.notes?pair("ملاحظات",s.notes):"")+
    '</div>'+
    '<div class="miniStats"><div><b>'+absent+'</b><span>غياب</span></div><div><b>'+excused+'</b><span>إجازة</span></div><div><b>'+fmt(res.avg)+'</b><span>المعدل النهائي</span></div><div><b>'+hw.done+'/'+hw.total+'</b><span>الواجبات</span></div></div>'+
    (function(){
      const rec=(S.grades[id]||{})[MYSUB()]||{};
      const svg=sparkSVG(rec);
      if(!svg)return "";
      const t=trendOf(rec);
      const tTxt=t===null?"":(t>0?'<span style="color:var(--green);font-weight:700">▲ متحسن +'+t+'</span>':t<0?'<span style="color:var(--red);font-weight:700">▼ متراجع '+t+'</span>':'<span style="color:#64748B;font-weight:700">◄ مستقر</span>');
      return '<div class="subCard" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:0"><div><div style="font-size:12px;font-weight:700;color:#475569">مسار الدرجات — '+esc(MYSUB())+'</div><div style="font-size:12px;margin-top:4px">'+tTxt+'</div></div>'+svg+'</div>';
    })()+
    (res.status?'<div class="avgBox">النتيجة السنوية: <b>'+res.status+'</b></div>':"")+
    payPairHTML(id)+
    (s.sphone?
      '<div class="actions"><button class="wa lg" id="waImgG" style="background:linear-gradient(135deg,#0F172A,#1E293B)">🖼 التقرير لولي الأمر</button><button class="wa lg" id="waImgS" style="background:linear-gradient(135deg,#0F172A,#1E293B)">🖼 التقرير للطالب</button></div>':
      '<div class="actions"><button class="wa lg" id="waImgG" style="background:linear-gradient(135deg,#0F172A,#1E293B)">🖼 إرسال التقرير كبطاقة مصوّرة</button></div>')+
    '<div class="actions"><button class="wa lg" id="waAbs">📱 إبلاغ غياب اليوم</button><button class="wa lg" id="waMsg">💬 مراسلة</button></div>'+
    '<div class="actions"><button class="wa lg" id="waPraise" style="background:linear-gradient(135deg,#B8860B,#D4AF37)">🌟 إرسال بطاقة ثناء'+(s.sphone?" للطالب":" لولي الأمر")+'</button></div>'+
    '<button class="btn ghost full" id="prnCard">🖨 طباعة كشف الدرجات</button>'+
    '<h3 class="h2" style="margin:6px 0 0">سجل السلوك</h3>'+
    '<div class="tplChips">'+TPLS("note").map((t,i)=>'<button data-nt="'+i+'">'+esc(t)+'</button>').join("")+'<button data-nt="__save__" style="border-style:dashed">💾 حفظ الحالية</button></div>'+
    '<div class="addRow"><select id="bhType"><option>ثناء</option><option>تنبيه</option><option>مخالفة</option></select><input id="bhText" placeholder="اكتب الملاحظة…"><button class="btn" id="bhAdd">+</button></div>'+
    '<div id="bhList" class="payList"></div>'+
    '<h3 class="h2">✉️ سجل الرسائل المرسلة ('+msgs.length+')</h3>'+
    (msgs.length===0?'<p class="empty" style="padding:10px">لا توجد رسائل مرسلة بعد.</p>':
      '<div class="payList">'+msgs.slice(0,8).map(m=>
        '<div class="behavRow"><span class="bChip p" style="white-space:nowrap">'+esc(m.to)+'</span>'+
        '<div class="bd">'+esc(m.badge)+'<div class="bDate">'+m.date+'</div></div></div>').join("")+'</div>')+
    '</div>'+
    '<div class="sheetFoot" id="dFoot"><button class="btn ghostD" id="dDel">حذف</button><button class="btn" id="dEdit">تعديل</button></div>'+
  '</div></div>';
  el("dx").onclick=closeModal;
  el("waImgG").onclick=()=>shareItemCard(s,{mode:"report",toPhone:s.phone,recipientLabel:"ولي الأمر"});
  if(el("waImgS"))el("waImgS").onclick=()=>shareItemCard(s,{mode:"report",toPhone:s.sphone,recipientLabel:"الطالب"});
  el("waAbs").onclick=()=>shareItemCard(s,absCardOpts(s));
  el("waMsg").onclick=()=>openMsgTplSheet(s);
  el("waPraise").onclick=()=>{
    const opts=praiseCardOpts(s);
    if(s.sphone)shareItemCard(s,Object.assign(opts,{toPhone:s.sphone,recipientLabel:"الطالب"}));
    else shareItemCard(s,Object.assign(opts,{toPhone:s.phone,recipientLabel:"ولي الأمر"}));
  };
  el("prnCard").onclick=()=>printReportCard(id);
  document.querySelectorAll(".tplChips [data-nt]").forEach(b=>b.onclick=()=>{
    if(b.dataset.nt==="__save__"){
      const txt=el("bhText").value.trim();
      if(!txt){toast("اكتب الملاحظة أولاً حتى تنحفظ كقالب");return}
      if(TPLS("note").includes(txt)){toast("القالب موجود مسبقاً");return}
      tplArr("note").push(txt);save.settings();
      b.insertAdjacentHTML("beforebegin",'<button disabled style="opacity:.6">'+esc(txt)+'</button>');
      toast("حُفظ كقالب ملاحظة ✓");
    }else el("bhText").value=TPLS("note")[Number(b.dataset.nt)];
  });
  el("bhAdd").onclick=()=>{
    const txt=el("bhText").value.trim();
    if(!txt){toast("اكتب الملاحظة أولاً");return}
    (S.behavior[id]=S.behavior[id]||[]).unshift({id:uid(),date:todayStr(),type:el("bhType").value,text:txt});
    save.behavior();el("bhText").value="";renderBhList(id);toast("تمت الإضافة");
  };
  renderBhList(id);
  el("dEdit").onclick=()=>{openForm(id)};
  el("dDel").onclick=()=>{
    el("dFoot").innerHTML='<span class="warnTxt">حذف الطالب نهائياً؟</span><button class="btn ghost" id="dBack">تراجع</button><button class="btn danger" id="dConfirm">تأكيد الحذف</button>';
    el("dBack").onclick=()=>openDetail(id);
    el("dConfirm").onclick=()=>{
      S.students=S.students.filter(x=>x.id!==id);delete S.grades[id];setStudentPhoto(id,"");
      save.students();save.grades();closeModal();render();toast("تم حذف الطالب");
    };
  };
}

