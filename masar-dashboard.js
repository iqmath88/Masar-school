/* ============ أدوات ============ */
let toastT;
function toast(m){const b=document.getElementById("toastBox");b.innerHTML='<div class="toast">'+esc(m)+'</div>';clearTimeout(toastT);toastT=setTimeout(()=>b.innerHTML="",1800)}
function el(id){return document.getElementById(id)}

/* ============ التنقل ============ */
const TABS=[["home","الرئيسية","▦"],["lectures","المحاضرات","📚"],["students","الطلبة","👤"],["attendance","الحضور","✓"],["evaluation","التقييم","٪"],["teaching","التدريس","📝"],["payments","الأقساط","💰"],["settings","الإعدادات","⚙️"]];
function renderTabs(){
  el("tabs").innerHTML=TABS.map(([k,l,i])=>
    '<button class="tab'+(S.tab===k?" on":"")+'" data-tab="'+k+'"><span class="ticon">'+i+'</span><span>'+l+'</span></button>').join("");
  el("tabs").querySelectorAll(".tab").forEach(b=>b.onclick=()=>{goToTab(b.dataset.tab)});
}
function fixFilterState(){
  const effInst=S.curInst||INSTS()[0];
  const grades=gradesFor(effInst);
  const sections=secList(effInst);
  if(!grades.includes(S.aGrade))S.aGrade=grades[0];
  if(!sections.includes(S.aSection))S.aSection=sections[0];
  if(!grades.includes(S.gGrade))S.gGrade=grades[0];
  if(!sections.includes(S.gSection))S.gSection=sections[0];
  if(!grades.includes(S.hGrade))S.hGrade=grades[0];
  if(!sections.includes(S.hSection))S.hSection=sections[0];
  if(!grades.includes(S.pGrade))S.pGrade=grades[0];
  if(!sections.includes(S.pSection))S.pSection=sections[0];
  if(S.fg&&!grades.includes(S.fg))S.fg="";
  if(S.fs&&!sections.includes(S.fs))S.fs="";
}
function render(){
  fixFilterState();
  renderTabs();
  el("fabBox").innerHTML="";
  if(S.tab==="home")renderHome();
  else if(S.tab==="lectures")renderLectures();
  else if(S.tab==="students")renderStudents();
  else if(S.tab==="attendance")renderAttendance();
  else if(S.tab==="payments")renderPayments();
  else if(S.tab==="evaluation")renderEvaluation();
  else if(S.tab==="teaching")renderTeaching();
  else if(S.tab==="homework")renderHomework();
  else if(S.tab==="grades")renderGrades();
  else if(S.tab==="stats")renderStatsPage();
  else if(S.tab==="settings")renderSettings();
  else renderHome();
}

/* ============ الرئيسية ============ */
function backupBanner(){
  if(!S.students.length)return "";
  const last=S.settings.lastBackup;
  const days=last?Math.floor((new Date(todayStr())-new Date(last))/86400000):null;
  if(last&&days<7)return "";
  const msg=last?
    "⏰ مرت "+days+" أيام على آخر نسخة احتياطية — بياناتك كلها على هذا الجهاز فقط.":
    "🛡️ لم تأخذ نسخة احتياطية بعد — إذا ضاع الجهاز تضيع البيانات.";
  return '<div class="notice" style="display:flex;align-items:center;gap:10px;justify-content:space-between"><span>'+msg+'</span><button class="btn" id="bkNow" style="padding:8px 14px;white-space:nowrap">⬇ الآن</button></div>';
}
function morningBriefHTML(){
  const h=new Date().getHours();
  const greeting=h<12?"صباح الخير":(h<18?"مساء الخير":"مساء الخير");
  const today=new Date().getDay();
  const lessonsToday=S.timetable.filter(t=>t.day===today).length;
  const pendingStudents=new Set();
  hwFollowups().forEach(hw=>hw._pending.forEach(s=>pendingStudents.add(s.id)));
  const active=VIS().filter(s=>s.status==="مستمر");
  const lastVals=active.map(s=>lastVal((S.grades[s.id]||{})[MYSUB()]||{},s.grade)).filter(v=>v!==null);
  const avgAll=lastVals.length?Math.round(lastVals.reduce((a,b)=>a+b,0)/lastVals.length):null;
  const improved=active.map(s=>({s,t:trendOf((S.grades[s.id]||{})[MYSUB()]||{},s.grade)})).filter(x=>x.t!==null&&x.t>0).sort((a,b)=>b.t-a.t)[0];
  const lines=[];
  lines.push('لديك اليوم <b>'+lessonsToday+'</b> '+(lessonsToday===1?'حصة':'حصص')+'.');
  if(pendingStudents.size>0)lines.push('<b>'+pendingStudents.size+'</b> طالب لم يسلّموا واجبات مستحقة.');
  if(avgAll!==null)lines.push('متوسط آخر الدرجات المرصودة لكل طلبتك: <b>'+avgAll+'</b>.');
  if(improved)lines.push('الأكثر تحسناً هذه الفترة: <b>'+esc(improved.s.name)+'</b> (+'+improved.t+').');
  return '<div class="briefCard">'+
    '<div class="briefHead">'+greeting+' يا أستاذ '+esc((S.settings.teacher||"").split(" ")[0]||"")+' 🌹</div>'+
    '<ul class="briefList">'+lines.map(l=>'<li>'+l+'</li>').join("")+'</ul>'+
  '</div>';
}
function renderHome(){
  const t=S.attendance[todayStr()]||{};
  const vals=Object.values(t);
  const present=vals.filter(v=>v==="حاضر").length, absent=vals.filter(v=>v==="غائب").length;
  const male=VIS().filter(s=>s.gender==="ذكر").length;
  const myGrades=gradesFor(S.curInst||INSTS()[0]);
  const max=Math.max(1,...myGrades.map(g=>VIS().filter(s=>s.grade===g).length));
  const todayLessons=S.timetable.filter(x=>x.day===new Date().getDay());
  const attTakenToday=todayLessons.some(les=>{
    const list=VIS().filter(s=>s.grade===les.grade&&s.section===les.section);
    return list.some(s=>t[s.id]!==undefined);
  });
  el("content").innerHTML=
    (canSave?"":'<div class="notice">⚠️ المتصفح مانع التخزين المحلي — البيانات ما تنحفظ تلقائياً. استخدم زر «نسخة احتياطية» قبل ما تسكّر، وزر «استيراد» حتى ترجّعها.</div>')+
    backupBanner()+
    morningBriefHTML()+
    (!(S.settings.sync&&S.settings.sync.userId)?'<div class="notice" id="homeAcctNotice" style="cursor:pointer">👤 ما سجّلت دخول بحساب بعد — اضغط هنا لتسجيل الدخول أو إنشاء حسابك (معلم/طالب/ولي أمر)</div>':"")+
    (todayLessons.length>0&&!attTakenToday?'<div class="notice" style="background:#FDECEC;border-color:#F3C7C4;color:#8A2E2E">📋 عندك حصص اليوم ولسا ما سجّلت حضور — اضغط أي حصة أدناه لتسجيله.</div>':"")+
    '<h2 class="h">📊 لوحة المتابعة</h2>'+
    '<h3 class="h2" style="margin-top:0">⚡ إجراءات سريعة</h3>'+
    '<div class="quickActions">'+
      '<button class="qaBtn" id="qaAtt"><span class="qaIcon">✓</span><span>تسجيل حضور</span></button>'+
      '<button class="qaBtn" id="qaAddStudent"><span class="qaIcon">👤+</span><span>إضافة طالب</span></button>'+
      '<button class="qaBtn" id="qaExam"><span class="qaIcon">📝</span><span>امتحان جديد</span></button>'+
      '<button class="qaBtn" id="qaPayments"><span class="qaIcon">💰</span><span>الأقساط</span></button>'+
    '</div>'+
    '<h3 class="h2">🗓 حصص اليوم — '+DAYS[new Date().getDay()]+'</h3>'+
    '<div id="lessonsBox"></div>'+
    '<button class="btn ghost full" id="ttBtn" style="margin-top:8px">إدارة جدول الحصص الأسبوعي</button>'+
    '<div class="cards">'+
      '<div class="card big"><div class="num">'+VIS().length+'</div><div class="lbl">إجمالي الطلبة</div></div>'+
      '<div class="card"><div class="num">'+male+'</div><div class="lbl">ذكور</div></div>'+
      '<div class="card"><div class="num">'+(VIS().length-male)+'</div><div class="lbl">إناث</div></div>'+
      '<div class="card ok"><div class="num">'+present+'</div><div class="lbl">حاضر اليوم</div></div>'+
      '<div class="card bad"><div class="num">'+absent+'</div><div class="lbl">غائب اليوم</div></div>'+
    '</div>'+
    '<h3 class="h2">الطلبة حسب الصف</h3>'+
    '<div class="bars">'+myGrades.map(g=>{
      const n=VIS().filter(s=>s.grade===g).length;
      return '<div class="barRow"><span>'+g+'</span><div class="barTrack"><div class="barFill" style="width:'+(n/max*100)+'%"></div></div><span class="barNum">'+n+'</span></div>';
    }).join("")+'</div>'+
    (VIS().length===0?'<p class="empty">لا يوجد طلبة بعد — افتح تبويب «الطلبة» وأضف أول طالب.</p>':"")+
    '<h3 class="h2">⚠️ إنذارات الغياب — الحد: <input id="absLim" class="limIn" inputmode="numeric" value="'+(S.settings.absLimit||5)+'"> أيام</h3>'+
    '<div id="alertBox"></div>'+
    '<h3 class="h2">🌟 الطلبة المتفوقون (90 فأكثر)</h3>'+
    '<div id="topBox"></div>'+
    '<h3 class="h2">📉 طلبة معرّضون للرسوب (دون 50)</h3>'+
    '<div id="riskBox"></div>'+
    '<div id="hwFollowBox"></div>';
  el("bkNow")&&(el("bkNow").onclick=()=>exportBackup());
  el("absLim").onchange=e=>{
    const v=Math.max(1,parseInt(e.target.value)||5);
    e.target.value=v;S.settings.absLimit=v;save.settings();renderAlerts();
  };
  el("ttBtn").onclick=openTimetable;
  el("qaAtt").onclick=()=>goToTab("attendance");
  el("qaAddStudent").onclick=()=>{goToTab("students");openForm(null)};
  el("qaExam").onclick=()=>openExamBuilder();
  el("qaPayments").onclick=()=>goToTab("payments");
  const homeAcctNotice=el("homeAcctNotice");
  if(homeAcctNotice)homeAcctNotice.onclick=openSyncSheet;
  renderLessons();
  renderAlerts();
  renderTopBox();
  renderRiskBox();
  renderHwFollow();
}
function renderTopBox(){
  const list=VIS().filter(s=>s.status==="مستمر").map(s=>{
    const rec=(S.grades[s.id]||{})[MYSUB()]||{};
    return {s,last:lastVal(rec,s.grade)};
  }).filter(x=>x.last!==null&&x.last>=90).sort((a,b)=>b.last-a.last);
  el("topBox").innerHTML=list.length===0?
    '<p class="empty">ما فيه طلبة وصلوا 90 بعد — تشجيعهم شوي 💪</p>':
    '<ul class="slist">'+list.map(({s,last})=>
      '<li class="srow" data-id="'+s.id+'">'+
        '<div class="sinfo"><div class="sname">'+esc(s.name)+'</div>'+
        '<div class="smeta">'+s.grade+' — '+secTerm(instOf(s))+' '+s.section+'</div></div>'+
        '<span class="chip ok">آخر درجة: '+fmt(last)+'</span></li>').join("")+'</ul>';
  el("topBox").querySelectorAll(".srow").forEach(r=>r.onclick=()=>openDetail(r.dataset.id));
}
function renderRiskBox(){
  const list=VIS().filter(s=>s.status==="مستمر").map(s=>{
    const rec=(S.grades[s.id]||{})[MYSUB()]||{};
    return {s,last:lastVal(rec,s.grade)};
  }).filter(x=>x.last!==null&&x.last<50).sort((a,b)=>a.last-b.last);
  el("riskBox").innerHTML=list.length===0?
    '<p class="empty">لا يوجد طلبة دون درجة النجاح حالياً 👍</p>':
    '<ul class="slist">'+list.map(({s,last})=>
      '<li class="srow alertRow" data-id="'+s.id+'">'+
        '<div class="sinfo"><div class="sname">'+esc(s.name)+'</div>'+
        '<div class="smeta">'+s.grade+' — '+secTerm(instOf(s))+' '+s.section+'</div></div>'+
        '<span class="chip bad">آخر درجة: '+fmt(last)+'</span></li>').join("")+'</ul>';
  el("riskBox").querySelectorAll(".srow").forEach(r=>r.onclick=()=>openDetail(r.dataset.id));
}
function renderSettings(){
  el("content").innerHTML=
    '<h2 class="h">⚙️ الإعدادات</h2>'+

    '<h3 class="h2" style="margin-top:0">🎨 مظهر التطبيق</h3>'+
    '<label style="font-size:11.5px;margin-bottom:10px">نوع خط واجهة التطبيق (كل الشاشات، مو الطباعة)<select id="setAppFont">'+PRINT_FONT_OPTIONS.map(f=>'<option value="'+f.id+'"'+((S.settings.appFont||"tajawal")===f.id?" selected":"")+'>'+f.label+'</option>').join("")+'</select></label>'+

    '<h3 class="h2">👤 إعداداتي الأساسية</h3>'+
    '<div class="filters"><input id="setTeacher" placeholder="اسم المدرس" value="'+esc(S.settings.teacher||"")+'"><input id="setSubject" placeholder="المادة التي تدرّسها" value="'+esc(S.settings.subject||"")+'"></div>'+

    '<div class="filters" style="grid-template-columns:1fr"><input id="setAcadYear" placeholder="السنة الدراسية (تلقائي: '+academicYearStr()+')" value="'+esc(S.settings.acadYear||"")+'"></div>'+
    '<button class="btn ghost full" id="instBtn" style="margin-top:0">🏫 إدارة مؤسساتي — إضافة مدرسة أو معهد</button>'+
    '<button class="btn ghost full" id="gwBtn" style="margin-top:0">⚖️ تقسيم الدرجات — خصّصه حسب نظام مادتك</button>'+

    '<h3 class="h2">🧰 أدوات إضافية</h3>'+
    (featureOn("exams")?'<button class="btn ghost full" id="examsBtn" style="margin-top:0">📝 الامتحانات اليومية الإلكترونية</button>':'')+
    (featureOn("stats")?'<button class="btn ghost full" id="statsBtn" style="margin-top:0">📊 صفحة الإحصاءات الكاملة</button>':'')+
    (featureOn("honor")?'<button class="btn ghost full" id="honorBtn" style="margin-top:0">🏆 لوحة الشرف وشهادات التقدير</button>':'')+
    (featureOn("plot")?'<button class="btn ghost full" id="plotBtn" style="margin-top:0">📈 رسم الدوال الرياضية</button>':'')+
    (featureOn("calendar")?'<button class="btn ghost full" id="calBtn" style="margin-top:0">📅 التقويم الدراسي</button>':'')+
    (featureOn("examBuilder")?'<button class="btn ghost full" id="examBuilderBtn" style="margin-top:0">📝 إعداد وطباعة ورقة أسئلة</button>':'')+
    (featureOn("qbank")?'<button class="btn ghost full" id="qbankBtn" style="margin-top:0">📚 بنك الأسئلة</button>':'')+

    '<h3 class="h2">🎨 هوية مخرجات PDF</h3>'+
    '<p class="empty" style="padding:2px 4px 7px;font-size:11px">خصص محتوى الرأس والتذييل لجميع التقارير. الحقول الفارغة تستخدم بيانات التقرير تلقائياً.</p>'+
    '<div class="filters">'+
      '<label style="font-size:11.5px">نمط الرأس<select id="setPrintHeaderStyle"><option value="premium"'+(((S.settings.printDesign||{}).headerStyle||"premium")==="premium"?" selected":"")+'>فاخر</option><option value="professional"'+(((S.settings.printDesign||{}).headerStyle||"premium")==="professional"?" selected":"")+'>رسمي</option><option value="minimal"'+(((S.settings.printDesign||{}).headerStyle||"premium")==="minimal"?" selected":"")+'>مختصر</option></select></label>'+
      '<label style="font-size:11.5px">قوة الزخرفة<select id="setPrintOrnament"><option value="strong"'+(((S.settings.printDesign||{}).ornament||"strong")==="strong"?" selected":"")+'>واضحة</option><option value="medium"'+(((S.settings.printDesign||{}).ornament||"strong")==="medium"?" selected":"")+'>متوسطة</option><option value="soft"'+(((S.settings.printDesign||{}).ornament||"strong")==="soft"?" selected":"")+'>هادئة</option></select></label>'+
    '</div>'+
    '<div class="filters"><input id="setPrintHeaderTitle" placeholder="عنوان ثابت للرأس — اتركه فارغاً لاستخدام عنوان التقرير" value="'+esc((S.settings.printDesign||{}).headerTitle||"")+'"><input id="setPrintHeaderSubtitle" placeholder="السطر الفرعي — مثال: العام الدراسي 2026-2027" value="'+esc((S.settings.printDesign||{}).headerSubtitle||"")+'"></div>'+
    '<div class="filters"><input id="setPrintHeaderRight" placeholder="نص جهة الشعار — فارغ: اسم المؤسسة" value="'+esc((S.settings.printDesign||{}).headerRight||"")+'"><input id="setPrintHeaderNote" placeholder="سطر إضافي اختياري في الرأس" value="'+esc((S.settings.printDesign||{}).headerNote||"")+'"></div>'+
    '<div class="filters"><label style="font-size:11.5px">اللون الأساسي<input type="color" id="setPrintPrimary" value="'+esc((S.settings.printDesign||{}).primaryColor||"#075968")+'"></label><label style="font-size:11.5px">اللون الذهبي<input type="color" id="setPrintAccent" value="'+esc((S.settings.printDesign||{}).accentColor||"#D4AF37")+'"></label></div>'+
    '<div class="filters"><input id="setPrintFooterRight" placeholder="يمين التذييل — فارغ: اسم المدرس" value="'+esc((S.settings.printDesign||{}).footerRight||"")+'"><input id="setPrintFooterCenter" placeholder="وسط التذييل — عبارة أو شعار مختصر" value="'+esc((S.settings.printDesign||{}).footerCenter||"بالعلم نرتقي")+'"></div>'+
    '<div class="filters"><input id="setPrintFooterLeft" placeholder="يسار التذييل — فارغ: اسم المؤسسة" value="'+esc((S.settings.printDesign||{}).footerLeft||"")+'"><label style="font-size:11.5px;display:flex;align-items:center;gap:8px"><input type="checkbox" id="setPrintPageNum" style="width:auto"'+((S.settings.printDesign||{}).showPageNumber===false?"":" checked")+'>إظهار رقم الصفحة</label></div>'+
    '<div class="filters" style="grid-template-columns:1fr"><label style="font-size:11.5px;display:flex;align-items:center;gap:8px"><input type="checkbox" id="setPrintFillPage" style="width:auto"'+((S.settings.printDesign||{}).fillExamPage===false?"":" checked")+'>توزيع الأسئلة لملء الصفحة تلقائياً عند توفر مساحة كافية</label></div>'+
    '<div class="actions"><button class="btn ghost" id="printDesignReset">↩️ استعادة الافتراضي</button><button class="btn" id="printDesignSave">💾 حفظ هوية PDF</button></div>'+

    '<h3 class="h2">🖨️ تخصيص خط الطباعة</h3>'+
    '<p class="empty" style="padding:2px 4px 6px;font-size:11px">يتحكم بنوع وحجم الخط بترويسة وتذييل أوراق الأسئلة المطبوعة. حجم منتصف الرأس أكبر افتراضيًا من الأطراف.</p>'+
    '<label style="font-size:11.5px;margin-bottom:8px">نوع الخط<select id="setFontFamily">'+PRINT_FONT_OPTIONS.map(f=>'<option value="'+f.id+'"'+((S.settings.printFont?.family||"tajawal")===f.id?" selected":"")+'>'+f.label+'</option>').join("")+'</select></label>'+
    '<div class="filters">'+
      '<label style="font-size:11.5px">حجم خط منتصف الرأس (العنوان)<input type="number" id="setFontHeadCenter" min="12" max="34" value="'+(S.settings.printFont?.headerCenter||19)+'"></label>'+
      '<label style="font-size:11.5px">حجم خط أطراف الرأس (المدرسة/الصف)<input type="number" id="setFontHeadSide" min="8" max="20" value="'+(S.settings.printFont?.headerSide||11)+'"></label>'+
    '</div>'+
    '<div class="filters" style="grid-template-columns:1fr">'+
      '<label style="font-size:11.5px">حجم خط شريط التذييل السفلي<input type="number" id="setFontFooter" min="7" max="16" value="'+(S.settings.printFont?.footer||9.5)+'"></label>'+
    '</div>'+
    '<button class="btn ghost full" id="fontResetBtn" style="margin-top:0">↩️ إرجاع أحجام الخط الافتراضية</button>'+
    '<div class="filters" style="grid-template-columns:1fr;margin-top:10px">'+
      '<label style="font-size:11.5px">هامش أمان الطباعة (مم) — زوّده لو تطلع صفحة ثانية زايدة عندك<input type="number" id="setPrintSafety" min="0" max="100" step="1" value="'+(Number(S.settings.printSafetyMM)||6)+'"></label>'+
    '</div>'+

    '<h3 class="h2" style="margin-top:0">👤 حسابي</h3>'+
    '<button class="btn full" id="acctBtn" style="margin-top:0">'+(S.settings.sync&&S.settings.sync.userId?"👤 حسابي — "+(ROLE_LABEL[S.settings.accountRole]||"معلم")+" ("+esc(S.settings.sync.email||"")+")":"👤 تسجيل الدخول / إنشاء حساب")+'</button>'+

    '<h3 class="h2">🔒 الهوية والأمان</h3>'+
    '<button class="btn ghost full" id="sigBtn" style="margin-top:0">'+(S.settings.signature?"✍️ تعديل التوقيع الحي":"✍️ إضافة توقيع حي للتقارير")+'</button>'+
    '<button class="btn ghost full" id="ctBtn" style="margin-top:0">📇 بطاقة التواصل — هاتفي وحساباتي بالتقارير</button>'+
    '<button class="btn ghost full" id="pinBtn" style="margin-top:0">'+((S.settings.pinHash||S.settings.pin)?"🔒 تغيير أو إزالة رمز القفل":"🔓 تفعيل رمز قفل التطبيق")+'</button>'+

    '<h3 class="h2">☁️ البيانات والنسخ الاحتياطي</h3>'+
    (featureOn("archive")?'<button class="btn ghost full" id="arcBtn" style="margin-top:0">📦 أرشيف السنوات — طي السنة وبدء جديدة</button>':'')+
    '<button class="btn ghost full" id="syncBtn" style="margin-top:0">'+(syncOn()?"☁️ المزامنة التلقائية مفعّلة ✓":"☁️ تفعيل المزامنة التلقائية بين الأجهزة")+'</button>'+
    (S.settings.lastBackup?'<p class="empty" style="padding:2px 4px;font-size:11px">آخر نسخة احتياطية: '+S.settings.lastBackup+'</p>':'')+
    '<div class="actions"><button class="btn ghost" id="bkShare">📤 مزامنة لجهاز آخر</button><button class="btn ghost" id="bkExp">⬇ نسخة احتياطية</button><button class="btn ghost" id="bkImp">⬆ استيراد نسخة</button></div>'+

    '<h3 class="h2">❔ المساعدة والتخصيص</h3>'+
    '<button class="btn ghost full" id="tourBtn" style="margin-top:0">🎓 جولة تعريفية بالتطبيق</button>'+
    '<button class="btn ghost full" id="wizardBtn" style="margin-top:0">🧭 إعادة تشغيل مساعد الإعداد</button>'+
    '<button class="btn ghost full" id="pluginsBtn" style="margin-top:0">🧩 تخصيص الميزات الظاهرة</button>'+
    '<div style="text-align:center;padding:22px 10px 8px;color:#94A3B8;font-size:11.5px;line-height:1.8">'+
      '<b style="display:block;font-size:13px;color:var(--green2)">مسار</b>'+
      'تطوير الأستاذ فائز جواد الحمداني<br>جميع الحقوق محفوظة © '+new Date().getFullYear()+
    '</div>';
  el("setAppFont").onchange=e=>{
    S.settings.appFont=e.target.value;save.settings();applyAppFont();toast("تم تغيير خط التطبيق ✓");
  };
  el("setTeacher").onchange=e=>{S.settings.teacher=e.target.value.trim();save.settings()};
  el("setAcadYear").onchange=e=>{S.settings.acadYear=e.target.value.trim();save.settings();el("yearLbl").textContent=academicYearStr()+" · v"+APP_VER;toast("تم تحديث السنة الدراسية")};
  el("setSubject").onchange=e=>{S.settings.subject=e.target.value.trim();save.settings();if(S.settings.subject)toast("تم تغيير المادة إلى "+S.settings.subject)};
  const savePrintDesign=()=>{
    S.settings.printDesign={
      headerStyle:el("setPrintHeaderStyle").value,
      ornament:el("setPrintOrnament").value,
      headerTitle:el("setPrintHeaderTitle").value.trim(),
      headerSubtitle:el("setPrintHeaderSubtitle").value.trim(),
      headerRight:el("setPrintHeaderRight").value.trim(),
      headerNote:el("setPrintHeaderNote").value.trim(),
      primaryColor:el("setPrintPrimary").value,
      accentColor:el("setPrintAccent").value,
      footerRight:el("setPrintFooterRight").value.trim(),
      footerCenter:el("setPrintFooterCenter").value.trim(),
      footerLeft:el("setPrintFooterLeft").value.trim(),
      showPageNumber:el("setPrintPageNum").checked,
      fillExamPage:el("setPrintFillPage").checked
    };
    save.settings();toast("تم حفظ تخصيص الرأس والتذييل ✓");
  };
  el("printDesignSave").onclick=savePrintDesign;
  el("printDesignReset").onclick=()=>{delete S.settings.printDesign;save.settings();toast("تمت استعادة هوية الطباعة الافتراضية");renderSettings()};
  const savePrintFont=()=>{
    S.settings.printFont={
      family:el("setFontFamily").value,
      headerCenter:Number(el("setFontHeadCenter").value)||19,
      headerSide:Number(el("setFontHeadSide").value)||11,
      footer:Number(el("setFontFooter").value)||9.5
    };
    save.settings();
    toast("تم حفظ تخصيص خط الطباعة");
  };
  el("setFontFamily").onchange=savePrintFont;
  el("setFontHeadCenter").onchange=savePrintFont;
  el("setFontHeadSide").onchange=savePrintFont;
  el("setFontFooter").onchange=savePrintFont;
  const savePrintSafety=e=>{
    S.settings.printSafetyMM=Number(e.target.value)||6;
    save.settings();
    toast("تم حفظ هامش أمان الطباعة: "+S.settings.printSafetyMM+"مم");
  };
  el("setPrintSafety").oninput=savePrintSafety;
  el("setPrintSafety").onchange=savePrintSafety;
  el("fontResetBtn").onclick=()=>{
    delete S.settings.printFont;
    save.settings();
    toast("تم إرجاع أحجام الخط الافتراضية");
    renderSettings();
  };
  el("instBtn").onclick=openInstSheet;
  el("gwBtn").onclick=openGradeWeightsSheet;
  if(el("examsBtn"))el("examsBtn").onclick=openExamsSheet;
  if(el("statsBtn"))el("statsBtn").onclick=()=>{goToTab("stats")};
  if(el("honorBtn"))el("honorBtn").onclick=openHonorBoard;
  if(el("plotBtn"))el("plotBtn").onclick=openFunctionPlotter;
  if(el("calBtn"))el("calBtn").onclick=openCalendar;
  if(el("examBuilderBtn"))el("examBuilderBtn").onclick=openExamBuilder;
  if(el("qbankBtn"))el("qbankBtn").onclick=()=>openQuestionBank(false);
  el("sigBtn").onclick=openSignatureSheet;
  el("ctBtn").onclick=openContactSheet;
  el("pinBtn").onclick=openPinSheet;
  if(el("arcBtn"))el("arcBtn").onclick=openArchive;
  el("syncBtn").onclick=openSyncSheet;
  el("acctBtn").onclick=openSyncSheet;
  el("tourBtn").onclick=openOnboarding;
  el("wizardBtn").onclick=openSetupWizard;
  el("pluginsBtn").onclick=openPluginsSheet;
  el("bkExp").onclick=()=>exportBackup();
  el("bkImp").onclick=()=>el("importFile").click();
  el("bkShare").onclick=shareBackup;
}
function hwFollowups(){
  const today=todayStr();
  const weekAgo=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  return S.homework.filter(h=>{
    if(h.notified)return false;
    if(h.date>=today||h.date<weekAgo)return false;
    const pending=hwClassStudents(h).filter(s=>!(h.done&&h.done[s.id])&&(!S.curInst||instOf(s)===S.curInst));
    h._pending=pending;
    return pending.length>0;
  });
}
function renderHwFollow(){
  const list=hwFollowups();
  el("hwFollowBox").innerHTML=list.length===0?"":
    '<h3 class="h2">📋 واجبات تحتاج متابعة</h3><ul class="slist">'+list.map(h=>
      '<li class="srow noClick"><div class="sinfo"><div class="sname">'+esc(h.title)+'</div>'+
      '<div class="smeta">'+h.grade+' / '+h.section+' — بتاريخ '+h.date+'</div></div>'+
      '<span class="chip warn">'+h._pending.length+' لم يسلّموا</span>'+
      '<button class="wa" data-hf="'+h.id+'">⏰ إبلاغ</button></li>').join("")+'</ul>';
  el("hwFollowBox").querySelectorAll("[data-hf]").forEach(b=>b.onclick=()=>{
    const h=S.homework.find(x=>x.id===b.dataset.hf);if(!h)return;
    const targets=h._pending.map(s=>({s,cardOpts:{badge:"⏰ تذكير بواجب",chip:"تذكير واجب",tone:"warn",filePrefix:"تذكير_واجب",bodyText:hwRemindMsg(h,s)}}));
    openBulkSender("⏰ تذكير غير المسلّمين: "+h.title,targets,(n)=>{
      if(n>0){h.notified=todayStr();save.homework()}
      render();
    });
  });
}
/* ============ بطاقة ما قبل الحصة ============ */
function lastExamVal(rec){
  rec=rec||{};const out=[];
  const pushM=(f,lbl)=>{
    const m=rec[f];
    if(m&&typeof m==="object"){
      (m.d||[]).forEach((v,i)=>{const n=num(v);if(n!==null)out.push({v:n,l:examName(f,i)+" ("+lbl+")"})});
      const w=num(m.w);if(w!==null)out.push({v:w,l:"تحريري "+lbl});
    }else{const n=num(m);if(n!==null)out.push({v:n,l:lbl})}
  };
  pushM("m1","شهر1 ف1");pushM("m2","شهر2 ف1");
  const mid=num(rec.mid);if(mid!==null)out.push({v:mid,l:"نصف السنة"});
  pushM("m3","شهر1 ف2");pushM("m4","شهر2 ف2");
  const fin=num(rec.fin);if(fin!==null)out.push({v:fin,l:"النهائي"});
  return out.length?out[out.length-1]:null;
}
function preClassHTML(grade,section,inst){
  const list=S.students.filter(s=>s.grade===grade&&s.section===section&&s.status==="مستمر"&&(!inst||instOf(s)===inst));
  if(!list.length)return '<p class="empty" style="padding:6px">لا يوجد طلبة مستمرون بهذا الصف.</p>';
  const ids=new Set(list.map(s=>s.id)),today=todayStr();
  // غائبو آخر يوم دوام مسجّل
  const dates=Object.keys(S.attendance).filter(d=>d<today&&Object.keys(S.attendance[d]).some(id=>ids.has(id))).sort();
  const lastD=dates.length?dates[dates.length-1]:null;
  const absents=lastD?list.filter(s=>S.attendance[lastD][s.id]==="غائب"):[];
  // آخر واجب للصف
  const hws=S.homework.filter(h=>h.grade===grade&&h.section===section&&h.date<=today).sort((a,b)=>a.date<b.date?1:-1);
  const hw=hws[0];
  const pend=hw?list.filter(s=>!(hw.done&&hw.done[s.id])):[];
  // متوسط آخر تقييم مرصود
  const vals=list.map(s=>lastExamVal((S.grades[s.id]||{})[MYSUB()])).filter(x=>x!==null);
  const avg=vals.length?vals.reduce((a,b)=>a+b.v,0)/vals.length:null;
  const chips=arr=>arr.map(s=>'<span class="preChip">'+esc(s.name.split(" ").slice(0,2).join(" "))+'</span>').join("");
  return ''+
    '<div class="preH">🚶 غائبو آخر دوام'+(lastD?' <span class="preD">('+lastD+')</span>':'')+'</div>'+
    (lastD?(absents.length?'<div class="preChips">'+chips(absents)+'</div>':'<div class="preOk">لا غيابات — حضور كامل ✓</div>'):'<div class="preOk">لا يوجد تحضير سابق مسجّل</div>')+
    '<div class="preH">📋 لم يسلّموا آخر واجب'+(hw?' <span class="preD">«'+esc(hw.title)+'»</span>':'')+'</div>'+
    (hw?(pend.length?'<div class="preChips">'+chips(pend)+'</div>':'<div class="preOk">الجميع سلّموا ✓</div>'):'<div class="preOk">لا توجد واجبات مسجّلة لهذا الصف</div>')+
    '<div class="preH">📈 متوسط آخر تقييم مرصود</div>'+
    (avg!==null?'<div class="preAvg"><b>'+fmt(avg)+'</b> من 100 — لدى '+vals.length+' من '+list.length+' طالب'+(avg>=50?'':' ⚠️')+'</div>':'<div class="preOk">لا توجد درجات مرصودة بعد</div>');
}
function renderLessons(){
  const today=new Date().getDay();
  const lessons=S.timetable.filter(t=>t.day===today).sort((a,b)=>((a.shift||"صباحي")===(b.shift||"صباحي")?a.period-b.period:((a.shift||"صباحي")==="صباحي"?-1:1)));
  el("lessonsBox").innerHTML=lessons.length===0?
    '<p class="empty">لا توجد حصص اليوم'+(S.timetable.length===0?' — أضف جدولك من الزر أدناه':'')+' 😌</p>':
    lessons.map((t,i)=>
      '<div class="lessonCard" data-goatt="'+i+'">'+
        '<div class="lessonNum">'+t.period+'</div>'+
        '<div class="lessonInfo"><div class="lessonTitle">'+(t.shift==="مسائي"?"🌙":"☀️")+' '+t.grade+' — '+secTerm(t.inst||S.curInst)+' '+t.section+'</div>'+
        (INSTS().length>1&&t.inst?'<div class="lessonMeta">🏫 '+esc(t.inst)+'</div>':'')+'</div>'+
        '<div class="attBtns">'+
          '<button class="att" data-pre="'+i+'" title="بطاقة ما قبل الحصة">📌</button>'+
          '<button class="att" data-go="grades|'+t.grade+'|'+t.section+'" title="الدرجات">٪</button>'+
          '<button class="att" data-go="homework|'+t.grade+'|'+t.section+'" title="الواجبات">📋</button>'+
        '</div>'+
      '</div><div class="preBox" id="preBox'+i+'" style="display:none"></div>').join("");
  el("lessonsBox").querySelectorAll("[data-pre]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const i=Number(b.dataset.pre),t=lessons[i],box=el("preBox"+i);
    if(box.style.display==="none"){
      box.innerHTML='<div class="preTitle">🎴 بطاقة ما قبل الحصة — '+t.grade+' / '+t.section+'</div>'+preClassHTML(t.grade,t.section,t.inst||S.curInst);
      box.style.display="block";
    }else box.style.display="none";
  });
  el("lessonsBox").querySelectorAll("[data-go]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const p=b.dataset.go.split("|");
    if(p[0]==="grades"){S.gGrade=p[1];S.gSection=p[2];S.evalSub="grades"}
    else{S.hGrade=p[1];S.hSection=p[2];S.evalSub="homework"}
    goToTab("evaluation");
  });
  el("lessonsBox").querySelectorAll("[data-goatt]").forEach(card=>card.onclick=()=>{
    const t=lessons[Number(card.dataset.goatt)];
    S.aGrade=t.grade;S.aSection=t.section;S.aDate=todayStr();
    if(INSTS().length>1&&t.inst&&S.curInst!==t.inst){S.curInst=t.inst;updateHeader();}
    goToTab("attendance");
  });
}
/* ============ أوقات الحصص ============ */
function periodTime(period,shift){
  const key=shift==="مسائي"?"evening":"morning";
  const t=(S.settings.periodTimes||{})[key]||{};
  return t[period]||null;
}
function periodTimeStr(period,shift){
  const t=periodTime(period,shift);
  return (t&&t.start&&t.end)?(t.start+" - "+t.end):"";
}
function hasPeriodTimes(){
  const pt=S.settings.periodTimes;
  if(!pt)return false;
  return Object.values(pt).some(shiftObj=>Object.values(shiftObj||{}).some(t=>t&&t.start&&t.end));
}
function openGradeWeightsSheet(){
  let curGrade=""; // "" = الإعداد الافتراضي لكل المراحل
  const draw=()=>{
    const overrides=S.settings.gradeConfigByGrade||{};
    const hasOverride=curGrade&&!!overrides[curGrade];
    const gw=gradeWeights(curGrade||undefined);
    const lw=languageWeights(curGrade||undefined);
    const mode=gradeMode(curGrade||undefined);
    el("modal").innerHTML=
    '<div class="overlay"><div class="sheet">'+
      '<div class="sheetHead"><h3>⚖️ تقسيم الدرجات</h3><button class="x" id="gwX">✕</button></div>'+
      '<div class="form">'+
        '<p class="empty" style="padding:6px;font-size:11.5px">خصّص كيف تُحسب الدرجات — الإعداد الافتراضي يطبَّق على كل المراحل، وتقدر تسوي استثناء خاص لمرحلة معينة إذا نظامها مختلف (مثل الصف المنتهي).</p>'+
        '<label>الإعداد لمرحلة<select id="gwGrade"><option value="">🌐 الإعداد الافتراضي (كل المراحل)</option>'+
          GRADES.map(g=>'<option value="'+esc(g)+'"'+(curGrade===g?" selected":"")+'>'+(overrides[g]?"⭐ ":"")+esc(g)+'</option>').join("")+
        '</select></label>'+
        (curGrade?'<p class="empty" style="padding:4px 6px;font-size:11px">'+(hasOverride?'✓ هذه المرحلة عندها استثناء خاص بها الآن.':'لسا تستخدم الإعداد الافتراضي — عدّل أي قيمة بالأسفل حتى ينشأ استثناء خاص بهذه المرحلة.')+'</p>':'')+
        '<label>نظام درجة الشهر<select id="gwMode">'+
          '<option value="standard"'+(mode==="standard"?" selected":"")+'>📐 قياسي (يومي + تحريري)</option>'+
          '<option value="language"'+(mode==="language"?" selected":"")+'>🗣️ مهارات لغة (إصغاء/قراءة/محادثة/تحريري)</option>'+
        '</select></label>'+
        (mode==="language"?
          '<div class="subCard">'+
            '<div class="subHead"><span class="subName">توزيع درجة الشهر (100 درجة)</span></div>'+
            '<div class="grid2">'+
              '<label style="font-size:11px">🎧 إصغاء<input type="number" id="lwListen" min="0" max="100" value="'+lw.listen+'"></label>'+
              '<label style="font-size:11px">📖 قراءة<input type="number" id="lwRead" min="0" max="100" value="'+lw.read+'"></label>'+
              '<label style="font-size:11px">🗣️ محادثة<input type="number" id="lwSpeak" min="0" max="100" value="'+lw.speak+'"></label>'+
              '<label style="font-size:11px">✍️ تحريري<input type="number" id="lwWritten" min="0" max="100" value="'+lw.written+'"></label>'+
            '</div>'+
            '<p id="lwSumMsg" class="empty" style="padding:6px;font-size:11px"></p>'+
          '</div>':
          '<div class="subCard">'+
            '<div class="subHead"><span class="subName">درجة الشهر: اليومي مقابل التحريري</span></div>'+
            '<div style="display:flex;align-items:center;gap:10px;padding:6px 4px">'+
              '<span style="font-size:11.5px;min-width:70px">يومي <b id="gwDailyLbl">'+gw.daily+'</b>%</span>'+
              '<input type="range" id="gwDaily" min="0" max="100" step="5" value="'+gw.daily+'" style="flex:1">'+
              '<span style="font-size:11.5px;min-width:70px">تحريري <b id="gwWrittenLbl">'+gw.written+'</b>%</span>'+
            '</div>'+
          '</div>')+
        '<div class="subCard">'+
          '<div class="subHead"><span class="subName">الدرجة النهائية: السعي مقابل الامتحان النهائي</span></div>'+
          '<div style="display:flex;align-items:center;gap:10px;padding:6px 4px">'+
            '<span style="font-size:11.5px;min-width:70px">السعي <b id="gwSaayLbl">'+gw.saay+'</b>%</span>'+
            '<input type="range" id="gwSaay" min="0" max="100" step="5" value="'+gw.saay+'" style="flex:1">'+
            '<span style="font-size:11.5px;min-width:70px">النهائي <b id="gwFinalLbl">'+gw.final+'</b>%</span>'+
          '</div>'+
        '</div>'+
        '<button class="btn ghost full" id="gwReset" style="margin-top:0">↺ '+(curGrade?'حذف استثناء هذه المرحلة (رجوع للافتراضي)':'إرجاع الافتراضي لإعداداته الأصلية')+'</button>'+
      '</div>'+
      '<div class="sheetFoot"><button class="btn" id="gwClose">تم</button></div>'+
    '</div></div>';
    el("gwGrade").onchange=()=>{curGrade=el("gwGrade").value;draw()};
    const writeConfig=(patch)=>{
      if(!curGrade){
        Object.assign(S.settings,patch.top||{});
        save.settings();return;
      }
      S.settings.gradeConfigByGrade=S.settings.gradeConfigByGrade||{};
      const cur=S.settings.gradeConfigByGrade[curGrade]||{};
      S.settings.gradeConfigByGrade[curGrade]=Object.assign(cur,patch.override||{});
      save.settings();
    };
    el("gwMode").onchange=()=>{
      const v=el("gwMode").value;
      writeConfig({top:{gradeMode:v},override:{mode:v}});
      draw();
    };
    const save2=()=>{
      const daily=Number(el("gwDaily")?.value??gw.daily);
      const saay=Number(el("gwSaay").value);
      const gwObj={daily,written:100-daily,saay,final:100-saay};
      writeConfig({top:{gradeWeights:gwObj},override:{gradeWeights:gwObj}});
    };
    if(el("gwDaily"))el("gwDaily").oninput=()=>{
      el("gwDailyLbl").textContent=el("gwDaily").value;
      el("gwWrittenLbl").textContent=100-Number(el("gwDaily").value);
      save2();
    };
    el("gwSaay").oninput=()=>{
      el("gwSaayLbl").textContent=el("gwSaay").value;
      el("gwFinalLbl").textContent=100-Number(el("gwSaay").value);
      save2();
    };
    if(mode==="language"){
      const checkSum=()=>{
        const vals=["lwListen","lwRead","lwSpeak","lwWritten"].map(id=>Number(el(id).value)||0);
        const sum=vals.reduce((a,b)=>a+b,0);
        el("lwSumMsg").textContent=sum===100?"✓ المجموع 100 بالضبط":"⚠️ المجموع الحالي "+sum+" — يفضّل يكون 100";
        el("lwSumMsg").style.color=sum===100?"#1E7A4C":"#B3453F";
        const lwObj={listen:vals[0],read:vals[1],speak:vals[2],written:vals[3]};
        writeConfig({top:{languageWeights:lwObj},override:{languageWeights:lwObj}});
      };
      ["lwListen","lwRead","lwSpeak","lwWritten"].forEach(id=>el(id).oninput=checkSum);
      checkSum();
    }
    el("gwReset").onclick=()=>{
      if(curGrade){
        if(S.settings.gradeConfigByGrade)delete S.settings.gradeConfigByGrade[curGrade];
        save.settings();toast("تم حذف استثناء هذه المرحلة ✓");
      }else{
        S.settings.gradeMode="standard";
        S.settings.gradeWeights={daily:50,written:50,saay:50,final:50};
        S.settings.languageWeights={listen:10,read:10,speak:10,written:70};
        save.settings();toast("تمت الإعادة للافتراضي ✓");
      }
      draw();
    };
    el("gwX").onclick=el("gwClose").onclick=closeModal;
  };
  draw();
}
function openPeriodTimesSheet(){
  const periods=[1,2,3,4,5,6,7,8];
  const row=(shift,p)=>{
    const t=periodTime(p,shift)||{start:"",end:""};
    return '<div class="addRow" style="grid-template-columns:50px 1fr 1fr;align-items:center">'+
      '<span style="font-size:11.5px;font-weight:700;color:#64748B">ح'+p+'</span>'+
      '<input type="time" data-pt="'+shift+'|'+p+'|start" value="'+esc(t.start)+'">'+
      '<input type="time" data-pt="'+shift+'|'+p+'|end" value="'+esc(t.end)+'">'+
    '</div>';
  };
  const quickFill=(shift)=>
    '<div class="quickFillBox">'+
      '<div style="font-size:11px;font-weight:700;color:var(--green2);margin-bottom:6px">⚡ تعبئة سريعة لكل الحصص دفعة وحدة</div>'+
      '<div class="addRow" style="grid-template-columns:1fr 1fr 1fr auto">'+
        '<label style="font-size:10.5px">بداية أول حصة<input type="time" id="qf'+shift+'Start" value="08:00"></label>'+
        '<label style="font-size:10.5px">مدة الحصة (د)<input inputmode="numeric" id="qf'+shift+'Dur" value="45"></label>'+
        '<label style="font-size:10.5px">استراحة بينها (د)<input inputmode="numeric" id="qf'+shift+'Gap" value="0"></label>'+
        '<button class="btn ghost" id="qf'+shift+'Apply" style="align-self:end;font-size:11px;padding:8px 10px">تطبيق</button>'+
      '</div>'+
    '</div>';
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>⏰ أوقات الحصص</h3><button class="x" id="ptX">✕</button></div>'+
    '<div class="form">'+
      '<p class="empty" style="padding:6px;font-size:11.5px">حدّد وقت بداية ونهاية كل حصة، ليظهر تلقائياً بتقارير الحضور والغياب.</p>'+
      '<div class="subCard"><div class="subHead"><span class="subName">☀️ الفترة الصباحية</span></div>'+quickFill("صباحي")+periods.map(p=>row("صباحي",p)).join("")+'</div>'+
      '<div class="subCard"><div class="subHead"><span class="subName">🌙 الفترة المسائية</span></div>'+quickFill("مسائي")+periods.map(p=>row("مسائي",p)).join("")+'</div>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="ptClose">تم</button></div>'+
  '</div></div>';
  el("modal").querySelectorAll("[data-pt]").forEach(inp=>inp.onchange=()=>{
    const[shift,p,part]=inp.dataset.pt.split("|");
    const key=shift==="مسائي"?"evening":"morning";
    S.settings.periodTimes=S.settings.periodTimes||{morning:{},evening:{}};
    S.settings.periodTimes[key][p]=S.settings.periodTimes[key][p]||{start:"",end:""};
    S.settings.periodTimes[key][p][part]=inp.value;
    save.settings();
  });
  ["صباحي","مسائي"].forEach(shift=>{
    el("qf"+shift+"Apply").onclick=()=>{
      const startVal=el("qf"+shift+"Start").value;
      const dur=parseInt(el("qf"+shift+"Dur").value)||45;
      const gap=parseInt(el("qf"+shift+"Gap").value)||0;
      if(!startVal){toast("حدّد وقت بداية أول حصة");return}
      const key=shift==="مسائي"?"evening":"morning";
      S.settings.periodTimes=S.settings.periodTimes||{morning:{},evening:{}};
      let[h,m]=startVal.split(":").map(Number);
      let cursor=h*60+m;
      periods.forEach(p=>{
        const start=cursor,end=cursor+dur;
        const fmt=mins=>String(Math.floor(mins/60)%24).padStart(2,"0")+":"+String(mins%60).padStart(2,"0");
        S.settings.periodTimes[key][p]={start:fmt(start),end:fmt(end)};
        cursor=end+gap;
      });
      save.settings();
      toast("تم تعبئة كل حصص الفترة ال"+shift+" ✓");
      openPeriodTimesSheet();
    };
  });
  el("ptX").onclick=el("ptClose").onclick=closeModal;
}
function openTimetable(){
  let day=new Date().getDay();if(day===5)day=0;
  const needsInstPicker=INSTS().length>1&&!S.curInst;
  const curTtInst=()=>needsInstPicker?(el("ttInst")?el("ttInst").value:INSTS()[0]):(S.curInst||INSTS()[0]);
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>جدول الحصص الأسبوعي'+(S.curInst?' — '+esc(S.curInst):'')+'</h3><button class="x" id="ttx">✕</button></div>'+
    '<div class="form">'+
      '<button class="btn ghost full" id="ptBtn" style="margin-top:0">⏰ إعداد أوقات الحصص (من - إلى)</button>'+
      (hasPeriodTimes()?'':'<p class="empty" style="padding:4px 6px;font-size:11px">💡 لسا ما حدّدت أوقات حصصك — حددها مرة وحدة لتظهر تلقائياً بتقارير الحضور والغياب.</p>')+
      '<div class="grid2"><label>اليوم<select id="ttDay">'+[0,1,2,3,4,6].map(d=>'<option value="'+d+'"'+(d===day?" selected":"")+'>'+DAYS[d]+'</option>').join("")+'</select></label>'+
      '<label>الفترة<select id="ttShift"><option value="صباحي">☀️ صباحي</option><option value="مسائي">🌙 مسائي</option></select></label></div>'+
      (needsInstPicker?'<label>المؤسسة<select id="ttInst">'+opts(INSTS(),INSTS()[0])+'</select></label>':'')+
      '<div class="addRow" style="grid-template-columns:70px 1fr 64px auto">'+
        '<select id="ttPeriod">'+[1,2,3,4,5,6,7,8].map(p=>'<option>'+p+'</option>').join("")+'</select>'+
        '<select id="ttGrade">'+opts(GRADES,GRADES[0])+'</select>'+
        '<select id="ttSection">'+opts(secList(curTtInst()),secList(curTtInst())[0])+'</select>'+
        '<button class="btn" id="ttAdd">+</button>'+
      '</div>'+
      '<div id="ttList" class="payList"></div>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="ttClose">تم</button></div>'+
  '</div></div>';
  const refreshTtSections=()=>{
    const inst=curTtInst();
    el("ttSection").innerHTML=opts(secList(inst),secList(inst)[0]);
  };
  const renderTT=()=>{
    const d=Number(el("ttDay").value);
    const rows=(S.curInst?S.timetable.filter(t=>(t.inst||INSTS()[0])===S.curInst):S.timetable).filter(t=>t.day===d).sort((a,b)=>((a.shift||"صباحي")===(b.shift||"صباحي")?a.period-b.period:((a.shift||"صباحي")==="صباحي"?-1:1)));
    el("ttList").innerHTML=rows.length===0?'<p class="empty" style="padding:10px">لا توجد حصص بهذا اليوم.</p>':
      rows.map(t=>'<div class="behavRow"><span class="bChip p">'+(t.shift==="مسائي"?"🌙":"☀️")+' حصة '+t.period+'</span>'+
        '<div class="bd">'+t.grade+' — '+secTerm(t.inst||S.curInst)+' '+t.section+(!S.curInst&&INSTS().length>1&&t.inst?' — '+esc(t.inst):'')+'</div>'+
        '<button class="bDel" data-ttd="'+t.id+'">✕</button></div>').join("");
    el("ttList").querySelectorAll("[data-ttd]").forEach(b=>b.onclick=()=>{
      S.timetable=S.timetable.filter(x=>x.id!==b.dataset.ttd);
      save.timetable();renderTT();
    });
  };
  el("ttDay").onchange=renderTT;renderTT();
  if(el("ttInst"))el("ttInst").onchange=refreshTtSections;
  el("ttAdd").onclick=()=>{
    const d=Number(el("ttDay").value),p=Number(el("ttPeriod").value),shift=el("ttShift").value;
    const inst=curTtInst();
    if(S.timetable.some(t=>t.day===d&&t.period===p&&(t.shift||"صباحي")===shift&&(t.inst||INSTS()[0])===inst)){toast("الحصة "+p+" ("+shift+") محجوزة بهذا اليوم في "+inst);return}
    S.timetable.push({id:uid(),day:d,period:p,shift,inst,grade:el("ttGrade").value,section:el("ttSection").value});
    save.timetable();renderTT();
  };
  el("ptBtn").onclick=openPeriodTimesSheet;
  el("ttx").onclick=el("ttClose").onclick=()=>{closeModal();if(S.tab==="home")render()};
}
/* ============ المؤسسات ============ */
function renameInst(old,nv){
  nv=(nv||"").trim();
  if(!nv||nv===old)return false;
  if(INSTS().includes(nv)){toast("الاسم موجود مسبقاً");return false}
  S.settings.insts=INSTS().map(x=>x===old?nv:x);
  S.students.forEach(s=>{if(instOf(s)===old)s.inst=nv});
  S.timetable.forEach(t=>{if(t.inst===old)t.inst=nv});
  if(S.settings.instMeta&&S.settings.instMeta[old]){S.settings.instMeta[nv]=S.settings.instMeta[old];delete S.settings.instMeta[old]}
  if(S.curInst===old)S.curInst=nv;
  save.settings();save.students();save.timetable();
  return true;
}
function updateHeader(){
  const sn=el("schoolName");
  if(S.curInst){sn.value=S.curInst;sn.disabled=false}
  else{sn.value="كل مؤسساتي ("+INSTS().length+")";sn.disabled=true}
}
function openInstSheet(){
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>مؤسساتي</h3><button class="x" id="wx">✕</button></div>'+
    '<div class="form">'+
      '<div id="wsList" class="payList"></div>'+
      '<div class="addRow" style="grid-template-columns:1fr auto"><input id="wsName" placeholder="اسم المدرسة/المعهد الجديد"><button class="btn" id="wsAdd">+ إضافة</button></div>'+
      '<input type="file" id="wsLogoFile" accept="image/*" style="display:none">'+
      '<p class="empty" style="padding:8px;font-size:11.5px">اختر مؤسسة لعرض طلبتها فقط، أو «كل مؤسساتي» لنظرة عامة. زر ⚙️ يضبط نوع الخطاب (مدرسة/تدريس خاص) وشعار المؤسسة، و✏️ يعدّل الاسم. رسائل أولياء الأمور تُختم حسب نوع مؤسسة الطالب.</p>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="wsClose">تم</button></div>'+
  '</div></div>';
  let cfgOpen=null;
  const renderWs=()=>{
    const rows=['<div class="behavRow" style="'+(S.curInst===""?'border-color:var(--green);background:var(--okbg)':'')+'">'+
      '<span class="bChip '+(S.curInst===""?'p':'w')+'">'+(S.curInst===""?'الحالية':'عرض')+'</span>'+
      '<div class="bd" data-wgo="__all__" style="cursor:pointer;font-weight:700">كل مؤسساتي — نظرة عامة</div></div>']
      .concat(INSTS().map(name=>{
        const cur=S.curInst===name;
        const n=S.students.filter(s=>instOf(s)===name).length;
        const priv=instType(name)==="private",logo=instLogo(name);
        let row='<div class="behavRow" style="'+(cur?'border-color:var(--green);background:var(--okbg)':'')+'">'+
          '<span class="bChip '+(cur?'p':'w')+'">'+n+' طالب</span>'+
          '<div class="bd" data-wgo="'+esc(name)+'" style="cursor:pointer;font-weight:700">'+(priv?'👨‍🏫 ':'')+esc(name)+'</div>'+
          '<button class="bDel" data-wset="'+esc(name)+'" style="color:var(--green);border-color:var(--green)">⚙️</button>'+
          '<button class="bDel" data-wren="'+esc(name)+'" style="color:var(--green);border-color:var(--green)">✏️</button>'+
          (INSTS().length>1?'<button class="bDel" data-wdel="'+esc(name)+'">✕</button>':'')+
        '</div>';
        if(cfgOpen===name){
          row+='<div class="instCfg">'+
            '<label style="font-size:12px;font-weight:700;color:var(--green2)">نوع المؤسسة وطبيعة الخطاب'+
              '<select data-wtype="'+esc(name)+'">'+
                '<option value="school"'+(priv?'':' selected')+'>🏫 مدرسة رسمية — الرسائل والتقارير بصيغة الإدارة</option>'+
                '<option value="private"'+(priv?' selected':'')+'>👨‍🏫 تدريس خاص — الرسائل بصيغة الأستاذ الشخصية</option>'+
              '</select></label>'+
            '<div class="instLogoRow">'+
              (logo?'<img src="'+logo+'" class="instLogoPrev" alt="الشعار">':'<span class="instLogoNone">لا يوجد شعار</span>')+
              '<button class="btn ghost" data-wlogo="'+esc(name)+'" style="margin:0">🖼 '+(logo?'تغيير':'رفع')+' الشعار</button>'+
              (logo?'<button class="btn ghostD" data-wlogodel="'+esc(name)+'" style="margin:0">إزالة</button>':'')+
            '</div>'+
            '<p class="empty" style="padding:4px 6px;font-size:11px">الشعار يظهر بترويسة التقارير المطبوعة والبطاقة المصوّرة لطلبة هذه المؤسسة. بالتدريس الخاص تُوقَّع الرسائل باسمك مباشرة ويختفي حقل مدير المدرسة من التقارير.</p>'+
            '<label style="font-size:12px;font-weight:700;color:var(--green2)">عنوان المؤسسة (يظهر بترويسة التقارير، اختياري)'+
              '<input data-waddr="'+esc(name)+'" placeholder="مثال: بغداد — الكرادة — قرب ساحة ..." value="'+esc(instAddress(name))+'"></label>'+
            '<label style="font-size:12px;font-weight:700;color:var(--green2)">اسم مدير هذه المؤسسة (يظهر أسفل تقارير هذه المؤسسة فقط)'+
              '<input data-wprincipal="'+esc(name)+'" placeholder="مثال: أحمد محمد علي" value="'+esc(instMeta(name).principal||"")+'"></label>'+
            '<label style="font-size:12px;font-weight:700;color:var(--green2);flex-direction:row;align-items:center;justify-content:space-between">لون مميّز للتقارير المطبوعة<input type="color" data-wcolor="'+esc(name)+'" value="'+esc(instMeta(name).color||"#0F172A")+'" style="width:44px;height:32px;padding:2px;border-radius:8px"></label>'+
            '<div class="colorSwatches">'+COLOR_PRESETS.map(c=>'<button type="button" class="swatch" data-wswatch="'+esc(name)+'|'+c+'" style="background:'+c+'"></button>').join("")+'</div>'+
            '<div style="font-size:12px;font-weight:700;color:var(--green2);margin-top:6px">المراحل الدراسية الموجودة بهذه المؤسسة</div>'+
            '<select data-wgpreset="'+esc(name)+'" style="margin-bottom:4px"><option value="">— اختر قالباً جاهزاً (اختياري) —</option>'+GRADE_PRESETS.map(([l])=>'<option>'+l+'</option>').join("")+'</select>'+
            '<div class="gradeChecks" data-wgrades="'+esc(name)+'">'+ALL_GRADES.map(g=>
              '<label style="flex-direction:row;align-items:center;gap:6px;font-size:12px;font-weight:500"><input type="checkbox" value="'+esc(g)+'" '+(gradesFor(name).includes(g)?"checked":"")+' style="width:17px;height:17px">'+g+'</label>').join("")+
            '</div>'+
            '<p class="empty" style="padding:4px 6px;font-size:11px">فعّل بس المراحل الموجودة فعلياً بهذه المؤسسة — تختفي البقية من كل القوائم والفلاتر تلقائياً.</p>'+
            '<label style="font-size:12px;font-weight:700;color:var(--green2)">تسمية تصنيف الطلبة (شعبة / مجموعة / أي اسم تريده)'+
              '<input data-wterm="'+esc(name)+'" placeholder="مثال: شعبة أو مجموعة" value="'+esc(secTerm(name))+'"></label>'+
            '<div style="font-size:11.5px;font-weight:700;color:var(--green2)">قائمة ال'+esc(secTerm(name))+' الحالية بهذه المؤسسة</div>'+
            '<div data-wseclist="'+esc(name)+'" class="payList"></div>'+
            '<div class="addRow" style="grid-template-columns:1fr auto">'+
              '<input data-wsecnew="'+esc(name)+'" placeholder="اسم '+esc(secTerm(name))+' جديدة">'+
              '<button class="btn ghost" data-wsecadd="'+esc(name)+'" style="margin:0">+ إضافة</button>'+
            '</div>'+
          '</div>';
        }
        return row;
      }));
    el("wsList").innerHTML=rows.join("");
    el("wsList").querySelectorAll("[data-wset]").forEach(b=>b.onclick=()=>{
      cfgOpen=cfgOpen===b.dataset.wset?null:b.dataset.wset;renderWs();
    });
    el("wsList").querySelectorAll("[data-wtype]").forEach(sl=>sl.onchange=()=>{
      setInstMeta(sl.dataset.wtype,{type:sl.value});
      toast(sl.value==="private"?"صار الخطاب شخصياً باسم الأستاذ ✓":"صار الخطاب رسمياً باسم الإدارة ✓");
      renderWs();
    });
    el("wsList").querySelectorAll("[data-wlogo]").forEach(b=>b.onclick=()=>{
      window._logoInst=b.dataset.wlogo;
      el("wsLogoFile").click();
    });
    el("wsList").querySelectorAll("[data-wlogodel]").forEach(b=>b.onclick=()=>{
      if(!confirm("إزالة شعار «"+b.dataset.wlogodel+"»؟"))return;
      setInstMeta(b.dataset.wlogodel,{logo:""});renderWs();toast("أُزيل الشعار");
    });
    el("wsList").querySelectorAll("[data-wterm]").forEach(inp=>inp.onchange=()=>{
      const nv=inp.value.trim();
      if(!nv){toast("اكتب اسماً للتصنيف");inp.value=secTerm(inp.dataset.wterm);return}
      setInstMeta(inp.dataset.wterm,{sectionTerm:nv});
      toast("تم تحديث التسمية إلى «"+nv+"» ✓");renderWs();
    });
    el("wsList").querySelectorAll("[data-waddr]").forEach(inp=>inp.onchange=()=>{
      setInstMeta(inp.dataset.waddr,{address:inp.value.trim()});
      toast("تم حفظ العنوان ✓");
    });
    el("wsList").querySelectorAll("[data-wprincipal]").forEach(inp=>inp.onchange=()=>{
      setInstMeta(inp.dataset.wprincipal,{principal:inp.value.trim()});
      toast("تم حفظ اسم المدير ✓");
    });
    el("wsList").querySelectorAll("[data-wcolor]").forEach(inp=>inp.onchange=()=>{
      setInstMeta(inp.dataset.wcolor,{color:inp.value});
      toast("تم حفظ اللون المميز ✓");
    });
    el("wsList").querySelectorAll("[data-wswatch]").forEach(b=>b.onclick=()=>{
      const[name,color]=b.dataset.wswatch.split("|");
      setInstMeta(name,{color});
      renderWs();
      toast("تم تطبيق اللون ✓");
    });
    el("wsList").querySelectorAll("[data-wgpreset]").forEach(sel=>sel.onchange=()=>{
      const inst=sel.dataset.wgpreset;
      const preset=GRADE_PRESETS.find(([l])=>l===sel.value);
      if(!preset)return;
      setInstMeta(inst,{grades:preset[1].slice()});
      renderWs();
      toast("تم تطبيق القالب ✓");
    });
    el("wsList").querySelectorAll("[data-wgrades]").forEach(box=>{
      const inst=box.dataset.wgrades;
      box.querySelectorAll("input[type=checkbox]").forEach(cb=>cb.onchange=()=>{
        const checked=Array.from(box.querySelectorAll("input[type=checkbox]:checked")).map(x=>x.value);
        if(checked.length===0){toast("لازم تبقي مرحلة واحدة على الأقل مفعّلة");cb.checked=true;return}
        // نحافظ على ترتيب ALL_GRADES الطبيعي بدل ترتيب النقر
        const ordered=ALL_GRADES.filter(g=>checked.includes(g));
        setInstMeta(inst,{grades:ordered});
        toast("تم تحديث المراحل ✓");
      });
    });
    el("wsList").querySelectorAll("[data-wseclist]").forEach(box=>{
      const inst=box.dataset.wseclist;
      box.innerHTML=secList(inst).map(nm=>
        '<div class="behavRow"><div class="bd" style="font-weight:700">'+esc(nm)+'</div>'+
        '<button class="bDel" data-wsecren="'+esc(inst)+'|'+esc(nm)+'">✏️</button>'+
        (secList(inst).length>1?'<button class="bDel" data-wsecdel="'+esc(inst)+'|'+esc(nm)+'">✕</button>':'')+
        '</div>').join("");
    });
    el("wsList").querySelectorAll("[data-wsecren]").forEach(b=>b.onclick=()=>{
      const[inst,old]=b.dataset.wsecren.split("|");
      const nv=prompt("الاسم الجديد:",old);
      if(nv===null)return;
      if(renameSection(inst,old,nv)){toast("تم تغيير الاسم — تحدّث طلبتها وحصصها تلقائياً ✓");renderWs()}
    });
    el("wsList").querySelectorAll("[data-wsecdel]").forEach(b=>b.onclick=()=>{
      const[inst,nm]=b.dataset.wsecdel.split("|");
      if(!confirm("حذف «"+nm+"»؟ طلبتها سينتقلون لأول "+secTerm(inst)+" بالقائمة."))return;
      if(deleteSection(inst,nm)){renderWs();toast("تم الحذف والنقل")}
    });
    el("wsList").querySelectorAll("[data-wsecadd]").forEach(b=>b.onclick=()=>{
      const inst=b.dataset.wsecadd;
      const inp=el("wsList").querySelector('[data-wsecnew="'+CSS.escape(inst)+'"]');
      if(addSection(inst,inp.value)){inp.value="";renderWs();toast("أُضيفت ✓")}
    });
    el("wsList").querySelectorAll("[data-wgo]").forEach(d=>d.onclick=()=>{
      S.curInst=d.dataset.wgo==="__all__"?"":d.dataset.wgo;
      closeModal();updateHeader();_tabHistActive=false;S.tab="home";render();
      toast(S.curInst?("عرض: "+S.curInst):"عرض كل المؤسسات");
    });
    el("wsList").querySelectorAll("[data-wren]").forEach(b=>b.onclick=()=>{
      const old=b.dataset.wren;
      const nv=prompt("الاسم الجديد للمؤسسة:",old);
      if(nv===null)return;
      if(renameInst(old,nv)){
        updateHeader();renderWs();
        toast("تم تغيير الاسم — تحدّث طلبتها وحصصها ورسائلها تلقائياً ✓");
      }
    });
    el("wsList").querySelectorAll("[data-wdel]").forEach(b=>b.onclick=()=>{
      const name=b.dataset.wdel;
      const others=INSTS().filter(x=>x!==name);
      if(!others.length)return;
      if(!confirm("حذف «"+name+"»؟ طلبتها وحصصها سينتقلون إلى «"+others[0]+"»."))return;
      S.students.forEach(s=>{if(instOf(s)===name)s.inst=others[0]});
      S.timetable.forEach(t=>{if(t.inst===name)t.inst=others[0]});
      if(S.settings.instMeta)delete S.settings.instMeta[name];
      S.settings.insts=others;
      if(S.curInst===name)S.curInst="";
      save.students();save.timetable();save.settings();
      updateHeader();renderWs();toast("تم الحذف والنقل");
    });
  };
  el("wsLogoFile").onchange=e=>{
    const f=e.target.files&&e.target.files[0];
    e.target.value="";
    if(!f||!window._logoInst)return;
    const inst=window._logoInst;
    const fr=new FileReader();
    fr.onload=()=>{
      const im=new Image();
      im.onload=()=>{
        const max=280,sc=Math.min(1,max/Math.max(im.width,im.height));
        const cv=document.createElement("canvas");
        cv.width=Math.max(1,Math.round(im.width*sc));cv.height=Math.max(1,Math.round(im.height*sc));
        cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);
        setInstMeta(inst,{logo:cv.toDataURL("image/png")});
        renderWs();toast("حُفظ شعار "+inst+" ✓");
      };
      im.onerror=()=>toast("تعذر قراءة الصورة — جرّب صيغة PNG أو JPG");
      im.src=fr.result;
    };
    fr.readAsDataURL(f);
  };
  el("wsAdd").onclick=()=>{
    const name=el("wsName").value.trim();
    if(!name){toast("اكتب اسم المؤسسة");return}
    if(INSTS().includes(name)){toast("الاسم موجود مسبقاً");return}
    S.settings.insts=INSTS().concat([name]);
    save.settings();
    el("wsName").value="";
    S.curInst=name;updateHeader();renderWs();
    toast("أُضيفت: "+name);
  };
  el("wx").onclick=el("wsClose").onclick=()=>{closeModal();if(S.tab==="home")render()};
  renderWs();
}
function renderAlerts(){
  const lim=S.settings.absLimit||5;
  const list=VIS()
    .filter(s=>s.status==="مستمر")
    .map(s=>({s,n:absCount(s.id)}))
    .filter(x=>x.n>=lim)
    .sort((a,b)=>b.n-a.n);
  el("alertBox").innerHTML=list.length===0?
    '<p class="empty">لا يوجد طلبة تجاوزوا حد الغياب 👍</p>':
    '<ul class="slist">'+list.map(({s,n})=>
      '<li class="srow alertRow" data-id="'+s.id+'">'+
        '<div class="sinfo"><div class="sname">'+esc(s.name)+'</div>'+
        '<div class="smeta">'+s.grade+' — '+secTerm(instOf(s))+' '+s.section+'</div></div>'+
        '<span class="chip bad">'+n+' غياب</span>'+
        '<button class="wa" data-wa="'+s.id+'">واتساب</button></li>').join("")+'</ul>';
  el("alertBox").querySelectorAll("[data-wa]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const s=S.students.find(x=>x.id===b.dataset.wa);
    shareItemCard(s,{badge:"⚠️ تنبيه تكرار غياب",chip:"غياب متكرر",tone:"warn",filePrefix:"تكرار_غياب",
      bodyText:"السلام عليكم،\nنود تنبيهكم بأن غيابات "+genderNoun(s)+" ("+s.name+") بلغت "+absCount(s.id)+" أيام.\n"+instFollowLine(s)});
  });
  el("alertBox").querySelectorAll(".srow").forEach(r=>r.onclick=()=>openDetail(r.dataset.id));
}
function backupData(){
  return JSON.stringify({
    masarBackup:true,appVersion:APP_VER,schemaVersion:MASAR_SCHEMA_VERSION,exportedAt:new Date().toISOString(),
    data:{students:S.students,grades:S.grades,attendance:S.attendance,payments:S.payments,behavior:S.behavior,homework:S.homework,timetable:S.timetable,dailyPlans:S.dailyPlans||[],settings:S.settings,exams:S.exams,messages:S.messages,events:S.events,qbank:S.qbank,examTemplates:S.examTemplates}
  });
}
// يقبل الصيغة الجديدة (مغلّفة) والقديمة (مسطّحة) معًا، للتوافق مع نسخ احتياطية قديمة
function unwrapBackup(d){return d&&d.masarBackup&&d.data?d.data:d}
async function createPreImportSnapshot(){
  try{await saveRaw("safety:preImport",{createdAt:new Date().toISOString(),appVersion:APP_VER,payload:JSON.parse(backupData())});return true}
  catch(e){console.error("snapshot",e);return false}
}
// تحقق أساسي من بنية ملف الاستيراد قبل تطبيقه — يمنع دخول بيانات تالفة بصمت
function validateBackupSchema(d){
  if(!d||typeof d!=="object"||Array.isArray(d))return "الملف فاسد أو غير مقروء";
  const isArr=k=>d[k]===undefined||Array.isArray(d[k]);
  const isObj=k=>d[k]===undefined||(typeof d[k]==="object"&&d[k]!==null&&!Array.isArray(d[k]));
  if(!isArr("students"))return "بيانات الطلبة تالفة (يُفترض أن تكون قائمة)";
  if(d.students&&d.students.some(s=>!s||typeof s!=="object"||typeof s.id!=="string"))return "بعض سجلات الطلبة تالفة (بدون معرّف صالح)";
  for(const k of ["grades","attendance","payments","behavior","messages"])if(!isObj(k))return "بيانات «"+k+"» تالفة (يُفترض أن تكون كائن)";
  for(const k of ["homework","timetable","exams","events","qbank","examTemplates","dailyPlans"])if(!isArr(k))return "بيانات «"+k+"» تالفة (يُفترض أن تكون قائمة)";
  if(!isObj("settings"))return "بيانات الإعدادات تالفة";
  return null;
}
// تشفير اختياري بكلمة مرور — يُرجع null إذا ألغى المستخدم، أو النص كما هو إذا تُرك بدون كلمة مرور
async function maybeEncryptBackup(data){
  if(!hasCrypto)return data;
  const pass=prompt("🔒 كلمة مرور لتشفير النسخة الاحتياطية (اختياري)\nاتركها فارغة واضغط موافق للتصدير بدون تشفير.\n⚠️ إذا نسيت كلمة المرور لاحقاً، لا يمكن فتح هذه النسخة نهائياً.");
  if(pass===null)return null;
  if(!pass.trim())return data;
  try{return await encryptBackupText(data,pass.trim())}
  catch(e){console.error("encrypt failed",e);toast("تعذّر التشفير — صُدّرت النسخة بدون تشفير");return data}
}
async function shareBackup(){
  const raw=backupData();
  const data=await maybeEncryptBackup(raw);
  if(data===null)return;
  const file=new File([data],"مزامنة_الطلبة_"+todayStr()+".json",{type:"application/json"});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{
      await navigator.share({files:[file],title:"بيانات طلبتي"});
      S.settings.lastBackup=todayStr();save.settings();
      if(S.tab==="home")render();
      toast("أرسل الملف لنفسك وافتحه بالجهاز الآخر ثم «استيراد نسخة»");
    }catch(e){/* المستخدم ألغى */}
  }else{
    await exportBackup(data);
    toast("نزل الملف — انقله للجهاز الآخر واستورده هناك");
  }
}
async function exportBackup(preparedData){
  try{
    const data=preparedData!==undefined?preparedData:await maybeEncryptBackup(backupData());
    if(data===null)return;
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([data],{type:"application/json"}));
    a.download="نسخة_احتياطية_الطلبة_"+todayStr()+".json";a.click();
    S.settings.lastBackup=todayStr();save.settings();
    if(S.tab==="home")render();
    toast("تم تنزيل النسخة الاحتياطية");
  }catch(e){
    console.error("exportBackup failed",e);
    toast("تعذّر إنشاء النسخة الاحتياطية — حاول مرة أخرى");
  }
}
el("importFile").onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=async()=>{try{
    let d=JSON.parse(r.result);
    if(d&&d.masarEncrypted){
      const pass=prompt("🔒 هذه النسخة مشفّرة — اكتب كلمة المرور لفتحها:");
      if(pass===null)return;
      try{d=JSON.parse(await decryptBackupObj(d,pass))}
      catch(err){toast("كلمة المرور غير صحيحة أو الملف تالف");return}
    }
    d=unwrapBackup(d);
    const schemaErr=validateBackupSchema(d);
    if(schemaErr){toast("⚠️ "+schemaErr+" — أُلغي الاستيراد لحماية بياناتك");return}
    if(d.settings&&(d.settings.pin||d.settings.pinHash||d.settings.sync)){
      if(!confirm("هذا الملف يحتوي أيضاً على رمز قفل و/أو إعدادات مزامنة سحابية — استيراده سيستبدل رمز القفل وإعدادات المزامنة الحالية بجهازك. متابعة؟"))return;
    }
    d=sanitizeImportedData(d);
    if(!await createPreImportSnapshot()){if(!confirm("تعذّر إنشاء نقطة استرجاع تلقائية قبل الاستيراد. متابعة رغم ذلك؟"))return}
    S.students=d.students||[];S.grades=d.grades||{};S.attendance=d.attendance||{};
    S.payments=d.payments||{};S.behavior=d.behavior||{};S.homework=d.homework||[];S.timetable=d.timetable||[];S.dailyPlans=d.dailyPlans||[];S.exams=d.exams||[];S.messages=d.messages||{};S.events=d.events||[];S.qbank=d.qbank||[];S.examTemplates=d.examTemplates||[];S.settings=d.settings||S.settings;
    save.students();save.grades();save.attendance();save.payments();save.behavior();save.homework();save.timetable();save.dailyPlans&&save.dailyPlans();save.exams();save.messages();save.events();save.qbank();save.examTemplates();save.settings();
    el("schoolName").value=S.settings.school;render();toast("تم استيراد البيانات ✓");
  }catch(err){toast("ملف غير صالح")}};
  r.readAsText(f);e.target.value="";
};

