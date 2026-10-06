/* ============ الطلبة ============ */
function filteredStudents(){
  const q=(S.q||"").trim();
  return VIS().filter(s=>{
    if(S.fg&&s.grade!==S.fg)return false;
    if(S.fs&&s.section!==S.fs)return false;
    if(!q)return true;
    const qMatchesGrade=s.grade.includes(q)||q.includes(s.grade);
    const qMatchesSection=s.section===q;
    const qMatchesText=s.name.includes(q)||s.guardian.includes(q)||s.phone.includes(q)||(s.examNo||"").includes(q);
    return qMatchesGrade||qMatchesSection||qMatchesText;
  });
}
function renderStudents(){
  el("content").innerHTML=
    '<div class="rowBetween"><h2 class="h">👨‍🎓 الطلبة <span class="count" id="cnt"></span></h2>'+
    '<div class="actions"><button class="btn ghost" id="bulkBtn">⬆ استيراد أسماء</button><button class="btn ghost" id="prnList">🖨 طباعة</button><button class="btn ghost" id="csvBtn">CSV</button><button class="btn" id="addBtn">+ إضافة طالب</button></div></div>'+
    '<input class="search" id="qIn" placeholder="🔍 اكتب اسماً، هاتفاً، أو صفاً/شعبة مباشرة…" value="'+esc(S.q)+'">'+
    '<div class="filters">'+
      '<select id="fgSel"><option value="">كل الصفوف</option>'+gradesFor(S.curInst||INSTS()[0]).map(g=>'<option'+(S.fg===g?" selected":"")+'>'+g+'</option>').join("")+'</select>'+
      '<select id="fsSel"><option value="">'+secAllLabel(S.curInst)+'</option>'+secList(S.curInst||INSTS()[0]).map(x=>'<option'+(S.fs===x?" selected":"")+'>'+x+'</option>').join("")+'</select>'+
    '</div>'+
    (S.fg&&S.fs?'<button class="btn full" id="fullClassPrn" style="margin:0 0 10px">📄 تقرير شامل لهذا الصف (طلبة + درجات + حضور + أقساط)</button>':'')+
    '<div id="slistBox"></div>';
  el("fabBox").innerHTML='<button class="fab" id="fabAdd" title="إضافة طالب">+</button>';
  el("fabAdd").onclick=()=>openForm(null);
  el("addBtn").onclick=()=>openForm(null);
  el("csvBtn").onclick=exportCSV;
  el("bulkBtn").onclick=openBulkImport;
  el("prnList").onclick=printClassList;
  const fcp=el("fullClassPrn");if(fcp)fcp.onclick=printFullClassReport;
  el("qIn").oninput=e=>{S.q=e.target.value;renderSList()};
  el("fgSel").onchange=e=>{S.fg=e.target.value;renderStudents()};
  el("fsSel").onchange=e=>{S.fs=e.target.value;renderStudents()};
  renderSList();
}
function printClassList(){
  const list=filteredStudents();
  if(!list.length){toast("لا يوجد طلبة للطباعة");return}
  const inst=reportInstFor(list);
  const title="قائمة الطلبة"+(S.fg?" — "+S.fg:"")+(S.fs?" — "+secTerm(inst)+" "+S.fs:"");
  printHTML(title,
    '<table class="pTable"><thead><tr><th>ت</th><th>الرقم الامتحاني</th><th>اسم الطالب</th><th>الصف</th><th>'+secTerm(inst)+'</th><th>الفرع</th><th>ولي الأمر</th><th>الهاتف</th><th>الحالة</th></tr></thead><tbody>'+
    list.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(s.examNo||"—")+'</td><td style="text-align:right">'+esc(s.name)+'</td><td>'+s.grade+'</td><td>'+s.section+'</td><td>'+s.branch+'</td><td>'+esc(s.guardian)+'</td><td>'+esc(s.phone)+'</td><td>'+s.status+'</td></tr>').join("")+
    '</tbody></table>',false,inst);
}
function printFullClassReport(){
  const list=filteredStudents();
  if(!list.length){toast("لا يوجد طلبة بهذا الصف والشعبة");return}
  const inst=reportInstFor(list);
  const month=todayStr().slice(0,7);
  const attRows=monthStats(month,S.fg,S.fs);
  const body=
    '<div class="pInfo"><b>'+esc(S.fg)+'</b> — '+secTerm(inst)+' '+esc(S.fs)+' &nbsp;|&nbsp; <b>المادة:</b> '+esc(MYSUB())+' &nbsp;|&nbsp; <b>عدد الطلبة:</b> '+list.length+'</div>'+
    '<h3 style="font-size:13px;margin:14px 0 6px">👨‍🎓 قائمة الطلبة</h3>'+
    '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th><th>ولي الأمر</th><th>الهاتف</th><th>الحالة</th></tr></thead><tbody>'+
    list.map((s,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(s.name)+'</td><td>'+esc(s.guardian||"—")+'</td><td>'+esc(s.phone||"—")+'</td><td>'+s.status+'</td></tr>').join("")+
    '</tbody></table>'+
    '<h3 style="font-size:13px;margin:14px 0 6px">📚 الدرجات (المعدل النهائي)</h3>'+
    '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th><th>الدرجة النهائية</th><th>النتيجة</th></tr></thead><tbody>'+
    list.map((s,i)=>{
      const rec=(S.grades[s.id]||{})[MYSUB()]||{};
      const c=subjectCalc(rec,s.grade);
      return '<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(s.name)+'</td><td><b>'+fmt(c.final)+'</b></td><td>'+(c.status||"—")+'</td></tr>';
    }).join("")+
    '</tbody></table>'+
    '<h3 style="font-size:13px;margin:14px 0 6px">✓ الحضور — شهر '+month+'</h3>'+
    '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th><th>حضور</th><th>غياب</th><th>إجازة</th><th>النسبة</th></tr></thead><tbody>'+
    attRows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(r.s.name)+'</td><td>'+r.p+'</td><td>'+r.a+'</td><td>'+r.e+'</td><td>'+(r.pct===null?"—":r.pct+"%")+'</td></tr>').join("")+
    '</tbody></table>'+
    '<h3 style="font-size:13px;margin:14px 0 6px">💰 الأقساط</h3>'+
    '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th><th>القسط الكلي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>'+
    list.map((s,i)=>{
      const p=payInfo(s.id);
      return '<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(s.name)+'</td><td>'+(p?p.total.toLocaleString():"—")+'</td><td>'+(p?p.paid.toLocaleString():"—")+'</td><td>'+(p?p.rest.toLocaleString():"—")+'</td></tr>';
    }).join("")+
    '</tbody></table>';
  printHTML("تقرير شامل — "+S.fg+" "+secTerm(inst)+" "+S.fs,body,false,inst);
}
function openBulkImport(){
  const inst0=S.curInst||INSTS()[0];
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>استيراد أسماء دفعة واحدة</h3><button class="x" id="bx">✕</button></div>'+
    '<div class="form">'+
      '<label>المؤسسة<select id="bInst">'+opts(INSTS(),inst0)+'</select></label>'+
      '<label>الأسماء (اسم واحد بكل سطر)<textarea id="bNames" rows="7" placeholder="أحمد محمد علي حسين&#10;زينب كريم جاسم&#10;علي حسن كاظم"></textarea></label>'+
      '<div class="grid2">'+
        '<label>الصف<select id="bGrade">'+opts(GRADES,GRADES[0])+'</select></label>'+
        '<label><span id="bSecLbl">'+secTerm(inst0)+'</span><select id="bSection">'+opts(secList(inst0),secList(inst0)[0])+'</select></label>'+
        '<label>الفرع<select id="bBranch">'+opts(BRANCHES,"-")+'</select></label>'+
        '<label>الجنس<select id="bGender">'+opts(["ذكر","أنثى"],"ذكر")+'</select></label>'+
      '</div>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn ghost" id="bCancel">إلغاء</button><button class="btn" id="bSave">إضافة الكل</button></div>'+
  '</div></div>';
  el("bInst").onchange=()=>{
    const inst=el("bInst").value;
    el("bSecLbl").textContent=secTerm(inst);
    el("bSection").innerHTML=opts(secList(inst),secList(inst)[0]);
  };
  el("bx").onclick=el("bCancel").onclick=closeModal;
  el("bSave").onclick=()=>{
    const names=el("bNames").value.split("\n").map(x=>x.trim()).filter(Boolean);
    if(!names.length){toast("اكتب الأسماء أولاً");return}
    const grade=el("bGrade").value,section=el("bSection").value,gender=el("bGender").value,inst=el("bInst").value;
    const branch=grade.includes("متوسط")?"-":el("bBranch").value;
    names.forEach(name=>S.students.push({id:uid(),name,inst,gender,birth:"",grade,section,branch,guardian:"",phone:"",address:"",status:"مستمر",notes:""}));
    save.students();closeModal();render();toast("تمت إضافة "+names.length+" طالب");
  };
}
function levelColor(s){
  const rec=(S.grades[s.id]||{})[MYSUB()]||{};
  const c=subjectCalc(rec,s.grade);
  if(c.final===null)return "#94A3B8";
  if(c.final>=85)return "#B8860B";
  if(c.final>=70)return "#0F172A";
  if(c.final>=50)return "#475569";
  return "#B3453F";
}
const SLIST_BATCH=80;
function renderSList(loadMore){
  if(!loadMore)S._slistShown=SLIST_BATCH;
  const list=filteredStudents();
  el("cnt").textContent=list.length;
  const shown=list.slice(0,S._slistShown||SLIST_BATCH);
  const remaining=list.length-shown.length;
  el("slistBox").innerHTML=list.length===0?
    '<p class="empty">لا توجد نتائج. أضف طالباً جديداً بزر «+ إضافة طالب».</p>':
    '<ul class="slist">'+shown.map(s=>{
      const rec=(S.grades[s.id]||{})[MYSUB()]||{};
      const last=lastVal(rec,s.grade);
      const gradeBadge=last===null?'':last>=90?'<span class="chip ok" title="متفوّق">🌟 '+fmt(last)+'</span>':last<50?'<span class="chip bad" title="معرّض للرسوب">📉 '+fmt(last)+'</span>':'<span class="chip" style="background:var(--okbg);color:var(--green2)">'+fmt(last)+'</span>';
      return '<li class="srow" data-id="'+s.id+'" style="border-inline-start:4px solid '+levelColor(s)+'">'+
        (photoSrcOf(s)?'<img src="'+photoSrcOf(s)+'" class="avatar" style="object-fit:cover">':'<div class="avatar '+(s.gender==="ذكر"?"m":"f")+'">'+esc((s.name.trim()[0]||"؟"))+'</div>')+
        '<div class="sinfo"><div class="sname">'+esc(s.name||"بدون اسم")+'</div>'+
        '<div class="smeta">'+s.grade+' — '+secTerm(instOf(s))+' '+s.section+(s.branch!=="-"?" — "+s.branch:"")+(S.curInst?"":" — 🏫 "+esc(instOf(s)))+'</div></div>'+
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">'+
          '<span class="chip '+(s.status==="مستمر"?"ok":"warn")+'">'+s.status+'</span>'+
          gradeBadge+
        '</div></li>';
    }).join("")+'</ul>'+
    (remaining>0?'<button class="btn ghost full" id="slistMore" style="margin:10px 0">تحميل '+Math.min(remaining,SLIST_BATCH)+' أخرى ('+remaining+' متبقية)</button>':'');
  el("slistBox").querySelectorAll(".srow").forEach(r=>r.onclick=()=>openDetail(r.dataset.id));
  const moreBtn=document.getElementById("slistMore");
  if(moreBtn)moreBtn.onclick=()=>{S._slistShown=(S._slistShown||SLIST_BATCH)+SLIST_BATCH;renderSList(true)};
}
function exportCSV(){
  const head=["الرقم الامتحاني","الاسم","المؤسسة","الجنس","المواليد","الصف",secTerm(S.curInst),"الفرع","ولي الأمر","هاتف ولي الأمر","هاتف الطالب","العنوان","الحالة","ملاحظات"];
  const rows=filteredStudents().map(s=>[s.examNo||"",s.name,instOf(s),s.gender,s.birth,s.grade,s.section,s.branch,s.guardian,s.phone,s.sphone||"",s.address,s.status,s.notes]);
  const csv="\uFEFF"+[head,...rows].map(r=>r.map(c=>'"'+String(c||"").replace(/"/g,'""')+'"').join(",")).join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="الطلبة.csv";a.click();
}

/* ============ نموذج طالب ============ */
function opts(arr,sel){return arr.map(x=>'<option'+(x===sel?" selected":"")+'>'+x+'</option>').join("")}
function openForm(id){
  const s=id?S.students.find(x=>x.id===id):{id:uid(),name:"",examNo:"",photo:"",gender:"ذكر",birth:"",grade:GRADES[0],section:"أ",branch:"-",guardian:"",phone:"",sphone:"",telegram:"",address:"",status:"مستمر",notes:""};
  const isNew=!id;
  const inst0=s.inst||S.curInst||INSTS()[0];
  el("modal").innerHTML=
  '<div class="overlay" id="ov"><div class="sheet">'+
    '<div class="sheetHead"><h3>'+(isNew?"طالب جديد":"تعديل بيانات الطالب")+'</h3><button class="x" id="fx">✕</button></div>'+
    '<div class="form">'+
      '<div style="display:flex;align-items:center;gap:12px">'+
        (photoSrcOf(s)?'<img id="fPhotoPrev" src="'+photoSrcOf(s)+'" style="width:64px;height:64px;border-radius:14px;object-fit:cover;border:1px solid var(--line)">':'<div id="fPhotoPrev" style="width:64px;height:64px;border-radius:14px;background:var(--okbg);display:flex;align-items:center;justify-content:center;font-size:24px;color:#94A3B8">👤</div>')+
        '<button type="button" class="btn ghost" id="fPhotoBtn" style="margin:0">📷 '+(photoSrcOf(s)?"تغيير الصورة":"إضافة صورة شخصية")+'</button>'+
        (photoSrcOf(s)?'<button type="button" class="btn ghostD" id="fPhotoDel" style="margin:0">إزالة</button>':'')+
        '<input type="file" id="fPhotoFile" accept="image/*" style="display:none">'+
      '</div>'+
      '<label>المؤسسة<select id="fInst">'+opts(INSTS(),inst0)+'<option value="__new__">➕ إضافة مؤسسة جديدة…</option></select></label>'+
      '<label id="fInstNewWrap" style="display:none">اسم المؤسسة الجديدة<input id="fInstNew" placeholder="مثال: معهد التفوق للدورات"></label>'+
      '<label>الاسم الرباعي واللقب<input id="fName" value="'+esc(s.name)+'" placeholder="مثال: أحمد محمد علي حسين"></label>'+
      '<div class="grid2">'+
        '<label>الرقم الامتحاني / رقم الجلوس<input id="fExamNo" inputmode="numeric" value="'+esc(s.examNo||"")+'" placeholder="اختياري"></label>'+
        '<label>الجنس<select id="fGender">'+opts(["ذكر","أنثى"],s.gender)+'</select></label>'+
        '<label>تاريخ الميلاد<input type="date" id="fBirth" value="'+esc(s.birth)+'"></label>'+
        '<label>الصف<select id="fGrade">'+opts(gradesFor(inst0),s.grade)+'</select></label>'+
        '<label><span id="fSecLbl">'+secTerm(inst0)+'</span><select id="fSection">'+opts(secList(inst0),s.section)+'</select></label>'+
        '<label>الفرع<select id="fBranch">'+opts(BRANCHES,s.branch)+'</select></label>'+
        '<label>حالة القيد<select id="fStatus">'+opts(STATUSES,s.status)+'</select></label>'+
      '</div>'+
      '<label>اسم ولي الأمر<input id="fGuardian" value="'+esc(s.guardian)+'"></label>'+
      '<div class="grid2">'+
        '<label>هاتف ولي الأمر<input id="fPhone" inputmode="tel" value="'+esc(s.phone)+'" placeholder="07xxxxxxxxx"></label>'+
        '<label>العنوان<input id="fAddress" value="'+esc(s.address)+'"></label>'+
      '</div>'+
      '<label>هاتف الطالب نفسه (اختياري — لإرسال الواجبات والتقارير له مباشرة)<input id="fSPhone" inputmode="tel" value="'+esc(s.sphone||"")+'" placeholder="07xxxxxxxxx"></label>'+
      '<label>معرّف تليكرام الطالب (اختياري — إذا يفضّل التواصل عبر تليكرام بدل الهاتف)<input id="fTg" value="'+esc(s.telegram||"")+'" placeholder="@username"></label>'+
      '<label>ملاحظات<textarea id="fNotes" rows="2">'+esc(s.notes)+'</textarea></label>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn ghost" id="fCancel">إلغاء</button><button class="btn" id="fSave">حفظ</button></div>'+
  '</div></div>';
  let curPhoto=photoSrcOf(s);
  el("fPhotoBtn").onclick=()=>el("fPhotoFile").click();
  el("fPhotoFile").onchange=e=>{
    const f=e.target.files&&e.target.files[0];e.target.value="";
    if(!f)return;
    const fr=new FileReader();
    fr.onload=()=>{
      const im=new Image();
      im.onload=()=>{
        const max=220,sc=Math.min(1,max/Math.max(im.width,im.height));
        const cv=document.createElement("canvas");
        cv.width=Math.max(1,Math.round(im.width*sc));cv.height=Math.max(1,Math.round(im.height*sc));
        cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);
        curPhoto=cv.toDataURL("image/jpeg",0.85);
        el("fPhotoPrev").outerHTML='<img id="fPhotoPrev" src="'+curPhoto+'" style="width:64px;height:64px;border-radius:14px;object-fit:cover;border:1px solid var(--line)">';
        toast("تم اختيار الصورة — لا تنسَ الحفظ");
      };
      im.onerror=()=>toast("تعذر قراءة الصورة");
      im.src=fr.result;
    };
    fr.readAsDataURL(f);
  };
  const pDel=el("fPhotoDel");if(pDel)pDel.onclick=()=>{
    curPhoto="";
    el("fPhotoPrev").outerHTML='<div id="fPhotoPrev" style="width:64px;height:64px;border-radius:14px;background:var(--okbg);display:flex;align-items:center;justify-content:center;font-size:24px;color:#94A3B8">👤</div>';
  };
  const syncBranch=()=>{const mid=el("fGrade").value.includes("متوسط");el("fBranch").disabled=mid;if(mid)el("fBranch").value="-"};
  el("fGrade").onchange=syncBranch;syncBranch();
  el("fInst").onchange=()=>{
    el("fInstNewWrap").style.display=el("fInst").value==="__new__"?"flex":"none";
    if(el("fInst").value!=="__new__"){
      const inst=el("fInst").value;
      el("fSecLbl").textContent=secTerm(inst);
      el("fSection").innerHTML=opts(secList(inst),secList(inst)[0]);
    }
  };
  el("fx").onclick=el("fCancel").onclick=closeModal;
  el("fSave").onclick=()=>{
    const name=el("fName").value.trim();
    if(!name){toast("اكتب اسم الطالب أولاً");return}
    let inst=el("fInst").value;
    if(inst==="__new__"){
      inst=el("fInstNew").value.trim();
      if(!inst){toast("اكتب اسم المؤسسة الجديدة");return}
      if(!INSTS().includes(inst)){S.settings.insts=INSTS().concat([inst]);save.settings()}
    }
    setStudentPhoto(s.id,curPhoto);
    const st={id:s.id,name,examNo:el("fExamNo").value.trim(),photo:curPhoto?"idb":"",inst,gender:el("fGender").value,birth:el("fBirth").value,grade:el("fGrade").value,
      section:el("fSection").value,branch:el("fBranch").value,guardian:el("fGuardian").value.trim(),
      phone:el("fPhone").value.trim(),sphone:el("fSPhone").value.trim(),telegram:el("fTg").value.trim(),address:el("fAddress").value.trim(),status:el("fStatus").value,notes:el("fNotes").value.trim()};
    if(isNew)S.students.push(st);else S.students=S.students.map(x=>x.id===st.id?st:x);
    save.students();closeModal();render();toast(isNew?"تمت إضافة الطالب":"تم حفظ التعديلات");
  };
}
function closeModal(){el("modal").innerHTML=""}
/* ============ دعم زر الرجوع (لا يخرج من التطبيق، يسكّر النافذة المفتوحة أو يرجع للرئيسية فقط) ============ */
let _modalHistActive=false,_suppressPop=false,_exitArmed=false,_exitTimer=null,_tabHistActive=false;
const _isLockShown=()=>!!document.getElementById("lockScreen");
function goToTab(tab){
  if(tab!=="home"&&S.tab==="home"&&!_tabHistActive){
    _tabHistActive=true;
    history.pushState({tabNav:true},"");
  }
  S.tab=tab;render();
}
function backToHome(){
  _tabHistActive=false;
  S.tab="home";render();
}
history.pushState({root:true},""); // حارس أساسي يمنع الخروج المباشر من أول ضغطة رجوع
new MutationObserver(()=>{
  if(_isLockShown())return; // شاشة القفل لا تُغلق بزر الرجوع لأسباب أمنية
  const open=el("modal").innerHTML.trim()!=="";
  if(open&&!_modalHistActive){
    _modalHistActive=true;
    history.pushState({modalOpen:true},"");
  }else if(!open&&_modalHistActive&&!_suppressPop){
    _modalHistActive=false;
    history.back();
  }
}).observe(el("modal"),{childList:true});
window.addEventListener("popstate",()=>{
  if(_isLockShown())return;
  if(_modalHistActive&&el("modal").innerHTML.trim()===""){_modalHistActive=false} // تصحيح حالة عالقة إن وجدت
  if(_modalHistActive){
    _suppressPop=true;
    _modalHistActive=false;
    el("modal").innerHTML="";
    setTimeout(()=>{_suppressPop=false},60);
    return;
  }
  if(_tabHistActive){
    _tabHistActive=false;
    S.tab="home";render();
    return;
  }
  // ما فيه نافذة مفتوحة ولا تبويب غير الرئيسية — ضغطة رجوع بمستوى الجذر (محاولة خروج فعلية)
  if(_exitArmed)return; // الضغطة الثانية خلال المهلة: نسمح بالخروج الفعلي
  history.pushState({root:true},""); // نعيد الحارس فنمنع الخروج المفاجئ من أول ضغطة
  _exitArmed=true;
  toast("اضغط رجوع مرة أخرى للخروج من التطبيق");
  clearTimeout(_exitTimer);
  _exitTimer=setTimeout(()=>{_exitArmed=false},2000);
});
