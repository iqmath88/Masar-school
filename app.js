const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const state = {
  user: null,
  page: 'dashboard',
  students: [
    {id:1,name:'محمد أحمد علي',code:'2026001',grade:'الأول المتوسط',section:'أ',status:'نشط'},
    {id:2,name:'علي حسن كريم',code:'2026002',grade:'الثالث المتوسط',section:'ب',status:'نشط'},
    {id:3,name:'زهراء محمود حسين',code:'2026003',grade:'السادس العلمي',section:'أ',status:'نشط'}
  ],
  grades: ['الأول المتوسط','الثاني المتوسط','الثالث المتوسط','الرابع العلمي','الخامس العلمي','السادس العلمي'],
  sections: [
    {id:1,grade:'الأول المتوسط',name:'أ'}, {id:2,grade:'الأول المتوسط',name:'ب'},
    {id:3,grade:'السادس العلمي',name:'أ'}, {id:4,grade:'السادس العلمي',name:'ب'}
  ],
  subjects: ['الرياضيات','اللغة العربية','اللغة الإنكليزية','الفيزياء','الكيمياء','الأحياء','الإسلامية'],
  teachers: [
    {id:1,name:'أحمد علي',subject:'الرياضيات'},
    {id:2,name:'محمد حسن',subject:'الفيزياء'}
  ],
  timetable: [
    {id:1,teacherId:1,teacher:'أحمد علي',subject:'الرياضيات',grade:'السادس العلمي',section:'أ',day:'الأحد',period:1,room:'12'},
    {id:2,teacherId:1,teacher:'أحمد علي',subject:'الرياضيات',grade:'السادس العلمي',section:'ب',day:'الاثنين',period:3,room:'12'},
    {id:3,teacherId:2,teacher:'محمد حسن',subject:'الفيزياء',grade:'السادس العلمي',section:'أ',day:'الأحد',period:3,room:'11'}
  ]
};

const demoUsers = {
  'admin@masar.local': {name:'إدارة المدرسة',role:'admin',teacherId:null,password:'123456'},
  'teacher@masar.local': {name:'أحمد علي',role:'teacher',teacherId:1,password:'123456'}
};

function mount(){
  const saved = localStorage.getItem('masar_session');
  if(saved){ try{ state.user = JSON.parse(saved); }catch{} }
  render();
}

function render(){
  $('#app').innerHTML = state.user ? shell() : loginView();
  bind();
}

function loginView(){
  return `<div class="login-wrap"><div class="login-card">
    <div class="brand"><div class="brand-mark">م</div><h1>مسار لإدارة المدارس</h1><p>نظام إدارة الثانوية من الأول المتوسط إلى السادس العلمي</p></div>
    <form id="loginForm">
      <div class="field"><label>البريد الإلكتروني</label><input id="email" type="email" value="admin@masar.local" required></div>
      <div class="field"><label>كلمة المرور</label><input id="password" type="password" value="123456" required></div>
      <button class="btn btn-primary">تسجيل الدخول</button>
    </form>
    <div class="demo-note">نسخة أولية تجريبية: الإدارة <b>admin@masar.local</b> — المدرس <b>teacher@masar.local</b> — كلمة المرور <b>123456</b>.</div>
  </div></div>`;
}

function navItems(){
  const admin = [
    ['dashboard','الرئيسية'],['students','الطلاب'],['sections','الصفوف والشعب'],['teachers','المعلمون والمواد'],['timetable','جدول الحصص'],['attendance','الحضور والغياب'],['scores','الدرجات والاختبارات'],['reports','التقارير'],['settings','الإعدادات']
  ];
  const teacher = [
    ['dashboard','الرئيسية'],['myclasses','شعبي وحصصي'],['attendance','الحضور والغياب'],['scores','الدرجات'],['reports','تقاريري']
  ];
  return state.user.role==='admin'?admin:teacher;
}

function shell(){
  return `<div class="shell">
    <aside class="sidebar"><div class="logo"><div class="logo-badge">م</div><h2>مسار للمدارس</h2></div><nav class="nav">${navItems().map(([id,label])=>`<button data-page="${id}" class="${state.page===id?'active':''}"><span class="label">${label}</span></button>`).join('')}</nav></aside>
    <main class="main"><header class="topbar"><div><b>العام الدراسي 2026–2027</b><div class="small">ثانوية — نظام إدارة مدرسي</div></div><div class="user"><div><b>${state.user.name}</b><div class="small">${state.user.role==='admin'?'الإدارة':'مدرس'}</div></div><div class="avatar">${state.user.name[0]}</div><button id="logout" class="btn btn-soft">خروج</button></div></header>
    <section class="content">${pageView()}</section></main>
  </div>`;
}

function pageView(){
  const map = {dashboard:dashboardView,students:studentsView,sections:sectionsView,teachers:teachersView,timetable:timetableView,myclasses:myClassesView,attendance:attendanceView,scores:scoresView,reports:reportsView,settings:settingsView};
  return (map[state.page]||dashboardView)();
}

function dashboardView(){
  const isAdmin=state.user.role==='admin';
  const assignments=isAdmin?state.timetable:state.timetable.filter(x=>x.teacherId===state.user.teacherId);
  return `<div class="page-title"><h1>${isAdmin?'لوحة الإدارة':'لوحة المدرس'}</h1></div>
  ${!isAdmin?'<div class="notice">صلاحياتك تُستخرج تلقائيًا من جدول الحصص الحالي، لذلك لا تظهر لك إلا الشعب والمواد المكلف بها.</div>':''}
  <div class="grid stats">
    <div class="card stat"><strong>${state.students.length}</strong><span>الطلاب</span></div>
    <div class="card stat"><strong>${state.teachers.length}</strong><span>المدرسون</span></div>
    <div class="card stat"><strong>${state.sections.length}</strong><span>الشعب</span></div>
    <div class="card stat"><strong>${assignments.length}</strong><span>${isAdmin?'حصص مسجلة':'تكليفاتي'}</span></div>
  </div>
  <div class="grid two-col"><div class="card"><h3>ملخص اليوم</h3>${table(assignments.slice(0,6),['اليوم','الحصة','المدرس','المادة','الصف/الشعبة'],r=>[r.day,r.period,r.teacher,r.subject,`${r.grade} / ${r.section}`])}</div>
  <div class="card"><h3>مبدأ الصلاحيات</h3><p>المدرس لا يُمنح صلاحيات يدويًا على الشعب. وجود تكليف فعال له في جدول الحصص هو المرجع الذي يسمح له بالتعامل مع طلاب الشعبة ومادته فقط.</p><span class="badge badge-success">قابل للربط مع RLS في Supabase</span></div></div>`;
}

function studentsView(){
  if(state.user.role!=='admin') return denied();
  return `<div class="page-title"><h1>إدارة الطلاب</h1><button class="btn btn-primary" data-action="add-student">+ إضافة طالب</button></div>
  <div class="card"><div class="toolbar"><input id="studentSearch" placeholder="بحث بالاسم أو الرقم"><select id="gradeFilter"><option value="">كل الصفوف</option>${state.grades.map(g=>`<option>${g}</option>`).join('')}</select></div><div id="studentsTable">${studentsTable(state.students)}</div></div>`;
}
function studentsTable(rows){return table(rows,['الرقم','الاسم','الصف','الشعبة','الحالة','إجراء'],r=>[r.code,r.name,r.grade,r.section,`<span class="badge badge-success">${r.status}</span>`,`<button class="btn btn-danger" data-delete-student="${r.id}">حذف</button>`]);}

function sectionsView(){
  if(state.user.role!=='admin') return denied();
  return `<div class="page-title"><h1>الصفوف والشعب</h1><button class="btn btn-primary" data-action="add-section">+ إضافة شعبة</button></div><div class="card">${table(state.sections,['الصف','الشعبة'],r=>[r.grade,r.name])}</div>`;
}
function teachersView(){
  if(state.user.role!=='admin') return denied();
  return `<div class="page-title"><h1>المعلمون والمواد</h1></div><div class="grid two-col"><div class="card"><h3>المدرسون</h3>${table(state.teachers,['المدرس','التخصص'],r=>[r.name,r.subject])}</div><div class="card"><h3>المواد</h3>${state.subjects.map(s=>`<div style="padding:9px;border-bottom:1px solid #edf1f7">${s}</div>`).join('')}</div></div>`;
}
function timetableView(){
  if(state.user.role!=='admin') return denied();
  return `<div class="page-title"><h1>جدول الحصص</h1><button class="btn btn-primary" data-action="add-timetable">+ إضافة حصة</button></div><div class="notice">إضافة حصة للمدرس تنشئ له تكليفًا وظيفيًا على المادة والشعبة، وهذا التكليف هو أساس صلاحياته داخل النظام.</div><div class="card">${table(state.timetable,['اليوم','الحصة','المدرس','المادة','الصف','الشعبة','القاعة'],r=>[r.day,r.period,r.teacher,r.subject,r.grade,r.section,r.room])}</div>`;
}
function myClassesView(){
  const rows=state.timetable.filter(x=>x.teacherId===state.user.teacherId);
  const unique=[]; rows.forEach(r=>{if(!unique.some(x=>x.subject===r.subject&&x.grade===r.grade&&x.section===r.section)) unique.push(r)});
  return `<div class="page-title"><h1>شعبي وحصصي</h1></div><div class="grid teacher-sections">${unique.map(r=>`<div class="card section-card"><h3>${r.grade} / ${r.section}</h3><p>${r.subject}</p><p>صلاحية فعالة من جدول الحصص</p><span class="badge badge-success">مسموح بالتعديل</span></div>`).join('')||'<div class="card empty">لا توجد تكليفات.</div>'}</div>`;
}
function attendanceView(){
  const allowed = state.user.role==='admin'?state.timetable:state.timetable.filter(x=>x.teacherId===state.user.teacherId);
  return `<div class="page-title"><h1>الحضور والغياب</h1></div><div class="card"><p>هذه الشاشة مهيأة للمرحلة التالية. ستُظهر الشعب المسموح بها حسب جدول الحصص وتسمح بتسجيل الحضور مع سجل تدقيق كامل.</p>${table(allowed,['المدرس','المادة','الصف/الشعبة'],r=>[r.teacher,r.subject,`${r.grade} / ${r.section}`])}</div>`;
}
function scoresView(){
  const allowed=state.user.role==='admin'?state.timetable:state.timetable.filter(x=>x.teacherId===state.user.teacherId);
  return `<div class="page-title"><h1>الدرجات والاختبارات</h1></div><div class="card"><p>في النسخة التالية سنربط إنشاء الاختبار وإدخال الدرجات بنفس صلاحية التكليف: المدرس لا يستطيع إدخال درجة لطالب خارج مادته وشعبته.</p>${table(allowed,['المادة','الصف/الشعبة','المدرس'],r=>[r.subject,`${r.grade} / ${r.section}`,r.teacher])}</div>`;
}
function reportsView(){return `<div class="page-title"><h1>التقارير</h1></div><div class="grid stats"><div class="card">كشف حضور</div><div class="card">كشف درجات</div><div class="card">إحصاءات الطلاب</div><div class="card">تقرير المدرسين</div></div>`;}
function settingsView(){if(state.user.role!=='admin')return denied();return `<div class="page-title"><h1>الإعدادات</h1></div><div class="card"><h3>ربط Supabase</h3><p>أدخل رابط المشروع والمفتاح العام في ملف <code>config.js</code>، ثم نفعل المصادقة وقاعدة البيانات وRLS في المرحلة التالية.</p></div>`;}
function denied(){return `<div class="card empty">هذه الصفحة غير متاحة لصلاحيات حسابك.</div>`;}

function table(rows,headers,rowFn){
  if(!rows.length)return '<div class="empty">لا توجد بيانات.</div>';
  return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${rowFn(r).map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function modal(title,body){return `<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="close" data-action="close-modal">×</button></div>${body}</div></div>`;}
function showModal(html){document.body.insertAdjacentHTML('beforeend',html);bindModal();}
function bindModal(){$('[data-action="close-modal"]')?.addEventListener('click',()=>$('.modal-backdrop')?.remove());}

function bind(){
  $('#loginForm')?.addEventListener('submit',e=>{e.preventDefault(); const email=$('#email').value.trim();const password=$('#password').value;const u=demoUsers[email];if(!u||u.password!==password)return alert('بيانات الدخول غير صحيحة');state.user={name:u.name,role:u.role,teacherId:u.teacherId,email};localStorage.setItem('masar_session',JSON.stringify(state.user));state.page='dashboard';render();});
  $('#logout')?.addEventListener('click',()=>{localStorage.removeItem('masar_session');state.user=null;render();});
  $$('[data-page]').forEach(b=>b.addEventListener('click',()=>{state.page=b.dataset.page;render();}));
  $('[data-action="add-student"]')?.addEventListener('click',openStudentModal);
  $('[data-action="add-section"]')?.addEventListener('click',openSectionModal);
  $('[data-action="add-timetable"]')?.addEventListener('click',openTimetableModal);
  $$('[data-delete-student]').forEach(b=>b.addEventListener('click',()=>{state.students=state.students.filter(s=>s.id!==+b.dataset.deleteStudent);render();}));
  $('#studentSearch')?.addEventListener('input',filterStudents); $('#gradeFilter')?.addEventListener('change',filterStudents);
}
function filterStudents(){const q=$('#studentSearch').value.trim();const g=$('#gradeFilter').value;const rows=state.students.filter(s=>(!q||s.name.includes(q)||s.code.includes(q))&&(!g||s.grade===g));$('#studentsTable').innerHTML=studentsTable(rows);$$('[data-delete-student]').forEach(b=>b.addEventListener('click',()=>{state.students=state.students.filter(s=>s.id!==+b.dataset.deleteStudent);render();}));}
function openStudentModal(){showModal(modal('إضافة طالب',`<form id="studentForm"><div class="form-grid"><div class="field"><label>الاسم الكامل</label><input name="name" required></div><div class="field"><label>الرقم المدرسي</label><input name="code" required></div><div class="field"><label>الصف</label><select name="grade">${state.grades.map(g=>`<option>${g}</option>`).join('')}</select></div><div class="field"><label>الشعبة</label><input name="section" value="أ" required></div></div><button class="btn btn-primary">حفظ</button></form>`));$('#studentForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);state.students.push({id:Date.now(),name:f.get('name'),code:f.get('code'),grade:f.get('grade'),section:f.get('section'),status:'نشط'});$('.modal-backdrop').remove();render();});}
function openSectionModal(){showModal(modal('إضافة شعبة',`<form id="sectionForm"><div class="form-grid"><div class="field"><label>الصف</label><select name="grade">${state.grades.map(g=>`<option>${g}</option>`).join('')}</select></div><div class="field"><label>اسم الشعبة</label><input name="name" value="أ" required></div></div><button class="btn btn-primary">حفظ</button></form>`));$('#sectionForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);state.sections.push({id:Date.now(),grade:f.get('grade'),name:f.get('name')});$('.modal-backdrop').remove();render();});}
function openTimetableModal(){showModal(modal('إضافة حصة',`<form id="ttForm"><div class="form-grid">
<div class="field"><label>المدرس</label><select name="teacherId">${state.teachers.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
<div class="field"><label>المادة</label><select name="subject">${state.subjects.map(s=>`<option>${s}</option>`).join('')}</select></div>
<div class="field"><label>الصف</label><select name="grade">${state.grades.map(g=>`<option>${g}</option>`).join('')}</select></div>
<div class="field"><label>الشعبة</label><input name="section" value="أ"></div>
<div class="field"><label>اليوم</label><select name="day">${['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'].map(d=>`<option>${d}</option>`).join('')}</select></div>
<div class="field"><label>الحصة</label><input name="period" type="number" min="1" max="8" value="1"></div>
<div class="field"><label>القاعة</label><input name="room" value="12"></div></div><button class="btn btn-primary">حفظ الحصة</button></form>`));$('#ttForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);const teacher=state.teachers.find(t=>t.id===+f.get('teacherId'));state.timetable.push({id:Date.now(),teacherId:teacher.id,teacher:teacher.name,subject:f.get('subject'),grade:f.get('grade'),section:f.get('section'),day:f.get('day'),period:+f.get('period'),room:f.get('room')});$('.modal-backdrop').remove();render();});}
mount();
