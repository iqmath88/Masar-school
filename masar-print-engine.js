/* ============ محرك تقسيم صفحات حقيقي (يقيس العناصر فعليًا بدل الاعتماد على تقسيم المتصفح التلقائي) ============ */
async function renderMathIn(el){
  if(el.querySelector(".katex-wrap")){
    try{await Promise.race([loadKatex(),new Promise(r=>setTimeout(r,3000))])}catch(_){}
    if(window.katex){
      el.querySelectorAll(".katex-wrap").forEach(w=>{
        const lx=w.getAttribute("data-latex");
        if(!lx)return;
        try{const tmp=document.createElement("span");window.katex.render(lx,tmp,{throwOnError:false,displayMode:false,output:"html",strict:"ignore",trust:false});w.innerHTML=tmp.innerHTML}
        catch(_){w.innerHTML='<span class="mathFallback">'+esc("$"+lx+"$")+'</span>'}
      });
    }
  }
}
async function paginateContent({headerHTML,footerHTML,blocks,fFamily,extraBodyHTML}){
  const MM=96/25.4; // بكسل لكل ملم (مرجع CSS القياسي 96dpi)
  const pageHeightPx=297*MM;
  const marginPx=0; // Full-bleed PDF: الرأس يلامس أعلى ويمين ويسار صفحة A4
  const contentWidthPx=210*MM;

  // حاوية قياس حقيقية (نفس عرض ونوع خط الصفحة الحقيقية، خارج الشاشة تمامًا)
  const meas=document.createElement("div");
  // مهم: نستخدم نفس معرّف منطقة الطباعة مؤقتاً حتى تُطبّق قواعد CSS الخاصة بـ #printArea
  // أثناء القياس أيضاً؛ وإلا كانت البطاقات تُقاس بأحجام مختلفة عن الناتج النهائي فتتوزع خطأً على صفحات إضافية.
  meas.id="printArea";
  meas.className="printMeasureMode";
  meas.setAttribute("aria-hidden","true");
  meas.style.cssText="position:fixed;left:-99999px;top:0;width:"+contentWidthPx+"px;visibility:hidden;display:block;font-family:"+fFamily;
  document.body.appendChild(meas);
  let headerHeightPx,footerHeightPx,bodyPaddingPx,bodyGapPx=0,blockHeights,extraBodyHeightPx=0;
  let renderedHeaderHTML=headerHTML,renderedFooterHTML=footerHTML,renderedBlocks=blocks;
  try{
    // 1) نقيس ارتفاع الرأس (سيتكرر بأعلى كل صفحة)
    const headEl=document.createElement("div");
    headEl.className="pPageHead";
    headEl.innerHTML=headerHTML;
    meas.appendChild(headEl);
    await renderMathIn(headEl);
    const headImgs=[...headEl.querySelectorAll("img")].filter(i=>!i.complete);
    if(headImgs.length)await Promise.race([Promise.all(headImgs.map(i=>new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,1200)}))),new Promise(r=>setTimeout(r,2000))]);
    if(document.fonts&&document.fonts.ready)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2000))]);
    headerHeightPx=headEl.getBoundingClientRect().height;
    renderedHeaderHTML=headEl.innerHTML; // نحتفظ بالنسخة المرسومة فعليًا (معادلات KaTeX متضمنة) لاستخدامها بالمخرج النهائي

    // 2) نقيس ارتفاع التذييل (يظهر مرة وحدة فقط بآخر صفحة)
    const footEl=document.createElement("div");
    footEl.className="pPageFootWrap";
    footEl.innerHTML=footerHTML;
    meas.appendChild(footEl);
    await renderMathIn(footEl);
    footerHeightPx=footEl.getBoundingClientRect().height+12; // هامش أمان صغير (بكسل) لفروقات قياس الخط بين الأجهزة
    renderedFooterHTML=footEl.innerHTML;

    // 2ب) نقيس ارتفاع شريط التواصل الإضافي (extraBodyHTML) إن وُجد — يظهر بآخر صفحة بجانب التذييل
    // إغفال قياسه كان يسبب فراغًا خاطئًا بين المحتوى والتذييل عند وجوده
    if(extraBodyHTML){
      const extraEl=document.createElement("div");
      extraEl.innerHTML=extraBodyHTML;
      meas.appendChild(extraEl);
      extraBodyHeightPx=extraEl.getBoundingClientRect().height;
    }

    // 3) نقيس كل كتلة محتوى (سؤال/ملاحظة) بشكل مستقل
    // مهم: نضيفها كأشقاء مباشرين (بدون صندوق تغليف إضافي) لتفادي مشكلة "تصادم الهوامش" (margin collapse)
    // التي تجعل القياس المنفصل أصغر من الحجم الحقيقي عند وضع العناصر جنب بعض فعليًا
    const measurePage=document.createElement("div");
    measurePage.className="printPage examPrintPage";
    const bodyEl=document.createElement("div");
    bodyEl.className="pBody";
    measurePage.appendChild(bodyEl);
    meas.appendChild(measurePage);
    bodyEl.innerHTML=blocks.join("");
    await renderMathIn(bodyEl);
    if(document.fonts&&document.fonts.ready)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2000))]);
    const bodyCS=getComputedStyle(bodyEl);
    bodyPaddingPx=(parseFloat(bodyCS.paddingTop)||0)+(parseFloat(bodyCS.paddingBottom)||0);
    bodyGapPx=parseFloat(bodyCS.rowGap||bodyCS.gap)||0;
    blockHeights=[];
    renderedBlocks=[];
    Array.from(bodyEl.children).forEach(child=>{
      const rect=child.getBoundingClientRect();
      blockHeights.push(rect.height);
      renderedBlocks.push(child.outerHTML); // نفس المبدأ: النسخة المرسومة فعليًا، مو النص الخام
    });
  }finally{
    if(meas.parentNode)document.body.removeChild(meas);
  }

  // 4) المساحة المتاحة لكل صفحة (بافتراض أن الرأس يتكرر بكل صفحة)
  const safetyBufferPx=(Number(S.settings.printSafetyMM)||6)*MM; // هامش أمان قابل للتخصيص من الإعدادات (افتراضي 6مم — مؤكد يعطي صفحة واحدة)
  const availPerPage=pageHeightPx-marginPx*2-headerHeightPx-bodyPaddingPx-safetyBufferPx;
  // إذا كانت كتلة مفردة أطول من مساحة الصفحة، نتركها لمسار الطباعة الأصلي للمتصفح؛
  // لأن إجبارها داخل صفحة مصطنعة قد يسبب قصّ المحتوى أو صفحة فارغة.
  if(blockHeights.some(h=>h>availPerPage)){
    throw new Error("oversized print block");
  }

  // 5) نوزّع الكتل على صفحات فعليًا (خوارزمية تعبئة تراكمية بسيطة وحتمية) — نتتبّع الفهارس لا النصوص المصيّرة مباشرة
  const pageIdx=[];
  let curIdx=[],curH=0,curQuestionCount=0;
  // حد وقائي ثابت لأوراق الامتحان: التصميم الحالي لا يتحمل أكثر من 7 بطاقات
  // مع الرأس والتذييل على صفحة A4 في Android/iPad، حتى لو أعاد محرك PDF تحجيم الخطوط.
  // يبقى قياس الارتفاع هو الأساس، وهذا الحد يمنع تحديدًا سقوط السؤال الثامن خلف التذييل.
  const MAX_EXAM_QUESTIONS_PER_PAGE=7;
  blocks.forEach((_,i)=>{
    const h=blockHeights[i];
    const isQuestion=(renderedBlocks[i]||"").includes("examQGlass");
    const addH=h+(curIdx.length?bodyGapPx:0);
    const exceedsHeight=curIdx.length&&curH+addH>availPerPage;
    const exceedsQuestionCap=curIdx.length&&isQuestion&&curQuestionCount>=MAX_EXAM_QUESTIONS_PER_PAGE;
    if(exceedsHeight||exceedsQuestionCap){
      pageIdx.push(curIdx);
      curIdx=[];curH=0;curQuestionCount=0;
    }
    curH+=h+(curIdx.length?bodyGapPx:0);
    curIdx.push(i);
    if(isQuestion)curQuestionCount++;
  });
  pageIdx.push(curIdx);
  if(pageIdx.length>1&&pageIdx[pageIdx.length-1].length===0)pageIdx.pop();

  // 6) نتأكد أن التذييل (وشريط التواصل إن وُجد) يسع مع آخر صفحة محتوى؛ لو لا، ننقل كتلة واحدة في كل مرة لصفحة جديدة ونعيد الفحص
  // (بدل تجميع كل المنقولات دفعة واحدة، لأن هذا كان يعيد بناء نفس الصفحة الفاشلة الأصلية حرفيًا لو احتجنا نفرّغها بالكامل)
  const pageContentH=idxArr=>idxArr.reduce((a,i)=>a+blockHeights[i],0)+Math.max(0,idxArr.length-1)*bodyGapPx;
  const footerBudgetFor=idxArr=>footerHeightPx+extraBodyHeightPx+(extraBodyHeightPx&&idxArr.length?bodyGapPx:0);
  while(pageIdx.length){
    const lastArr=pageIdx[pageIdx.length-1];
    if(pageContentH(lastArr)+footerBudgetFor(lastArr)<=availPerPage)break; // يسع، ننتهي
    if(lastArr.length<=1){
      // كتلة وحدة (أو صفحة فارغة) ما نقدر نصغّرها أكثر، ولسا ما تكفي مع التذييل —
      // نعطي التذييل صفحة منفصلة خاصة فيه، بدل ما نتركه يفيض فعليًا لصفحة إضافية ما كان الكود يخطط لها
      break;
    }
    const moved=lastArr.pop();
    pageIdx.push([moved]); // صفحة جديدة فعلية تُفحص من جديد بالتكرار القادم
  }
  const pages=pageIdx.map(idxArr=>idxArr.map(i=>renderedBlocks[i]));
  const lastPageContentH=pageContentH(pageIdx[pageIdx.length-1]);


  // 7) نبني HTML الصفحات النهائي (التذييل يظهر دائمًا مع آخر صفحة الآن، بعد إعادة التوازن أعلاه)
  let html="";
  pages.forEach((pageBlocks,idx)=>{
    const isLast=idx===pages.length-1;
    const showFooterHere=isLast;
    const questionCount=pageBlocks.filter(b=>b.includes("examQGlass")).length;
    const fillEnabled=(S.settings.printDesign||{}).fillExamPage!==false;
    const fillClass=(pages.length===1&&fillEnabled&&questionCount>=4&&questionCount<=7)?" examFillPage":"";
    const examClass=questionCount?" examPrintPage":"";
    const pageNumHTML=((S.settings.printDesign||{}).showPageNumber===false||pages.length<=1)?'':'<div class="pPageNum">صفحة '+(idx+1)+' من '+pages.length+'</div>';
    const pageStyle=questionCount?' style="--exam-q-count:'+questionCount+'"':'';
    html+='<div class="printPage'+examClass+fillClass+'"'+pageStyle+'><div class="pPageHead">'+renderedHeaderHTML+'</div><div class="pBody">'+pageBlocks.join("")+(showFooterHere?extraBodyHTML:'')+'</div>'+
      (showFooterHere?renderedFooterHTML:'')+pageNumHTML+'</div>';
  });
  return html;
}
async function printHTML(title,body,withParent,instOverride,examMode,examMeta,paginationBlocks){
  toast("⏳ جارِ تحضير الطباعة…");
  // نوقف الوضع الداكن مؤقتًا أثناء الطباعة فقط (يسبب مشاكل حقيقية بالطباعة على بعض الأجهزة)، ونرجعه تلقائيًا بعدها
  const _wasDark=document.documentElement.classList.contains("dark");
  if(_wasDark)document.documentElement.classList.remove("dark");
  const _restoreDark=()=>{if(_wasDark)document.documentElement.classList.add("dark")};
  window.addEventListener("afterprint",_restoreDark,{once:true});
  setTimeout(_restoreDark,15000); // شبكة أمان: نرجعه حتى لو ما انطلق afterprint لأي سبب
  const y=new Date().getFullYear();
  const teacher=S.settings.teacher||"أستاذ المادة";
  const pInst=instOverride||S.curInst||INSTS()[0];
  const principal=instMeta(pInst).principal||S.settings.principal||"";
  const priv=instType(pInst)==="private";
  const logo=instLogo(pInst);
  const addr=instAddress(pInst);
  const em=examMeta||{};
  const isMono=examMode&&em.mono;
  const clr=isMono?"":(em.headerColor||instColor(pInst)||(examMode?"#0F3D2E":""));
  const bandStyle=isMono?' style="background:#fff;color:#0F172A;border:2px solid #0F172A"':(clr?' style="background:linear-gradient(135deg,'+shadeColor(clr,-30)+','+clr+' 60%,'+shadeColor(clr,20)+')"':'');
  const pd=S.settings.printDesign||{};
  const designPrimary=(examMode&&!isMono?(em.headerColor||pd.primaryColor||clr):pd.primaryColor||clr)||"#075968";
  const designAccent=pd.accentColor||"#D4AF37";
  const designStyle=pd.headerStyle||"premium";
  const designOrnament=pd.ornament||"strong";
  const resolvedTitle=(pd.headerTitle||"").trim()||title;
  const resolvedSubtitle=(pd.headerSubtitle||"").trim()||('العام الدراسي: '+academicYearStr());
  const resolvedRight=(pd.headerRight||"").trim()||pInst;
  const resolvedNote=(pd.headerNote||"").trim();
  const resolvedFooterRight=(pd.footerRight||"").trim()||teacher;
  const resolvedFooterCenter=(pd.footerCenter||"").trim()||"بالعلم نرتقي";
  const resolvedFooterLeft=(pd.footerLeft||"").trim()||pInst;
  const ornamentSVG='<svg class="pHeaderOrnament" viewBox="0 0 420 300" aria-hidden="true"><defs><pattern id="masarGeo" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M21 1 41 21 21 41 1 21Z M21 8 34 21 21 34 8 21Z" fill="none" stroke="currentColor" stroke-width="1.15"/><circle cx="21" cy="21" r="3.5" fill="none" stroke="currentColor"/></pattern><radialGradient id="geoFade"><stop offset="0" stop-color="currentColor" stop-opacity=".24"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><rect width="420" height="300" fill="url(#masarGeo)" opacity=".42"/><circle cx="86" cy="154" r="104" fill="url(#geoFade)"/><g transform="translate(84 154)" fill="none" stroke="currentColor"><circle r="92" stroke-width="2.4"/><circle r="70" stroke-width="1.5"/><circle r="43" stroke-width="1.2"/><path d="M0-98 17-55 55-78 48-32 94-25 53 0 94 25 48 32 55 78 17 55 0 98-17 55-55 78-48 32-94 25-53 0-94-25-48-32-55-78-17-55Z" stroke-width="3"/><path d="M0-70 13-31 49-49 31-13 70 0 31 13 49 49 13 31 0 70-13 31-49 49-31 13-70 0-31-13-49-49-13-31Z" stroke-width="2"/><circle r="12" stroke-width="2"/></g></svg>';
  const pf=S.settings.printFont||{};
  const fHeadCenter=pf.headerCenter||19;
  const fHeadSide=pf.headerSide||11;
  const fFooter=pf.footer||9.5;
  const fFamily=(PRINT_FONT_OPTIONS.find(f=>f.id===(pf.family||"tajawal"))||PRINT_FONT_OPTIONS[1]).css;
  const headerVars=' style="--printPrimary:'+esc(designPrimary)+';--printAccent:'+esc(designAccent)+'"';
  const examBandHTML=
    '<div class="pBand pBandExam pHeaderStyle-'+esc(designStyle)+' pOrnament-'+esc(designOrnament)+(isMono?' pBandMono':'')+'"'+headerVars+'>'+
      ornamentSVG+
      '<div class="pHeaderWave" aria-hidden="true"></div>'+
      '<div class="pExamBrandPanel">'+
        (logo?'<span class="pLogoDirect"><img src="'+logo+'" alt=""></span>':'<span class="pLogoDirect pLogoEmoji">🏫</span>')+
        '<div class="pExamSchool" style="font-size:'+fHeadSide+'px">'+esc(resolvedRight)+'</div>'+
      '</div>'+
      '<div class="pExamTitlePanel">'+
        '<div class="pExamTitle" style="font-size:'+fHeadCenter+'px">'+esc(resolvedTitle)+'</div>'+
        '<div class="pTitleDivider"><span></span><b>◆</b><span></span></div>'+
        '<div class="pExamYear" style="font-size:'+fHeadSide+'px">'+esc(resolvedSubtitle)+'</div>'+
        (resolvedNote?'<div class="pExamNote">'+esc(resolvedNote)+'</div>':'')+
      '</div>'+
    '</div>';
  const normalBandHTML=
    '<div class="pBand pBandReport pHeaderStyle-'+esc(designStyle)+' pOrnament-'+esc(designOrnament)+'"'+headerVars+'>'+
      ornamentSVG+
      '<div class="pHeaderWave" aria-hidden="true"></div>'+
      '<div class="pExamBrandPanel">'+
        (logo?'<span class="pLogoDirect"><img src="'+logo+'" alt=""></span>':'<span class="pLogoDirect pLogoEmoji">🏫</span>')+
        '<div class="pExamSchool" style="font-size:'+fHeadSide+'px">'+esc(resolvedRight)+'</div>'+
      '</div>'+
      '<div class="pExamTitlePanel">'+
        '<div class="pExamTitle" style="font-size:'+Math.max(20,fHeadCenter+2)+'px">'+esc(resolvedTitle)+'</div>'+
        '<div class="pTitleDivider"><span></span><b>◆</b><span></span></div>'+
        '<div class="pExamYear" style="font-size:'+fHeadSide+'px">'+esc(resolvedSubtitle)+'</div>'+
        (resolvedNote?'<div class="pExamNote">'+esc(resolvedNote)+'</div>':'')+
      '</div>'+
    '</div>';
  const headerHTML=examMode?examBandHTML:normalBandHTML;
  const footerHTML=examMode?
    '<div class="pPageFootWrap pExamFootWrap" style="--printPrimary:'+esc(designPrimary)+';--printAccent:'+esc(designAccent)+'">'+
      '<div class="pExamFoot">'+
        '<div class="pExamFootTeacher"><strong>'+esc(resolvedFooterRight)+'</strong></div>'+
        '<div class="pExamFootBrand">'+(logo?'<img src="'+logo+'" alt="">':'<span>✦</span>')+'<em>'+esc(resolvedFooterCenter)+'</em></div>'+
        '<div class="pExamFootSchool">'+esc(resolvedFooterLeft)+'</div>'+
      '</div>'+
    '</div>':
    '<div class="pPageFootWrap pReportFootWrap" style="--printPrimary:'+esc(designPrimary)+';--printAccent:'+esc(designAccent)+'">'+
      '<div class="pReportSignatures">'+
        '<div class="pReportSignature">'+
          '<b>مدرس المادة</b><span class="pReportPersonName">'+esc(teacher)+'</span>'+ 
          (S.settings.signature?'<div class="pReportSignatureImage"><img src="'+S.settings.signature+'" alt="توقيع مدرس المادة"></div>':'<div class="pReportSignatureLine"></div>')+
          '<small>التوقيع</small>'+ 
        '</div>'+ 
        '<div class="pReportSignature">'+
          '<b>'+principalTitle(pInst)+'</b><span class="pReportPersonName">'+(principal?esc(principal):'&nbsp;')+'</span>'+ 
          '<div class="pReportSignatureLine"></div><small>التوقيع</small>'+ 
        '</div>'+ 
      '</div>'+ 
    '</div>';
  el("printArea").style.fontFamily=fFamily;
  let paginationFailed=false;
  let effectiveBlocks=paginationBlocks;
  if(!effectiveBlocks||!effectiveBlocks.length){
    // نشتق كتل التقسيم تلقائيًا من محتوى body (كل عنصر ابن مباشر يصير كتلة مستقلة)
    // هذا يعمّم محرك التقسيم الحقيقي على كل أنواع التقارير، لا حصرًا على أوراق الأسئلة
    try{
      const tmp=document.createElement("div");
      tmp.innerHTML=body;
      const kids=[...tmp.children];
      if(kids.length)effectiveBlocks=kids.map(k=>k.outerHTML);
    }catch(_){}
  }
  if(effectiveBlocks&&effectiveBlocks.length){
    // === المسار الجديد: تقسيم حتمي حقيقي (يقيس فعليًا بدل الاعتماد على تقسيم المتصفح) ===
    try{
      el("printArea").innerHTML=await Promise.race([
        paginateContent({headerHTML,footerHTML,blocks:effectiveBlocks,fFamily,extraBodyHTML:priv?contactStripHTML():''}),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("pagination timeout")),6000))
      ]);
    }catch(_){paginationFailed=true}
  }
  if(!effectiveBlocks||!effectiveBlocks.length||paginationFailed){
    // مسار احتياطي بسيط (يُستخدم فقط لو تعذّر اشتقاق كتل، أو فشل محرك التقسيم لأي سبب — الطباعة لازم تشتغل دائمًا)
    el("printArea").innerHTML=
    '<div class="pageWrap">'+
    '<div class="pPageHead">'+
    headerHTML+
    '</div>'+
    '<div class="pBody">'+body+
    (priv?contactStripHTML():'')+
    '</div>'+
    footerHTML+
    '</div>';
  }
  // مرّر ألوان التصميم المحسوبة إلى الصفحة كلها، حتى تتبع شارة السؤال لون الرأس فعليًا.
  {
    const area=el("printArea");
    area.style.setProperty("--printPrimary",designPrimary);
    area.style.setProperty("--printAccent",designAccent);
    area.querySelectorAll(".printPage,.pageWrap").forEach(page=>{
      page.style.setProperty("--printPrimary",designPrimary);
      page.style.setProperty("--printAccent",designAccent);
    });
  }

  // انتظر جاهزية الخطوط (KaTeX/Cairo) وصور الشعار/التوقيع قبل الطباعة
  // (محاط بمهلة قصوى إجمالية: إذا تعلّق أي جزء لأي سبب، نكمل للطباعة على أي حال بدل ما نعلّق للأبد)
  const prepPrint=async()=>{
    const area=el("printArea");
    // لو فيه معادلات ومحرك KaTeX لسا ما تحمّل: حمّله ثم أعد الرسم من data-latex لضمان استخدام الخطوط المحلية
    if(area.querySelector(".katex-wrap")){
      try{await Promise.race([loadKatex(),new Promise(r=>setTimeout(r,3000))])}catch(_){}
      if(window.katex){
        area.querySelectorAll(".katex-wrap").forEach(w=>{
          const lx=w.getAttribute("data-latex");
          if(!lx)return;
          try{const tmp=document.createElement("span");window.katex.render(lx,tmp,{throwOnError:false,displayMode:false,output:"html",strict:"ignore",trust:false});w.innerHTML=tmp.innerHTML}
          catch(_){w.innerHTML='<span class="mathFallback">'+esc("$"+lx+"$")+'</span>'}
        });
      }
    }
    if(document.fonts){
      const katexFontLoads=[
        '16px KaTeX_Main','16px KaTeX_Math','16px KaTeX_Size1',
        '16px KaTeX_Size2','16px KaTeX_Size3','16px KaTeX_Size4'
      ].map(spec=>document.fonts.load(spec).catch(()=>[]));
      await Promise.race([
        Promise.all([document.fonts.ready,...katexFontLoads]),
        new Promise(r=>setTimeout(r,4500))
      ]);
    }
    const imgs=[...area.querySelectorAll("img")].filter(i=>!i.complete);
    if(imgs.length)await Promise.race([Promise.all(imgs.map(i=>new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,1200)}))),new Promise(r=>setTimeout(r,3000))]);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  };
  try{await Promise.race([prepPrint(),new Promise(r=>setTimeout(r,5000))])}catch(_){}
  // دورة طباعة ثابتة على Android/PWA:
  // لا نمسح #printArea تلقائيًا مطلقًا، لأن Android Print Spooler قد يقرأ DOM
  // بعد رجوع focus/visibility أو بعد afterprint بوقت غير ثابت. إبقاء المستند في DOM آمن
  // لأن CSS الشاشة يعزله تمامًا، ويمنع الصفحة الفارغة وتغيّر أبعاد التطبيق معًا.
  const _printScrollX=window.scrollX||0;
  const _printScrollY=window.scrollY||0;
  const _viewportMeta=document.querySelector('meta[name="viewport"]');
  const _viewportContent=_viewportMeta?_viewportMeta.getAttribute("content"):null;

  const restoreAppViewport=()=>{
    [document.documentElement,document.body].forEach(node=>{
      node.style.removeProperty("width");
      node.style.removeProperty("min-width");
      node.style.removeProperty("max-width");
      node.style.removeProperty("height");
      node.style.removeProperty("min-height");
      node.style.removeProperty("transform");
      node.style.removeProperty("zoom");
      node.style.removeProperty("overflow");
      node.style.removeProperty("overflow-x");
    });
    document.body.classList.remove("print-mode","preview-mode","a4-mode","printing");
    if(_viewportMeta&&_viewportContent!==null){
      _viewportMeta.setAttribute("content",_viewportContent);
    }
    _restoreDark();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      void document.documentElement.offsetWidth;
      window.scrollTo(_printScrollX,_printScrollY);
      window.dispatchEvent(new Event("resize"));
    }));
  };

  // نجعل مستند الطباعة مرئيًا صراحةً لحظة beforeprint، من دون تفريغه بعد ذلك.
  const onBeforePrint=()=>{
    const area=el("printArea");
    if(area){
      area.style.setProperty("display","block","important");
      area.style.setProperty("visibility","visible","important");
    }
  };
  const onAfterPrint=()=>{
    // نعيد واجهة التطبيق فقط، ولا نمسح محتوى التقرير.
    setTimeout(restoreAppViewport,600);
  };
  window.addEventListener("beforeprint",onBeforePrint,{once:true});
  window.addEventListener("afterprint",onAfterPrint,{once:true});

  document.body.classList.add("printing");
  void document.body.offsetHeight;
  try{
    window.print();
  }finally{
    // window.print غير متزامن في Android؛ لا تنظيف ولا innerHTML="" هنا.
    // شبكة أمان لإرجاع قياسات التطبيق فقط، مع إبقاء التقرير موجودًا للطابعة.
    setTimeout(restoreAppViewport,4000);
  }

}

