/* ============ الحضور ============ */
function renderAttendance(){
  el("content").innerHTML=
    '<h2 class="h">✅ تسجيل الحضور</h2>'+
    '<div class="filters three">'+
      '<input type="date" id="aDate" value="'+S.aDate+'">'+
      '<select id="aGrade">'+opts(gradesFor(S.curInst||INSTS()[0]),S.aGrade)+'</select>'+
      '<select id="aSection">'+opts(secList(S.curInst||INSTS()[0]),S.aSection)+'</select>'+
    '</div>'+
    '<div class="actions" style="margin-bottom:12px"><button class="btn ghost" id="moRep">📊 التقرير الشهري للصف</button><button class="btn ghost" id="absRepPdf">🖨 PDF للإدارة</button><button class="btn ghost" id="absRepImg">🖼 صورة للإدارة</button></div>'+
    '<div id="aBox"></div>';
  el("aDate").onchange=e=>{S.aDate=e.target.value||todayStr();renderABox()};
  el("aGrade").onchange=e=>{S.aGrade=e.target.value;renderABox()};
  el("aSection").onchange=e=>{S.aSection=e.target.value;renderABox()};
  el("moRep").onclick=openMonthReport;
  el("absRepPdf").onclick=printAbsenceReport;
  el("absRepImg").onclick=shareAbsenceReportImage;
  renderABox();
}
function reportInstFor(list){
  if(!list.length)return S.curInst||INSTS()[0];
  const set=new Set(list.map(instOf));
  if(set.size>1)toast("⚠️ الطلبة من أكثر من مؤسسة — اختر مؤسسة محددة من «مؤسساتي» لتقرير أدق");
  return instOf(list[0]);
}
async function ensureFontsReady(){
  try{
    await Promise.all([
      document.fonts.load('700 42px Cairo'),
      document.fonts.load('400 27px Cairo'),
      document.fonts.load('900 34px Cairo')
    ]);
  }catch(e){/* تجاهل — سيُستخدم خط احتياطي إذا تعذّر */}
}
async function shareAbsenceReportImage(){
  const list=VIS().filter(s=>s.grade===S.aGrade&&s.section===S.aSection&&s.status==="مستمر");
  if(!list.length){toast("لا يوجد طلبة بهذا الصف وال"+secTerm(S.curInst));return}
  const day=S.attendance[S.aDate]||{};
  const absentees=list.filter(s=>day[s.id]==="غائب");
  const excused=list.filter(s=>day[s.id]==="مجاز");
  const rows=absentees.map(s=>[s.name,"غائب"]).concat(excused.map(s=>[s.name,"مجاز"]));
  const inst=reportInstFor(list);
  const btn=el("absRepImg");if(btn){btn.disabled=true;btn.textContent="⏳ جارِ التحضير…"}
  const [logo,sigImg]=await Promise.all([loadImgCached(instLogo(inst)),loadImgCached(S.settings.signature||""),ensureFontsReady()]);
  const cv=buildAbsenceReportCanvas(S.aGrade,S.aSection,inst,S.aDate,rows,logo,sigImg);
  if(btn){btn.disabled=false;btn.textContent="🖼 صورة للإدارة"}
  if(!cv||!cv.toBlob){toast("المتصفح لا يدعم إنشاء الصور");return}
  cv.toBlob(async b=>{
    if(!b){toast("تعذر إنشاء الصورة");return}
    const fname="تقرير_غياب_"+S.aGrade+"_"+S.aSection+"_"+S.aDate+".png";
    const file=new File([b],fname,{type:"image/png"});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:fname,text:"تقرير الغياب اليومي — "+S.aGrade+" "+secTerm(inst)+" "+S.aSection});return}
      catch(e){/* أُلغيت أو فشلت — ننزّل بدلاً منها */}
    }
    const a=document.createElement("a");
    a.href=URL.createObjectURL(b);a.download=fname;a.click();
    toast("تم تنزيل تقرير الغياب — شاركه مع إدارة المؤسسة");
  },"image/png");
}
function printAbsenceReport(){
  const list=VIS().filter(s=>s.grade===S.aGrade&&s.section===S.aSection&&s.status==="مستمر");
  const day=S.attendance[S.aDate]||{};
  const absentees=list.filter(s=>day[s.id]==="غائب");
  const excused=list.filter(s=>day[s.id]==="مجاز");
  if(!list.length){toast("لا يوجد طلبة بهذا الصف وال"+secTerm(S.curInst));return}
  const inst=reportInstFor(list);
  const lesson=lessonForDate(S.aGrade,S.aSection,inst,S.aDate);
  const timeStr=lesson?periodTimeStr(lesson.period,lesson.shift||"صباحي"):"";
  const lessonInfo=lesson?(' &nbsp;|&nbsp; <b>الحصة:</b> '+lesson.period+(lesson.shift==="مسائي"?" (مسائي)":" (صباحي)")+(timeStr?' — '+timeStr:'')):"";
  const rows=absentees.map(s=>[s.name,"غائب"]).concat(excused.map(s=>[s.name,"مجاز"]));
  const body=
    '<div class="pInfo"><b>'+esc(S.aGrade)+'</b> — '+secTerm(inst)+' '+esc(S.aSection)+' &nbsp;|&nbsp; <b>التاريخ:</b> '+S.aDate+lessonInfo+' &nbsp;|&nbsp; <b>المادة:</b> '+esc(MYSUB())+'</div>'+
    '<p style="font-size:13px;margin:0 0 10px">إلى السادة إدارة '+esc(inst)+' المحترمين،<br>نُحيطكم علماً بأسماء الطلبة المتغيبين والمجازين بحصة اليوم:</p>'+
    (rows.length?
      '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th><th>الحالة</th></tr></thead><tbody>'+
      rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(r[0])+'</td><td>'+r[1]+'</td></tr>').join("")+
      '</tbody></table>':
      '<p class="empty" style="padding:16px">لا يوجد غياب أو إجازات بهذا التحضير — الحضور كامل ✅</p>');
  printHTML("تقرير الغياب اليومي",body,false,inst);
}
function monthStats(month,grade,section){
  const list=VIS().filter(s=>s.grade===grade&&s.section===section);
  const days=Object.keys(S.attendance).filter(d=>d.startsWith(month));
  return list.map(s=>{
    let p=0,a=0,e2=0;
    days.forEach(d=>{const v=S.attendance[d][s.id];if(v==="حاضر")p++;else if(v==="غائب")a++;else if(v==="مجاز")e2++});
    const tot=p+a+e2;
    return {s,p,a,e:e2,pct:tot?Math.round(p/tot*100):null};
  });
}
function openMonthReport(){
  const month=todayStr().slice(0,7);
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>التقرير الشهري — '+S.aGrade+' / '+S.aSection+'</h3><button class="x" id="mx">✕</button></div>'+
    '<div class="form">'+
      '<label>الشهر<input type="month" id="moIn" value="'+month+'"></label>'+
      '<div id="moBox"></div>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn ghost" id="moExp">⬇ Excel</button><button class="btn ghost" id="moPrn">🖨 طباعة</button><button class="btn" id="moClose">إغلاق</button></div>'+
  '</div></div>';
  const renderMo=()=>{
    const m=el("moIn").value||month;
    const rows=monthStats(m,S.aGrade,S.aSection);
    el("moBox").innerHTML=rows.length===0?'<p class="empty">لا يوجد طلبة بهذا الصف وال'+secTerm(S.curInst)+'.</p>':
      '<div class="gTable"><div class="gHead" style="grid-template-columns:1fr 50px 50px 50px 60px"><span>الطالب</span><span>حضور</span><span>غياب</span><span>إجازة</span><span>النسبة</span></div>'+
      rows.map(r=>'<div class="gRow" style="grid-template-columns:1fr 50px 50px 50px 60px"><span class="gSub">'+esc(r.s.name)+'</span><span style="text-align:center">'+r.p+'</span><span style="text-align:center;color:var(--red)">'+r.a+'</span><span style="text-align:center">'+r.e+'</span><span style="text-align:center;font-weight:700">'+(r.pct===null?"—":r.pct+"%")+'</span></div>').join("")+'</div>';
  };
  el("moIn").onchange=renderMo;renderMo();
  el("mx").onclick=el("moClose").onclick=closeModal;
  el("moExp").onclick=()=>{
    const m=el("moIn").value||month;
    const rows=monthStats(m,S.aGrade,S.aSection);
    if(!rows.length){toast("لا توجد بيانات للتصدير");return}
    csvDownload("حضور_"+S.aGrade+"_"+S.aSection+"_"+m,
      ["ت","اسم الطالب","حضور","غياب","إجازة","نسبة الحضور %"],
      rows.map((r,i)=>[i+1,r.s.name,r.p,r.a,r.e,r.pct===null?"":r.pct]));
  };
  el("moPrn").onclick=()=>{
    const m=el("moIn").value||month;
    const rows=monthStats(m,S.aGrade,S.aSection);
    const inst=reportInstFor(rows.map(r=>r.s));
    printHTML("تقرير الحضور الشهري — "+S.aGrade+" "+secTerm(inst)+" "+S.aSection+" — شهر "+m,
      '<table class="pTable"><thead><tr><th>ت</th><th>الطالب</th><th>حضور</th><th>غياب</th><th>إجازة</th><th>نسبة الحضور</th></tr></thead><tbody>'+
      rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(r.s.name)+'</td><td>'+r.p+'</td><td>'+r.a+'</td><td>'+r.e+'</td><td>'+(r.pct===null?"—":r.pct+"%")+'</td></tr>').join("")+'</tbody></table>',false,inst);
  };
}

/* ============ الأقساط ============ */
function renderPayments(){
  const list=VIS().filter(s=>s.grade===S.pGrade&&s.section===S.pSection);
  if(S.pSid&&!list.some(s=>s.id===S.pSid))S.pSid="";
  el("content").innerHTML=
    '<h2 class="h">💰 الأقساط والدفعات</h2>'+
    '<div class="filters three">'+
      '<select id="pGrade">'+opts(gradesFor(S.curInst||INSTS()[0]),S.pGrade)+'</select>'+
      '<select id="pSection">'+opts(secList(S.curInst||INSTS()[0]),S.pSection)+'</select>'+
      '<select id="pSid"><option value="">اختر الطالب…</option>'+
        list.map(s=>'<option value="'+s.id+'"'+(S.pSid===s.id?" selected":"")+'>'+esc(s.name)+'</option>').join("")+
      '</select>'+
    '</div><div id="pBox"></div>';
  el("pGrade").onchange=e=>{S.pGrade=e.target.value;S.pSid="";renderPayments()};
  el("pSection").onchange=e=>{S.pSection=e.target.value;S.pSid="";renderPayments()};
  el("pSid").onchange=e=>{S.pSid=e.target.value;renderPBox()};
  renderPBox();
}
function renderPBox(){
  const s=S.students.find(x=>x.id===S.pSid);
  if(!s){
    // ملخص المتبقي على طلبة الصف
    const rows=VIS().filter(x=>x.grade===S.pGrade&&x.section===S.pSection)
      .map(x=>({x,p:payInfo(x.id)})).filter(r=>r.p&&r.p.rest>0);
    el("pBox").innerHTML=(rows.length?
      '<h3 class="h2">عليهم متبقي بهذا الصف</h3><ul class="slist">'+rows.map(({x,p})=>
        '<li class="srow" data-id="'+x.id+'"><div class="sinfo"><div class="sname">'+esc(x.name)+'</div></div><span class="chip bad">متبقي '+p.rest.toLocaleString()+'</span></li>').join("")+'</ul>':"")+
      '<p class="empty">اختر طالباً لإدارة قسطه ودفعاته.</p>';
    el("pBox").querySelectorAll(".srow").forEach(r=>r.onclick=()=>{S.pSid=r.dataset.id;renderPayments()});
    return;
  }
  const p=S.payments[s.id]||(S.payments[s.id]={total:"",list:[]});
  const info=payInfo(s.id);
  el("pBox").innerHTML=
    '<label style="display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:700;color:#475569;margin-bottom:10px">القسط الكلي (دينار)'+
      '<input id="pTotal" inputmode="numeric" value="'+esc(p.total||"")+'" placeholder="مثال: 1500000" style="padding:11px;border:1px solid var(--line);border-radius:12px;font-size:14px;background:var(--card);outline:none"></label>'+
    (info?'<div class="sumBox"><div><span>المدفوع</span><b>'+info.paid.toLocaleString()+'</b></div><div><span>المتبقي</span><b>'+info.rest.toLocaleString()+'</b></div></div>':"")+
    '<div class="addRow"><input id="payAmt" inputmode="numeric" placeholder="المبلغ" style="grid-column:1"><input id="payNote" placeholder="ملاحظة (اختياري)"><button class="btn" id="payAdd">+ دفعة</button></div>'+
    '<div id="payList" class="payList" style="margin-top:10px"></div>';
  el("pTotal").onchange=e=>{
    const v=e.target.value.trim();
    if(v!==""&&(isNaN(v)||Number(v)<0)){e.target.value=p.total||"";return}
    p.total=v;save.payments();renderPBox();
  };
  el("payAdd").onclick=()=>{
    const amt=el("payAmt").value.trim();
    if(!amt||isNaN(amt)||Number(amt)<=0){toast("أدخل مبلغاً صحيحاً");return}
    p.list.unshift({id:uid(),date:todayStr(),amount:amt,note:el("payNote").value.trim()});
    save.payments();renderPBox();toast("تمت إضافة الدفعة");
  };
  renderPayList(s.id,p);
}
function renderPayList(id,p){
  el("payList").innerHTML=(p.list||[]).length===0?'<p class="empty" style="padding:10px">لا توجد دفعات مسجلة.</p>':
    p.list.map(x=>'<div class="behavRow"><span class="bChip p">'+Number(x.amount).toLocaleString()+'</span>'+
      '<div class="bd">'+esc(x.note||"دفعة")+'<div class="bDate">'+x.date+'</div></div>'+
      '<button class="bDel" data-pd="'+x.id+'">✕</button></div>').join("");
  el("payList").querySelectorAll("[data-pd]").forEach(btn=>btn.onclick=()=>{
    p.list=p.list.filter(x=>x.id!==btn.dataset.pd);
    save.payments();renderPBox();
  });
}
function renderABox(){
  const list=VIS().filter(s=>s.grade===S.aGrade&&s.section===S.aSection&&s.status==="مستمر");
  const day=S.attendance[S.aDate]||{};
  el("aBox").innerHTML=list.length===0?
    '<p class="empty">لا يوجد طلبة مستمرون بهذا الصف وال'+secTerm(S.curInst)+'.</p>':
    '<button class="btn ghost full" id="allP">تحضير الجميع ✓</button><ul class="slist">'+
    list.map(s=>'<li class="srow noClick"><div class="sinfo"><div class="sname">'+esc(s.name)+'</div></div>'+
      '<div class="attBtns">'+ATT.map(([a,cls])=>
        '<button class="att'+(day[s.id]===a?" "+cls:"")+'" data-id="'+s.id+'" data-v="'+a+'">'+a+'</button>').join("")+
      (day[s.id]==="غائب"?'<button class="wa" data-wa="'+s.id+'">📱</button>':"")+
      '</div></li>').join("")+'</ul>';
  const allP=el("allP");
  if(allP)allP.onclick=()=>{
    const d=Object.assign({},S.attendance[S.aDate]||{});
    list.forEach(s=>d[s.id]="حاضر");
    S.attendance[S.aDate]=d;save.attendance();renderABox();toast("تم تحضير الجميع");
  };
  el("aBox").querySelectorAll(".att").forEach(b=>b.onclick=()=>{
    const d=Object.assign({},S.attendance[S.aDate]||{});
    d[b.dataset.id]=b.dataset.v;
    S.attendance[S.aDate]=d;save.attendance();renderABox();
  });
  el("aBox").querySelectorAll("[data-wa]").forEach(b=>b.onclick=()=>{
    const s=S.students.find(x=>x.id===b.dataset.wa);
    if(s)shareItemCard(s,absCardOpts(s));
  });
}

/* ============ الدرجات ============ */
function csvDownload(name,head,rows){
  const csv="\uFEFF"+[head,...rows].map(r=>r.map(c=>'"'+String(c??"").replace(/"/g,'""')+'"').join(",")).join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download=name+".csv";a.click();
  toast("تم تنزيل الملف — يفتح بالإكسل");
}
function exportClassGrades(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection);
  if(!list.length){toast("لا يوجد طلبة للتصدير");return}
  csvDownload("درجات_"+MYSUB()+"_"+S.gGrade+"_"+S.gSection,
    ["ت","اسم الطالب","شهر أول ف1","شهر ثاني ف1","نصف السنة","شهر أول ف2","شهر ثاني ف2","السعي السنوي","الامتحان النهائي","الدرجة النهائية","الدور الثاني","النتيجة"],
    list.map((s,i)=>{
      const rec=(S.grades[s.id]||{})[MYSUB()]||{};
      const c=subjectCalc(rec,s.grade);
      return [i+1,s.name,fmt(c.M1),fmt(c.M2),rec.mid||"",fmt(c.M3),fmt(c.M4),fmt(c.saay),rec.fin||"",fmt(c.final),rec.r2||"",c.status||""];
    }));
}
function examLabel(){
  const fLbl=GFIELDS.find(x=>x[0]===S.gField)[1];
  if(!isMonth(S.gField))return fLbl;
  const subLbl=S.gSub==="w"?"الامتحان التحريري":examName(S.gField,Number(S.gSub.slice(1)));
  return subLbl+" — "+fLbl;
}
function examScoreMsg(s,label,val){
  return "السلام عليكم،\nنود إعلامكم بنتيجة "+genderNoun(s)+" ("+s.name+") في "+label+" لمادة "+MYSUB()+":\n📝 الدرجة: "+val+" من 100";
}
function printExamReport(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection&&s.status==="مستمر");
  if(!list.length){toast("لا يوجد طلبة بهذا الصف");return}
  const sub=isMonth(S.gField)?S.gSub:null;
  const inst=reportInstFor(list);
  const label=examLabel();
  const rows=list.map(s=>{
    const rec=(S.grades[s.id]||{})[MYSUB()]||{};
    const val=getCell(rec,S.gField,sub);
    return [s.name,val===""?"—":val];
  });
  const body=
    '<div class="pInfo"><b>'+esc(S.gGrade)+'</b> — '+secTerm(inst)+' '+esc(S.gSection)+' &nbsp;|&nbsp; <b>الامتحان:</b> '+esc(label)+' &nbsp;|&nbsp; <b>المادة:</b> '+esc(MYSUB())+'</div>'+
    '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th><th>الدرجة</th></tr></thead><tbody>'+
    rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(r[0])+'</td><td><b>'+r[1]+'</b></td></tr>').join("")+
    '</tbody></table>';
  printHTML("تقرير نتائج "+label,body,false,inst);
}
function sendExamReports(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection&&s.status==="مستمر");
  if(!list.length){toast("لا يوجد طلبة بهذا الصف");return}
  const sub=isMonth(S.gField)?S.gSub:null;
  const label=examLabel();
  const targets=list.map(s=>{
    const rec=(S.grades[s.id]||{})[MYSUB()]||{};
    const val=getCell(rec,S.gField,sub);
    return {s,val,cardOpts:{badge:"📝 نتيجة امتحان",chip:"",tone:"info",filePrefix:"نتيجة_امتحان",bodyText:examScoreMsg(s,label,val)}};
  }).filter(t=>t.val!=="");
  if(!targets.length){toast("لا توجد درجات مرصودة لهذا الامتحان بعد");return}
  openBulkSender("📝 إرسال نتائج "+label,targets);
}
function printAllDailyReport(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection&&s.status==="مستمر");
  if(!list.length){toast("لا يوجد طلبة بهذا الصف");return}
  if(!isMonth(S.gField)){toast("اختر أحد الأشهر أولاً (شهر أول/ثاني...) لعرض امتحاناته اليومية");return}
  const inst=reportInstFor(list);
  const n=examCount(S.gField);
  const names=Array.from({length:n},(_,i)=>examName(S.gField,i));
  const fLbl=GFIELDS.find(x=>x[0]===S.gField)[1];
  const rows=list.map(s=>{
    const rec=(S.grades[s.id]||{})[MYSUB()]||{};
    const m=rec[S.gField];
    const vals=names.map((_,i)=>getCell(rec,S.gField,"d"+i));
    const dVals=(m&&m.d?m.d:[]).map(num).filter(v=>v!==null);
    const dAvg=dVals.length?Math.round(dVals.reduce((a,b)=>a+b,0)/dVals.length):null;
    return {name:s.name,vals,dAvg};
  });
  const recordedCount=rows.filter(r=>r.vals.some(v=>v!=="")).length;
  const allEmpty=recordedCount===0;
  const body=
    '<div class="pInfo"><b>'+esc(S.gGrade)+'</b> — '+secTerm(inst)+' '+esc(S.gSection)+' &nbsp;|&nbsp; <b>الامتحانات اليومية:</b> '+esc(fLbl)+' &nbsp;|&nbsp; <b>المادة:</b> '+esc(MYSUB())+
    (allEmpty?'':' &nbsp;|&nbsp; <b>رُصدت درجات:</b> '+recordedCount+' من '+rows.length)+'</div>'+
    (allEmpty?
      '<p class="empty" style="padding:18px;text-align:center">📝 لا توجد أي درجات مرصودة بعد لهذا الامتحان — سجّلها من تبويب الدرجات أولاً.</p>':
      '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th>'+names.map(nm=>'<th>'+esc(nm)+'</th>').join("")+'<th>المعدل</th></tr></thead><tbody>'+
      rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(r.name)+'</td>'+r.vals.map(v=>'<td>'+(v===""?"—":v)+'</td>').join("")+'<td><b>'+(r.dAvg===null?"—":r.dAvg)+'</b></td></tr>').join("")+
      '</tbody></table>');
  printHTML("تقرير الامتحانات اليومية — "+fLbl,body,false,inst);
}
function printAllMonthsReport(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection&&s.status==="مستمر");
  if(!list.length){toast("لا يوجد طلبة بهذا الصف");return}
  const inst=reportInstFor(list);
  const months=[["m1","شهر أول ف1"],["m2","شهر ثاني ف1"],["m3","شهر أول ف2"],["m4","شهر ثاني ف2"]];
  const rows=list.map(s=>{
    const rec=(S.grades[s.id]||{})[MYSUB()]||{};
    return {name:s.name,vals:months.map(([f])=>fmt(monthScore(rec[f],s.grade)))};
  });
  const body=
    '<div class="pInfo"><b>'+esc(S.gGrade)+'</b> — '+secTerm(inst)+' '+esc(S.gSection)+' &nbsp;|&nbsp; <b>المادة:</b> '+esc(MYSUB())+'</div>'+
    '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th>'+months.map(([,l])=>'<th>'+l+'</th>').join("")+'</tr></thead><tbody>'+
    rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(r.name)+'</td>'+r.vals.map(v=>'<td>'+v+'</td>').join("")+'</tr>').join("")+
    '</tbody></table>';
  printHTML("تقرير جميع الأشهر المكتملة",body,false,inst);
}
/* ============ التقييم (تبويب مدمج: الدرجات + الواجبات) ============ */
function renderEvaluation(){
  if(!S.evalSub)S.evalSub="grades";
  if(S.evalSub==="homework")renderHomework();else renderGrades();
  const toggle='<div class="tplChips" id="evalToggle" style="margin-bottom:10px">'+
    '<button data-evalsub="grades" class="'+(S.evalSub==="grades"?"on":"")+'">📚 الدرجات</button>'+
    '<button data-evalsub="homework" class="'+(S.evalSub==="homework"?"on":"")+'">📋 الواجبات</button>'+
    '</div>';
  el("content").insertAdjacentHTML("afterbegin",toggle);
  el("content").querySelectorAll("[data-evalsub]").forEach(b=>b.onclick=()=>{S.evalSub=b.dataset.evalsub;renderEvaluation()});
}
/* ============ التدريس (تبويب مدمج: أسئلة + بنك أسئلة + خطة يومية + رسم دوال) ============ */
function renderTeaching(){
  if(!S.teachSub)S.teachSub="plan";
  const tabsDef=[["plan","📅 الخطة اليومية"],["exam","📝 ورقة الأسئلة"],["qbank","📚 بنك الأسئلة"],["plot","📈 رسم الدوال"]];
  el("content").innerHTML=
    '<h2 class="h">📝 أدوات التدريس</h2>'+
    '<div class="tplChips" id="teachToggle">'+tabsDef.map(([k,l])=>'<button data-teachsub="'+k+'" class="'+(S.teachSub===k?"on":"")+'">'+l+'</button>').join("")+'</div>'+
    '<div id="teachBody" style="margin-top:10px"></div>';
  el("content").querySelectorAll("[data-teachsub]").forEach(b=>b.onclick=()=>{S.teachSub=b.dataset.teachsub;renderTeaching()});
  if(S.teachSub==="plan")renderDailyPlan();
  else if(S.teachSub==="exam"){
    el("teachBody").innerHTML='<p class="empty" style="padding:16px 4px">جهّز واطبع ورقة أسئلة امتحان مع نموذج إجابة خاص بالمدرّس.</p><button class="btn full" id="goExamBtn">📝 فتح إعداد ورقة الأسئلة</button>';
    el("goExamBtn").onclick=openExamBuilder;
  }else if(S.teachSub==="qbank"){
    el("teachBody").innerHTML='<p class="empty" style="padding:16px 4px">احفظ أسئلة تستخدمها لاحقًا بأي ورقة امتحان.</p><button class="btn full" id="goQBankBtn">📚 فتح بنك الأسئلة</button>';
    el("goQBankBtn").onclick=()=>openQuestionBank(false);
  }else if(S.teachSub==="plot"){
    el("teachBody").innerHTML='<p class="empty" style="padding:16px 4px">ارسم دالة رياضية بيانيًا بسرعة.</p><button class="btn full" id="goPlotBtn">📈 فتح رسم الدوال</button>';
    el("goPlotBtn").onclick=openFunctionPlotter;
  }
}
const DEFAULT_PLAN_LABELS=["التهيئة","عرض الدرس والأهداف السلوكية","الأنشطة والوسائل التعليمية","التقويم","الواجب البيتي"];
function planLabels(){return (S.settings.planFieldLabels&&S.settings.planFieldLabels.length===5)?S.settings.planFieldLabels:DEFAULT_PLAN_LABELS}
function renderDailyPlan(){
  if(!S.pGrade)S.pGrade=gradesFor(S.curInst||INSTS()[0])[0]||"";
  if(!S.pSection)S.pSection=secList(S.curInst||INSTS()[0])[0]||"";
  if(!S.pDate)S.pDate=todayStr();
  const labels=planLabels();
  const inst=S.curInst||INSTS()[0];
  const plans=(S.dailyPlans||[]).filter(p=>p.inst===inst&&p.grade===S.pGrade&&p.section===S.pSection).sort((a,b)=>a.date<b.date?1:-1);
  el("teachBody").innerHTML=
    '<div class="filters three">'+
      '<select id="pGrade">'+opts(gradesFor(inst),S.pGrade)+'</select>'+
      '<select id="pSection">'+opts(secList(inst),S.pSection)+'</select>'+
      '<input type="date" id="pDate" value="'+S.pDate+'">'+
    '</div>'+
    '<button class="btn ghost full ' + '" id="planCustomizeBtn" style="margin:6px 0 10px">✏️ تخصيص عناوين حقول الخطة</button>'+
    '<button class="btn full" id="planAddBtn">+ خطة جديدة لهذا اليوم</button>'+
    '<div id="planList" style="margin-top:12px"></div>';
  el("pGrade").onchange=e=>{S.pGrade=e.target.value;S.pSection=secList(inst)[0]||"";renderDailyPlan()};
  el("pSection").onchange=e=>{S.pSection=e.target.value;renderDailyPlan()};
  el("pDate").onchange=e=>{S.pDate=e.target.value;renderDailyPlan()};
  el("planCustomizeBtn").onclick=openPlanFieldCustomizer;
  el("planAddBtn").onclick=()=>openPlanEditor(null);
  const renderList=()=>{
    el("planList").innerHTML=plans.length===0?
      '<p class="empty">لا توجد خطط مسجلة لهذا الصف بعد. أضف خطة من الزر أعلاه.</p>':
      plans.map(p=>'<div class="subCard" data-planopen="'+p.id+'" style="cursor:pointer">'+
        '<div class="subHead"><span class="subName">📅 '+esc(p.date)+' — '+esc(p.topic||"بدون عنوان")+'</span>'+
        '<button class="bDel" data-plandel="'+p.id+'">✕</button></div>'+
        '<p class="empty" style="padding:6px 8px;font-size:11.5px;text-align:right">'+esc(labels[0])+': '+esc(stripHTML((p.fields&&p.fields[0])||"—")).slice(0,60)+'</p>'+
      '</div>').join("");
    el("planList").querySelectorAll("[data-planopen]").forEach(c=>c.onclick=e=>{
      if(e.target.closest("[data-plandel]"))return;
      openPlanEditor(plans.find(p=>p.id===c.dataset.planopen));
    });
    el("planList").querySelectorAll("[data-plandel]").forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      S.dailyPlans=S.dailyPlans.filter(p=>p.id!==b.dataset.plandel);
      save.dailyPlans();renderDailyPlan();toast("تم حذف الخطة");
    });
  };
  renderList();
}
function openPlanFieldCustomizer(){
  const cur=planLabels();
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>✏️ تخصيص عناوين حقول الخطة</h3><button class="x" id="pcX">✕</button></div>'+
    '<div class="form">'+
      '<p class="empty" style="padding:0 2px 4px;font-size:11.5px">غيّر أسماء الحقول الخمسة لتناسب مادتك أو أسلوبك بالتحضير (تنطبق على كل الخطط اللاحقة).</p>'+
      cur.map((l,i)=>'<label>الحقل '+(i+1)+'<input data-pclabel="'+i+'" value="'+esc(l)+'"></label>').join("")+
    '</div>'+
    '<div class="sheetFoot"><button class="btn ghost" id="pcReset">إرجاع الافتراضي</button><button class="btn" id="pcSave">حفظ</button></div>'+
  '</div></div>';
  el("pcX").onclick=closeModal;
  el("pcReset").onclick=()=>{delete S.settings.planFieldLabels;save.settings();closeModal();renderDailyPlan();toast("رجعت العناوين الافتراضية")};
  el("pcSave").onclick=()=>{
    const vals=Array.from(el("modal").querySelectorAll("[data-pclabel]")).map(i=>i.value.trim()||"—");
    S.settings.planFieldLabels=vals;save.settings();closeModal();renderDailyPlan();toast("تم حفظ العناوين ✓");
  };
}
function openPlanEditor(plan){
  const labels=planLabels();
  const isNew=!plan;
  const data=plan?{...plan,fields:[...(plan.fields||["","","","",""])]}:{id:uid(),date:S.pDate,inst:S.curInst||INSTS()[0],grade:S.pGrade,section:S.pSection,topic:"",fields:["","","","",""],postNotes:""};
  let toolbar=null;
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet" style="max-height:90vh;overflow-y:auto">'+
    '<div class="sheetHead"><h3>📅 '+(isNew?"خطة جديدة":"تعديل الخطة")+'</h3><button class="x" id="peX">✕</button></div>'+
    '<div class="form">'+
      '<label>موضوع الدرس<input id="peTopic" value="'+esc(data.topic)+'" placeholder="مثال: المعادلة التربيعية"></label>'+
      '<div id="peToolbarHost" class="stickyToolbar"></div>'+
      '<p class="empty" style="padding:2px 4px;font-size:10.5px">💡 اضغط داخل أي قسم أدناه ثم استخدم الشريط أعلاه لتنسيقه أو لإدراج معادلة.</p>'+
      labels.map((l,i)=>'<div class="fieldLbl">'+(i+1)+'. '+esc(l)+'<div id="pe_field'+i+'_host"></div></div>').join("")+
      '<div class="fieldLbl">🗒️ ملاحظات بعد الحصة (تُملأ بعد التنفيذ)<div id="pe_post_host"></div></div>'+
    '</div>'+
    '<div class="sheetFoot">'+(isNew?"":'<button class="btn ghost" id="peDel">حذف</button>')+'<button class="btn ghost" id="pePrint">🖨 طباعة</button><button class="btn" id="peSave">حفظ</button></div>'+
  '</div></div>';
  el("peX").onclick=closeModal;
  el("peTopic").onchange=e=>data.topic=e.target.value;
  toolbar=createMathToolbar();
  el("peToolbarHost").appendChild(toolbar.bar);
  el("peToolbarHost").appendChild(toolbar.tplMenu);
  el("peToolbarHost").appendChild(toolbar.qtplMenu);
  el("peToolbarHost").appendChild(toolbar.imgInput);
  const editors=labels.map((_,i)=>{
    const ed=makeSimpleEditor("اكتب هنا…",data.fields[i]||"",toolbar);
    ed.addEventListener("input",()=>data.fields[i]=ed.innerHTML);
    el("pe_field"+i+"_host").appendChild(ed);
    return ed;
  });
  const postEd=makeSimpleEditor("اكتب هنا…",data.postNotes||"",toolbar);
  postEd.addEventListener("input",()=>data.postNotes=sanitizeRichHTML(postEd.innerHTML));
  el("pe_post_host").appendChild(postEd);
  toolbar.setActive(editors[0]);
  const collectAndSave=()=>{
    data.topic=el("peTopic").value.trim();
    const hwText=stripHTML(data.fields[4]||""); // حقل الواجب البيتي (الخامس افتراضيًا)
    if(isNew){
      S.dailyPlans=S.dailyPlans||[];
      S.dailyPlans.push(data);
      if(hwText.trim()){
        S.homework=S.homework||[];
        S.homework.unshift({id:uid(),date:data.date,title:hwText.trim(),grade:data.grade,section:data.section,done:{}});
        save.homework();
      }
    }else{
      const idx=S.dailyPlans.findIndex(p=>p.id===data.id);
      if(idx>-1)S.dailyPlans[idx]=data;
    }
    save.dailyPlans();
  };
  if(!isNew)el("peDel").onclick=()=>{
    S.dailyPlans=S.dailyPlans.filter(p=>p.id!==data.id);
    save.dailyPlans();closeModal();if(S.tab==="teaching")renderTeaching();toast("تم حذف الخطة");
  };
  el("pePrint").onclick=()=>{
    if(!data.topic.trim()){toast("اكتب عنوان الدرس أولاً");return}
    collectAndSave();
    printDailyPlan(data,labels);
  };
  el("peSave").onclick=()=>{
    collectAndSave();
    closeModal();if(S.tab==="teaching")renderTeaching();toast("تم حفظ الخطة ✓");
  };
}
function printDailyPlan(data,labels){
  const inst=data.inst||S.curInst||INSTS()[0];
  const sectionHTML=(label,val)=>stripHTML(val).trim()?
    '<div class="lpSection"><div class="lpSecTitle">'+esc(label)+'</div><div class="lpSecBody">'+val+'</div></div>':'';
  const body=
    '<div class="pInfo"><b>'+esc(data.grade)+'</b> — '+secTerm(inst)+' '+esc(data.section)+' &nbsp;|&nbsp; <b>المادة:</b> '+esc(MYSUB())+' &nbsp;|&nbsp; <b>التاريخ:</b> '+esc(data.date)+'</div>'+
    '<div class="lpTopicBox"><b>عنوان الدرس:</b> '+esc(data.topic)+'</div>'+
    labels.map((l,i)=>sectionHTML(l,data.fields[i]||"")).join("")+
    sectionHTML("🗒️ ملاحظات بعد الحصة",data.postNotes||"");
  printHTML("الخطة اليومية — "+data.topic,body,false,inst);
}
function applyAppFont(){
  const css=(PRINT_FONT_OPTIONS.find(f=>f.id===(S.settings.appFont||"tajawal"))||PRINT_FONT_OPTIONS[1]).css;
  document.documentElement.style.setProperty("--app-font",css);
}
function renderGrades(){
  if(gradeMode(S.gGrade)==="language"){
    if(!LANG_SKILL_KEYS.includes(S.gSub))S.gSub="listen";
  }else if(isMonth(S.gField)&&S.gSub!=="w"&&(!/^d\d+$/.test(S.gSub)||Number(S.gSub.slice(1))>=examCount(S.gField))){
    S.gSub="d0";
  }
  el("content").innerHTML=
    '<h2 class="h">📚 درجات مادة '+esc(MYSUB())+'</h2>'+
    '<div class="filters three">'+
      '<select id="gGrade">'+opts(gradesFor(S.curInst||INSTS()[0]),S.gGrade)+'</select>'+
      '<select id="gSection">'+opts(secList(S.curInst||INSTS()[0]),S.gSection)+'</select>'+
      '<select id="gField">'+GFIELDS.map(([f,l])=>'<option value="'+f+'"'+(S.gField===f?" selected":"")+'>'+l+'</option>').join("")+'</select>'+
    '</div>'+
    (isMonth(S.gField)?
      '<div class="filters" style="grid-template-columns:1fr"><select id="gSub">'+
        (gradeMode(S.gGrade)==="language"?(()=>{
          const lw=languageWeights(S.gGrade);
          return [["listen","🎧 إصغاء (من "+lw.listen+")"],["read","📖 قراءة (من "+lw.read+")"],["speak","🗣️ محادثة (من "+lw.speak+")"],["w","✍️ تحريري (من "+lw.written+")"]]
            .map(([v,l])=>'<option value="'+v+'"'+(S.gSub===v?" selected":"")+'>'+l+'</option>').join("");
        })():
        Array.from({length:examCount(S.gField)},(_,i)=>["d"+i,examName(S.gField,i)]).concat([["w","الامتحان التحريري"]])
          .map(([v,l])=>'<option value="'+v+'"'+(S.gSub===v?" selected":"")+'>'+esc(l)+'</option>').join(""))+
      '</select></div>':"")+
    '<div class="actions" style="margin-bottom:8px"><button class="btn ghost" id="gAna">📈 تحليل</button><button class="btn ghost" id="gExp">⬇ Excel</button><button class="btn ghost" id="gPrn">🖨 طباعة السجل الكامل</button></div>'+
    '<div class="actions" style="margin-bottom:12px;background:var(--okbg);padding:8px;border-radius:14px">'+
      '<button class="btn ghost" id="gExamPrn">🖨 نتائج هذا الامتحان</button><button class="btn ghost" id="gExamSend">📤 إرسال نتائج هذا الامتحان</button><button class="btn" id="gRep">📤 كشوفات كاملة للصف</button>'+
    '</div>'+
    '<div class="actions" style="margin-bottom:12px">'+
      '<button class="btn ghost" id="gAllDailyPrn">🖨 كل الامتحانات اليومية</button><button class="btn ghost" id="gAllMonthsPrn">🖨 كل الأشهر المكتملة</button>'+
      '<button class="btn ghost" id="gHalfYearPrn">🖨 تقرير نصف السنة</button><button class="btn ghost" id="gEndYearPrn">🖨 تقرير نهاية السنة</button>'+
    '</div>'+
    '<div id="gBox"></div>';
  el("gGrade").onchange=e=>{S.gGrade=e.target.value;renderGBox()};
  el("gSection").onchange=e=>{S.gSection=e.target.value;renderGBox()};
  el("gField").onchange=e=>{S.gField=e.target.value;if(!isMonth(S.gField))S.gSub=gradeMode(S.gGrade)==="language"?"listen":"d0";renderGrades()};
  const gs=el("gSub");if(gs&&gs.onchange!==undefined)gs.onchange=e=>{S.gSub=e.target.value;renderGBox()};
  el("gExp").onclick=exportClassGrades;
  el("gPrn").onclick=printClassGrades;
  el("gAna").onclick=openAnalysis;
  el("gAllDailyPrn").onclick=printAllDailyReport;
  el("gAllMonthsPrn").onclick=printAllMonthsReport;
  el("gHalfYearPrn").onclick=printHalfYearReport;
  el("gEndYearPrn").onclick=printEndYearReport;
  el("gExamPrn").onclick=printExamReport;
  el("gExamSend").onclick=sendExamReports;
  el("gRep").onclick=()=>{
    const targets=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection&&s.status==="مستمر").map(s=>({s,cardOpts:{mode:"report"}}));
    if(!targets.length){toast("لا يوجد طلبة بهذا الصف");return}
    openBulkSender("📤 تقارير "+S.gGrade+" / "+S.gSection,targets);
  };
  renderGBox();
}
function openAnalysis(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection);
  if(!list.length){toast("لا يوجد طلبة بهذا الصف");return}
  const recOf=s=>(S.grades[s.id]||{})[MYSUB()]||{};
  // متوسط الصف لكل محطة امتحانية
  const stAvgs=SEQ_LBL.map((lbl,i)=>{
    const vals=list.map(s=>seqVals(recOf(s))[i]).filter(v=>v!==null);
    return {lbl,avg:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null,n:vals.length};
  });
  // المتراجعون والمتحسنون
  const trends=list.map(s=>({s,t:trendOf(recOf(s)),last:lastVal(recOf(s))})).filter(x=>x.t!==null);
  const declining=trends.filter(x=>x.t<=-5).sort((a,b)=>a.t-b.t);
  const improving=trends.filter(x=>x.t>=5).sort((a,b)=>b.t-a.t).slice(0,3);
  // الترتيب حسب آخر درجة
  const ranked=list.map(s=>({s,last:lastVal(recOf(s))})).filter(x=>x.last!==null).sort((a,b)=>b.last-a.last);
  const top=ranked.slice(0,3),bottom=ranked.slice(-3).reverse();
  const row=(x,chipCls,chipTxt)=>'<div class="behavRow"><div class="bd" data-ana="'+x.s.id+'" style="cursor:pointer;font-weight:700">'+esc(x.s.name)+'</div><span class="chip '+chipCls+'">'+chipTxt+'</span></div>';
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>📈 تحليل '+S.gGrade+' / '+S.gSection+'</h3><button class="x" id="anaX">✕</button></div>'+
    '<div class="form">'+
      '<h3 class="h2" style="margin-top:0">متوسط الصف عبر الامتحانات</h3>'+
      '<div class="bars">'+stAvgs.map(a=>
        '<div class="barRow"><span>'+a.lbl+'</span><div class="barTrack"><div class="barFill" style="width:'+(a.avg===null?0:a.avg)+'%"></div></div><span class="barNum">'+(a.avg===null?"—":a.avg)+'</span></div>').join("")+'</div>'+
      '<h3 class="h2">⚠️ طلبة متراجعون (انخفاض 5+ بين آخر درجتين)</h3>'+
      '<div class="payList">'+(declining.length?declining.map(x=>row(x,"bad","▼ "+x.t)).join(""):'<p class="empty" style="padding:10px">لا يوجد تراجع ملحوظ 👍</p>')+'</div>'+
      (improving.length?'<h3 class="h2">🌟 الأكثر تحسناً</h3><div class="payList">'+improving.map(x=>row(x,"ok","▲ +"+x.t)).join("")+'</div>':"")+
      (ranked.length?'<h3 class="h2">الأوائل (آخر امتحان)</h3><div class="payList">'+top.map((x,i)=>row(x,"ok",(i+1)+" — "+x.last)).join("")+'</div>'+
      '<h3 class="h2">يحتاجون دعماً</h3><div class="payList">'+bottom.map(x=>row(x,"warn",""+x.last)).join("")+'</div>':"")+
      '<p class="empty" style="padding:8px;font-size:11.5px">اضغط اسم أي طالب لفتح درجاته. المحطات: درجات الشهور المحسوبة ثم نصف السنة ثم النهائي.</p>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="anaClose">تم</button></div>'+
  '</div></div>';
  el("anaX").onclick=el("anaClose").onclick=closeModal;
  el("modal").querySelectorAll("[data-ana]").forEach(d=>d.onclick=()=>openGradeSheet(d.dataset.ana));
}
function printHalfYearReport(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection&&s.status==="مستمر");
  if(!list.length){toast("لا يوجد طلبة بهذا الصف");return}
  const inst=reportInstFor(list);
  const rows=list.map(s=>{
    const rec=(S.grades[s.id]||{})[MYSUB()]||{};
    const c=subjectCalc(rec,s.grade);
    return [s.name,fmt(c.M1),fmt(c.M2),(rec.mid===undefined||rec.mid==="")?"—":rec.mid];
  });
  const body=
    '<div class="pInfo"><b>'+esc(S.gGrade)+'</b> — '+secTerm(inst)+' '+esc(S.gSection)+' &nbsp;|&nbsp; <b>المادة:</b> '+esc(MYSUB())+'</div>'+
    '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th><th>شهر أول ف1</th><th>شهر ثاني ف1</th><th>نصف السنة</th></tr></thead><tbody>'+
    rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(r[0])+'</td><td>'+r[1]+'</td><td>'+r[2]+'</td><td><b>'+r[3]+'</b></td></tr>').join("")+
    '</tbody></table>';
  printHTML("تقرير نصف السنة",body,false,inst);
}
function printEndYearReport(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection&&s.status==="مستمر");
  if(!list.length){toast("لا يوجد طلبة بهذا الصف");return}
  const inst=reportInstFor(list);
  const rows=list.map(s=>{
    const rec=(S.grades[s.id]||{})[MYSUB()]||{};
    const c=subjectCalc(rec,s.grade);
    return [s.name,fmt(c.saay),(rec.fin===undefined||rec.fin==="")?"—":rec.fin,fmt(c.final),c.status||"—"];
  });
  const body=
    '<div class="pInfo"><b>'+esc(S.gGrade)+'</b> — '+secTerm(inst)+' '+esc(S.gSection)+' &nbsp;|&nbsp; <b>المادة:</b> '+esc(MYSUB())+'</div>'+
    '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th><th>السعي السنوي</th><th>الامتحان النهائي</th><th>الدرجة النهائية</th><th>النتيجة</th></tr></thead><tbody>'+
    rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(r[0])+'</td><td>'+r[1]+'</td><td>'+r[2]+'</td><td><b>'+r[3]+'</b></td><td>'+r[4]+'</td></tr>').join("")+
    '</tbody></table>';
  printHTML("تقرير نهاية السنة",body,false,inst);
}
function printClassGrades(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection);
  if(!list.length){toast("لا يوجد طلبة للطباعة");return}
  const inst=reportInstFor(list);
  printHTML("سجل درجات الصف — "+S.gGrade+" "+secTerm(inst)+" "+S.gSection,
    '<table class="pTable"><thead><tr><th>ت</th><th>اسم الطالب</th><th>شهر أول ف1</th><th>شهر ثاني ف1</th><th>نصف السنة</th><th>شهر أول ف2</th><th>شهر ثاني ف2</th><th>السعي</th><th>النهائي</th><th>الدرجة النهائية</th><th>الدور الثاني</th><th>النتيجة</th></tr></thead><tbody>'+
    list.map((s,i)=>{
      const rec=(S.grades[s.id]||{})[MYSUB()]||{};
      const c=subjectCalc(rec,s.grade);
      const cell=v=>(v===undefined||v==="")?"—":esc(v);
      return '<tr><td>'+(i+1)+'</td><td style="text-align:right">'+esc(s.name)+'</td><td>'+fmt(c.M1)+'</td><td>'+fmt(c.M2)+'</td><td>'+cell(rec.mid)+'</td><td>'+fmt(c.M3)+'</td><td>'+fmt(c.M4)+'</td><td>'+fmt(c.saay)+'</td><td>'+cell(rec.fin)+'</td><td><b>'+fmt(c.final)+'</b></td><td>'+cell(rec.r2)+'</td><td>'+(c.status||"—")+'</td></tr>';
    }).join("")+'</tbody></table>',false,inst);
}
function classAvg(list,f,sub){
  const vals=list.map(s=>num(getCell((S.grades[s.id]||{})[MYSUB()]||{},f,sub))).filter(v=>v!==null);
  return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;
}
function renderGBox(){
  const list=VIS().filter(s=>s.grade===S.gGrade&&s.section===S.gSection);
  if(!list.length){el("gBox").innerHTML='<p class="empty">لا يوجد طلبة بهذا الصف وال'+secTerm(S.curInst)+'.</p>';return}
  const fLbl=GFIELDS.find(x=>x[0]===S.gField)[1];
  const sub=isMonth(S.gField)?S.gSub:null;
  const subLbl=sub?(gradeMode(S.gGrade)==="language"?{listen:"إصغاء",read:"قراءة",speak:"محادثة",w:"تحريري"}[sub]:(sub==="w"?"التحريري":examName(S.gField,Number(sub.slice(1))))):"";
  const avg=classAvg(list,S.gField,sub);
  el("gBox").innerHTML=
    '<div class="sumBox"><div><span>رصد: '+fLbl+(subLbl?" — "+subLbl:"")+'</span><b>'+list.length+' طالب</b></div><div><span>متوسط الصف</span><b>'+(avg===null?"—":avg)+'</b></div></div>'+
    '<ul class="slist">'+list.map(s=>{
      const rec=(S.grades[s.id]||{})[MYSUB()]||{};
      const c=subjectCalc(rec,s.grade);
      const mS=isMonth(S.gField)?monthScore(rec[S.gField],s.grade):null;
      return '<li class="srow noClick"><div class="sinfo" data-gs="'+s.id+'" style="cursor:pointer"><div class="sname">'+esc(s.name)+'</div>'+
        '<div class="smeta">'+(isMonth(S.gField)?'درجة الشهر: '+fmt(mS)+' — ':'')+'النهائية: '+fmt(c.final)+(c.status?' — '+c.status:'')+' (اضغط للتفاصيل)</div></div>'+
        '<input class="limIn" style="width:64px;padding:9px" inputmode="numeric" data-gid="'+s.id+'" value="'+esc(getCell(rec,S.gField,sub))+'" placeholder="—"></li>';
    }).join("")+'</ul>'+
    '<p class="empty" style="padding:10px">'+(gradeMode(S.gGrade)==="language"?'درجة الشهر = مجموع الإصغاء + القراءة + المحادثة + التحريري.':'درجة الشهر = (معدل اليوميات + التحريري) ÷ 2')+' — اضغط اسم الطالب لكل درجاته.</p>';
  const subMax=gradeMode(S.gGrade)==="language"?{listen:languageWeights(S.gGrade).listen,read:languageWeights(S.gGrade).read,speak:languageWeights(S.gGrade).speak,w:languageWeights(S.gGrade).written}[sub]:100;
  el("gBox").querySelectorAll("[data-gid]").forEach(inp=>{
    inp.oninput=()=>{
      let v=inp.value.trim();
      if(v!==""&&(isNaN(v)||Number(v)<0||Number(v)>subMax)){inp.value=v.slice(0,-1);return}
      const gg=S.grades[inp.dataset.gid]||(S.grades[inp.dataset.gid]={});
      const rec=gg[MYSUB()]||(gg[MYSUB()]={});
      setCell(rec,S.gField,sub,inp.value.trim());
      save.grades();
    };
    inp.onblur=()=>renderGBox();
  });
  el("gBox").querySelectorAll("[data-gs]").forEach(d=>d.onclick=()=>openGradeSheet(d.dataset.gs));
}
function openGradeSheet(id){
  const s=S.students.find(x=>x.id===id);if(!s)return;
  const gg=S.grades[id]||(S.grades[id]={});
  const rec=gg[MYSUB()]||(gg[MYSUB()]={});
  const monthCard=(f,lbl)=>{
    if(gradeMode(s.grade)==="language"){
      const lw=languageWeights(s.grade);
      const skillCell=(sub,icon,name,max)=>'<div class="gCell">'+icon+' '+name+' (من '+max+')<input inputmode="numeric" data-f="'+f+'" data-sub="'+sub+'" value="'+esc(getCell(rec,f,sub))+'" placeholder="—"></div>';
      return '<div class="subCard"><div class="subHead"><span class="subName">'+lbl+'</span>'+
        '<span class="chip ok" data-mchip="'+f+'">الدرجة: '+fmt(monthScore(rec[f],s.grade))+'</span></div>'+
        '<div class="gGrid">'+
          skillCell("listen","🎧","إصغاء",lw.listen)+
          skillCell("read","📖","قراءة",lw.read)+
          skillCell("speak","🗣️","محادثة",lw.speak)+
          skillCell("w","✍️","تحريري",lw.written)+
        '</div></div>';
    }
    const n=examCount(f);
    return '<div class="subCard"><div class="subHead"><span class="subName">'+lbl+'</span>'+
      '<span class="chip ok" data-mchip="'+f+'">الدرجة: '+fmt(monthScore(rec[f],s.grade))+'</span></div>'+
      '<div class="gGrid">'+
        Array.from({length:n},(_,i)=>
          '<div class="gCell"><span class="examLbl" data-examren="'+f+'|'+i+'" title="اضغط لتغيير الاسم">'+esc(examName(f,i))+' ✏️</span><input inputmode="numeric" data-f="'+f+'" data-sub="d'+i+'" value="'+esc(getCell(rec,f,"d"+i))+'" placeholder="—"></div>').join("")+
        '<div class="gCell">التحريري<input inputmode="numeric" data-f="'+f+'" data-sub="w" value="'+esc(getCell(rec,f,"w"))+'" placeholder="—"></div>'+
      '</div>'+
      '<div class="actions" style="margin-top:8px;gap:6px"><button class="btn ghost" data-examadd="'+f+'" style="padding:6px 12px;font-size:11.5px">+ امتحان لهذا الشهر</button>'+
      (n>1?'<button class="btn ghostD" data-examdel="'+f+'" style="padding:6px 12px;font-size:11.5px">🗑 حذف آخر امتحان</button>':'')+'</div>'+
      '</div>';
  };
  const fLabels={m1:"شهر أول ف1",m2:"شهر ثاني ف1",mid:"نصف السنة",m3:"شهر أول ف2",m4:"شهر ثاني ف2",fin:"الامتحان النهائي",r2:"الدور الثاني"};
  const LANG_SUB_LBL={listen:"إصغاء",read:"قراءة",speak:"محادثة",w:"تحريري"};
  const fieldLabel=inp=>{
    const lbl=fLabels[inp.dataset.f]||inp.dataset.f;
    if(!inp.dataset.sub)return lbl;
    if(gradeMode(s.grade)==="language")return lbl+" — "+LANG_SUB_LBL[inp.dataset.sub];
    return lbl+" — "+(inp.dataset.sub==="w"?"التحريري":examName(inp.dataset.f,Number(inp.dataset.sub.slice(1))));
  };
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>'+esc(s.name)+' — '+esc(MYSUB())+'</h3><button class="x" id="gx">✕</button></div>'+
    '<div class="form">'+
      '<div class="subCard" style="background:var(--okbg);margin-bottom:0">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" id="gCalcToggle">'+
          '<span style="font-weight:700;font-size:13px">🧮 حاسبة تحويل الدرجات — إذا الاختبار مو من 100</span>'+
          '<span id="gCalcArrow" style="font-size:13px;color:#64748B">▾</span>'+
        '</div>'+
        '<div id="gCalcBody" style="display:none;margin-top:10px">'+
          '<p class="empty" style="padding:6px;font-size:11px;margin:0 0 8px">اضغط بالحقل اللي تريد تعبئته (يومي أو تحريري بالأسفل) أول شي، وبعدها اكتب الدرجتين هنا.</p>'+
          '<div class="grid2">'+
            '<label style="font-size:11.5px">درجة الطالب<input type="number" inputmode="decimal" id="gcScore" placeholder="مثال: 8"></label>'+
            '<label style="font-size:11.5px">الاختبار من كم<input type="number" inputmode="decimal" id="gcMax" placeholder="مثال: 10"></label>'+
          '</div>'+
          '<div style="margin-top:8px;text-align:center;font-size:16px;font-weight:900;color:var(--green)" id="gcResult">—</div>'+
          '<button class="btn full" id="gcApply" disabled style="margin-top:8px">👆 اضغط أولاً داخل الحقل المطلوب تعبئته</button>'+
        '</div>'+
      '</div>'+
      monthCard("m1","شهر أول — الفصل الأول")+
      monthCard("m2","شهر ثاني — الفصل الأول")+
      '<div class="subCard"><div class="gGrid">'+
        '<div class="gCell">نصف السنة<input inputmode="numeric" data-f="mid" value="'+esc(rec.mid||"")+'" placeholder="—"></div>'+
        '<div class="gCell">الامتحان النهائي<input inputmode="numeric" data-f="fin" value="'+esc(rec.fin||"")+'" placeholder="—"></div>'+
        '<div class="gCell">الدور الثاني<input inputmode="numeric" data-f="r2" value="'+esc(rec.r2||"")+'" placeholder="للمكمل"></div>'+
      '</div></div>'+
      monthCard("m3","شهر أول — الفصل الثاني")+
      monthCard("m4","شهر ثاني — الفصل الثاني")+
      '<div class="subRes" id="gsRes">'+subResHTML(subjectCalc(rec,s.grade))+'</div>'+
      '<p class="empty" style="padding:8px;font-size:11.5px">'+(gradeMode(s.grade)==="language"?'درجة الشهر = مجموع الإصغاء + القراءة + المحادثة + التحريري.':'درجة الشهر = (معدل اليوميات + التحريري) ÷ 2 — تحتاج يوميين على الأقل. اليوميات الفارغة لا تدخل بالمعدل.')+'</p>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="gClose">تم</button></div>'+
  '</div></div>';
  el("gCalcToggle").onclick=()=>{
    const body=el("gCalcBody");
    const open=body.style.display!=="none";
    body.style.display=open?"none":"block";
    el("gCalcArrow").textContent=open?"▾":"▴";
  };
  let gLastFocused=null;
  const computeResult=()=>{
    const score=Number(el("gcScore").value),max=Number(el("gcMax").value);
    if(!el("gcScore").value||!el("gcMax").value||!max)return null;
    return Math.round((score/max)*100);
  };
  const updateCalc=()=>{
    const r=computeResult();
    el("gcResult").textContent=r===null?"—":"الناتج من 100 = "+r;
    updateApplyBtn();
  };
  const updateApplyBtn=()=>{
    const btn=el("gcApply");
    const r=computeResult();
    if(gLastFocused&&r!==null){btn.disabled=false;btn.textContent="✔ تطبيق "+r+" على: "+fieldLabel(gLastFocused)}
    else if(gLastFocused){btn.disabled=true;btn.textContent="اكتب الدرجتين أعلاه ↑"}
    else{btn.disabled=true;btn.textContent="👆 اضغط أولاً داخل الحقل المطلوب تعبئته"}
  };
  el("gcScore").oninput=updateCalc;
  el("gcMax").oninput=updateCalc;
  el("gcApply").onclick=()=>{
    const r=computeResult();
    if(!gLastFocused||r===null)return;
    gLastFocused.value=Math.min(100,Math.max(0,r));
    gLastFocused.dispatchEvent(new Event("input",{bubbles:true}));
    toast("تم تعبئة "+fieldLabel(gLastFocused)+" ✓");
    el("gcScore").value="";el("gcMax").value="";
    el("gcResult").textContent="—";
    gLastFocused=null;updateApplyBtn();
  };
  el("gx").onclick=el("gClose").onclick=()=>{closeModal();if(el("gBox"))renderGBox()};
  el("modal").querySelectorAll("input[data-f]").forEach(inp=>{
    inp.addEventListener("focus",()=>{gLastFocused=inp;updateApplyBtn()});
    inp.oninput=()=>{
      let v=inp.value.trim();
      const fMax=(gradeMode(s.grade)==="language"&&inp.dataset.sub)?{listen:languageWeights(s.grade).listen,read:languageWeights(s.grade).read,speak:languageWeights(s.grade).speak,w:languageWeights(s.grade).written}[inp.dataset.sub]:100;
      if(v!==""&&(isNaN(v)||Number(v)<0||Number(v)>fMax)){inp.value=v.slice(0,-1);return}
      setCell(rec,inp.dataset.f,inp.dataset.sub||null,inp.value.trim());
      save.grades();
      if(isMonth(inp.dataset.f)){
        const chip=el("modal").querySelector('[data-mchip="'+inp.dataset.f+'"]');
        if(chip)chip.textContent="الدرجة: "+fmt(monthScore(rec[inp.dataset.f],s.grade));
      }
      el("gsRes").innerHTML=subResHTML(subjectCalc(rec,s.grade));
    };
  });
  el("modal").querySelectorAll("[data-examren]").forEach(lbl=>lbl.onclick=()=>{
    const[f,i]=lbl.dataset.examren.split("|");
    const nv=prompt("اسم هذا الامتحان (مثال: إلكتروني، شفهي، يومي):",examName(f,Number(i)));
    if(nv===null)return;
    if(setExamName(f,Number(i),nv)){toast("تم تحديث الاسم ✓");openGradeSheet(id)}
  });
  el("modal").querySelectorAll("[data-examadd]").forEach(b=>b.onclick=()=>{
    addExamSlot(b.dataset.examadd);openGradeSheet(id);toast("أُضيف امتحان جديد لهذا الشهر");
  });
  el("modal").querySelectorAll("[data-examdel]").forEach(b=>b.onclick=()=>{
    if(!confirm("حذف آخر امتحان بهذا الشهر؟ هذا سيحذف درجاته المرصودة لكل الطلبة."))return;
    if(removeExamSlot(b.dataset.examdel))openGradeSheet(id);
  });
}
function fmt(v){return v===null?"—":Math.round(v).toString()}
function subResHTML(c){
  return '<div class="resBox">السعي السنوي<b>'+fmt(c.saay)+'</b></div>'+
    '<div class="resBox">الدرجة النهائية<b>'+fmt(c.final)+'</b></div>'+
    '<div class="resBox">النتيجة<b style="color:'+(c.status==="ناجح"?"var(--green)":c.status==="مكمل"?"var(--red)":"inherit")+'">'+(c.status||"—")+'</b></div>';
}

