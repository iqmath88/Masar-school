/* ============ الواجبات ============ */
function hwStats(id){
  const s=S.students.find(x=>x.id===id);if(!s)return {done:0,total:0};
  const hws=S.homework.filter(h=>h.grade===s.grade&&h.section===s.section);
  return {done:hws.filter(h=>h.done&&h.done[id]).length,total:hws.length};
}
/* ============ نظام تحفيز الطلبة ============ */
function attRate(id){
  const days=Object.values(S.attendance).filter(m=>m[id]);
  if(!days.length)return null;
  return days.filter(m=>m[id]==="حاضر").length/days.length;
}
function studentPoints(s){
  const rec=(S.grades[s.id]||{})[MYSUB()]||{};
  const last=lastVal(rec);
  const gradePts=last!==null?Math.round(last):50;
  const ar=attRate(s.id);
  const attPts=ar!==null?Math.round(ar*100):70;
  const hw=hwStats(s.id);
  const hwPts=hw.total?Math.round(hw.done/hw.total*100):60;
  return Math.round(gradePts*0.5+attPts*0.3+hwPts*0.2);
}
function studentLevel(pts){return Math.max(1,Math.floor(pts/20)+1)}
function studentBadges(s){
  const badges=[];
  const rec=(S.grades[s.id]||{})[MYSUB()]||{};
  const days=Object.values(S.attendance).filter(m=>m[s.id]);
  if(days.length>=5&&days.every(m=>m[s.id]==="حاضر"))badges.push({icon:"🎯",name:"حضور مثالي"});
  const t=trendOf(rec);
  if(t!==null&&t>=10)badges.push({icon:"🚀",name:"تحسّن رائع"});
  const last=lastVal(rec);
  if(last!==null&&last>=90)badges.push({icon:"🌟",name:"متفوق"});
  const hw=hwStats(s.id);
  if(hw.total>=2&&hw.done===hw.total)badges.push({icon:"📋",name:"ملتزم بالواجبات"});
  if(last!==null&&last>=50&&last<70)badges.push({icon:"💪",name:"بحاجة دفعة أخيرة"});
  return badges;
}
function classRanking(grade,section){
  const list=VIS().filter(s=>s.grade===grade&&s.section===section&&s.status==="مستمر");
  return list.map(s=>({s,pts:studentPoints(s),badges:studentBadges(s)})).sort((a,b)=>b.pts-a.pts);
}
function openHonorBoard(){
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>🏆 لوحة الشرف</h3><button class="x" id="hbX">✕</button></div>'+
    '<div class="form">'+
      '<div class="filters">'+
        '<select id="hbGrade">'+opts(gradesFor(S.curInst||INSTS()[0]),S.gGrade)+'</select>'+
        '<select id="hbSection">'+opts(secList(S.curInst||INSTS()[0]),S.gSection)+'</select>'+
      '</div>'+
      '<div id="hbList" class="payList"></div>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="hbClose">تم</button></div>'+
  '</div></div>';
  const renderHb=()=>{
    const grade=el("hbGrade").value,section=el("hbSection").value;
    const rank=classRanking(grade,section);
    el("hbList").innerHTML=rank.length===0?'<p class="empty" style="padding:14px">لا يوجد طلبة بهذا الصف.</p>':
      rank.map((r,i)=>{
        const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1)+".";
        return '<div class="behavRow" data-hbid="'+r.s.id+'" style="cursor:pointer">'+
          '<span class="bChip p" style="min-width:28px;text-align:center">'+medal+'</span>'+
          '<div class="bd"><b>'+esc(r.s.name)+'</b> — مستوى '+studentLevel(r.pts)+' ('+r.pts+' نقطة)'+
          (r.badges.length?'<div style="margin-top:3px">'+r.badges.map(b=>b.icon).join(" ")+'</div>':'')+'</div>'+
        '</div>';
      }).join("");
    el("hbList").querySelectorAll("[data-hbid]").forEach(row=>row.onclick=()=>openCertificate(row.dataset.hbid));
  };
  el("hbGrade").onchange=renderHb;el("hbSection").onchange=renderHb;
  el("hbX").onclick=el("hbClose").onclick=closeModal;
  renderHb();
}
function buildCertificateCanvas(s,logoImg){
  const W=1600,H=1131;
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const ctx=cv.getContext("2d");
  ctx.direction="rtl";ctx.textBaseline="middle";
  const F=(w,sz)=>ctx.font=(w?w+" ":"")+sz+"px Cairo, sans-serif";
  // خلفية متدرجة فاخرة (كريمي دافئ نحو الحواف الذهبية)
  const bgGrad=ctx.createRadialGradient(W/2,H/2,H*0.15,W/2,H/2,W*0.65);
  bgGrad.addColorStop(0,"#FFFDF7");bgGrad.addColorStop(1,"#FAF3E3");
  ctx.fillStyle=bgGrad;ctx.fillRect(0,0,W,H);
  // زخرفة خلفية خفيفة جداً (دوائر شفافة كبيرة)
  ctx.save();ctx.globalAlpha=0.05;
  ctx.fillStyle="#D4AF37";
  ctx.beginPath();ctx.arc(W*0.12,H*0.15,220,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(W*0.9,H*0.88,260,0,Math.PI*2);ctx.fill();
  ctx.restore();
  // إطار مزدوج فاخر
  ctx.strokeStyle="#D4AF37";ctx.lineWidth=14;ctx.strokeRect(30,30,W-60,H-60);
  ctx.strokeStyle="#0F172A";ctx.lineWidth=3;ctx.strokeRect(54,54,W-108,H-108);
  ctx.strokeStyle="#D4AF37";ctx.lineWidth=1.5;ctx.strokeRect(66,66,W-132,H-132);
  // زخارف الزوايا (أقواس ذهبية بسيطة بكل ركن)
  const corner=(cx,cy,rot)=>{
    ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);
    ctx.strokeStyle="#D4AF37";ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(0,50);ctx.quadraticCurveTo(0,0,50,0);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,80);ctx.quadraticCurveTo(0,0,80,0);ctx.globalAlpha=0.5;ctx.stroke();
    ctx.restore();
  };
  corner(70,70,0);corner(W-70,70,Math.PI/2);corner(W-70,H-70,Math.PI);corner(70,H-70,-Math.PI/2);
  // شعار المؤسسة أو ميدالية ذهبية بأعلى الوسط
  ctx.textAlign="center";
  const medalY=145;
  if(logoImg){
    ctx.save();ctx.beginPath();ctx.arc(W/2,medalY,58,0,Math.PI*2);ctx.clip();
    ctx.drawImage(logoImg,W/2-58,medalY-58,116,116);ctx.restore();
    ctx.strokeStyle="#D4AF37";ctx.lineWidth=5;ctx.beginPath();ctx.arc(W/2,medalY,58,0,Math.PI*2);ctx.stroke();
  }else{
    const medalGrad=ctx.createLinearGradient(W/2-58,medalY-58,W/2+58,medalY+58);
    medalGrad.addColorStop(0,"#F4D976");medalGrad.addColorStop(0.5,"#D4AF37");medalGrad.addColorStop(1,"#B8860B");
    ctx.fillStyle=medalGrad;ctx.beginPath();ctx.arc(W/2,medalY,58,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.beginPath();ctx.arc(W/2,medalY,50,0,Math.PI*2);ctx.stroke();
    F("900",56);ctx.fillStyle="#fff";ctx.fillText("🏆",W/2,medalY+4);
  }
  // العنوان الرئيسي
  ctx.fillStyle="#0F172A";F("900",72);ctx.fillText("شهادة تقدير",W/2,280);
  ctx.fillStyle="#D4AF37";F("700",24);ctx.fillText("★  ★  ★  ★  ★",W/2,330);
  ctx.fillStyle="#64748B";F("500",26);ctx.fillText("تُمنح هذه الشهادة بكل فخر واعتزاز إلى",W/2,400);
  // اسم الطالب — أكبر وأبرز عنصر بالشهادة (نصغّر الخط تلقائيًا لو الاسم طويل حتى لا يتجاوز عرض الشهادة)
  ctx.fillStyle="#0F172A";
  const nameMaxW=W-240;
  let nameSz=92;
  F("900",nameSz);
  while(ctx.measureText(s.name).width>nameMaxW&&nameSz>44){nameSz-=2;F("900",nameSz)}
  ctx.fillText(s.name,W/2,505);
  ctx.strokeStyle="#D4AF37";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(W/2-260,548);ctx.lineTo(W/2+260,548);ctx.stroke();
  // نص التقدير
  ctx.fillStyle="#334155";F("600",30);
  const pts=studentPoints(s),lvl=studentLevel(pts);
  ctx.fillText("تقديراً لتميّزه وجهده المتواصل ومثابرته بمادة "+MYSUB(),W/2,605);
  ctx.fillStyle="#B8860B";F("900",30);
  ctx.fillText("مستوى "+lvl+"  —  "+pts+" نقطة",W/2,650);
  // الشارات المكتسبة
  const badges=studentBadges(s);
  if(badges.length){
    ctx.fillStyle="#475569";F("500",20);ctx.fillText("الإنجازات المكتسبة",W/2,710);
    F("",50);ctx.fillText(badges.map(b=>b.icon).join("     "),W/2,765);
  }
  ctx.fillStyle="#94A3B8";F("500",20);ctx.fillText(instOf(s)+"  —  العام الدراسي "+academicYearStr(),W/2,830);
  // التوقيع
  ctx.strokeStyle="#D4AF37";ctx.lineWidth=2;ctx.setLineDash([8,7]);
  ctx.beginPath();ctx.moveTo(W/2-220,910);ctx.lineTo(W/2+220,910);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle="#64748B";F("600",22);ctx.fillText("مدرس المادة",W/2,950);
  ctx.fillStyle="#0F172A";F("900",34);ctx.fillText(S.settings.teacher||"أستاذ المادة",W/2,995);
  ctx.fillStyle="#94A3B8";F("500",18);ctx.fillText("تاريخ الإصدار: "+todayStr(),W/2,1075);
  return cv;
}
function openCertificate(id){
  const s=S.students.find(x=>x.id===id);if(!s)return;
  const cv=buildCertificateCanvas(s);
  const url=cv.toDataURL("image/png");
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>🏆 شهادة '+esc(s.name)+'</h3><button class="x" id="certX">✕</button></div>'+
    '<div class="form"><img src="'+url+'" style="width:100%;border-radius:12px;border:1px solid var(--line)"></div>'+
    '<div class="sheetFoot"><button class="btn ghost" id="certBack">رجوع للوحة</button><button class="btn" id="certSend">📤 إرسال الشهادة</button></div>'+
  '</div></div>';
  el("certX").onclick=closeModal;
  el("certBack").onclick=openHonorBoard;
  el("certSend").onclick=async()=>{
    const btn=el("certSend");btn.disabled=true;btn.textContent="⏳...";
    cv.toBlob(async b=>{
      const fname="شهادة_تقدير_"+s.name.trim().replace(/\s+/g,"_")+".png";
      const file=new File([b],fname,{type:"image/png"});
      const text="🏆 شهادة تقدير "+genderNoun(s)+" ("+s.name+") — مستوى "+studentLevel(studentPoints(s))+" بمادة "+MYSUB();
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file],title:fname,text});logMessage(s,{badge:"🏆 شهادة تقدير",bodyText:text},s.sphone?"الطالب":"ولي الأمر");if(el("certSend")){btn.disabled=false;btn.textContent="📤 إرسال الشهادة"}return}catch(e){}
      }
      const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=fname;a.click();
      const n=normPhone(s.sphone||s.phone);
      if(n)window.open("https://wa.me/"+n+"?text="+encodeURIComponent(text),"_blank");
      logMessage(s,{badge:"🏆 شهادة تقدير",bodyText:text},s.sphone?"الطالب":"ولي الأمر");
      if(el("certSend")){btn.disabled=false;btn.textContent="📤 إرسال الشهادة"}
    },"image/png");
  };
}
function renderHomework(){
  el("content").innerHTML=
    '<h2 class="h">📋 واجبات مادة '+esc(MYSUB())+'</h2>'+
    '<div class="filters">'+
      '<select id="hGrade">'+opts(gradesFor(S.curInst||INSTS()[0]),S.hGrade)+'</select>'+
      '<select id="hSection">'+opts(secList(S.curInst||INSTS()[0]),S.hSection)+'</select>'+
    '</div>'+
    '<div class="addRow" style="grid-template-columns:1fr auto"><input id="hwTitle" placeholder="عنوان الواجب — مثال: تمارين ص45"><button class="btn" id="hwAdd">+ واجب</button></div>'+
    '<div id="hwList" style="margin-top:12px"></div>';
  el("hGrade").onchange=e=>{S.hGrade=e.target.value;S.hOpen="";renderHwList()};
  el("hSection").onchange=e=>{S.hSection=e.target.value;S.hOpen="";renderHwList()};
  el("hwAdd").onclick=()=>{
    const t=el("hwTitle").value.trim();
    if(!t){toast("اكتب عنوان الواجب");return}
    S.homework.unshift({id:uid(),date:todayStr(),title:t,grade:S.hGrade,section:S.hSection,done:{}});
    save.homework();el("hwTitle").value="";S.hOpen=S.homework[0].id;renderHwList();toast("تمت إضافة الواجب");
  };
  renderHwList();
}
function renderHwList(){
  const hws=S.homework.filter(h=>h.grade===S.hGrade&&h.section===S.hSection);
  const list=VIS().filter(s=>s.grade===S.hGrade&&s.section===S.hSection&&s.status==="مستمر");
  el("hwList").innerHTML=hws.length===0?
    '<p class="empty">لا توجد واجبات مسجلة لهذا الصف. أضف واجباً من الأعلى.</p>':
    hws.map(h=>{
      const doneN=list.filter(s=>h.done&&h.done[s.id]).length;
      const open=S.hOpen===h.id;
      return '<div class="subCard">'+
        '<div class="subHead" data-hw="'+h.id+'" style="cursor:pointer"><span class="subName">📋 '+esc(h.title)+'</span>'+
        '<span class="chip '+(doneN===list.length&&list.length?"ok":"warn")+'">'+doneN+'/'+list.length+' سلّموا</span></div>'+
        '<div class="bDate" style="font-size:11px;color:#64748B">'+h.date+' — اضغط العنوان '+(open?'للإغلاق':'لتأشير التسليم')+'</div>'+
        (open?
          '<div class="actions" style="margin:8px 0"><button class="btn ghost" data-hann="'+h.id+'" style="flex:1">📢 إبلاغ الجميع بالواجب</button><button class="btn ghost" data-hrem="'+h.id+'" style="flex:1">⏰ تذكير غير المسلّمين</button></div>'+
          '<div class="payList">'+list.map(s=>{
            const d=h.done&&h.done[s.id];
            return '<div class="behavRow"><div class="bd">'+esc(s.name)+'</div>'+
              '<button class="att '+(d?"selG":"")+'" data-hd="'+h.id+'|'+s.id+'">'+(d?"سلّم ✓":"لم يسلّم")+'</button>'+
              (!d?'<button class="wa" data-hwa="'+h.id+'|'+s.id+'">📱</button>':"")+
              '</div>';
          }).join("")+'</div>'+
          '<button class="btn ghostD full" data-hdel="'+h.id+'" style="margin-bottom:0">حذف الواجب</button>'
        :"")+
      '</div>';
    }).join("");
  el("hwList").querySelectorAll("[data-hw]").forEach(d=>d.onclick=()=>{S.hOpen=S.hOpen===d.dataset.hw?"":d.dataset.hw;renderHwList()});
  el("hwList").querySelectorAll("[data-hd]").forEach(b=>b.onclick=()=>{
    const parts=b.dataset.hd.split("|");
    const h=S.homework.find(x=>x.id===parts[0]);if(!h)return;
    h.done=h.done||{};
    if(h.done[parts[1]])delete h.done[parts[1]];else h.done[parts[1]]=true;
    save.homework();renderHwList();
  });
  el("hwList").querySelectorAll("[data-hwa]").forEach(b=>b.onclick=()=>{
    const parts=b.dataset.hwa.split("|");
    const h=S.homework.find(x=>x.id===parts[0]);
    const s=S.students.find(x=>x.id===parts[1]);
    if(s&&h)shareItemCard(s,{badge:"📚 لم يسلّم الواجب",chip:"متابعة واجب",tone:"warn",filePrefix:"واجب",
      bodyText:"السلام عليكم،\nنود إعلامكم بأن "+genderNoun(s)+" ("+s.name+") لم يسلّم واجب مادة "+MYSUB()+": «"+h.title+"» بتاريخ "+h.date+".\nيرجى المتابعة معه."});
  });
  el("hwList").querySelectorAll("[data-hdel]").forEach(b=>b.onclick=()=>{
    S.homework=S.homework.filter(x=>x.id!==b.dataset.hdel);
    save.homework();renderHwList();toast("تم حذف الواجب");
  });
  el("hwList").querySelectorAll("[data-hann]").forEach(b=>b.onclick=()=>{
    const h=S.homework.find(x=>x.id===b.dataset.hann);if(!h)return;
    const targets=hwClassStudents(h).map(s=>({s,cardOpts:{badge:"📢 إبلاغ بواجب جديد",chip:"واجب جديد",tone:"info",filePrefix:"واجب_جديد",bodyText:hwAnnounceMsg(h,s)}}));
    openBulkSender("📢 إبلاغ بالواجب: "+h.title,targets);
  });
  el("hwList").querySelectorAll("[data-hrem]").forEach(b=>b.onclick=()=>{
    const h=S.homework.find(x=>x.id===b.dataset.hrem);if(!h)return;
    const targets=hwClassStudents(h).filter(s=>!(h.done&&h.done[s.id])).map(s=>({s,cardOpts:{badge:"⏰ تذكير بواجب",chip:"تذكير واجب",tone:"warn",filePrefix:"تذكير_واجب",bodyText:hwRemindMsg(h,s)}}));
    if(!targets.length){toast("الجميع سلّموا ✓");return}
    openBulkSender("⏰ تذكير غير المسلّمين",targets,(n)=>{if(n>0){h.notified=todayStr();save.homework();if(S.tab==="home")render()}});
  });
}
function hwClassStudents(h){
  return S.students.filter(s=>s.grade===h.grade&&s.section===h.section&&s.status==="مستمر"&&(!h.inst||instOf(s)===h.inst||true));
}
function hwAnnounceMsg(h,s){
  return "السلام عليكم ورحمة الله،\nنود إعلامكم بأنه تم تكليف "+genderNoun(s)+" ("+s.name+") بواجب في مادة "+MYSUB()+":\n📋 "+h.title+"\nبتاريخ "+h.date+" — يرجى متابعة إنجازه وتسليمه.";
}
function hwRemindMsg(h,s){
  return "السلام عليكم،\nنود تذكيركم بأن "+genderNoun(s)+" ("+s.name+") لم يسلّم بعد واجب مادة "+MYSUB()+":\n📋 "+h.title+" (بتاريخ "+h.date+")\nيرجى المتابعة معه.";
}
/* ============ التقرير الشامل ============ */

/* ============ الإرسال الجماعي ============ */
function openBulkSender(title,items,doneCb){
  title=esc(title);
  let target="guardian";
  const phoneOf=x=>target==="student"?x.s.sphone:x.s.phone;
  let withPhone=items.filter(x=>normPhone(phoneOf(x)));
  let noPhone=items.filter(x=>!normPhone(phoneOf(x)));
  const anyStudentPhone=items.some(x=>x.s.sphone);
  let idx=0;
  const recompute=()=>{withPhone=items.filter(x=>normPhone(phoneOf(x)));noPhone=items.filter(x=>!normPhone(phoneOf(x)));idx=0};
  const renderB=()=>{
    const next=withPhone[idx];
    const recLbl=target==="student"?"الطالب":"ولي الأمر";
    el("modal").innerHTML='<div class="overlay"><div class="sheet">'+
      '<div class="sheetHead"><h3>'+title+'</h3><button class="x" id="bsX">✕</button></div>'+
      '<div class="form">'+
        (anyStudentPhone?'<div class="addRow" style="grid-template-columns:1fr 1fr"><button class="att'+(target==="guardian"?" selG":"")+'" id="bsToG" style="padding:9px">لأولياء الأمور</button><button class="att'+(target==="student"?" selG":"")+'" id="bsToS" style="padding:9px">للطلبة أنفسهم</button></div>':'')+
        '<div class="sumBox"><div><span>أُرسلت</span><b>'+idx+' / '+withPhone.length+'</b></div>'+(noPhone.length?'<div><span>بلا رقم هاتف</span><b>'+noPhone.length+'</b></div>':'')+'</div>'+
        (next?
          '<button class="btn full" id="bsNext" style="font-size:15px;padding:14px">📤 إرسال إلى '+recLbl+': '+esc(next.s.name)+'</button>'+
          '<p class="empty" style="padding:8px;font-size:11.5px">تنفتح قائمة المشاركة مباشرة بالصورة — اختر واتساب ثم المحادثة الصحيحة وأرسل، وارجع للتطبيق والزر ينتقل للطالب التالي تلقائياً.</p>'
          :'<p class="empty" style="padding:14px">✅ اكتملت كل الرسائل</p>')+
        '<div class="payList">'+withPhone.map((x,i)=>
          '<div class="behavRow"><span class="bChip '+(i<idx?'p':'w')+'">'+(i<idx?'✓':(i+1))+'</span><div class="bd">'+esc(x.s.name)+'</div></div>').join('')+
          noPhone.map(x=>'<div class="behavRow" style="opacity:.55"><span class="bChip v">✕</span><div class="bd">'+esc(x.s.name)+' — لا يوجد رقم</div></div>').join('')+
        '</div>'+
      '</div>'+
      '<div class="sheetFoot">'+(next?'<button class="btn ghost" id="bsSkip">تخطي هذا الطالب</button>':'')+'<button class="btn" id="bsClose">'+(next?'إيقاف':'تم')+'</button></div>'+
    '</div></div>';
    el("bsX").onclick=el("bsClose").onclick=()=>{closeModal();if(doneCb)doneCb(idx)};
    if(anyStudentPhone){
      el("bsToG").onclick=()=>{target="guardian";recompute();renderB()};
      el("bsToS").onclick=()=>{target="student";recompute();renderB()};
    }
    if(next){
      el("bsNext").onclick=async()=>{
        const btn=el("bsNext");btn.disabled=true;btn.textContent="⏳ جارِ تحضير البطاقة…";
        await shareItemCard(next.s,Object.assign({},next.cardOpts,{toPhone:phoneOf(next),recipientLabel:recLbl}));
        idx++;renderB();
      };
      el("bsSkip").onclick=()=>{idx++;renderB()};
    }
  };
  if(!withPhone.length){toast("لا يوجد طلبة بأرقام هواتف مسجلة");return}
  renderB();
}

/* ============ أرشيف السنوات ============ */
async function openArchive(){
  const idx=await loadRaw("archives",[]);
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>📦 أرشيف السنوات</h3><button class="x" id="arX">✕</button></div>'+
    '<div class="form">'+
      '<label>اسم السنة المؤرشفة<input id="arLabel" value="العام الدراسي '+academicYearStr()+'"></label>'+
      '<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="arPromote" checked style="width:auto"> ترقية الطلبة للصف التالي تلقائياً (والسادس إعدادي ← متخرج)</label>'+
      '<button class="btn full" id="arClose2" style="margin:0">📦 طي السنة الحالية وبدء سنة جديدة</button>'+
      '<p class="empty" style="padding:8px;font-size:11.5px">الطي يحفظ نسخة كاملة من السنة (درجات، حضور، واجبات، سلوك، أقساط) بالأرشيف، ثم يصفّرها لسنة جديدة — الطلبة والمؤسسات والجدول يبقون. خذ نسخة احتياطية قبلها للاطمئنان.</p>'+
      '<h3 class="h2">السنوات المؤرشفة</h3><div id="arList" class="payList"></div>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="arDone">تم</button></div>'+
  '</div></div>';
  const renderAr=async()=>{
    const list=await loadRaw("archives",[]);
    el("arList").innerHTML=list.length===0?'<p class="empty" style="padding:10px">لا توجد سنوات مؤرشفة بعد.</p>':
      list.map(a=>'<div class="behavRow"><span class="bChip p">'+a.count+' طالب</span>'+
        '<div class="bd">'+esc(a.label)+'<div class="bDate">أُرشفت: '+a.date+'</div></div>'+
        '<button class="att" data-ardl="'+a.id+'">⬇</button>'+
        '<button class="att" data-arrs="'+a.id+'">استعادة</button>'+
        '<button class="bDel" data-arDel="'+a.id+'">✕</button></div>').join("");
    el("arList").querySelectorAll("[data-ardl]").forEach(b=>b.onclick=async()=>{
      const snap=await loadRaw("archive:"+b.dataset.ardl,null);if(!snap)return;
      const a=document.createElement("a");
      a.href=URL.createObjectURL(new Blob([JSON.stringify(snap.data)],{type:"application/json"}));
      a.download="أرشيف_"+snap.label+".json";a.click();
      toast("نُزّل الأرشيف — يمكن استيراده لاحقاً");
    });
    el("arList").querySelectorAll("[data-arrs]").forEach(b=>b.onclick=async()=>{
      if(!confirm("الاستعادة تستبدل بيانات السنة الحالية كاملة بهذا الأرشيف. متأكد؟"))return;
      if(!confirm("تأكيد أخير: هل أخذت نسخة احتياطية من السنة الحالية؟"))return;
      const snap=await loadRaw("archive:"+b.dataset.arrs,null);if(!snap)return;
      applyData(unwrapBackup(snap.data));closeModal();render();toast("تمت الاستعادة: "+snap.label);
    });
    el("arList").querySelectorAll("[data-arDel]").forEach(b=>b.onclick=async()=>{
      if(!confirm("حذف هذا الأرشيف نهائياً؟"))return;
      await delRaw("archive:"+b.dataset.arDel);
      const nl=(await loadRaw("archives",[])).filter(x=>x.id!==b.dataset.arDel);
      await saveRaw("archives",nl);renderAr();toast("حُذف الأرشيف");
    });
  };
  el("arClose2").onclick=async()=>{
    const label=el("arLabel").value.trim()||("سنة "+todayStr());
    if(!confirm("طي السنة الحالية وأرشفتها باسم «"+label+"»؟"))return;
    const id=uid();
    await saveRaw("archive:"+id,{id,label,date:todayStr(),data:JSON.parse(backupData())});
    const list=await loadRaw("archives",[]);
    list.unshift({id,label,date:todayStr(),count:S.students.length});
    await saveRaw("archives",list);
    // تصفير بيانات السنة
    S.grades={};S.attendance={};S.homework=[];S.behavior={};S.payments={};
    // ترقية الصفوف
    if(el("arPromote").checked){
      S.students.forEach(s=>{
        const i=GRADES.indexOf(s.grade);
        if(i===GRADES.length-1)s.status="متخرج";
        else if(i>=0)s.grade=GRADES[i+1];
      });
    }
    save.grades();save.attendance();save.homework();save.behavior();save.payments();save.students();
    closeModal();render();toast("بدأت سنة جديدة ✓ — السابقة محفوظة بالأرشيف");
  };
  el("arX").onclick=el("arDone").onclick=closeModal;
  renderAr();
}
function applyData(d){
  S.students=d.students||[];S.grades=d.grades||{};S.attendance=d.attendance||{};
  S.payments=d.payments||{};S.behavior=d.behavior||{};S.homework=d.homework||[];
  S.timetable=d.timetable||[];S.dailyPlans=d.dailyPlans||[];S.exams=d.exams||[];S.messages=d.messages||{};S.events=d.events||[];S.qbank=d.qbank||[];S.examTemplates=d.examTemplates||[];S.settings=Object.assign(S.settings,d.settings||{});
  save.students();save.grades();save.attendance();save.payments();save.behavior();save.homework();save.timetable();save.dailyPlans&&save.dailyPlans();save.exams();save.messages();save.events();save.qbank();save.examTemplates();save.settings();
}

/* ============ المزامنة السحابية ============ */
const syncOn=()=>!!(S.settings.sync&&S.settings.sync.url&&S.settings.sync.key&&(S.settings.sync.code||S.settings.sync.accessToken));
const syncRowId=()=>S.settings.sync.userId||S.settings.sync.code; // معرّف حقيقي (auth.uid) إن وُجد، وإلا الرمز القديم للتوافق مع من يستخدمه
let syncTimer=null,syncApplying=false,lastPullAt=0;
function scheduleSync(){
  if(!syncOn()||syncApplying)return;
  S.settings.syncDirtyAt=new Date().toISOString();
  saveKey("settings",S.settings).catch(()=>{});
  clearTimeout(syncTimer);
  syncTimer=setTimeout(syncPush,2500);
}
function syncBase(){return S.settings.sync.url.replace(/\/+$/,"")+"/rest/v1/sync_data"}
function syncHeaders(){
  const c=S.settings.sync;
  const token=c.accessToken||c.key; // الأفضلية دائماً لجلسة المصادقة الحقيقية إن وُجدت
  return {apikey:c.key,Authorization:"Bearer "+token,"Content-Type":"application/json"};
}
// ============ مصادقة حقيقية عبر Supabase Auth (بديل «الرمز السري المشترك») ============
async function authSignUp(url,key,email,password){
  const r=await fetch(url.replace(/\/+$/,"")+"/auth/v1/signup",{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const d=await r.json();
  if(!r.ok)throw new Error(d.msg||d.error_description||d.error||"تعذّر إنشاء الحساب");
  return d;
}
async function authSignIn(url,key,email,password){
  const r=await fetch(url.replace(/\/+$/,"")+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const d=await r.json();
  if(!r.ok)throw new Error(d.msg||d.error_description||d.error||"البريد أو كلمة المرور غير صحيحة");
  return d; // { access_token, refresh_token, expires_in, user:{id,...} }
}
// يتحقق من كود دعوة ويربطه بالمستخدم الجديد (طالب/ولي أمر) عبر دالة آمنة بقاعدة البيانات
async function redeemInviteCode(url,key,accessToken,code,userId){
  const r=await fetch(url.replace(/\/+$/,"")+"/rest/v1/rpc/redeem_invite_code",{
    method:"POST",
    headers:{apikey:key,Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},
    body:JSON.stringify({p_code:code.trim(),p_user_id:userId})
  });
  const d=await r.json();
  if(!r.ok||!d.ok)throw new Error((d&&d.error)||"تعذّر التحقق من كود الدعوة");
  return d; // {ok:true, role, teacher_id, student_ref}
}
// يولّد كود دعوة جديد (المعلم فقط) — يُخزّن مباشرة بجدول invite_codes الخاص بحسابه
async function generateInviteCode(url,key,accessToken,teacherId,role,studentRef){
  const code=(role==="student"?"ST-":"PA-")+Math.random().toString(36).slice(2,8).toUpperCase();
  const r=await fetch(url.replace(/\/+$/,"")+"/rest/v1/invite_codes",{
    method:"POST",
    headers:{apikey:key,Authorization:"Bearer "+accessToken,"Content-Type":"application/json",Prefer:"return=minimal"},
    body:JSON.stringify([{code,teacher_id:teacherId,role,student_ref:studentRef||null}])
  });
  if(!r.ok)throw new Error("تعذّر توليد الكود — تأكد من إعداد الجدول (راجع ملف الإعداد)");
  return code;
}
async function ensureFreshToken(){
  const c=S.settings.sync;
  if(!c||!c.refreshToken)return; // ليس بوضع المصادقة الحقيقية — لا شيء لتحديثه
  if(c.expiresAt&&Date.now()<c.expiresAt-60000)return; // لسا صالح لأكثر من دقيقة، ما يحتاج تجديد
  try{
    const r=await fetch(c.url.replace(/\/+$/,"")+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:c.key,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:c.refreshToken})});
    const d=await r.json();
    if(r.ok){
      c.accessToken=d.access_token;c.refreshToken=d.refresh_token;c.expiresAt=Date.now()+(d.expires_in||3600)*1000;
      save.settings();
    }
  }catch(e){/* لو فشل التجديد، المحاولة التالية للمزامنة سترجع خطأ مصادقة واضح بدل فشل صامت */}
}
function syncPayload(){
  // نفس بيانات النسخة الاحتياطية (بصيغتها المسطّحة، بعد فك الغلاف الإصداري)، لكن بدون رمز القفل (PIN) ولا مفاتيح المزامنة نفسها —
  // ما إلها داعي تنكتب داخل البيانات المرفوعة للسحابة
  const d=unwrapBackup(JSON.parse(backupData()));
  if(d.settings){delete d.settings.pin;delete d.settings.pinHash;delete d.settings.pinSalt;delete d.settings.sync}
  return d;
}
async function syncPush(){
  if(!syncOn())return false;
  await ensureFreshToken();
  const now=new Date().toISOString();
  try{
    const r=await fetch(syncBase(),{method:"POST",
      headers:Object.assign(syncHeaders(),{Prefer:"resolution=merge-duplicates"}),
      body:JSON.stringify([{id:syncRowId(),payload:syncPayload(),updated_at:now}])});
    if(r.ok){
      S.settings.syncStamp=now;S.settings.lastSyncAt=now;delete S.settings.syncDirtyAt;
      await saveKey("settings",S.settings);
      return true;
    }
  }catch(e){console.error("sync push",e)}
  return false;
}
async function syncPull(silent){
  if(!syncOn())return false;
  await ensureFreshToken();
  try{
    const r=await fetch(syncBase()+"?id=eq."+encodeURIComponent(syncRowId())+"&select=payload,updated_at",{headers:syncHeaders()});
    if(!r.ok)throw 0;
    const rows=await r.json();
    lastPullAt=Date.now();
    if(!rows.length){ // أول جهاز — ارفع بياناتك
      const ok=await syncPush();
      if(!silent)toast(ok?"تم رفع بياناتك للسحابة ✓":"تعذر الرفع");
      return ok;
    }
    const row=rows[0];
    if(row.updated_at!==S.settings.syncStamp){
      const localDirty=S.settings.syncDirtyAt&&(!S.settings.syncStamp||S.settings.syncDirtyAt>S.settings.syncStamp);
      if(localDirty){
        if(!silent)toast("⚠️ يوجد تعارض: تغييرات محلية وسحابية. لم تُستبدل بياناتك تلقائياً");
        return false;
      }
      try{await saveRaw("safety:preCloudApply",{createdAt:new Date().toISOString(),payload:JSON.parse(backupData())})}catch(_){}
      syncApplying=true;
      const keepSync=S.settings.sync;
      applyData(sanitizeImportedData(row.payload));
      S.settings.sync=keepSync;
      S.settings.syncStamp=row.updated_at;
      S.settings.lastSyncAt=new Date().toISOString();
      await saveKey("settings",S.settings);
      syncApplying=false;
      updateHeader();render();
      if(!silent)toast("تمت المزامنة — البيانات محدثة ✓");
    }else if(!silent)toast("بياناتك مطابقة للسحابة ✓");
    return true;
  }catch(e){
    syncApplying=false;
    console.error("sync pull",e);
    if(!silent)toast("تعذر الاتصال — تحقق من الإنترنت والمفاتيح");
    return false;
  }
}
function openSyncSheet(){
  const c=S.settings.sync||{};
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>👤 حسابي والمزامنة السحابية</h3><button class="x" id="syX">✕</button></div>'+
    '<div class="form">'+
      (syncOn()?'<div class="avgBox">المزامنة مفعّلة '+(c.userId?"(حساب مستخدم — أكثر أمانًا) ":"(رمز مشترك) ")+'✓'+(S.settings.lastSyncAt?'<div style="font-size:11px;margin-top:4px;opacity:.8">آخر مزامنة: '+S.settings.lastSyncAt.slice(0,16).replace("T"," ")+'</div>':"")+'</div>':'<div class="notice">غير مفعّلة — تحتاج حساب Supabase مجاني.</div>')+

      '<div class="subCard">'+
        '<div class="subHead"><span class="subName">⚙️ إعدادات الاتصال بمشروعك</span></div>'+
        '<label>رابط المشروع (Project URL)<input id="syUrl" dir="ltr" placeholder="https://xxxx.supabase.co" value="'+esc(c.url||"")+'"></label>'+
        '<label>المفتاح العام (anon key)<input id="syKey" dir="ltr" placeholder="eyJhbGci..." value="'+esc(c.key||"")+'"></label>'+
      '</div>'+

      '<div class="subCard" style="border-color:#D4AF37;border-width:1.5px">'+
        '<div class="subHead"><span class="subName">🔐 حساب مستخدم <span style="font-weight:700;font-size:10.5px;color:#B8860B">(موصى به)</span></span></div>'+
        (c.userId?'':
          '<label>نوع الحساب عند إنشاء حساب جديد<select id="sySignupRole">'+
            '<option value="teacher">معلم</option><option value="student">طالب</option><option value="parent">ولي أمر</option>'+
          '</select></label>'+
          '<label id="syInviteWrap" style="display:none">كود الدعوة (من معلمك)<input id="syInviteCode" dir="ltr" placeholder="ST-XXXXXX"></label>'
        )+
        '<label>البريد الإلكتروني<input id="syEmail" dir="ltr" type="email" value="'+esc(c.email||"")+'" placeholder="teacher@example.com"></label>'+
        '<label>كلمة المرور<input id="syPass" dir="ltr" type="password" placeholder="••••••••"></label>'+
        '<div class="actions"><button class="btn ghost" id="syLogin">تسجيل الدخول</button><button class="btn ghost" id="sySignup">إنشاء حساب جديد</button></div>'+
        (c.userId?'<div style="font-size:11px;color:#16794f">✓ مسجّل دخول بحساب موثّق ('+esc(ROLE_LABEL[S.settings.accountRole]||"معلم")+') — بياناتك محمية بكلمة مرور حقيقية، لا بمجرد معرفة رمز</div>':'')+
        (c.userId?'<button class="btn ghost full" id="syLogout" style="margin-top:6px">🚪 تسجيل الخروج</button>':'')+
      '</div>'+

      (c.userId&&(S.settings.accountRole||"teacher")==="teacher"?'<div class="subCard">'+
        '<div class="subHead"><span class="subName">🎟️ دعوة طالب أو ولي أمر</span></div>'+
        '<p class="empty" style="padding:4px 2px;font-size:11px">وليّد كود لمرة واحدة، أعطه للطالب أو ولي الأمر ليسجّل حساب مرتبط بيك تلقائياً.</p>'+
        '<div class="grid2">'+
          '<label>النوع<select id="syInviteRole"><option value="student">طالب</option><option value="parent">ولي أمر</option></select></label>'+
          '<label>مرجع الطالب (اختياري)<input id="syInviteRef" placeholder="اسم أو رقم الطالب"></label>'+
        '</div>'+
        '<button class="btn ghost full" id="syGenInvite">توليد كود دعوة</button>'+
        '<div id="syInviteResult" style="font-size:13px;font-weight:800;text-align:center;margin-top:4px"></div>'+
      '</div>':'')+

      (c.userId?'<div class="subCard" style="border-color:#B3453F">'+
        '<div class="subHead"><span class="subName" style="color:#B3453F">🗑️ حذف الحساب نهائياً</span></div>'+
        '<p class="empty" style="padding:4px 2px;font-size:11px">يمسح بياناتك من السحابة ومن هذا الجهاز فوراً ويسجّل خروجك. هذا الإجراء لا يمكن التراجع عنه — خذ نسخة احتياطية أولاً لو حاب تحتفظ بأي شي.</p>'+
        '<button class="btn ghostD full" id="syDeleteAcct">حذف حسابي وكل بياناتي نهائياً</button>'+
      '</div>':'')+

      '<button type="button" id="syLegacyToggle" style="background:none;border:none;color:var(--muted);font-size:11.5px;text-decoration:underline;padding:12px 4px 4px;cursor:pointer">'+(c.code?"إخفاء الطريقة القديمة ▴":"إظهار الطريقة القديمة (رمز مشترك بدون حساب) ▾")+'</button>'+
      '<div class="subCard" id="syLegacyCard" style="display:'+(c.code?"block":"none")+';opacity:.85">'+
        '<div class="subHead"><span class="subName">🔑 رمز مشترك (الطريقة القديمة)</span></div>'+
        '<label>رمز المزامنة السري (نفسه بكل أجهزتك)<input id="syCode" dir="ltr" value="'+esc(c.code||"")+'" placeholder="اضغط توليد أو اكتب رمزاً طويلاً"></label>'+
        '<div class="actions"><button class="btn ghost" id="syGen">🎲 توليد رمز</button><button class="btn ghost" id="sySaveCode">حفظ وتفعيل بالرمز</button></div>'+
        '<p class="empty" style="padding:8px 2px 0;font-size:10.5px">⚠️ أقل أماناً: أي شخص يعرف الرابط والمفتاح والرمز يقدر يصل لبياناتك.</p>'+
      '</div>'+

      '<div class="actions" style="margin-top:16px"><button class="btn ghost" id="syNow" '+(syncOn()?"":"disabled")+'>🔄 مزامنة الآن</button></div>'+
      '<p class="empty" style="padding:8px;font-size:11.5px">بعد التفعيل: أي تغيير يُرفع للسحابة تلقائياً، وكل فتح للتطبيق يسحب الأحدث. مهم: لا تُدخل بيانات على جهازين بنفس اللحظة — الأحدث يطغى.</p>'+
    '</div>'+
    '<div class="sheetFoot">'+(syncOn()?'<button class="btn ghostD" id="syOff">تعطيل</button>':'')+'<button class="btn ghost" id="syCancel">إلغاء</button></div>'+
  '</div></div>';
  el("syX").onclick=el("syCancel").onclick=closeModal;
  el("syLegacyToggle").onclick=()=>{
    const box=el("syLegacyCard"),btn=el("syLegacyToggle");
    const show=box.style.display==="none";
    box.style.display=show?"block":"none";
    btn.textContent=show?"إخفاء الطريقة القديمة ▴":"إظهار الطريقة القديمة (رمز مشترك بدون حساب) ▾";
  };
  el("syGen").onclick=()=>{el("syCode").value="sync-"+uid()+uid()};
  el("syNow").onclick=()=>syncPull(false);
  const off=el("syOff");
  if(off)off.onclick=()=>{delete S.settings.sync;delete S.settings.syncStamp;save.settings();closeModal();render();toast("عُطّلت المزامنة — بياناتك بقيت محلياً")};
  const logoutBtn=el("syLogout");
  if(logoutBtn)logoutBtn.onclick=()=>{
    if(!confirm("تسجيل الخروج من هذا الحساب على هذا الجهاز؟ بياناتك المحلية تبقى كما هي."))return;
    delete S.settings.sync.accessToken;delete S.settings.sync.refreshToken;delete S.settings.sync.userId;delete S.settings.sync.expiresAt;
    save.settings();closeModal();render();toast("تم تسجيل الخروج");
  };
  const delBtn=el("syDeleteAcct");
  if(delBtn)delBtn.onclick=async()=>{
    if(!confirm("سيُحذف حسابك وكل بياناتك من السحابة ومن هذا الجهاز نهائياً. لا يمكن التراجع. متابعة؟"))return;
    if(!confirm("تأكيد أخير: هل أنت متأكد فعلاً؟ لا توجد طريقة لاسترجاع البيانات بعد هذا."))return;
    delBtn.disabled=true;delBtn.textContent="جارِ الحذف…";
    try{
      // 1) حذف صف بياناتنا من جدول المزامنة
      try{await fetch(syncBase()+"?id=eq."+encodeURIComponent(syncRowId()),{method:"DELETE",headers:syncHeaders()})}catch(_){}
      // 2) طلب حذف حساب المصادقة نفسه (بريد/كلمة مرور) — عبر دالة Edge Function إن كانت مُعدّة بمشروعك (راجع ملف الإعداد)
      try{await fetch(c.url.replace(/\/+$/,"")+"/functions/v1/delete-account",{method:"POST",headers:syncHeaders()})}catch(_){}
      // 3) مسح كل البيانات المحلية على هذا الجهاز وتسجيل الخروج
      S.students=[];S.grades={};S.attendance={};S.payments={};S.behavior={};S.homework=[];S.timetable=[];S.dailyPlans=[];S.exams=[];S.messages={};S.events=[];S.qbank=[];S.examTemplates=[];
      delete S.settings.sync;delete S.settings.syncStamp;delete S.settings.pin;delete S.settings.pinHash;delete S.settings.pinSalt;delete S.settings.accountRole;delete S.settings.linkedTeacherId;delete S.settings.linkedStudentRef;
      save.students();save.grades();save.attendance();save.payments();save.behavior();save.homework();save.timetable();save.dailyPlans();save.exams();save.messages();save.events();save.qbank();save.examTemplates();save.settings();
      closeModal();render();
      toast("تم حذف الحساب وكل البيانات ✓");
    }catch(e){toast("صار خطأ أثناء الحذف — جرّب مرة ثانية");delBtn.disabled=false;delBtn.textContent="حذف حسابي وكل بياناتي نهائياً"}
  };
  const needUrlKey=()=>{
    const url=el("syUrl").value.trim(),key=el("syKey").value.trim();
    if(!url.startsWith("http")||!key){toast("أكمل رابط المشروع والمفتاح العام أولاً");return null}
    return {url,key};
  };
  el("syLogin").onclick=async()=>{
    const base=needUrlKey();if(!base)return;
    const email=el("syEmail").value.trim(),pass=el("syPass").value;
    if(!email||!pass){toast("أدخل البريد وكلمة المرور");return}
    toast("جارِ تسجيل الدخول…");
    try{
      const d=await authSignIn(base.url,base.key,email,pass);
      S.settings.sync={url:base.url,key:base.key,email,accessToken:d.access_token,refreshToken:d.refresh_token,expiresAt:Date.now()+(d.expires_in||3600)*1000,userId:d.user.id};
      delete S.settings.syncStamp;save.settings();
      const ok=(S.settings.accountRole||"teacher")==="teacher"?await syncPull(true):true; // حسابات الطالب/ولي الأمر لا تسحب بيانات المعلم الكاملة
      closeModal();render();
      toast(ok?"☁️ تسجيل الدخول تم ✓":"سُجّل الدخول، لكن تعذّرت المزامنة الأولى");
    }catch(e){toast("⚠️ "+e.message)}
  };
  el("sySignup").onclick=async()=>{
    const base=needUrlKey();if(!base)return;
    const email=el("syEmail").value.trim(),pass=el("syPass").value;
    const role=el("sySignupRole")?el("sySignupRole").value:"teacher";
    const inviteCode=el("syInviteCode")?el("syInviteCode").value.trim():"";
    if(!email||pass.length<6){toast("أدخل بريداً صحيحاً وكلمة مرور 6 أحرف فأكثر");return}
    if(role!=="teacher"&&!inviteCode){toast("محتاج كود دعوة من معلمك عشان تسجّل كـ"+ROLE_LABEL[role]);return}
    toast("جارِ إنشاء الحساب…");
    try{
      const signRes=await authSignUp(base.url,base.key,email,pass);
      let accessToken=signRes.access_token,refreshToken=signRes.refresh_token,expiresIn=signRes.expires_in,userId=signRes.user&&signRes.user.id;
      if(!accessToken){ // بعض إعدادات Supabase تتطلب تسجيل دخول منفصل بعد التسجيل (لو تأكيد البريد مفعّل)
        const d=await authSignIn(base.url,base.key,email,pass);
        accessToken=d.access_token;refreshToken=d.refresh_token;expiresIn=d.expires_in;userId=d.user.id;
      }
      S.settings.sync={url:base.url,key:base.key,email,accessToken,refreshToken,expiresAt:Date.now()+(expiresIn||3600)*1000,userId};
      if(role==="teacher"){
        S.settings.accountRole="teacher";
        delete S.settings.syncStamp;save.settings();
        closeModal();render();
        toast("تم إنشاء الحساب ✓");
      }else{
        const red=await redeemInviteCode(base.url,base.key,accessToken,inviteCode,userId);
        S.settings.accountRole=red.role;S.settings.linkedTeacherId=red.teacher_id;S.settings.linkedStudentRef=red.student_ref||"";
        save.settings();
        closeModal();render();
        toast("تم إنشاء حساب "+ROLE_LABEL[red.role]+" وربطه بمعلمك ✓");
      }
    }catch(e){toast("⚠️ "+e.message)}
  };
  const roleSel=el("sySignupRole");
  if(roleSel)roleSel.onchange=()=>{el("syInviteWrap").style.display=roleSel.value==="teacher"?"none":"flex"};
  const genBtn=el("syGenInvite");
  if(genBtn)genBtn.onclick=async()=>{
    if(!syncOn()||!c.userId){toast("لازم تكون مسجّل دخول كمعلم أولاً");return}
    await ensureFreshToken();
    try{
      const code=await generateInviteCode(c.url,c.key,S.settings.sync.accessToken,c.userId,el("syInviteRole").value,el("syInviteRef").value.trim());
      el("syInviteResult").textContent="الكود: "+code;
      toast("تم توليد الكود ✓ — انسخه وأعطه للطالب/ولي الأمر");
    }catch(e){toast("⚠️ "+e.message)}
  };
  el("sySaveCode").onclick=async()=>{
    const base=needUrlKey();if(!base)return;
    const code=el("syCode").value.trim();
    if(code.length<8){toast("الرمز 8 أحرف على الأقل");return}
    S.settings.sync={url:base.url,key:base.key,code};
    delete S.settings.syncStamp;
    save.settings();
    toast("جارِ الاتصال…");
    const ok=await syncPull(true);
    if(ok){closeModal();render();toast("☁️ المزامنة مفعّلة بالرمز ✓")}
    else toast("فشل الاتصال — راجع الرابط والمفتاح");
  };
}

/* ============ التوقيع الحي ============ */
function openSignatureSheet(){
  const cur=S.settings.signature||"";
  el("modal").innerHTML='<div class="overlay"><div class="sheet"><div class="sheetHead"><h3>✍️ التوقيع الحي</h3><button class="x" id="sgX">✕</button></div><div class="form">'+
    (cur?'<div class="sigPreviewBox"><img src="'+cur+'" alt=""><div style="flex:1;font-size:12px;color:#64748B">هذا توقيعك المحفوظ حالياً — يظهر بالتقارير والبطاقات بدل الاسم المطبوع.</div><button class="btn ghostD" id="sgRemove">حذف</button></div>':'<div class="notice">لا يوجد توقيع محفوظ — سيُستخدم اسمك المطبوع بالتقارير.</div>')+
    '<p class="empty" style="padding:8px;font-size:12px">ارسم توقيعك بإصبعك أو الماوس بالمربع أدناه، ثم اضغط «حفظ التوقيع».</p>'+
    '<div class="sigPadWrap"><canvas id="sigPad"></canvas></div>'+
    '<div class="actions"><button class="btn ghost" id="sgClear">🧹 مسح اللوحة</button></div>'+
    '</div><div class="sheetFoot"><button class="btn ghost" id="sgCancel">إلغاء</button><button class="btn" id="sgSave">💾 حفظ التوقيع</button></div></div></div>';
  el("sgX").onclick=el("sgCancel").onclick=closeModal;
  const canvas=el("sigPad");
  const wrap=canvas.parentElement;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const cw=wrap.clientWidth||300,ch=170;
  canvas.width=cw*dpr;canvas.height=ch*dpr;
  const ctx=canvas.getContext("2d");
  ctx.scale(dpr,dpr);
  ctx.lineWidth=2.6;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#0F172A";
  let drawing=false,lastX=0,lastY=0,hasStroke=false;
  const posFromEvent=e=>{
    const r=canvas.getBoundingClientRect();
    const p=e.touches&&e.touches[0]?e.touches[0]:e;
    return [p.clientX-r.left,p.clientY-r.top];
  };
  const start=e=>{e.preventDefault();drawing=true;[lastX,lastY]=posFromEvent(e);};
  const move=e=>{
    if(!drawing)return;e.preventDefault();
    const [x,y]=posFromEvent(e);
    ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(x,y);ctx.stroke();
    lastX=x;lastY=y;hasStroke=true;
  };
  const end=()=>{drawing=false;};
  canvas.addEventListener("pointerdown",start);
  canvas.addEventListener("pointermove",move);
  window.addEventListener("pointerup",end);
  canvas.addEventListener("touchstart",start,{passive:false});
  canvas.addEventListener("touchmove",move,{passive:false});
  canvas.addEventListener("touchend",end);
  el("sgClear").onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasStroke=false;};
  if(el("sgRemove"))el("sgRemove").onclick=()=>{
    delete S.settings.signature;save.settings();closeModal();toast("حُذف التوقيع — رجع الاسم المطبوع");if(S.tab==="home")render();
  };
  el("sgSave").onclick=()=>{
    if(!hasStroke){toast("ارسم التوقيع أولاً");return}
    S.settings.signature=canvas.toDataURL("image/png");
    save.settings();closeModal();toast("تم حفظ التوقيع ✓");if(S.tab==="home")render();
  };
}

