/* ============ صفحة الإحصاءات المستقلة ============ */
function drawBarChart(canvas,labels,values,opts){
  opts=opts||{};
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const cw=canvas.parentElement.clientWidth||320,ch=opts.height||180;
  canvas.width=cw*dpr;canvas.height=ch*dpr;canvas.style.height=ch+"px";
  const ctx=canvas.getContext("2d");if(!ctx)return;
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,cw,ch);
  const max=Math.max(1,...values,opts.max||0);
  const padL=8,padR=8,padT=10,padB=28;
  const bw=(cw-padL-padR)/values.length;
  ctx.textAlign="center";ctx.font="11px Cairo, Tahoma, sans-serif";
  values.forEach((v,i)=>{
    const bh=(ch-padT-padB)*(v/max);
    const bx=padL+i*bw+bw*0.18,bw2=bw*0.64;
    const by=ch-padB-bh;
    ctx.fillStyle=opts.color||"#0F172A";
    const rad=Math.min(7,bw2/2);
    ctx.beginPath();
    ctx.moveTo(bx,by+bh);ctx.lineTo(bx,by+rad);ctx.arcTo(bx,by,bx+rad,by,rad);
    ctx.lineTo(bx+bw2-rad,by);ctx.arcTo(bx+bw2,by,bx+bw2,by+rad,rad);
    ctx.lineTo(bx+bw2,by+bh);ctx.closePath();ctx.fill();
    ctx.fillStyle="#475569";
    ctx.fillText(String(v),bx+bw2/2,by-6<10?by+14:by-6);
    ctx.fillStyle="#94A3B8";ctx.font="10px Cairo, Tahoma, sans-serif";
    ctx.fillText(String(labels[i]).slice(0,6),bx+bw2/2,ch-10);
    ctx.font="11px Cairo, Tahoma, sans-serif";
  });
}
function drawLineChart(canvas,labels,values,opts){
  opts=opts||{};
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const cw=canvas.parentElement.clientWidth||320,ch=opts.height||180;
  canvas.width=cw*dpr;canvas.height=ch*dpr;canvas.style.height=ch+"px";
  const ctx=canvas.getContext("2d");if(!ctx)return;
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,cw,ch);
  const max=Math.max(1,...values,opts.max||0);
  const padL=10,padR=10,padT=14,padB=24;
  const stepX=(cw-padL-padR)/Math.max(1,values.length-1);
  ctx.strokeStyle=opts.color||"#0F172A";ctx.lineWidth=2.4;ctx.lineJoin="round";ctx.beginPath();
  values.forEach((v,i)=>{
    const x=padL+i*stepX,y=padT+(ch-padT-padB)*(1-v/max);
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });
  ctx.stroke();
  ctx.fillStyle=opts.color||"#0F172A";
  values.forEach((v,i)=>{
    const x=padL+i*stepX,y=padT+(ch-padT-padB)*(1-v/max);
    ctx.beginPath();ctx.arc(x,y,3,0,7);ctx.fill();
  });
  ctx.textAlign="center";ctx.fillStyle="#94A3B8";ctx.font="9.5px Cairo, Tahoma, sans-serif";
  values.forEach((v,i)=>{
    if(labels[i]===undefined)return;
    if(values.length>10&&i%2!==0&&i!==values.length-1)return;
    const x=padL+i*stepX;
    ctx.fillText(String(labels[i]),x,ch-8);
  });
}
function renderStatsPage(){
  const list=VIS();
  const male=list.filter(s=>s.gender==="ذكر").length;
  const female=list.length-male;
  const active=list.filter(s=>s.status==="مستمر").length;
  // نسبة الحضور آخر 10 أيام مسجّلة
  const attDays=Object.keys(S.attendance).sort().slice(-10);
  const attRates=attDays.map(d=>{
    const day=S.attendance[d]||{};
    const ids=list.map(s=>s.id).filter(id=>day[id]!==undefined);
    if(!ids.length)return 0;
    const present=ids.filter(id=>day[id]==="حاضر").length;
    return Math.round(present/ids.length*100);
  });
  const attLbls=attDays.map(d=>d.slice(5).replace("-","/"));
  // توزيع الطلبة حسب الصف
  const gLbls=GRADES.map(g=>g.replace(" متوسط","م").replace(" إعدادي","إ"));
  const gVals=GRADES.map(g=>list.filter(s=>s.grade===g).length);
  // متوسط الدرجة النهائية لكل صف
  const avgVals=GRADES.map(g=>{
    const studs=list.filter(s=>s.grade===g);
    const finals=studs.map(s=>subjectCalc((S.grades[s.id]||{})[MYSUB(g)],g).final).filter(v=>v!==null);
    return finals.length?Math.round(finals.reduce((a,b)=>a+b,0)/finals.length):0;
  });
  // نسبة تسليم الواجبات لكل صف
  const hwVals=GRADES.map(g=>{
    const hws=S.homework.filter(h=>h.grade===g);
    const studs=list.filter(s=>s.grade===g);
    if(!hws.length||!studs.length)return 0;
    let done=0,total=0;
    hws.forEach(h=>studs.forEach(s=>{total++;if(h.done&&h.done[s.id])done++;}));
    return total?Math.round(done/total*100):0;
  });
  // نسبة النجاح لكل صف
  const passVals=GRADES.map(g=>{
    const studs=list.filter(s=>s.grade===g&&s.status==="مستمر");
    const finals=studs.map(s=>subjectCalc((S.grades[s.id]||{})[MYSUB()],s.grade).final).filter(v=>v!==null);
    if(!finals.length)return 0;
    return Math.round(finals.filter(v=>v>=50).length/finals.length*100);
  });
  // توزيع الدرجات النهائية على كل الطلبة (كل الصفوف)
  const distBuckets=["0-49","50-59","60-69","70-79","80-89","90-100"];
  const allFinals=list.map(s=>subjectCalc((S.grades[s.id]||{})[MYSUB()],s.grade).final).filter(v=>v!==null);
  const distVals=[
    allFinals.filter(v=>v<50).length,
    allFinals.filter(v=>v>=50&&v<60).length,
    allFinals.filter(v=>v>=60&&v<70).length,
    allFinals.filter(v=>v>=70&&v<80).length,
    allFinals.filter(v=>v>=80&&v<90).length,
    allFinals.filter(v=>v>=90).length
  ];
  const examsGiven=(()=>{
    const set=new Set();
    Object.values(S.grades).forEach(subjMap=>{
      const rec=subjMap[MYSUB()];if(!rec)return;
      ["m1","m2","m3","m4"].forEach(f=>{
        const m=rec[f];
        if(m&&typeof m==="object"){
          (m.d||[]).forEach((v,i)=>{if(num(v)!==null)set.add(f+"-d"+i)});
          if(num(m.w)!==null)set.add(f+"-w");
        }
      });
      ["mid","fin","r2"].forEach(f=>{if(num(rec[f])!==null)set.add(f)});
    });
    return set.size;
  })();
  const msgsSent=Object.values(S.messages).reduce((a,arr)=>a+arr.length,0);
  const overallPassRate=(()=>{
    const finals=VIS().filter(s=>s.status==="مستمر").map(s=>subjectCalc((S.grades[s.id]||{})[MYSUB()],s.grade).final).filter(v=>v!==null);
    return finals.length?Math.round(finals.filter(v=>v>=50).length/finals.length*100):null;
  })();
  el("content").innerHTML=
    '<div class="backRow"><button id="statsBack">‹ رجوع للرئيسية</button></div>'+
    '<h2 class="h">📊 صفحة الإحصاءات</h2>'+
    '<div class="briefCard" style="margin-top:0"><div class="briefHead">🏅 إنجازاتك مع طلبتي</div>'+
      '<div class="miniStats" style="background:transparent">'+
        '<div style="background:rgba(255,255,255,.08);border-radius:12px;padding:8px"><b style="color:#fff">'+INSTS().length+'</b><span style="color:rgba(255,255,255,.7)">مؤسسات</span></div>'+
        '<div style="background:rgba(255,255,255,.08);border-radius:12px;padding:8px"><b style="color:#fff">'+list.length+'</b><span style="color:rgba(255,255,255,.7)">طلبة</span></div>'+
        '<div style="background:rgba(255,255,255,.08);border-radius:12px;padding:8px"><b style="color:#fff">'+examsGiven+'</b><span style="color:rgba(255,255,255,.7)">امتحانات مرصودة</span></div>'+
        '<div style="background:rgba(255,255,255,.08);border-radius:12px;padding:8px"><b style="color:var(--gold)">'+msgsSent+'</b><span style="color:rgba(255,255,255,.7)">رسالة مُرسلة</span></div>'+
      '</div>'+
      (overallPassRate!==null?'<div style="margin-top:8px;font-size:12.5px;color:rgba(255,255,255,.85)">نسبة النجاح العامة: <b style="color:var(--gold)">'+overallPassRate+'%</b></div>':'')+
    '</div>'+
    '<div class="cards">'+
      '<div class="card big"><div class="num">'+list.length+'</div><div class="lbl">إجمالي الطلبة</div></div>'+
      '<div class="card"><div class="num">'+male+'</div><div class="lbl">ذكور</div></div>'+
      '<div class="card"><div class="num">'+female+'</div><div class="lbl">إناث</div></div>'+
      '<div class="card ok"><div class="num">'+active+'</div><div class="lbl">مستمر</div></div>'+
      '<div class="card bad"><div class="num">'+(list.length-active)+'</div><div class="lbl">غير مستمر</div></div>'+
    '</div>'+
    '<div class="statChart"><h4>📈 نسبة الحضور — آخر '+attDays.length+' يوم مسجّل</h4>'+(attDays.length?'<canvas id="chAtt"></canvas>':'<p class="empty">لا يوجد حضور مسجّل بعد.</p>')+'</div>'+
    '<div class="statChart"><h4>👨‍🎓 توزيع الطلبة حسب الصف</h4><canvas id="chGrade"></canvas></div>'+
    '<div class="statChart"><h4>📚 متوسط الدرجة النهائية لكل صف</h4><canvas id="chAvg"></canvas></div>'+
    '<div class="statChart"><h4>✅ نسبة النجاح لكل صف</h4>'+(allFinals.length?'<canvas id="chPass"></canvas>':'<p class="empty">لا توجد درجات نهائية محسوبة بعد.</p>')+'</div>'+
    '<div class="statChart"><h4>📊 توزيع الدرجات النهائية (كل الطلبة)</h4>'+(allFinals.length?'<canvas id="chDist"></canvas>':'<p class="empty">لا توجد درجات نهائية محسوبة بعد.</p>')+'</div>'+
    '<div class="statChart"><h4>📋 نسبة تسليم الواجبات لكل صف</h4><canvas id="chHw"></canvas></div>';
  el("statsBack").onclick=backToHome;
  if(attDays.length)drawLineChart(el("chAtt"),attLbls,attRates,{max:100,color:"#0F172A"});
  drawBarChart(el("chGrade"),gLbls,gVals,{color:"#D4AF37"});
  drawBarChart(el("chAvg"),gLbls,avgVals,{max:100,color:"#0F172A"});
  if(allFinals.length)drawBarChart(el("chPass"),gLbls,passVals,{max:100,color:"#1E7A4C"});
  if(allFinals.length)drawBarChart(el("chDist"),distBuckets,distVals,{color:"#B8860B"});
  drawBarChart(el("chHw"),gLbls,hwVals,{max:100,color:"#1E293B"});
}
function rr(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();
}
function buildReportCanvas(s,logoImg,sigImg){
  const priv=isPrivate(s);
  const rec=(S.grades[s.id]||{})[MYSUB()]||{};
  const c=subjectCalc(rec,s.grade);
  const hw=hwStats(s.id);
  const absN=absCount(s.id);
  const v=x=>(x===undefined||x===null||x==="")?"—":String(x);
  const rows=[
    ["شهر أول — الفصل الأول",fmt(c.M1)],["شهر ثاني — الفصل الأول",fmt(c.M2)],
    ["امتحان نصف السنة",v(rec.mid)],
    ["شهر أول — الفصل الثاني",fmt(c.M3)],["شهر ثاني — الفصل الثاني",fmt(c.M4)],
    ["السعي السنوي",fmt(c.saay)],["الامتحان النهائي",v(rec.fin)],
    ["الدرجة النهائية",fmt(c.final)]
  ];
  if(rec.r2!==undefined&&rec.r2!=="")rows.push(["الدور الثاني",v(rec.r2)]);
  const W=1000,ROW=58,TBL_Y=470;
  const tblH=ROW*(rows.length+1);
  const H=TBL_Y+tblH+40+130+185;
  const cv=document.createElement("canvas");
  cv.width=W;cv.height=H;
  const ctx=cv.getContext&&cv.getContext("2d");
  if(!ctx)return null;
  ctx.direction="rtl";ctx.textBaseline="middle";
  const F=(w,sz)=>ctx.font=(w?w+" ":"")+sz+"px Cairo, Tahoma, sans-serif";
  // الخلفية
  ctx.fillStyle="#F4F6F9";ctx.fillRect(0,0,W,H);
  // الترويسة المتدرجة
  const g=ctx.createLinearGradient(0,0,W,200);
  g.addColorStop(0,"#020617");g.addColorStop(0.55,"#0F172A");g.addColorStop(1,"#1E3A6E");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,200);
  ctx.fillStyle="#D4AF37";ctx.fillRect(0,200,W,7);
  ctx.fillStyle="#fff";ctx.textAlign="right";
  ctx.font="700 42px Cairo, sans-serif";ctx.fillText((priv?"👨‍🏫 ":"🏫 ")+instOf(s),W-45,66);
  if(logoImg){
    const LS=112,lx=45,ly=26;
    ctx.save();
    ctx.fillStyle="rgba(255,255,255,.97)";rr(ctx,lx,ly,LS,LS,18);ctx.fill();
    ctx.strokeStyle="#D4AF37";ctx.lineWidth=3;rr(ctx,lx,ly,LS,LS,18);ctx.stroke();
    rr(ctx,lx,ly,LS,LS,18);ctx.clip();
    const sc=Math.min((LS-14)/logoImg.width,(LS-14)/logoImg.height);
    const dw=logoImg.width*sc,dh=logoImg.height*sc;
    ctx.drawImage(logoImg,lx+(LS-dw)/2,ly+(LS-dh)/2,dw,dh);
    ctx.restore();
  }
  ctx.fillStyle="#E2E8F0";F("500",27);
  ctx.fillText("تقرير متابعة الطالب — مادة "+MYSUB(),W-45,120);
  ctx.fillStyle="#94A3B8";F("",21);
  ctx.fillText("العام الدراسي "+academicYearStr(),W-45,166);
  ctx.textAlign="left";ctx.fillText("تاريخ الإصدار: "+todayStr(),45,166);
  // بطاقة الطالب
  ctx.textAlign="right";
  ctx.fillStyle="#fff";rr(ctx,40,240,W-80,140,22);ctx.fill();
  ctx.strokeStyle="#D0D5DD";ctx.lineWidth=2;rr(ctx,40,240,W-80,140,22);ctx.stroke();
  ctx.fillStyle="#020617";
  {const nameMaxW=W-160;let nsz=36;F("900",nsz);while(ctx.measureText(s.name).width>nameMaxW&&nsz>22){nsz-=2;F("900",nsz)}}
  ctx.fillText(s.name,W-75,292);
  ctx.fillStyle="#475569";F("",25);
  ctx.fillText(s.grade+" — "+secTerm(instOf(s))+" "+s.section+(s.branch!=="-"?" — "+s.branch:""),W-75,342);
  if(s.examNo){
    ctx.textAlign="left";ctx.fillStyle="#475569";F("700",22);
    ctx.fillText("الرقم الامتحاني: "+s.examNo,75,317);
    ctx.textAlign="right";
  }
  // عنوان الجدول
  ctx.fillStyle="#D4AF37";rr(ctx,W-52,TBL_Y-46,14,28,6);ctx.fill();
  ctx.fillStyle="#0F172A";F("900",29);ctx.fillText("سجل الدرجات",W-75,TBL_Y-32);
  // الجدول
  const TX=40,TW=W-80,COL=TW*0.38;
  ctx.fillStyle="#0F172A";rr(ctx,TX,TBL_Y,TW,ROW,14);ctx.fill();
  ctx.fillStyle="#0F172A";ctx.fillRect(TX,TBL_Y+ROW/2,TW,ROW/2);
  ctx.fillStyle="#fff";F("700",24);
  ctx.fillText("البيان",TX+TW-30,TBL_Y+ROW/2);
  ctx.textAlign="center";ctx.fillText("الدرجة",TX+COL/2,TBL_Y+ROW/2);
  rows.forEach((r0,i)=>{
    const ry=TBL_Y+ROW*(i+1);
    const last=r0[0]==="الدرجة النهائية";
    ctx.fillStyle=last?"#E2E8F0":(i%2?"#F8FAFC":"#fff");
    ctx.fillRect(TX,ry,TW,ROW);
    ctx.strokeStyle="#D0D5DD";ctx.lineWidth=1;ctx.strokeRect(TX,ry,TW,ROW);
    ctx.fillStyle=last?"#0F172A":"#020617";
    ctx.textAlign="right";F(last?"900":"500",24);
    ctx.fillText(r0[0],TX+TW-30,ry+ROW/2);
    ctx.textAlign="center";F(last?"900":"700",26);
    ctx.fillText(r0[1],TX+COL/2,ry+ROW/2);
  });
  // صناديق الإحصائيات
  const SY=TBL_Y+tblH+35,BW=(W-80-40)/3;
  const boxes=[
    ["الغيابات",String(absN),absN>0?"#B3453F":"#0F172A"],
    ["الواجبات",hw.total?hw.done+" من "+hw.total:"—","#0F172A"],
    ["النتيجة",c.status||"غير مكتملة",c.status&&c.status.startsWith("ناجح")?"#0F172A":c.status==="راسب"||c.status==="مكمل"?"#B3453F":"#475569"]
  ];
  boxes.forEach((b,i)=>{
    const bx=40+(BW+20)*i;
    ctx.fillStyle="#fff";rr(ctx,bx,SY,BW,120,20);ctx.fill();
    ctx.strokeStyle="#D0D5DD";rr(ctx,bx,SY,BW,120,20);ctx.stroke();
    ctx.textAlign="center";
    ctx.fillStyle=b[2];F("900",31);ctx.fillText(b[1],bx+BW/2,SY+50);
    ctx.fillStyle="#475569";F("",21);ctx.fillText(b[0],bx+BW/2,SY+92);
  });
  // التذييل: الأستاذ يميناً والمدير يساراً
  const FY=SY+160;
  ctx.strokeStyle="#D4AF37";ctx.lineWidth=2;ctx.setLineDash([8,6]);
  ctx.beginPath();ctx.moveTo(40,FY);ctx.lineTo(W-40,FY);ctx.stroke();ctx.setLineDash([]);
  ctx.textAlign="right";
  if(sigImg){
    const sMaxW=175,sMaxH=50;
    const sSc=Math.min(sMaxW/sigImg.width,sMaxH/sigImg.height);
    const sdw=sigImg.width*sSc,sdh=sigImg.height*sSc;
    ctx.drawImage(sigImg,W-75-sdw,FY+6,sdw,sdh);
    ctx.fillStyle="#475569";F("",21);ctx.fillText(priv?"الأستاذ":"مدرس المادة",W-75,FY+70);
    ctx.fillStyle="#0F172A";F("700",19);ctx.fillText(S.settings.teacher||"أستاذ المادة",W-75,FY+98);
  }else{
    ctx.fillStyle="#475569";F("",21);ctx.fillText(priv?"الأستاذ":"مدرس المادة",W-75,FY+30);
    ctx.fillStyle="#0F172A";F("900",27);ctx.fillText(S.settings.teacher||"أستاذ المادة",W-75,FY+76);
  }
  ctx.textAlign="left";
  if(priv){
    ctx.fillStyle="#475569";F("",21);ctx.fillText("للتواصل المباشر",75,FY+38);
    ctx.fillStyle="#020617";F("900",27);ctx.fillText(myPhone()?("📞 "+myPhone()):instOf(s),75,FY+76);
  }else{
    ctx.fillStyle="#475569";F("",21);ctx.fillText(principalTitle(instOf(s)),75,FY+38);
    ctx.fillStyle="#0F172A";F("900",27);ctx.fillText(instMeta(instOf(s)).principal||S.settings.principal||"................",75,FY+76);
  }
  const cts=[];
  if(priv)myContacts().forEach(cc=>{if(cc.value)cts.push(ctIcon(cc.type)+" "+cc.value)});
  if(cts.length){
    ctx.textAlign="center";ctx.fillStyle="#475569";F("700",20);
    ctx.fillText(cts.join("   •   "),W/2,H-64);
  }
  ctx.textAlign="center";ctx.fillStyle="#94A3B8";F("",18);
  ctx.fillText("صادر آلياً من تطبيق مسار — بتطوير الأستاذ "+(S.settings.teacher||"أستاذ المادة")+" — "+instOf(s),W/2,H-28);
  return cv;
}
function buildAbsenceReportCanvas(grade,sectionName,inst,dateStr,rows,logoImg,sigImg){
  const priv=instType(inst)==="private";
  const W=1000;
  const ROW=56,TBL_Y=430;
  const hasRows=rows.length>0;
  const tblH=hasRows?ROW*(rows.length+1):130;
  const H=TBL_Y+tblH+40+130+185;
  const cv=document.createElement("canvas");
  cv.width=W;cv.height=H;
  const ctx=cv.getContext&&cv.getContext("2d");
  if(!ctx)return null;
  ctx.direction="rtl";ctx.textBaseline="middle";
  const F=(w,sz)=>ctx.font=(w?w+" ":"")+sz+"px Cairo, Tahoma, sans-serif";
  ctx.fillStyle="#F4F6F9";ctx.fillRect(0,0,W,H);
  const g=ctx.createLinearGradient(0,0,W,200);
  g.addColorStop(0,"#020617");g.addColorStop(0.55,"#0F172A");g.addColorStop(1,"#1E3A6E");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,200);
  ctx.fillStyle="#D4AF37";ctx.fillRect(0,200,W,7);
  ctx.fillStyle="#fff";ctx.textAlign="right";
  ctx.font="700 42px Cairo, sans-serif";ctx.fillText((priv?"👨‍🏫 ":"🏫 ")+inst,W-45,66);
  if(logoImg){
    const LS=112,lx=45,ly=26;
    ctx.save();
    ctx.fillStyle="rgba(255,255,255,.97)";rr(ctx,lx,ly,LS,LS,18);ctx.fill();
    ctx.strokeStyle="#D4AF37";ctx.lineWidth=3;rr(ctx,lx,ly,LS,LS,18);ctx.stroke();
    rr(ctx,lx,ly,LS,LS,18);ctx.clip();
    const sc=Math.min((LS-14)/logoImg.width,(LS-14)/logoImg.height);
    const dw=logoImg.width*sc,dh=logoImg.height*sc;
    ctx.drawImage(logoImg,lx+(LS-dw)/2,ly+(LS-dh)/2,dw,dh);
    ctx.restore();
  }
  ctx.fillStyle="#E2E8F0";F("500",27);
  ctx.fillText("تقرير الغياب اليومي — مادة "+MYSUB(),W-45,120);
  ctx.fillStyle="#94A3B8";F("",21);
  ctx.fillText("العام الدراسي "+academicYearStr(),W-45,166);
  ctx.textAlign="left";ctx.fillText("تاريخ الإصدار: "+todayStr(),45,166);
  // بطاقة معلومات الحصة
  ctx.textAlign="right";
  ctx.fillStyle="#fff";rr(ctx,40,240,W-80,140,22);ctx.fill();
  ctx.strokeStyle="#D0D5DD";ctx.lineWidth=2;rr(ctx,40,240,W-80,140,22);ctx.stroke();
  ctx.fillStyle="#020617";F("900",32);ctx.fillText(grade+" — "+secTerm(inst)+" "+sectionName,W-75,292);
  ctx.fillStyle="#475569";F("",23);
  const absLesson=lessonForDate(grade,sectionName,inst,dateStr);
  const absTimeStr=absLesson?periodTimeStr(absLesson.period,absLesson.shift||"صباحي"):"";
  ctx.fillText("تاريخ الحصة: "+dateStr+(absLesson?"   —   الحصة "+absLesson.period+(absTimeStr?" ("+absTimeStr+")":""):""),W-75,342);
  // عنوان القائمة
  ctx.fillStyle="#D4AF37";rr(ctx,W-52,TBL_Y-46,14,28,6);ctx.fill();
  ctx.fillStyle="#0F172A";F("900",29);ctx.fillText("الطلبة المتغيبون والمجازون",W-75,TBL_Y-32);
  if(hasRows){
    const TX=40,TW=W-80,COL=TW*0.28;
    ctx.fillStyle="#0F172A";rr(ctx,TX,TBL_Y,TW,ROW,14);ctx.fill();
    ctx.fillStyle="#0F172A";ctx.fillRect(TX,TBL_Y+ROW/2,TW,ROW/2);
    ctx.fillStyle="#fff";F("700",23);
    ctx.fillText("اسم الطالب",TX+TW-30,TBL_Y+ROW/2);
    ctx.textAlign="center";ctx.fillText("الحالة",TX+COL/2,TBL_Y+ROW/2);
    rows.forEach((r0,i)=>{
      const ry=TBL_Y+ROW*(i+1);
      const isAbs=r0[1]==="غائب";
      ctx.fillStyle=i%2?"#F8FAFC":"#fff";
      ctx.fillRect(TX,ry,TW,ROW);
      ctx.strokeStyle="#D0D5DD";ctx.lineWidth=1;ctx.strokeRect(TX,ry,TW,ROW);
      ctx.fillStyle="#020617";ctx.textAlign="right";F("700",23);
      ctx.fillText((i+1)+". "+r0[0],TX+TW-30,ry+ROW/2);
      const chipW=90;
      ctx.fillStyle=isAbs?"#FCE7E7":"#FBF3E0";
      rr(ctx,TX+COL/2-chipW/2,ry+ROW/2-17,chipW,34,17);ctx.fill();
      ctx.fillStyle=isAbs?"#B3453F":"#B8860B";F("800",19);ctx.textAlign="center";
      ctx.fillText(r0[1],TX+COL/2,ry+ROW/2);
    });
  }else{
    ctx.fillStyle="#E2E8F0";rr(ctx,40,TBL_Y,W-80,tblH,20);ctx.fill();
    ctx.strokeStyle="#D0D5DD";rr(ctx,40,TBL_Y,W-80,tblH,20);ctx.stroke();
    ctx.textAlign="center";ctx.fillStyle="#0F172A";F("900",26);
    ctx.fillText("✅ لا يوجد غياب أو إجازات — الحضور كامل",W/2,TBL_Y+tblH/2);
  }
  // التذييل: الأستاذ يميناً والمدير يساراً
  const FY=TBL_Y+tblH+35+130+35;
  ctx.strokeStyle="#D4AF37";ctx.lineWidth=2;ctx.setLineDash([8,6]);
  ctx.beginPath();ctx.moveTo(40,FY);ctx.lineTo(W-40,FY);ctx.stroke();ctx.setLineDash([]);
  ctx.textAlign="right";
  if(sigImg){
    const sMaxW=175,sMaxH=50;
    const sSc=Math.min(sMaxW/sigImg.width,sMaxH/sigImg.height);
    const sdw=sigImg.width*sSc,sdh=sigImg.height*sSc;
    ctx.drawImage(sigImg,W-75-sdw,FY+6,sdw,sdh);
    ctx.fillStyle="#475569";F("",21);ctx.fillText(priv?"الأستاذ":"مدرس المادة",W-75,FY+70);
    ctx.fillStyle="#0F172A";F("700",19);ctx.fillText(S.settings.teacher||"أستاذ المادة",W-75,FY+98);
  }else{
    ctx.fillStyle="#475569";F("",21);ctx.fillText(priv?"الأستاذ":"مدرس المادة",W-75,FY+30);
    ctx.fillStyle="#0F172A";F("900",27);ctx.fillText(S.settings.teacher||"أستاذ المادة",W-75,FY+76);
  }
  ctx.textAlign="left";
  if(priv){
    ctx.fillStyle="#475569";F("",21);ctx.fillText("للتواصل المباشر",75,FY+38);
    ctx.fillStyle="#020617";F("900",27);ctx.fillText(myPhone()?("📞 "+myPhone()):inst,75,FY+76);
  }else{
    ctx.fillStyle="#475569";F("",21);ctx.fillText(principalTitle(inst),75,FY+38);
    ctx.fillStyle="#0F172A";F("900",27);ctx.fillText(instMeta(inst).principal||S.settings.principal||"................",75,FY+76);
  }
  const cts=[];
  if(priv)myContacts().forEach(cc=>{if(cc.value)cts.push(ctIcon(cc.type)+" "+cc.value)});
  if(cts.length){
    ctx.textAlign="center";ctx.fillStyle="#475569";F("700",20);
    ctx.fillText(cts.join("   •   "),W/2,H-64);
  }
  ctx.textAlign="center";ctx.fillStyle="#94A3B8";F("",18);
  ctx.fillText("صادر آلياً من تطبيق مسار — بتطوير الأستاذ "+(S.settings.teacher||"أستاذ المادة")+" — "+inst,W/2,H-28);
  return cv;
}
function loadImg(src){return new Promise(res=>{if(!src)return res(null);const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src=src})}
const _imgCache=new Map();
function loadImgCached(src){
  if(!src)return Promise.resolve(null);
  if(_imgCache.has(src))return Promise.resolve(_imgCache.get(src));
  return loadImg(src).then(im=>{if(im)_imgCache.set(src,im);return im});
}
function wrapLines(ctx,text,maxW){
  const paragraphs=String(text||"").split("\n");
  const out=[];
  paragraphs.forEach(p=>{
    if(p===""){out.push("");return}
    const words=p.split(/\s+/).filter(Boolean);
    let cur="";
    words.forEach(w=>{
      const test=cur?cur+" "+w:w;
      if(ctx.measureText(test).width>maxW&&cur){out.push(cur);cur=w}
      else cur=test;
    });
    if(cur)out.push(cur);
  });
  return out;
}
/* بطاقة تبليغ عامة (غياب/واجب/سلوك/رسائل حرة) بنفس هوية التقرير المصوّر */
function buildNotifCard(s,logoImg,opts,sigImg){
  const priv=isPrivate(s);
  const badge=opts.badge||"📋 تبليغ لولي الأمر";
  const tone=opts.tone||"info";
  const isPraise=tone==="good";
  const accent=({info:"#0F172A",warn:"#B3453F",good:"#8A5A00"})[tone]||"#0F172A";
  const W=1000;
  const tmpCtx=document.createElement("canvas").getContext("2d");
  tmpCtx.direction="rtl";tmpCtx.font="500 27px Cairo, Tahoma, sans-serif";
  const bodyMaxW=W-80-70;
  const lines=wrapLines(tmpCtx,opts.bodyText||"",bodyMaxW);
  const LH=42,MSG_PAD=38;
  const STU_Y=240,STU_H=110;
  const MSG_Y=STU_Y+STU_H+30;
  const bodyH=Math.max(lines.length*LH+MSG_PAD*2-14,130);
  const FY=MSG_Y+bodyH+42;
  const H=FY+235;
  const cv=document.createElement("canvas");
  cv.width=W;cv.height=H;
  const ctx=cv.getContext("2d");
  if(!ctx)return null;
  ctx.direction="rtl";ctx.textBaseline="middle";
  const F=(w,sz)=>ctx.font=(w?w+" ":"")+sz+"px Cairo, Tahoma, sans-serif";
  ctx.fillStyle="#F4F6F9";ctx.fillRect(0,0,W,H);
  const g=ctx.createLinearGradient(0,0,W,200);
  if(isPraise){g.addColorStop(0,"#6B4500");g.addColorStop(.55,"#A6740A");g.addColorStop(1,"#D4AF37");}
  else{g.addColorStop(0,"#020617");g.addColorStop(0.55,"#0F172A");g.addColorStop(1,"#1E3A6E");}
  ctx.fillStyle=g;ctx.fillRect(0,0,W,200);
  if(isPraise){
    // زخرفة نجوم احتفالية بالترويسة
    ctx.save();
    ctx.fillStyle="rgba(255,255,255,.35)";
    const stars=[[165,34,13],[210,150,9],[880,40,11],[930,120,15],[790,26,8],[610,155,10]];
    stars.forEach(([sx,sy,sr])=>{
      ctx.save();ctx.translate(sx,sy);
      ctx.beginPath();
      for(let i=0;i<5;i++){
        ctx.lineTo(Math.cos((18+i*72)*Math.PI/180)*sr,-Math.sin((18+i*72)*Math.PI/180)*sr);
        ctx.lineTo(Math.cos((54+i*72)*Math.PI/180)*sr*0.42,-Math.sin((54+i*72)*Math.PI/180)*sr*0.42);
      }
      ctx.closePath();ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }
  ctx.fillStyle="#D4AF37";ctx.fillRect(0,200,W,7);
  ctx.fillStyle="#fff";ctx.textAlign="right";
  ctx.font="700 42px Cairo, sans-serif";ctx.fillText((priv?"👨‍🏫 ":"🏫 ")+instOf(s),W-45,66);
  if(logoImg){
    const LS=112,lx=45,ly=26;
    ctx.save();
    ctx.fillStyle="rgba(255,255,255,.97)";rr(ctx,lx,ly,LS,LS,18);ctx.fill();
    ctx.strokeStyle="#D4AF37";ctx.lineWidth=3;rr(ctx,lx,ly,LS,LS,18);ctx.stroke();
    rr(ctx,lx,ly,LS,LS,18);ctx.clip();
    const sc=Math.min((LS-14)/logoImg.width,(LS-14)/logoImg.height);
    const dw=logoImg.width*sc,dh=logoImg.height*sc;
    ctx.drawImage(logoImg,lx+(LS-dw)/2,ly+(LS-dh)/2,dw,dh);
    ctx.restore();
  }else if(isPraise){
    const LS=112,lx=45,ly=26;
    ctx.save();
    ctx.fillStyle="rgba(255,255,255,.97)";rr(ctx,lx,ly,LS,LS,18);ctx.fill();
    ctx.strokeStyle="#fff";ctx.lineWidth=3;rr(ctx,lx,ly,LS,LS,18);ctx.stroke();
    ctx.textAlign="center";ctx.font="56px Cairo, Tahoma, sans-serif";
    ctx.fillText("🏆",lx+LS/2,ly+LS/2+4);
    ctx.restore();
    ctx.textAlign="right";
  }
  ctx.fillStyle="#E2E8F0";F("700",28);ctx.fillText(badge,W-45,118);
  ctx.fillStyle=isPraise?"rgba(255,255,255,.75)":"#94A3B8";F("",20);
  ctx.fillText("العام الدراسي "+academicYearStr(),W-45,163);
  ctx.textAlign="left";ctx.fillText("تاريخ الإصدار: "+todayStr(),45,163);
  ctx.textAlign="right";
  ctx.fillStyle="#fff";rr(ctx,40,STU_Y,W-80,STU_H,22);ctx.fill();
  ctx.strokeStyle=isPraise?"#EAD9A0":"#D0D5DD";ctx.lineWidth=isPraise?2.5:2;rr(ctx,40,STU_Y,W-80,STU_H,22);ctx.stroke();
  ctx.fillStyle="#020617";
  {const nmTxt=(isPraise?"🌟 ":"")+s.name;const nameMaxW=W-160;let nsz=34;F("900",nsz);while(ctx.measureText(nmTxt).width>nameMaxW&&nsz>20){nsz-=2;F("900",nsz)}
  ctx.fillText(nmTxt,W-75,STU_Y+40);}
  ctx.fillStyle="#475569";F("",23);
  ctx.fillText(s.grade+" — "+secTerm(instOf(s))+" "+s.section+(s.branch!=="-"?" — "+s.branch:""),W-75,STU_Y+78);
  ctx.fillStyle="#fff";rr(ctx,40,MSG_Y,W-80,bodyH,22);ctx.fill();
  ctx.strokeStyle="#D0D5DD";ctx.lineWidth=2;rr(ctx,40,MSG_Y,W-80,bodyH,22);ctx.stroke();
  ctx.fillStyle=accent;rr(ctx,W-52,MSG_Y+22,14,bodyH-44,6);ctx.fill();
  ctx.fillStyle="#020617";F("500",27);
  lines.forEach((ln,i)=>ctx.fillText(ln,W-78,MSG_Y+MSG_PAD+i*LH+8));
  ctx.strokeStyle="#D4AF37";ctx.lineWidth=2;ctx.setLineDash([8,6]);
  ctx.beginPath();ctx.moveTo(40,FY);ctx.lineTo(W-40,FY);ctx.stroke();ctx.setLineDash([]);
  ctx.textAlign="right";
  if(sigImg){
    const sMaxW=175,sMaxH=50;
    const sSc=Math.min(sMaxW/sigImg.width,sMaxH/sigImg.height);
    const sdw=sigImg.width*sSc,sdh=sigImg.height*sSc;
    ctx.drawImage(sigImg,W-75-sdw,FY+6,sdw,sdh);
    ctx.fillStyle="#475569";F("",21);ctx.fillText(priv?"الأستاذ":"مدرس المادة",W-75,FY+70);
    ctx.fillStyle="#0F172A";F("700",19);ctx.fillText(S.settings.teacher||"أستاذ المادة",W-75,FY+98);
  }else{
    ctx.fillStyle="#475569";F("",21);ctx.fillText(priv?"الأستاذ":"مدرس المادة",W-75,FY+30);
    ctx.fillStyle="#0F172A";F("900",27);ctx.fillText(S.settings.teacher||"أستاذ المادة",W-75,FY+76);
  }
  ctx.textAlign="left";
  if(priv){
    ctx.fillStyle="#475569";F("",21);ctx.fillText("للتواصل المباشر",75,FY+38);
    ctx.fillStyle="#020617";F("900",27);ctx.fillText(myPhone()?("📞 "+myPhone()):instOf(s),75,FY+76);
  }else{
    ctx.fillStyle="#475569";F("",21);ctx.fillText(principalTitle(instOf(s)),75,FY+38);
    ctx.fillStyle="#0F172A";F("900",27);ctx.fillText(instMeta(instOf(s)).principal||S.settings.principal||"................",75,FY+76);
  }
  const cts=[];
  if(priv)myContacts().forEach(cc=>{if(cc.value)cts.push(ctIcon(cc.type)+" "+cc.value)});
  if(cts.length){
    ctx.textAlign="center";ctx.fillStyle="#475569";F("700",20);
    ctx.fillText(cts.join("   •   "),W/2,H-64);
  }
  ctx.textAlign="center";ctx.fillStyle="#94A3B8";F("",18);
  ctx.fillText("صادر آلياً من تطبيق مسار — بتطوير الأستاذ "+(S.settings.teacher||"أستاذ المادة")+" — "+instOf(s),W/2,H-28);
  return cv;
}
/* إرسال موحّد لأي بطاقة (تقرير درجات أو تبليغ) كصورة فقط */
function logMessage(s,cardOpts,recipientLabel){
  (S.messages[s.id]=S.messages[s.id]||[]).unshift({
    date:todayStr(),badge:cardOpts.badge||(cardOpts.mode==="report"?"🖼 كشف درجات":"📋 تبليغ"),
    to:recipientLabel,text:(cardOpts.bodyText||"").slice(0,200)
  });
  if(S.messages[s.id].length>50)S.messages[s.id].length=50;
  save.messages();
}
async function shareItemCard(s,cardOpts){
  const [logo,sigImg]=await Promise.all([loadImgCached(instLogo(instOf(s))),loadImgCached(S.settings.signature||""),ensureFontsReady()]);
  const cv=cardOpts.mode==="report"?buildReportCanvas(s,logo,sigImg):buildNotifCard(s,logo,cardOpts,sigImg);
  if(!cv||!cv.toBlob){toast("المتصفح لا يدعم إنشاء الصور");return false}
  const targetPhone=cardOpts.toPhone||s.phone;
  const recipientLabel=cardOpts.recipientLabel||"ولي الأمر";
  return new Promise(resolve=>{
    cv.toBlob(async(b)=>{
      if(!b){toast("تعذر إنشاء الصورة");resolve(false);return}
      const prefix=cardOpts.filePrefix||(cardOpts.mode==="report"?"تقرير":"تبليغ");
      const fname=prefix+"_"+s.name.trim().replace(/\s+/g,"_")+"_"+todayStr()+".png";
      const file=new File([b],fname,{type:"image/png"});
      // الخطة الأساسية: مشاركة الصورة مباشرة (بلا تنزيل) — يختار الأستاذ واتساب فمحادثة المستلم من قائمة المشاركة
      const shareText=cardOpts.bodyText||"";
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        try{
          await navigator.share({files:[file],title:fname,text:shareText});
          logMessage(s,cardOpts,recipientLabel);
          resolve(true);return;
        }catch(e){
          if(e&&e.name==="AbortError"){resolve(false);return} // المستخدم ألغى المشاركة عمدًا — لا نفرض الخطة البديلة
          /* فشلت المشاركة لسبب آخر — نكمل للخطة البديلة */
        }
      }
      // خطة بديلة (متصفحات لا تدعم مشاركة الملفات): تنزيل + فتح محادثة الرقم المستهدف مباشرة مع نص الرسالة جاهزاً
      const a=document.createElement("a");
      a.href=URL.createObjectURL(b);a.download=fname;a.click();
      const n=normPhone(targetPhone);
      if(n){
        window.open("https://wa.me/"+n+(shareText?("?text="+encodeURIComponent(shareText)):""),"_blank");
        toast("نُزّلت البطاقة — بمحادثة واتساب "+recipientLabel+" اضغط 📎 واختر الصورة");
        logMessage(s,cardOpts,recipientLabel);
      }else{
        toast("نُزّلت البطاقة بجهازك — لا يوجد رقم هاتف مسجّل لـ"+recipientLabel);
      }
      resolve(true);
    },"image/png");
  });
}

/* ============ قفل التطبيق ============ */
function showLock(cb){
  el("modal").innerHTML=
  '<div class="overlay" id="lockScreen" style="align-items:center;background:linear-gradient(160deg,#0F172A,#020617)">'+
    '<div style="background:#fff;border-radius:20px;padding:26px;width:86%;max-width:320px;text-align:center;margin:0 16px">'+
      '<div style="font-size:36px">🔒</div>'+
      '<h3 style="margin:8px 0 4px">'+esc(S.settings.teacher||"مرحباً")+'</h3>'+
      '<p style="margin:0 0 12px;font-size:12.5px;color:#64748B">أدخل رمز القفل لفتح التطبيق</p>'+
      '<input id="pinIn" type="password" inputmode="numeric" maxlength="6" style="width:100%;padding:12px;border:1.5px solid var(--line);border-radius:12px;text-align:center;font-size:22px;letter-spacing:8px;outline:none">'+
      '<button class="btn" id="pinGo" style="margin-top:12px;width:100%">فتح</button>'+
    '</div></div>';
  const go=async()=>{
    const entered=el("pinIn").value;
    const ok=hasCrypto&&S.settings.pinHash?(await hashPin(entered,S.settings.pinSalt))===S.settings.pinHash:entered===S.settings.pin;
    if(ok){closeModal();cb()}
    else{toast("رمز غير صحيح");el("pinIn").value=""}
  };
  el("pinGo").onclick=go;
  el("pinIn").onkeydown=e=>{if(e.key==="Enter")go()};
}
function openPinSheet(){
  const has=!!(S.settings.pinHash||S.settings.pin);
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>🔒 رمز قفل التطبيق</h3><button class="x" id="px">✕</button></div>'+
    '<div class="form">'+
      (has?'<label>الرمز الحالي<input id="pinOld" type="password" inputmode="numeric" maxlength="6"></label>':"")+
      '<label>'+(has?"الرمز الجديد (اتركه فارغاً لإزالة القفل)":"رمز جديد (4-6 أرقام)")+'<input id="pinNew" type="password" inputmode="numeric" maxlength="6"></label>'+
      '<label>تأكيد الرمز<input id="pinNew2" type="password" inputmode="numeric" maxlength="6"></label>'+
      '<p class="empty" style="padding:8px;font-size:11.5px">حماية أساسية تمنع فتح التطبيق من الفضوليين. لا تنسَ رمزك — لا توجد طريقة استرجاع سوى إعادة تثبيت التطبيق وفقدان البيانات (احتفظ بنسخة احتياطية).</p>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn ghost" id="pCancel">إلغاء</button><button class="btn" id="pSave">حفظ</button></div>'+
  '</div></div>';
  el("px").onclick=el("pCancel").onclick=closeModal;
  el("pSave").onclick=async()=>{
    if(has){
      const oldVal=el("pinOld").value;
      const oldOk=hasCrypto&&S.settings.pinHash?(await hashPin(oldVal,S.settings.pinSalt))===S.settings.pinHash:oldVal===S.settings.pin;
      if(!oldOk){toast("الرمز الحالي غير صحيح");return}
    }
    const p1=el("pinNew").value.trim(),p2=el("pinNew2").value.trim();
    if(p1===""&&has){delete S.settings.pin;delete S.settings.pinHash;delete S.settings.pinSalt;save.settings();closeModal();render();toast("تمت إزالة القفل");return}
    if(!/^\d{4,6}$/.test(p1)){toast("الرمز يجب أن يكون 4-6 أرقام");return}
    if(p1!==p2){toast("الرمزان غير متطابقين");return}
    delete S.settings.pin;
    if(hasCrypto){
      S.settings.pinSalt=b64Of(crypto.getRandomValues(new Uint8Array(16)));
      S.settings.pinHash=await hashPin(p1,S.settings.pinSalt);
    }else{
      S.settings.pin=p1; // بيئة بدون دعم تشفير — احتياطي فقط
    }
    save.settings();closeModal();render();toast("تم تفعيل القفل ✓");
  };
}

/* ============ الإقلاع ============ */
/* ============ رسم الدوال الرياضية ============ */
function safeEvalFunc(expr){
  const cleaned=String(expr||"").trim();
  // حدود تمنع التعبيرات الشديدة الطول أو الحسابات الأسّية المفرطة من تجميد الواجهة.
  if(!cleaned||cleaned.length>160)return null;
  if((cleaned.match(/\^/g)||[]).length>6)return null;
  if(/\d{13,}/.test(cleaned))return null;
  if(!/^[0-9x+\-*/^().,\s a-zA-Z]*$/.test(cleaned))return null;
  const allowedWords=["x","sin","cos","tan","sqrt","abs","pow","log","log10","exp","PI","E","min","max","floor","ceil","round"];
  const words=cleaned.match(/[a-zA-Z]+/g)||[];
  for(const w of words)if(!allowedWords.includes(w))return null;
  const js=cleaned.replace(/\^/g,"**");
  try{
    const fn=new Function("x","sin","cos","tan","sqrt","abs","pow","log","log10","exp","PI","E","min","max","floor","ceil","round",
      "return "+js+";");
    return xv=>{
      const out=fn(xv,Math.sin,Math.cos,Math.tan,Math.sqrt,Math.abs,Math.pow,Math.log,Math.log10,Math.exp,Math.PI,Math.E,Math.min,Math.max,Math.floor,Math.ceil,Math.round);
      return Number.isFinite(out)&&Math.abs(out)<=1e12?out:NaN;
    };
  }catch(e){return null}
}
function drawFunctionPlot(canvas,expr,xMin,xMax){
  const ctx=canvas.getContext("2d");
  const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
  const fn=safeEvalFunc(expr);
  const pad=30;
  // نحدد مجال y تقريبياً بأخذ عينات من الدالة
  let yMin=-10,yMax=10;
  if(fn){
    const samples=[];
    for(let i=0;i<=100;i++){
      const xv=xMin+(xMax-xMin)*i/100;
      try{const yv=fn(xv);if(isFinite(yv))samples.push(yv)}catch(e){}
    }
    if(samples.length){
      yMin=Math.min(...samples);yMax=Math.max(...samples);
      const m=(yMax-yMin)*0.15||1;yMin-=m;yMax+=m;
    }
  }
  const xToPx=xv=>pad+(xv-xMin)/(xMax-xMin)*(W-2*pad);
  const yToPx=yv=>H-pad-(yv-yMin)/(yMax-yMin)*(H-2*pad);
  // الشبكة
  ctx.strokeStyle="#E2E8F0";ctx.lineWidth=1;
  for(let i=0;i<=10;i++){
    const gx=pad+i*(W-2*pad)/10,gy=pad+i*(H-2*pad)/10;
    ctx.beginPath();ctx.moveTo(gx,pad);ctx.lineTo(gx,H-pad);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,gy);ctx.lineTo(W-pad,gy);ctx.stroke();
  }
  // المحاور
  ctx.strokeStyle="#0F172A";ctx.lineWidth=2;
  if(yMin<=0&&yMax>=0){ctx.beginPath();ctx.moveTo(pad,yToPx(0));ctx.lineTo(W-pad,yToPx(0));ctx.stroke()}
  if(xMin<=0&&xMax>=0){ctx.beginPath();ctx.moveTo(xToPx(0),pad);ctx.lineTo(xToPx(0),H-pad);ctx.stroke()}
  // المنحنى
  if(fn){
    ctx.strokeStyle="#D4AF37";ctx.lineWidth=3;ctx.beginPath();
    let started=false;
    for(let i=0;i<=400;i++){
      const xv=xMin+(xMax-xMin)*i/400;
      let yv;try{yv=fn(xv)}catch(e){yv=NaN}
      if(!isFinite(yv)){started=false;continue}
      const px=xToPx(xv),py=yToPx(yv);
      if(!started){ctx.moveTo(px,py);started=true}else ctx.lineTo(px,py);
    }
    ctx.stroke();
  }
  return !!fn;
}
/* ============ التقويم الدراسي ============ */
const EVENT_TYPES=[["exam","📝","امتحان","#B3453F"],["holiday","🏖️","عطلة","#1E7A4C"],["occasion","🎉","مناسبة","#B8860B"]];
const evtMeta=t=>EVENT_TYPES.find(x=>x[0]===t)||["custom","📌","حدث","#475569"];
function eventsForDate(dateStr){
  const custom=S.events.filter(e=>e.date===dateStr).map(e=>({id:e.id,date:e.date,type:e.type,title:e.title,auto:false}));
  const hw=S.homework.filter(h=>h.date===dateStr).map(h=>({date:h.date,type:"hw",title:"واجب: "+h.grade+" — "+secTerm(S.curInst)+" "+h.section,auto:true}));
  const exs=(S.exams||[]).filter(e=>e.date===dateStr).map(e=>({date:e.date,type:"exam",title:"📝 "+e.title,auto:true}));
  return custom.concat(hw).concat(exs);
}
function openCalendar(){
  let cur=new Date();cur.setDate(1);
  let selectedDate=todayStr();
  const WEEK=["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
  const draw=()=>{
    const y=cur.getFullYear(),m=cur.getMonth();
    const firstDay=new Date(y,m,1).getDay();
    const daysInMonth=new Date(y,m+1,0).getDate();
    const monthName=["كانون الثاني","شباط","آذار","نيسان","أيار","حزيران","تموز","آب","أيلول","تشرين الأول","تشرين الثاني","كانون الأول"][m]+" "+y;
    let cells="";
    for(let i=0;i<firstDay;i++)cells+='<div class="calCell empty"></div>';
    for(let d=1;d<=daysInMonth;d++){
      const dateStr=y+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
      const evs=eventsForDate(dateStr);
      const isToday=dateStr===todayStr();
      cells+='<div class="calCell'+(isToday?" today":"")+(selectedDate===dateStr?" sel":"")+'" data-date="'+dateStr+'">'+
        '<span class="calNum">'+d+'</span>'+
        (evs.length?'<div class="calDots">'+evs.slice(0,3).map(e=>'<span class="calDot" style="background:'+(e.type==="hw"?"#334155":evtMeta(e.type)[3])+'"></span>').join("")+'</div>':"")+
        '</div>';
    }
    const dayEvs=eventsForDate(selectedDate);
    el("modal").innerHTML=
    '<div class="overlay"><div class="sheet">'+
      '<div class="sheetHead"><h3>📅 التقويم الدراسي</h3><button class="x" id="calX">✕</button></div>'+
      '<div class="form">'+
        '<div class="calNav"><button id="calPrev" type="button">‹</button><b>'+monthName+'</b><button id="calNext" type="button">›</button></div>'+
        '<div class="calWeek">'+WEEK.map(d=>'<span>'+d+'</span>').join("")+'</div>'+
        '<div class="calGrid">'+cells+'</div>'+
        '<div class="subCard"><div class="subHead"><span class="subName">📌 '+selectedDate+'</span></div>'+
          (dayEvs.length===0?'<p class="empty" style="padding:8px">لا توجد أحداث بهذا اليوم.</p>':
            dayEvs.map(e=>'<div class="behavRow"><span class="bChip p">'+evtMeta(e.type)[1]+'</span><div class="bd">'+esc(e.title)+'</div>'+
              (e.auto?'':'<button class="bDel" data-evdel="'+e.id+'">✕</button>')+'</div>').join(""))+
          '<div class="addRow" style="margin-top:8px"><select id="evType">'+EVENT_TYPES.map(([v,ic,l])=>'<option value="'+v+'">'+ic+' '+l+'</option>').join("")+'</select><input id="evTitle" placeholder="عنوان الحدث…"><button class="btn" id="evAdd">+</button></div>'+
        '</div>'+
      '</div>'+
      '<div class="sheetFoot"><button class="btn" id="calClose">تم</button></div>'+
    '</div></div>';
    el("calX").onclick=el("calClose").onclick=closeModal;
    el("calPrev").onclick=()=>{cur.setMonth(cur.getMonth()-1);draw()};
    el("calNext").onclick=()=>{cur.setMonth(cur.getMonth()+1);draw()};
    el("modal").querySelectorAll(".calCell[data-date]").forEach(c=>c.onclick=()=>{selectedDate=c.dataset.date;draw()});
    el("evAdd").onclick=()=>{
      const title=el("evTitle").value.trim();
      if(!title){toast("اكتب عنوان الحدث");return}
      S.events.push({id:uid(),date:selectedDate,type:el("evType").value,title});
      save.events();draw();toast("أُضيف الحدث ✓");
    };
    el("modal").querySelectorAll("[data-evdel]").forEach(b=>b.onclick=()=>{
      S.events=S.events.filter(e=>e.id!==b.dataset.evdel);
      save.events();draw();
    });
  };
  draw();
  let touchStartX=null;
  const modalEl=el("modal");
  const onStart=e=>{touchStartX=e.touches[0].clientX};
  const onEnd=e=>{
    if(touchStartX===null)return;
    const dx=e.changedTouches[0].clientX-touchStartX;
    touchStartX=null;
    if(Math.abs(dx)<50)return;
    if(dx<0){cur.setMonth(cur.getMonth()+1);draw()}
    else{cur.setMonth(cur.getMonth()-1);draw()}
  };
  modalEl.addEventListener("touchstart",onStart,{passive:true});
  modalEl.addEventListener("touchend",onEnd,{passive:true});
}
function openFunctionPlotter(){
  const presets=[["خطي","2*x+1"],["تربيعي","x^2-3*x+2"],["تكعيبي","x^3-4*x"],["جيب","sin(x)"],["جتا","cos(x)"],["جذر","sqrt(x)"],["أسي","2^x"]];
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>📈 رسم الدوال الرياضية</h3><button class="x" id="pfX">✕</button></div>'+
    '<div class="form">'+
      '<label>الدالة (استخدم x كمتغيّر)<input id="pfExpr" value="x^2-3*x+2" placeholder="مثال: x^2-3*x+2"></label>'+
      '<div class="tplChips">'+presets.map(([l,e])=>'<button data-pfpreset="'+esc(e)+'">'+l+'</button>').join("")+'</div>'+
      '<div class="grid2">'+
        '<label>من x<input type="number" id="pfMin" value="-10"></label>'+
        '<label>إلى x<input type="number" id="pfMax" value="10"></label>'+
      '</div>'+
      '<canvas id="pfCanvas" width="600" height="420" style="width:100%;border:1px solid var(--line);border-radius:12px"></canvas>'+
      '<p id="pfErr" class="empty" style="padding:6px;font-size:11.5px;display:none;color:var(--red)">تعذّر رسم هذه الصيغة — تأكد من كتابتها بشكل صحيح (مثال: x^2+2*x-1)</p>'+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="pfClose">تم</button></div>'+
  '</div></div>';
  const redraw=()=>{
    const ok=drawFunctionPlot(el("pfCanvas"),el("pfExpr").value,Number(el("pfMin").value)||-10,Number(el("pfMax").value)||10);
    el("pfErr").style.display=ok?"none":"block";
  };
  el("pfExpr").oninput=redraw;
  el("pfMin").oninput=redraw;
  el("pfMax").oninput=redraw;
  el("modal").querySelectorAll("[data-pfpreset]").forEach(b=>b.onclick=()=>{el("pfExpr").value=b.dataset.pfpreset;redraw()});
  el("pfX").onclick=el("pfClose").onclick=closeModal;
  redraw();
}
const ONBOARD_STEPS=[
  {icon:"👋",title:"أهلاً بيك بتطبيق مسار",body:"تطبيق شخصي لإدارة طلبتك بكل مؤسساتك — بيانات، حضور، درجات، أقساط، ومراسلة أولياء الأمور، كله بمكان وحدة وبدون إنترنت."},
  {icon:"🏫",title:"مؤسساتك",body:"تكدر تضيف أكثر من مدرسة أو معهد من ⚙️ الإعدادات ← إدارة مؤسساتي. لكل مؤسسة شعارها ونوع خطابها (رسمي أو تدريس خاص) وحتى تسمية الشعب أو المجموعات الخاصة فيها."},
  {icon:"👤",title:"أضف طلبتك",body:"من تبويب «الطلبة» تكدر تضيف طالباً واحداً، أو تستورد قائمة أسماء دفعة وحدة. سجّل رقم ولي الأمر ورقم الطالب نفسه إذا متوفر."},
  {icon:"✓",title:"الحضور والدرجات",body:"سجّل الحضور اليومي ودرجات الامتحانات اليومية والشهرية بسهولة، والتطبيق يحسب المعدلات والنتيجة النهائية تلقائياً حسب قوانين النجاح والإكمال."},
  {icon:"🖼",title:"شارك التقارير مباشرة",body:"أرسل كشوفات الدرجات وتنبيهات الغياب وبطاقات الثناء كصور أنيقة مباشرة عبر واتساب لولي الأمر أو للطالب نفسه، بضغطة وحدة."},
  {icon:"🔒",title:"احمِ بياناتك",body:"فعّل قفل PIN لحماية التطبيق، وخذ نسخة احتياطية بشكل دوري من ⚙️ الإعدادات. تكدر تفعّل المزامنة التلقائية إذا تستخدم أكثر من جهاز."},
  {icon:"🎉",title:"جاهز تبدأ",body:"هذا كل شي تحتاجه بالبداية. تكدر تعيد هذي الجولة بأي وقت من ⚙️ الإعدادات. بالتوفيق!"}
];
/* ============ تخصيص الميزات الظاهرة (نظام الإضافات) ============ */
const FEATURE_LIST=[
  ["exams","📝 الامتحانات الإلكترونية (Google Forms)"],
  ["stats","📊 صفحة الإحصاءات الكاملة"],
  ["honor","🏆 لوحة الشرف والتحفيز"],
  ["plot","📈 رسم الدوال الرياضية"],
  ["calendar","📅 التقويم الدراسي"],
  ["examBuilder","📝 إعداد وطباعة ورقة أسئلة"],
  ["qbank","📚 بنك الأسئلة"],
  ["archive","📦 أرشيف السنوات"]
];
const featureOn=key=>(S.settings.features||{})[key]!==false;
function openPluginsSheet(){
  el("modal").innerHTML=
  '<div class="overlay"><div class="sheet">'+
    '<div class="sheetHead"><h3>🧩 تخصيص الميزات الظاهرة</h3><button class="x" id="plX">✕</button></div>'+
    '<div class="form">'+
      '<p class="empty" style="padding:6px;font-size:11.5px">عطّل أي ميزة ما تحتاجها حتى تصير الإعدادات أبسط وأقصر. تكدر ترجّعها بأي وقت.</p>'+
      FEATURE_LIST.map(([k,l])=>
        '<label style="flex-direction:row;align-items:center;justify-content:space-between;padding:10px 4px;border-bottom:1px solid var(--line)">'+l+
        '<input type="checkbox" data-feat="'+k+'" '+(featureOn(k)?"checked":"")+' style="width:20px;height:20px">'+
        '</label>').join("")+
    '</div>'+
    '<div class="sheetFoot"><button class="btn" id="plClose">تم</button></div>'+
  '</div></div>';
  el("modal").querySelectorAll("[data-feat]").forEach(cb=>cb.onchange=()=>{
    S.settings.features=S.settings.features||{};
    S.settings.features[cb.dataset.feat]=cb.checked;
    save.settings();
  });
  el("plX").onclick=el("plClose").onclick=()=>{closeModal();if(S.tab==="settings")render()};
}
function openSetupWizard(){
  let step=0;
  const total=4;
  const data={instName:"",instType:"school",teacher:S.settings.teacher||"",subject:S.settings.subject||"",grade:GRADES[0],section:"أ",names:""};
  const dots=()=>'<div style="display:flex;gap:6px;justify-content:center;margin-top:10px">'+Array.from({length:total},(_,d)=>'<span style="width:'+(d===step?"22px":"8px")+';height:8px;border-radius:999px;background:'+(d===step?"var(--gold)":"var(--line)")+';transition:width .2s"></span>').join("")+'</div>';
  const renderStep=()=>{
    let body="",foot="";
    if(step===0){
      body='<div style="font-size:52px;text-align:center">👋</div>'+
        '<h2 class="h" style="text-align:center;margin:4px 0 14px">أهلاً بيك! خلّينا نجهّز تطبيقك بدقائق</h2>'+
        '<label>اسم مؤسستك (مدرسة أو معهد)<input id="swInst" value="'+esc(data.instName)+'" placeholder="مثال: ثانوية النور المسائية"></label>'+
        '<label>نوع المؤسسة<select id="swType"><option value="school"'+(data.instType==="school"?" selected":"")+'>🏫 مدرسة رسمية</option><option value="private"'+(data.instType==="private"?" selected":"")+'>👨‍🏫 تدريس خاص</option></select></label>';
    }else if(step===1){
      body='<div style="font-size:52px;text-align:center">👨‍🏫</div>'+
        '<h2 class="h" style="text-align:center;margin:4px 0 14px">بياناتك كمدرّس</h2>'+
        '<label>اسمك الكامل<input id="swTeacher" value="'+esc(data.teacher)+'" placeholder="مثال: أحمد محمد علي"></label>'+
        '<label>المادة التي تدرّسها<input id="swSubject" value="'+esc(data.subject)+'" placeholder="مثال: اللغة العربية، الفيزياء، الرياضيات..."></label>';
    }else if(step===2){
      body='<div style="font-size:52px;text-align:center">👤</div>'+
        '<h2 class="h" style="text-align:center;margin:4px 0 14px">أول صف تريد تبدأ فيه</h2>'+
        '<p class="empty" style="padding:6px;font-size:12px">تكدر تضيف بقية الصفوف والشعب لاحقاً بسهولة — نبدأ بواحد فقط الآن.</p>'+
        '<div class="grid2"><label>الصف<select id="swGrade">'+opts(GRADES,data.grade)+'</select></label>'+
        '<label>الشعبة<select id="swSection">'+opts(SECTIONS,data.section)+'</select></label></div>';
    }else if(step===3){
      body='<div style="font-size:52px;text-align:center">📋</div>'+
        '<h2 class="h" style="text-align:center;margin:4px 0 14px">استورد أسماء الطلبة (اختياري)</h2>'+
        '<label>الأسماء (اسم بكل سطر) — تكدر تتخطى هذي الخطوة وتضيفهم لاحقاً<textarea id="swNames" rows="7" placeholder="أحمد محمد علي حسين&#10;زينب كريم جاسم">'+esc(data.names)+'</textarea></label>';
    }
    el("modal").innerHTML=
    '<div class="overlay"><div class="sheet">'+
      '<div class="sheetHead"><h3>مساعد الإعداد ('+(step+1)+'/'+total+')</h3><button class="x" id="swX">✕</button></div>'+
      '<div class="form">'+body+dots()+'</div>'+
      '<div class="sheetFoot">'+
        (step>0?'<button class="btn ghost" id="swBack">السابق</button>':'<button class="btn ghostD" id="swSkip">تخطي الإعداد</button>')+
        '<button class="btn" id="swNext">'+(step===total-1?"إنهاء الإعداد ✓":"التالي")+'</button>'+
      '</div>'+
    '</div></div>';
    el("swX").onclick=closeModal;
    if(step===0){el("swInst").onchange=e=>data.instName=e.target.value.trim();el("swType").onchange=e=>data.instType=e.target.value}
    if(step===1){el("swTeacher").onchange=e=>data.teacher=e.target.value.trim();el("swSubject").onchange=e=>data.subject=e.target.value.trim()}
    if(step===2){el("swGrade").onchange=e=>data.grade=e.target.value;el("swSection").onchange=e=>data.section=e.target.value}
    if(step===3){el("swNames").oninput=e=>data.names=e.target.value}
    const skipBtn=el("swSkip");if(skipBtn)skipBtn.onclick=closeModal;
    if(step>0)el("swBack").onclick=()=>{step--;renderStep()};
    el("swNext").onclick=()=>{
      if(step===0&&!data.instName.trim()){toast("اكتب اسم مؤسستك أولاً");return}
      if(step===1&&!data.teacher.trim()){toast("اكتب اسمك أولاً");return}
      if(step===1&&!data.subject.trim()){toast("اكتب المادة التي تدرّسها");return}
      if(step<total-1){step++;renderStep();return}
      // الإنهاء: نحفظ كل البيانات المُجمّعة
      S.settings.teacher=data.teacher;
      S.settings.subject=data.subject;
      if(!INSTS().includes(data.instName))S.settings.insts=INSTS().concat([data.instName]);
      setInstMeta(data.instName,{type:data.instType});
      S.curInst=data.instName;
      save.settings();updateHeader();
      const names=data.names.split("\n").map(x=>x.trim()).filter(Boolean);
      names.forEach(name=>S.students.push({id:uid(),name,examNo:"",photo:"",inst:data.instName,gender:"ذكر",birth:"",grade:data.grade,section:data.section,branch:"-",guardian:"",phone:"",sphone:"",telegram:"",address:"",status:"مستمر",notes:""}));
      if(names.length)save.students();
      closeModal();render();
      toast("🎉 تم إعداد تطبيقك! "+(names.length?"أُضيف "+names.length+" طالب.":""));
    };
  };
  renderStep();
}
function openOnboarding(){
  let i=0;
  const render2=()=>{
    const st=ONBOARD_STEPS[i];
    const last=i===ONBOARD_STEPS.length-1;
    el("modal").innerHTML=
    '<div class="overlay"><div class="sheet">'+
      '<div class="sheetHead"><h3>جولة تعريفية</h3><button class="x" id="obX">✕</button></div>'+
      '<div class="form" style="align-items:center;text-align:center;padding-top:8px">'+
        '<div style="font-size:56px;line-height:1">'+st.icon+'</div>'+
        '<h2 class="h" style="margin:6px 0 2px">'+st.title+'</h2>'+
        '<p style="font-size:14.5px;color:#475569;line-height:1.9;max-width:480px">'+st.body+'</p>'+
        '<div style="display:flex;gap:6px;margin-top:6px">'+ONBOARD_STEPS.map((_,d)=>'<span style="width:'+(d===i?"22px":"8px")+';height:8px;border-radius:999px;background:'+(d===i?"var(--gold)":"var(--line)")+';transition:width .2s"></span>').join("")+'</div>'+
      '</div>'+
      '<div class="sheetFoot">'+
        (i>0?'<button class="btn ghost" id="obBack">السابق</button>':'<button class="btn ghostD" id="obSkip">تخطي</button>')+
        '<button class="btn" id="obNext">'+(last?"ابدأ الآن 🎉":"التالي")+'</button>'+
      '</div>'+
    '</div></div>';
    el("obX").onclick=closeModal;
    if(i>0)el("obBack").onclick=()=>{i--;render2()};
    else el("obSkip").onclick=closeModal;
    el("obNext").onclick=()=>{if(last)closeModal();else{i++;render2()}};
  };
  render2();
  // دعم السحب باللمس يميناً/يساراً للتنقل بين الخطوات
  let touchStartX=null;
  const modalEl=el("modal");
  const onStart=e=>{touchStartX=e.touches[0].clientX};
  const onEnd=e=>{
    if(touchStartX===null)return;
    const dx=e.changedTouches[0].clientX-touchStartX;
    touchStartX=null;
    if(Math.abs(dx)<50)return;
    const last=i===ONBOARD_STEPS.length-1;
    if(dx<0&&!last){i++;render2()}
    else if(dx>0&&i>0){i--;render2()}
  };
  modalEl.addEventListener("touchstart",onStart,{passive:true});
  modalEl.addEventListener("touchend",onEnd,{passive:true});
}
async function boot(){
  S.wsId="";
  S.students=await loadKey("students",[]);
  S.grades=await loadKey("grades",{});
  S.attendance=await loadKey("attendance",{});
  S.payments=await loadKey("payments",{});
  S.behavior=await loadKey("behavior",{});
  S.homework=await loadKey("homework",[]);
  S.timetable=await loadKey("timetable",[]);
  S.exams=await loadKey("exams",[]);
  S.messages=await loadKey("messages",{});
  S.events=await loadKey("events",[]);
  S.qbank=await loadKey("qbank",[]);
  S.examTemplates=await loadKey("examTemplates",[]);
  S.dailyPlans=await loadKey("dailyPlans",[]);
  try{Object.assign(photoCache,await idbGetAllPhotos())}catch(e){}
  // ترحيل (بالخلفية): صور طلبة قديمة مخزّنة كاملة داخل localStorage → IndexedDB (سعة أكبر بكثير، يقلل خطر امتلاء التخزين)
  (async()=>{
    let anyMigrated=false;
    for(const s of S.students){
      if(s.photo&&s.photo.indexOf("data:")===0){
        photoCache[s.id]=s.photo;
        await idbSetPhoto(s.id,s.photo);
        s.photo="idb";
        anyMigrated=true;
      }
    }
    if(anyMigrated){save.students();if(S.tab==="students")render()}
  })();
  const st=await loadKey("settings",{});
  S.settings=Object.assign({school:"ثانويتي",subject:"",teacher:"",absLimit:5},st);
  // ترحيل: رمز قفل قديم مخزّن كنص صريح → تجزئة (hash) مملّحة
  if(S.settings.pin&&!S.settings.pinHash&&hasCrypto){
    const legacyPin=S.settings.pin;
    S.settings.pinSalt=b64Of(crypto.getRandomValues(new Uint8Array(16)));
    hashPin(legacyPin,S.settings.pinSalt).then(h=>{S.settings.pinHash=h;delete S.settings.pin;save.settings()});
  }
  applyAppFont();
  // ترحيل: أسماء المدارس القديمة (نظام المساحات) تصير قائمة مؤسسات
  if(!S.settings.insts||!S.settings.insts.length){
    const oldMeta=await loadRaw("meta",null);
    const names=oldMeta&&oldMeta.schools?oldMeta.schools.map(w=>w.name).filter(Boolean):[];
    S.settings.insts=names.length?[...new Set(names)]:[S.settings.school||"مدرستي"];
    save.settings();
  }
  // ترحيل: طلبة وحصص بدون مؤسسة → المؤسسة الأولى
  let migrated=false;
  S.students.forEach(s=>{if(!s.inst){s.inst=INSTS()[0];migrated=true}});
  S.timetable.forEach(t=>{if(!t.inst){t.inst=INSTS()[0];migrated=true}});
  if(migrated){save.students();save.timetable()}
  el("yearLbl").textContent=academicYearStr()+" · v"+APP_VER;
  const sn=el("schoolName");
  sn.onchange=()=>{
    if(!S.curInst){updateHeader();return}
    if(renameInst(S.curInst,sn.value))toast("تم تغيير الاسم");
    updateHeader();
  };
  el("wsBtn").onclick=openInstSheet;
  const fsBtn=el("fsBtn");
  const fsSupported=!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen);
  if(!fsSupported)fsBtn.style.display="none";
  const updateFsIcon=()=>{
    const isFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
    fsBtn.textContent=isFs?"⛶":"⛶";
    fsBtn.title=isFs?"الخروج من ملء الشاشة":"ملء الشاشة";
    fsBtn.style.opacity=isFs?"1":"";
  };
  fsBtn.onclick=async()=>{
    try{
      const isFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
      if(!isFs){
        if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
        else if(document.documentElement.webkitRequestFullscreen)document.documentElement.webkitRequestFullscreen();
      }else{
        if(document.exitFullscreen)await document.exitFullscreen();
        else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
      }
    }catch(e){toast("تعذّر تفعيل ملء الشاشة بهذا المتصفح")}
  };
  document.addEventListener("fullscreenchange",updateFsIcon);
  document.addEventListener("webkitfullscreenchange",updateFsIcon);
  updateFsIcon();
  const db=el("darkBtn");
  const applyDark=()=>{
    document.documentElement.classList.toggle("dark",!!S.settings.dark);
    document.body.style.background=S.settings.dark?"#020617":"";
    db.textContent=S.settings.dark?"☀️":"🌙";
  };
  db.onclick=()=>{S.settings.dark=!S.settings.dark;save.settings();applyDark()};
  applyDark();
  updateHeader();
  updateStorageBanner();
  S.tab="home";
  if(S.settings.pinHash||S.settings.pin)showLock(()=>render());
  else render();
  if(syncOn())syncPull(true); // بالخلفية بدون انتظار — تُحدّث العرض تلقائياً إذا وصلت بيانات جديدة
  if(!window._visHooked){
    window._visHooked=true;
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible"&&syncOn()&&Date.now()-lastPullAt>60000)syncPull(true);
    });
  }
  const splashEl=el("splash");
  if(splashEl)setTimeout(()=>splashEl.classList.add("hide"),200);
  if(!S.settings.onboarded){
    S.settings.onboarded=true;save.settings();
    if(S.students.length===0)setTimeout(openSetupWizard,900);
  }
  // تحميل مسبق (صامت) لكل الشعارات والتوقيع بالذاكرة، حتى تصير أول عملية مشاركة سريعة قدر الإمكان
  INSTS().forEach(n=>{const lg=instLogo(n);if(lg)loadImgCached(lg)});
  if(S.settings.signature)loadImgCached(S.settings.signature);
}
/* ============ شبكة أمان عامة: لو أي خطأ غير متوقع صار بأي مكان، ما نترك المستخدم بشاشة بيضاء صامتة ============ */
let _errorReported=false;
// تقرير خطأ مختصر لمشروع Supabase الخاص بالمطوّر (نفس بيانات المزامنة الموجودة أصلاً) — بدون أي بيانات طلبة، فقط تفاصيل تقنية عن الخطأ
async function reportErrorToSupabase(detail){
  if(!syncOn())return; // ما فيه وجهة نرسل لها التقرير أصلاً (المستخدم ما فعّل مزامنة سحابية)
  try{
    await fetch(S.settings.sync.url.replace(/\/+$/,"")+"/rest/v1/masar_error_logs",{
      method:"POST",
      headers:Object.assign(syncHeaders(),{Prefer:"return=minimal"}),
      body:JSON.stringify([{
        id:uid(),
        teacher:(S.settings&&S.settings.teacher)||"",
        school:(S.settings&&S.settings.school)||"",
        message:String((detail&&detail.message)||"").slice(0,500),
        stack:String((detail&&detail.stack)||"").slice(0,2000),
        page_url:location.href,
        app_ver:"v"+APP_VER,
        created_at:new Date().toISOString()
      }])
    });
  }catch(e){/* لا اتصال، أو الجدول غير منشأ بعد بمشروع Supabase — نتجاهل بصمت */}
}
function showCrashBanner(evt){
  try{
    if(!_errorReported){
      _errorReported=true; // تقرير واحد بالجلسة يكفي (يمنع إغراق الجدول لو صار الخطأ بحلقة متكررة)
      const detail=(evt&&evt.error)?{message:evt.error.message,stack:evt.error.stack}
        :(evt&&evt.reason)?{message:String((evt.reason&&evt.reason.message)||evt.reason),stack:evt.reason&&evt.reason.stack}
        :{message:(evt&&evt.message)||"unknown error"};
      reportErrorToSupabase(detail);
    }
    if(document.getElementById("crashBanner"))return; // مرة وحدة تكفي
    const box=document.createElement("div");
    box.id="crashBanner";
    box.style.cssText="position:fixed;left:12px;right:12px;bottom:70px;z-index:9999;background:#B3453F;color:#fff;padding:12px 16px;border-radius:14px;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;align-items:center;gap:10px;justify-content:space-between";
    box.innerHTML='<span>⚠️ صار خطأ غير متوقع. بياناتك المحفوظة سليمة — أعد تحميل الصفحة.</span><button style="background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:999px;padding:6px 14px;font-weight:700">إعادة التحميل</button>';
    box.querySelector("button").onclick=()=>location.reload();
    document.body.appendChild(box);
  }catch(_){/* حتى لو فشلت شبكة الأمان نفسها، ما نكسر شي إضافي */}
}
window.addEventListener("error",showCrashBanner);
window.addEventListener("unhandledrejection",showCrashBanner);
boot();
