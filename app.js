const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const MASAR_VERSION = '1.8.1';
const MASAR_DB_TARGET = 3;

const DAYS = {
  1: 'الأحد',
  2: 'الاثنين',
  3: 'الثلاثاء',
  4: 'الأربعاء',
  5: 'الخميس',
  6: 'الجمعة',
  7: 'السبت'
};

const state = {
  user: null,
  page: 'dashboard',
  loading: true,
  error: '',
  academicYears: [],
  grades: [],
  sections: [],
  subjects: [],
  teachers: [],
  profiles: [],
  students: [],
  assignments: [],
  timetable: [],
  teacherAvailability: [],
  timetableRules: [],
  timetableSettings: {1:7,2:7,3:7,4:7,5:7},
  exams: [],
  systemHealth: { dbVersion: null, status: 'unknown', message: '' }
};

let supabaseClient = null;

/* =========================================================
   CONFIG + SUPABASE
========================================================= */

function config() {
  return window.MASAR_CONFIG || {};
}

async function createSupabaseClient() {
  const cfg = config();

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error('إعدادات Supabase غير موجودة في config.js');
  }

  if (!window.supabase) {
    throw new Error('تعذر تحميل مكتبة Supabase');
  }

  return window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

/* =========================================================
   HELPERS
========================================================= */

function loadingView(message = 'جارٍ تحميل النظام...') {
  return `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand">
          <div class="brand-mark">م</div>
          <h1>مسار لإدارة المدارس</h1>
          <p>${message}</p>
        </div>
      </div>
    </div>
  `;
}

function safeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusArabic(status) {
  const map = {
    active: 'نشط',
    transferred: 'منقول',
    graduated: 'متخرج',
    inactive: 'غير نشط'
  };

  return map[status] || status || '';
}

function activeYear() {
  return state.academicYears.find(y => y.is_active) || null;
}

function gradeById(id) {
  return state.grades.find(g => String(g.id) === String(id));
}

function sectionById(id) {
  return state.sections.find(s => String(s.id) === String(id));
}

function subjectById(id) {
  return state.subjects.find(s => String(s.id) === String(id));
}

function teacherById(id) {
  return state.teachers.find(t => String(t.id) === String(id));
}

function assignmentById(id) {
  return state.assignments.find(a => String(a.id) === String(id));
}

function isAdmin() {
  return state.user?.role === 'admin';
}


function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isValidUsername(value) {
  return /^[a-z0-9._-]{3,32}$/.test(
    normalizeUsername(value)
  );
}

function usernameToInternalEmail(value) {
  return `${normalizeUsername(value)}@masar.local`;
}

/* =========================================================
   START
========================================================= */

async function mount() {
  $('#app').innerHTML = loadingView('جارٍ الاتصال بقاعدة البيانات...');

  try {
    supabaseClient = await createSupabaseClient();

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      await Promise.race([
        establishUser(data.session.user),
        new Promise((_, reject) => setTimeout(() => reject(new Error('انتهت مهلة تحميل بيانات النظام. تحقق من تحديث قاعدة البيانات ثم أعد المحاولة.')), 20000))
      ]);
    } else {
      state.loading = false;
      state.user = null;
      render();
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        state.user = null;
        clearData();
        state.page = 'dashboard';
        render();
      }
    });
  } catch (err) {
    console.error(err);
    state.loading = false;
    state.user = null;
    state.error = err?.message || 'تعذر الاتصال بـ Supabase';
    render();
  }
}

function clearData() {
  state.academicYears = [];
  state.grades = [];
  state.sections = [];
  state.subjects = [];
  state.teachers = [];
  state.profiles = [];
  state.students = [];
  state.assignments = [];
  state.timetable = [];
  state.exams = [];
}

async function establishUser(authUser) {
  state.loading = true;
  render();

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, full_name, username, role, phone, is_active')
    .eq('id', authUser.id)
    .single();

  if (profileError) {
    await supabaseClient.auth.signOut();
    throw new Error('الحساب موجود في المصادقة لكنه غير مربوط بملف مستخدم في النظام.');
  }

  if (!profile.is_active) {
    await supabaseClient.auth.signOut();
    throw new Error('هذا الحساب غير مفعّل.');
  }

  state.user = {
    id: authUser.id,
    email: authUser.email,
    name: profile.full_name,
    username: profile.username || null,
    role: profile.role,
    teacherId: null
  };

  if (profile.role === 'teacher') {
    const { data: teacher, error: teacherError } = await supabaseClient
      .from('teachers')
      .select('id')
      .eq('user_id', authUser.id)
      .single();

    if (teacherError) {
      await supabaseClient.auth.signOut();
      throw new Error('حساب المدرس غير مربوط بسجل مدرس.');
    }

    state.user.teacherId = teacher.id;
  }

  await loadSchoolData();
  await checkSystemCompatibility();

  state.loading = false;
  state.error = '';
  state.page = 'dashboard';
  render();
}

async function loadSchoolData() {
  clearData();

  const [
    yearsRes,
    gradesRes,
    sectionsRes,
    subjectsRes,
    studentsRes,
    teachersRes,
    assignmentsRes,
    timetableRes,
    examsRes
  ] = await Promise.all([
    supabaseClient
      .from('academic_years')
      .select('id, name, start_date, end_date, is_active')
      .order('start_date', { ascending: false }),

    supabaseClient
      .from('grades')
      .select('id, name, level, is_active')
      .order('level'),

    supabaseClient
      .from('sections')
      .select('id, name, grade_id, academic_year_id, is_active'),

    supabaseClient
      .from('subjects')
      .select('id, name, code, is_active')
      .order('name'),

    supabaseClient
      .from('students')
      .select('id, student_code, full_name, section_id, gender, birth_date, parent_name, parent_phone, address, status')
      .order('full_name'),

    supabaseClient
      .from('teachers')
      .select('id, user_id, full_name, employee_code, specialization, phone, notes'),

    supabaseClient
      .from('teacher_assignments')
      .select('id, teacher_id, subject_id, section_id, academic_year_id, start_date, end_date, status'),

    supabaseClient
      .from('timetable')
      .select('id, assignment_id, day_of_week, period_number, room, is_active, is_locked')
      .eq('is_active', true),

    supabaseClient
      .from('exams')
      .select('id, assignment_id, name, exam_type, exam_date, max_score, created_by, created_at')
      .order('exam_date', { ascending: false })
  ]);

  const responses = [
    yearsRes,
    gradesRes,
    sectionsRes,
    subjectsRes,
    studentsRes,
    teachersRes,
    assignmentsRes,
    timetableRes,
    examsRes
  ];

  const firstError = responses.find(r => r.error)?.error;
  if (firstError) {
    console.error(firstError);
    throw new Error('تعذر تحميل بيانات المدرسة: ' + firstError.message);
  }

  state.academicYears = yearsRes.data || [];
  state.grades = (gradesRes.data || []).filter(x => x.is_active !== false);
  state.sections = sectionsRes.data || [];
  state.subjects = (subjectsRes.data || []).filter(x => x.is_active !== false);
  state.students = studentsRes.data || [];
  state.teachers = teachersRes.data || [];
  state.assignments = assignmentsRes.data || [];
  state.exams = examsRes.data || [];

  const gradeMap = new Map(state.grades.map(g => [g.id, g]));
  const sectionMap = new Map(state.sections.map(s => [s.id, s]));
  const subjectMap = new Map(state.subjects.map(s => [s.id, s]));

  state.students = state.students.map(s => {
    const section = sectionMap.get(s.section_id);
    const grade = section ? gradeMap.get(section.grade_id) : null;

    return {
      ...s,
      code: s.student_code || '',
      name: s.full_name,
      grade: grade?.name || '',
      section: section?.name || '',
      statusLabel: statusArabic(s.status)
    };
  });

  state.sections = state.sections.map(s => ({
    ...s,
    grade: gradeMap.get(s.grade_id)?.name || '',
    gradeLevel: Number(gradeMap.get(s.grade_id)?.level || 999)
  }));

  const profileNames = new Map();

  if (isAdmin()) {
    const { data: allProfiles, error: allProfilesError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, username, role, phone, is_active, created_at')
      .order('full_name');
    if (!allProfilesError) state.profiles = allProfiles || [];
  }

  if (isAdmin() && state.teachers.length) {
    const ids = state.teachers.map(t => t.user_id).filter(Boolean);

    if (ids.length) {
      const { data: profiles, error } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);

      if (!error) {
        (profiles || []).forEach(p => profileNames.set(p.id, p.full_name));
      }
    }
  } else if (state.user?.role === 'teacher') {
    profileNames.set(state.user.id, state.user.name);
  }

  state.teachers = state.teachers.map(t => ({
    ...t,
    name: profileNames.get(t.user_id) || t.full_name || t.employee_code || 'مدرس',
    subject: t.specialization || ''
  }));

  const teacherMap = new Map(state.teachers.map(t => [t.id, t]));
  const assignmentMap = new Map(state.assignments.map(a => [a.id, a]));

  state.timetable = (timetableRes.data || [])
    .map(tt => {
      const assignment = assignmentMap.get(tt.assignment_id);
      if (!assignment) return null;

      const teacher = teacherMap.get(assignment.teacher_id);
      const subject = subjectMap.get(assignment.subject_id);
      const section = sectionMap.get(assignment.section_id);
      const grade = section ? gradeMap.get(section.grade_id) : null;

      return {
        id: tt.id,
        assignmentId: assignment.id,
        teacherId: assignment.teacher_id,
        teacher: teacher?.name || state.user?.name || 'مدرس',
        subject: subject?.name || '',
        grade: grade?.name || '',
        section: section?.name || '',
        sectionId: assignment.section_id,
        subjectId: assignment.subject_id,
        day: DAYS[tt.day_of_week] || String(tt.day_of_week),
        dayOfWeek: tt.day_of_week,
        period: tt.period_number,
        room: tt.room || '',
        isLocked: tt.is_locked === true
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.period - b.period));
}


async function checkSystemCompatibility() {
  state.systemHealth = { dbVersion: null, status: 'checking', message: 'جارٍ فحص توافق قاعدة البيانات' };
  try {
    const { data, error } = await supabaseClient
      .from('system_meta')
      .select('db_version')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      state.systemHealth = {
        dbVersion: null,
        status: 'legacy',
        message: 'قاعدة البيانات تعمل بالمخطط السابق. يلزم ترقية واحدة لتفعيل نظام التحديثات.'
      };
      return;
    }

    const version = Number(data?.db_version || 0);
    state.systemHealth = version >= MASAR_DB_TARGET
      ? { dbVersion: version, status: 'ok', message: 'قاعدة البيانات متوافقة مع هذا الإصدار.' }
      : { dbVersion: version, status: 'update', message: 'يوجد تحديث مطلوب لقاعدة البيانات.' };
  } catch (error) {
    console.error('Compatibility check failed', error);
    state.systemHealth = { dbVersion: null, status: 'unknown', message: 'تعذر التحقق من إصدار قاعدة البيانات.' };
  }
}

function systemStatusBadge() {
  const h = state.systemHealth || {};
  if (h.status === 'ok') return '<span class="badge badge-success">متوافق</span>';
  if (h.status === 'legacy' || h.status === 'update') return '<span class="badge badge-warning">يتطلب تهيئة</span>';
  return '<span class="badge">غير معروف</span>';
}

/* =========================================================
   RENDER
========================================================= */

function render() {
  if (state.loading) {
    $('#app').innerHTML = loadingView();
    return;
  }

  $('#app').innerHTML = state.user ? shell() : loginView();
  bind();
}

function loginView() {
  const errorBlock = state.error
    ? `<div class="notice" style="margin-top:14px">${safeText(state.error)}</div>`
    : '';

  return `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand">
          <div class="brand-mark">م</div>
          <h1>مسار لإدارة المدارس</h1>
          <p>نظام إدارة الثانوية من الأول المتوسط إلى السادس العلمي</p>
        </div>

        <form id="loginForm">
          <div class="field">
            <label>اسم المستخدم</label><button type="button" class="btn btn-soft btn-sm" id="generateUsername">توليد تلقائي</button>
            <input
              id="loginId"
              type="text"
              autocomplete="username"
              placeholder="مثال: faiz.jawad"
              required
            >
          </div>

          <div class="field">
            <label>كلمة المرور</label>
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              required
            >
          </div>

          <button
            id="loginButton"
            class="btn btn-primary"
            type="submit"
          >
            تسجيل الدخول
          </button>
        </form>

        <div class="small" style="margin-top:12px">
          الحسابات الجديدة تدخل باسم المستخدم. الحساب الإداري القديم يمكنه استخدام بريده الإلكتروني مؤقتًا.
        </div>

        ${errorBlock}
      </div>
    </div>
  `;
}

function navItems() {
  const admin = [
    ['dashboard', 'الرئيسية'],
    ['users', 'الحسابات والمستخدمون'],
    ['students', 'الطلاب'],
    ['sections', 'الصفوف والشعب'],
    ['teachers', 'المعلمون والمواد'],
    ['timetable', 'جدول الحصص'],
    ['attendance', 'الحضور والغياب'],
    ['scores', 'الدرجات والاختبارات'],
    ['reports', 'التقارير'],
    ['settings', 'الإعدادات']
  ];

  const teacher = [
    ['dashboard', 'الرئيسية'],
    ['myclasses', 'شعبي وحصصي'],
    ['attendance', 'الحضور والغياب'],
    ['scores', 'الدرجات'],
    ['reports', 'تقاريري']
  ];

  return state.user.role === 'admin' ? admin : teacher;
}

function academicYearLabel() {
  return activeYear()?.name || 'لم تُحدد سنة دراسية فعالة';
}

function shell() {
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="logo">
          <div class="logo-badge">م</div>
          <h2>مسار للمدارس</h2>
        </div>

        <nav class="nav">
          ${navItems()
            .map(
              ([id, label]) => `
                <button data-page="${id}" class="${state.page === id ? 'active' : ''}">
                  <span class="label">${label}</span>
                </button>
              `
            )
            .join('')}
        </nav>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <b>${safeText(academicYearLabel())}</b>
            <div class="small">ثانوية — نظام إدارة مدرسي · v${MASAR_VERSION}</div>
          </div>

          <div class="user">
            <div>
              <b>${safeText(state.user.name)}</b>
              <div class="small">${state.user.role === 'admin' ? 'الإدارة' : 'مدرس'}</div>
            </div>

            <div class="avatar">${safeText(state.user.name?.[0] || 'م')}</div>
            <button id="logout" class="btn btn-soft">خروج</button>
          </div>
        </header>

        <section class="content">${pageView()}</section>
      </main>
    </div>
  `;
}

function pageView() {
  const map = {
    dashboard: dashboardView,
    users: usersView,
    students: studentsView,
    sections: sectionsView,
    teachers: teachersView,
    timetable: timetableView,
    myclasses: myClassesView,
    attendance: attendanceView,
    scores: scoresView,
    reports: reportsView,
    settings: settingsView
  };

  return (map[state.page] || dashboardView)();
}

function teacherTimetable() {
  if (isAdmin()) return state.timetable;
  return state.timetable.filter(x => x.teacherId === state.user.teacherId);
}

/* =========================================================
   DASHBOARD
========================================================= */

function dashboardView() {
  const assignments = teacherTimetable();

  return `
    <div class="page-title">
      <h1>${isAdmin() ? 'لوحة الإدارة' : 'لوحة المدرس'}</h1>
    </div>

    ${
      !isAdmin()
        ? '<div class="notice">صلاحياتك تُستخرج تلقائيًا من جدول الحصص الحالي.</div>'
        : ''
    }

    <div class="grid stats">
      <div class="card stat"><strong>${state.students.length}</strong><span>الطلاب</span></div>
      <div class="card stat"><strong>${state.teachers.length}</strong><span>المدرسون</span></div>
      <div class="card stat"><strong>${state.sections.length}</strong><span>الشعب</span></div>
      <div class="card stat"><strong>${assignments.length}</strong><span>${isAdmin() ? 'حصص مسجلة' : 'تكليفاتي'}</span></div>
    </div>

    <div class="grid two-col">
      <div class="card">
        <h3>ملخص الجدول</h3>
        ${table(
          assignments.slice(0, 6),
          ['اليوم', 'الحصة', 'المدرس', 'المادة', 'الصف/الشعبة'],
          r => [
            safeText(r.day),
            r.period,
            safeText(r.teacher),
            safeText(r.subject),
            `${safeText(r.grade)} / ${safeText(r.section)}`
          ]
        )}
      </div>

      <div class="card">
        <h3>مبدأ الصلاحيات</h3>
        <p>وجود تكليف فعال للمدرس في جدول الحصص هو المرجع الذي يسمح له بالتعامل مع طلاب الشعبة ومادته فقط.</p>
        <span class="badge badge-success">محمي بسياسات RLS في Supabase</span>
      </div>
    </div>
  `;
}


/* =========================================================
   USERS + ACCOUNT CREATION
========================================================= */

function credentialsStore(){
  try { return JSON.parse(sessionStorage.getItem('masar_teacher_credentials') || '{}'); } catch { return {}; }
}
function saveCredential(userId, row){
  const all=credentialsStore(); all[String(userId || row.username)]={...row, saved_at:new Date().toISOString()};
  sessionStorage.setItem('masar_teacher_credentials', JSON.stringify(all));
}
function teacherCredential(t){
  const all=credentialsStore(); return all[String(t.user_id)] || Object.values(all).find(x=>x.username && x.username===(state.profiles||[]).find(p=>String(p.id)===String(t.user_id))?.username) || null;
}
const SPECIALIZATION_PREFIXES={
  'الرياضيات':'math','رياضيات':'math','mathematics':'math','math':'math',
  'الفيزياء':'phys','فيزياء':'phys','physics':'phys',
  'الكيمياء':'chem','كيمياء':'chem','chemistry':'chem',
  'الاحياء':'biol','الأحياء':'biol','احياء':'biol','biology':'biol',
  'اللغة العربية':'arab','العربية':'arab','عربي':'arab','arabic':'arab',
  'اللغة الانكليزية':'engl','اللغة الإنجليزية':'engl','الانكليزية':'engl','الإنجليزية':'engl','english':'engl',
  'التربية الاسلامية':'isla','التربية الإسلامية':'isla','اسلامية':'isla','إسلامية':'isla','islamic':'isla',
  'الحاسوب':'comp','حاسوب':'comp','computer':'comp',
  'التاريخ':'hist','تاريخ':'hist','history':'hist',
  'الجغرافية':'geog','جغرافية':'geog','geography':'geog'
};
function specializationPrefix(value=''){
  const raw=String(value).trim(); const key=raw.toLowerCase();
  if(SPECIALIZATION_PREFIXES[raw]||SPECIALIZATION_PREFIXES[key]) return SPECIALIZATION_PREFIXES[raw]||SPECIALIZATION_PREFIXES[key];
  const latin=key.replace(/[^a-z]/g,''); return (latin.slice(0,4)||'teac').padEnd(4,'x').slice(0,4);
}
function random4(){ return String(Math.floor(1000+Math.random()*9000)); }
function generatedTeacherUsername(spec=''){ return `${specializationPrefix(spec)}${random4()}`; }
function downloadTextFile(filename, content, type='text/plain;charset=utf-8'){
  const blob=new Blob(['\ufeff'+content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function teacherAccountDetails(t){
  const p=(state.profiles||[]).find(x=>String(x.id)===String(t.user_id));
  const c=teacherCredential(t);
  const assignments=(state.assignments||[]).filter(a=>String(a.teacher_id)===String(t.id)&&a.status!=='inactive');
  const subjects=[...new Set(assignments.map(a=>(state.subjects||[]).find(s=>String(s.id)===String(a.subject_id))?.name).filter(Boolean))];
  const sections=[...new Set(assignments.map(a=>{const sec=(state.sections||[]).find(s=>String(s.id)===String(a.section_id));return sec?`${sec.grade} / ${sec.name}`:''}).filter(Boolean))];
  const weekly=assignments.reduce((sum,a)=>sum+Number((state.timetableRules||[]).find(r=>String(r.assignment_id)===String(a.id))?.weekly_periods||0),0);
  return {p,c,subjects,sections,weekly};
}
function downloadTeacherCredential(teacherId){
  const t=teacherById(teacherId); if(!t)return; const {p,c,subjects,sections,weekly}=teacherAccountDetails(t);
  const password=c?.password||'غير متاح - أعد تعيين الرمز';
  const txt=`مسار لإدارة المدارس\nسجل حساب المدرس\n\nاسم المدرس: ${t.name}\nالتخصص: ${t.specialization||''}\nالرقم الوظيفي: ${t.employee_code||''}\nالهاتف: ${t.phone||p?.phone||''}\nاسم المستخدم: ${p?.username||c?.username||''}\nالرمز المؤقت: ${password}\nحالة الحساب: ${t.user_id?(p?.is_active!==false?'فعال':'موقوف'):'بدون حساب'}\nتاريخ إنشاء الحساب: ${p?.created_at?new Date(p.created_at).toLocaleDateString('ar-IQ'):''}\nالمواد المكلف بها: ${subjects.join('، ')}\nالصفوف والشعب: ${sections.join('، ')}\nمجموع الحصص الأسبوعية: ${weekly}\nملاحظات إدارية: ${t.notes||''}\n\nتنبيه: الرمز المؤقت يظهر فقط إذا كان متاحاً في جلسة الإدارة الحالية.`;
  downloadTextFile(`teacher-${(p?.username||c?.username||'account')}.txt`,txt);
}
function exportTeacherCredentials(){
  const rows=[['ت','اسم المدرس الكامل','التخصص','الرقم الوظيفي','الهاتف','اسم المستخدم','الرمز المؤقت','حالة الحساب','تاريخ إنشاء الحساب','المواد المكلف بها','الصفوف والشعب','مجموع الحصص الأسبوعية','ملاحظات إدارية']];
  state.teachers.forEach((t,i)=>{const {p,c,subjects,sections,weekly}=teacherAccountDetails(t);rows.push([i+1,t.name,t.specialization||'',t.employee_code||'',t.phone||p?.phone||'',p?.username||c?.username||'',c?.password||'غير متاح - أعد التعيين',t.user_id?(p?.is_active!==false?'فعال':'موقوف'):'بدون حساب',p?.created_at?new Date(p.created_at).toLocaleDateString('ar-IQ'):'',subjects.join('، '),sections.join('، '),weekly,t.notes||'']);});
  const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  downloadTextFile('Masar-Teacher-Accounts-Full.csv',csv,'text/csv;charset=utf-8');
}
async function deleteSchoolUser(profileId, teacherId=''){
  const p=(state.profiles||[]).find(x=>String(x.id)===String(profileId)); if(!p)return alert('تعذر العثور على الحساب.');
  if(String(profileId)===String(state.user?.id)) return alert('لا يمكن حذف الحساب الذي تستخدمه حالياً.');
  if(!confirm(`حذف حساب ${p.full_name} نهائياً؟\nلن يتم حذف السجلات الدراسية التاريخية.`))return;
  try{
    const {data,error}=await supabaseClient.functions.invoke('delete-school-user',{body:{user_id:profileId,teacher_id:teacherId||null}}); if(error)throw error; if(!data?.ok)throw new Error(data?.error||'تعذر حذف الحساب.');
    const all=credentialsStore(); delete all[String(profileId)]; sessionStorage.setItem('masar_teacher_credentials',JSON.stringify(all));
    await loadSchoolData();render();
  }catch(e){alert('تعذر حذف المستخدم: '+(e?.message||'تأكد من نشر وظيفة delete-school-user في Supabase.'));}
}
function usersView() {
  if (!isAdmin()) return denied();
  const admins = (state.profiles || []).filter(p => p.role === 'admin');
  return `
    <div class="page-title"><h1>الحسابات والمستخدمون</h1><div class="toolbar"><button class="btn btn-primary" data-action="add-teacher-account">+ حساب مدرس</button><button class="btn btn-soft" data-action="add-admin-account">+ حساب إدارة</button><button class="btn btn-soft" data-action="export-teacher-credentials">⬇ سجل حسابات المدرسين</button></div></div>
    <div class="grid two-col">
      <div class="card"><h3>حسابات الإدارة</h3>${table(admins,['الاسم','اسم المستخدم','الهاتف','الحالة','إجراءات'],p=>[safeText(p.full_name),safeText(p.username||''),safeText(p.phone||''),p.is_active!==false?'<span class="badge badge-success">فعال</span>':'<span class="badge">موقوف</span>',`<button class="btn btn-soft btn-sm" data-edit-profile="${p.id}">تعديل</button> <button class="btn btn-danger btn-sm" data-delete-user="${p.id}">حذف</button>`])}</div>
      <div class="card"><h3>حسابات المدرسين</h3>${table(state.teachers,['الاسم','التخصص','اسم المستخدم','إجراءات'],t=>{const p=(state.profiles||[]).find(x=>String(x.id)===String(t.user_id));return [safeText(t.name),safeText(t.specialization||''),safeText(p?.username||''),`<button class="btn btn-soft btn-sm" data-edit-teacher="${t.id}">الملف</button> <button class="btn btn-soft btn-sm" data-add-assignment="${t.id}">+ تكليف</button> <button class="btn btn-soft btn-sm" data-download-credential="${t.id}">تنزيل البيانات</button> ${t.user_id?`<button class="btn btn-danger btn-sm" data-delete-user="${t.user_id}" data-delete-teacher="${t.id}">حذف الحساب</button>`:''}`];})}</div>
    </div><div class="notice" style="margin-top:12px">لأمان أعلى، الرمز المؤقت يبقى في جلسة الإدارة الحالية فقط ولا يُخزن بشكل دائم على الجهاز. نزّل سجل الحسابات قبل إغلاق الجلسة، وإذا لم يعد الرمز متاحاً فأعد تعيينه.</div>`;
}

function randomUsername(name='user') { return `${String(name).toLowerCase().replace(/[^a-z]/g,'').slice(0,4)||'user'}${random4()}`; }
function randomPassword(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#'; return Array.from({length:12},()=>chars[Math.floor(Math.random()*chars.length)]).join(''); }

function openProfileEditModal(profileId, teacherId='') {
  const p=(state.profiles||[]).find(x=>String(x.id)===String(profileId));
  const t=state.teachers.find(x=>String(x.id)===String(teacherId));
  if(!p && !t) return alert('تعذر العثور على الملف.');
  const userId=p?.id || t?.user_id; const profile=p || (state.profiles||[]).find(x=>String(x.id)===String(userId));
  showModal(modal('تعديل الملف الشخصي',`<form id="profileEditForm"><input id="editProfileId" type="hidden" value="${safeText(userId||'')}"><input id="editTeacherId" type="hidden" value="${safeText(t?.id||'')}"><div class="field"><label>الاسم الكامل</label><input id="editProfileName" required value="${safeText(profile?.full_name||t?.name||'')}"></div><div class="field"><label>اسم المستخدم</label><input id="editProfileUsername" dir="ltr" value="${safeText(profile?.username||'')}"></div><div class="field"><label>الهاتف</label><input id="editProfilePhone" value="${safeText(profile?.phone||'')}"></div>${t?`<div class="field"><label>الرقم الوظيفي</label><input id="editTeacherCode" value="${safeText(t.employee_code||'')}"></div><div class="field"><label>التخصص</label><input id="editTeacherSpecialization" value="${safeText(t.specialization||'')}"></div><div class="field"><label>ملاحظات إدارية</label><textarea id="editTeacherNotes" rows="3">${safeText(t.notes||'')}</textarea></div>`:''}<label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input id="editProfileActive" type="checkbox" ${profile?.is_active!==false?'checked':''}> الحساب فعال</label><button class="btn btn-primary" type="submit">حفظ التعديلات</button></form>`));
  $('#profileEditForm')?.addEventListener('submit',saveProfileEdit);
}
async function saveProfileEdit(e){e.preventDefault();try{const pid=$('#editProfileId').value,tid=$('#editTeacherId').value;const fullName=$('#editProfileName').value.trim();if(pid){const {error}=await supabaseClient.from('profiles').update({full_name:fullName,username:normalizeUsername($('#editProfileUsername').value),phone:$('#editProfilePhone').value.trim()||null,is_active:$('#editProfileActive').checked}).eq('id',pid);if(error)throw error;}if(tid){const {error:te}=await supabaseClient.from('teachers').update({full_name:fullName,employee_code:$('#editTeacherCode').value.trim()||null,specialization:$('#editTeacherSpecialization').value.trim()||null,phone:$('#editProfilePhone').value.trim()||null,notes:$('#editTeacherNotes')?.value.trim()||null}).eq('id',tid);if(te)throw te;}await loadSchoolData();$('.modal-backdrop')?.remove();render();}catch(err){alert('تعذر حفظ الملف: '+(err?.message||'خطأ غير معروف'));}}

function openTeacherProfileModal(teacherId){ const t=state.teachers.find(x=>String(x.id)===String(teacherId)); if(!t)return; openProfileEditModal(t.user_id,t.id); }

function openUserAccountModal(role = 'teacher') {
  if (!isAdmin()) return;

  const isTeacher = role === 'teacher';

  showModal(
    modal(
      isTeacher ? 'إضافة حساب مدرس' : 'إضافة حساب إدارة',
      `
        <form id="userAccountForm">
          <input id="newUserRole" type="hidden" value="${role}">

          <div class="field">
            <label>الاسم الكامل</label>
            <input id="newUserName" required>
          </div>

          <div class="field">
            <label>اسم المستخدم</label><button type="button" class="btn btn-soft btn-sm" id="generateUsername">توليد تلقائي</button>
            <input
              id="newUsername"
              type="text"
              minlength="3"
              maxlength="32"
              autocomplete="off"
              placeholder="مثال: faiz.jawad"
              dir="ltr"
              required
            >
            <div class="small" style="margin-top:6px">
              أحرف إنجليزية صغيرة وأرقام والنقطة والشرطة والشرطة السفلية فقط.
            </div>
          </div>

          <div class="field">
            <label>كلمة المرور الأولية</label><button type="button" class="btn btn-soft btn-sm" id="generatePassword">توليد كلمة مرور</button>
            <input
              id="newUserPassword"
              type="password"
              minlength="8"
              autocomplete="new-password"
              required
            >
          </div>

          <div class="field">
            <label>رقم الهاتف</label>
            <input id="newUserPhone">
          </div>

          ${
            isTeacher
              ? `
                <div class="field">
                  <label>الرقم الوظيفي</label>
                  <input id="newTeacherCode">
                </div>

                <div class="field">
                  <label>التخصص</label>
                  <input
                    id="newTeacherSpecialization"
                    placeholder="مثال: الرياضيات"
                  >
                </div>
              `
              : ''
          }

          <button
            id="saveUserAccountButton"
            class="btn btn-primary"
            type="submit"
          >
            إنشاء الحساب
          </button>

          <div
            id="userAccountMessage"
            class="notice"
            style="display:none;margin-top:12px"
          ></div>
        </form>
      `
    )
  );

  $('#userAccountForm')?.addEventListener('submit', saveUserAccount);
  $('#generateUsername')?.addEventListener('click',()=>{$('#newUsername').value=isTeacher?generatedTeacherUsername($('#newTeacherSpecialization')?.value||''):randomUsername($('#newUserName')?.value||'admin');});
  $('#newTeacherSpecialization')?.addEventListener('input',()=>{if(isTeacher) $('#newUsername').value=generatedTeacherUsername($('#newTeacherSpecialization').value);});
  $('#generatePassword')?.addEventListener('click',()=>{const p=randomPassword();$('#newUserPassword').type='text';$('#newUserPassword').value=p;});
}

async function saveUserAccount(event) {
  event.preventDefault();

  const role = $('#newUserRole')?.value;
  const fullName = $('#newUserName')?.value.trim();
  const username = normalizeUsername(
    $('#newUsername')?.value
  );
  const password = $('#newUserPassword')?.value || '';
  const phone = $('#newUserPhone')?.value.trim() || null;

  const employeeCode =
    role === 'teacher'
      ? $('#newTeacherCode')?.value.trim() || null
      : null;

  const specialization =
    role === 'teacher'
      ? $('#newTeacherSpecialization')?.value.trim() || null
      : null;

  const button = $('#saveUserAccountButton');
  const message = $('#userAccountMessage');

  if (
    !fullName ||
    !isValidUsername(username) ||
    password.length < 8
  ) {
    if (message) {
      message.style.display = 'block';
      message.textContent =
        'تحقق من الاسم واسم المستخدم وكلمة المرور. اسم المستخدم من 3 إلى 32 محرفًا إنجليزيًا.';
    }
    return;
  }

  try {
    button.disabled = true;
    button.textContent = 'جارٍ إنشاء الحساب...';

    const { data, error } =
      await supabaseClient.functions.invoke(
        'create-school-user',
        {
          body: {
            username,
            password,
            full_name: fullName,
            role,
            phone,
            employee_code: employeeCode,
            specialization
          }
        }
      );

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(
        data?.error ||
        'تعذر إنشاء الحساب.'
      );
    }

    const createdUserId = data?.user_id || data?.id || data?.user?.id || username;
    if(role==='teacher') saveCredential(createdUserId,{username,password,full_name:fullName,specialization:specialization||''});
    await loadSchoolData();
    if(role==='teacher'){
      const createdTeacher=state.teachers.find(t=>String(t.user_id)===String(createdUserId)) || state.teachers.find(t=>t.name===fullName);
      if(createdTeacher) saveCredential(createdTeacher.user_id,{username,password,full_name:fullName,specialization:specialization||''});
    }

    $('.modal-backdrop')?.remove();
    render();

  } catch (error) {
    console.error(
      'Create account error:',
      error
    );

    message.style.display = 'block';

    const text =
      error?.context?.body?.error ||
      error?.message ||
      'تعذر إنشاء الحساب.';

    message.textContent = text;

    button.disabled = false;
    button.textContent = 'إنشاء الحساب';
  }
}


/* =========================================================
   STUDENTS CRUD
========================================================= */

function studentsView() {
  if (!isAdmin()) return denied();

  return `
    <div class="page-title">
      <h1>إدارة الطلاب</h1>
      <button class="btn btn-primary" data-action="add-student">+ إضافة طالب</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <input id="studentSearch" placeholder="بحث بالاسم أو الرقم">

        <select id="gradeFilter">
          <option value="">كل الصفوف</option>
          ${state.grades.map(g => `<option>${safeText(g.name)}</option>`).join('')}
        </select>
      </div>

      <div id="studentsTable">${studentsTable(state.students)}</div>
    </div>
  `;
}

function studentsTable(rows) {
  return table(
    rows,
    ['الرقم', 'الاسم', 'الصف', 'الشعبة', 'الحالة', 'إجراءات'],
    r => [
      safeText(r.code),
      safeText(r.name),
      safeText(r.grade),
      safeText(r.section),
      `<span class="badge badge-success">${safeText(r.statusLabel)}</span>`,
      `
        <button class="btn btn-soft btn-sm" data-edit-student="${r.id}">تعديل</button>
        <button class="btn btn-soft btn-sm" data-delete-student="${r.id}">حذف</button>
      `
    ]
  );
}

function openStudentModal(student = null) {
  const year = activeYear();

  if (!year) {
    showModal(modal('إضافة طالب', `<div class="notice">يجب أولًا إنشاء سنة دراسية فعالة.</div>`));
    return;
  }

  const yearSections = state.sections.filter(
    s => String(s.academic_year_id) === String(year.id) && s.is_active !== false
  );

  showModal(
    modal(
      student ? 'تعديل طالب' : 'إضافة طالب',
      `
        <form id="studentForm">
          <input id="studentId" type="hidden" value="${safeText(student?.id || '')}">

          <div class="field">
            <label>اسم الطالب</label>
            <input id="studentName" required value="${safeText(student?.full_name || student?.name || '')}">
          </div>

          <div class="field">
            <label>الرقم الطلابي</label>
            <input id="studentCode" value="${safeText(student?.student_code || student?.code || '')}">
          </div>

          <div class="field">
            <label>الشعبة</label>
            <select id="studentSection" required>
              <option value="">اختر الشعبة</option>
              ${yearSections
                .map(
                  s => `
                    <option value="${s.id}" ${String(student?.section_id) === String(s.id) ? 'selected' : ''}>
                      ${safeText(s.grade)} / ${safeText(s.name)}
                    </option>
                  `
                )
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>الجنس</label>
            <select id="studentGender">
              <option value="">غير محدد</option>
              <option value="male" ${student?.gender === 'male' ? 'selected' : ''}>ذكر</option>
              <option value="female" ${student?.gender === 'female' ? 'selected' : ''}>أنثى</option>
            </select>
          </div>

          <div class="field">
            <label>تاريخ الميلاد</label>
            <input id="studentBirthDate" type="date" value="${safeText(student?.birth_date || '')}">
          </div>

          <div class="field">
            <label>اسم ولي الأمر</label>
            <input id="studentParentName" value="${safeText(student?.parent_name || '')}">
          </div>

          <div class="field">
            <label>هاتف ولي الأمر</label>
            <input id="studentParentPhone" value="${safeText(student?.parent_phone || '')}">
          </div>

          <div class="field">
            <label>العنوان</label>
            <input id="studentAddress" value="${safeText(student?.address || '')}">
          </div>

          <div class="field">
            <label>الحالة</label>
            <select id="studentStatus">
              <option value="active" ${!student || student?.status === 'active' ? 'selected' : ''}>نشط</option>
              <option value="transferred" ${student?.status === 'transferred' ? 'selected' : ''}>منقول</option>
              <option value="graduated" ${student?.status === 'graduated' ? 'selected' : ''}>متخرج</option>
              <option value="inactive" ${student?.status === 'inactive' ? 'selected' : ''}>غير نشط</option>
            </select>
          </div>

          <button id="saveStudentButton" class="btn btn-primary" type="submit">
            ${student ? 'حفظ التعديل' : 'إضافة الطالب'}
          </button>

          <div id="studentFormMessage" class="notice" style="display:none; margin-top:12px"></div>
        </form>
      `
    )
  );

  $('#studentForm')?.addEventListener('submit', saveStudent);
}

async function saveStudent(event) {
  event.preventDefault();

  const id = $('#studentId')?.value || '';
  const message = $('#studentFormMessage');
  const button = $('#saveStudentButton');

  const payload = {
    full_name: $('#studentName')?.value.trim(),
    student_code: $('#studentCode')?.value.trim() || null,
    section_id: $('#studentSection')?.value,
    gender: $('#studentGender')?.value || null,
    birth_date: $('#studentBirthDate')?.value || null,
    parent_name: $('#studentParentName')?.value.trim() || null,
    parent_phone: $('#studentParentPhone')?.value.trim() || null,
    address: $('#studentAddress')?.value.trim() || null,
    status: $('#studentStatus')?.value || 'active'
  };

  if (!payload.full_name || !payload.section_id) return;

  try {
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';

    const query = id
      ? supabaseClient.from('students').update(payload).eq('id', id)
      : supabaseClient.from('students').insert(payload);

    const { error } = await query;
    if (error) throw error;

    await loadSchoolData();
    $('.modal-backdrop')?.remove();
    render();
  } catch (error) {
    console.error(error);

    message.style.display = 'block';
    message.textContent =
      error?.code === '23505'
        ? 'الرقم الطلابي مستخدم مسبقًا.'
        : 'تعذر حفظ الطالب: ' + (error?.message || 'خطأ غير معروف');

    button.disabled = false;
    button.textContent = id ? 'حفظ التعديل' : 'إضافة الطالب';
  }
}

async function deleteStudent(id) {
  if (!confirm('هل تريد حذف الطالب؟')) return;

  try {
    const { error } = await supabaseClient
      .from('students')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await loadSchoolData();
    render();
  } catch (error) {
    alert('تعذر حذف الطالب: ' + (error?.message || 'خطأ غير معروف'));
  }
}

/* =========================================================
   SECTIONS CRUD
========================================================= */

function sectionsView() {
  if (!isAdmin()) return denied();

  return `
    <div class="page-title">
      <h1>الصفوف والشعب</h1>
      <button class="btn btn-primary" data-action="add-section">+ إضافة شعبة</button>
    </div>

    <div class="card">
      ${table(
        state.sections,
        ['الصف', 'الشعبة', 'إجراءات'],
        r => [
          safeText(r.grade),
          safeText(r.name),
          `
            <button class="btn btn-soft btn-sm" data-edit-section="${r.id}">تعديل</button>
            <button class="btn btn-soft btn-sm" data-delete-section="${r.id}">حذف</button>
          `
        ]
      )}
    </div>
  `;
}

function openSectionModal(section = null) {
  const year = activeYear();

  if (!year) {
    showModal(
      modal(
        'إضافة شعبة',
        `<div class="notice">يجب أولًا إنشاء سنة دراسية فعالة قبل إضافة الشعب.</div>`
      )
    );
    return;
  }

  showModal(
    modal(
      section ? 'تعديل شعبة' : 'إضافة شعبة',
      `
        <form id="sectionForm">
          <input id="sectionId" type="hidden" value="${safeText(section?.id || '')}">

          <div class="field">
            <label>الصف</label>
            <select id="sectionGrade" required>
              <option value="">اختر الصف</option>
              ${state.grades
                .map(
                  grade => `
                    <option value="${grade.id}" ${String(section?.grade_id) === String(grade.id) ? 'selected' : ''}>
                      ${safeText(grade.name)}
                    </option>
                  `
                )
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>اسم الشعبة</label>
            <input
              id="sectionName"
              type="text"
              placeholder="مثال: أ"
              maxlength="20"
              required
              value="${safeText(section?.name || '')}"
            >
          </div>

          <button id="saveSectionButton" class="btn btn-primary" type="submit">
            ${section ? 'حفظ التعديل' : 'حفظ الشعبة'}
          </button>

          <div id="sectionFormMessage" class="notice" style="display:none; margin-top:12px"></div>
        </form>
      `
    )
  );

  $('#sectionForm')?.addEventListener('submit', saveSection);
}

async function saveSection(event) {
  event.preventDefault();

  const year = activeYear();
  const id = $('#sectionId')?.value || '';
  const gradeId = $('#sectionGrade')?.value;
  const name = $('#sectionName')?.value.trim();
  const button = $('#saveSectionButton');
  const message = $('#sectionFormMessage');

  if (!year || !gradeId || !name) return;

  const payload = {
    academic_year_id: year.id,
    grade_id: gradeId,
    name,
    is_active: true
  };

  try {
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';

    const query = id
      ? supabaseClient.from('sections').update(payload).eq('id', id)
      : supabaseClient.from('sections').insert(payload);

    const { error } = await query;
    if (error) throw error;

    await loadSchoolData();
    $('.modal-backdrop')?.remove();
    render();
  } catch (error) {
    console.error(error);

    message.style.display = 'block';
    message.textContent =
      error?.code === '23505'
        ? 'هذه الشعبة موجودة مسبقًا لهذا الصف.'
        : 'تعذر حفظ الشعبة: ' + (error?.message || 'خطأ غير معروف');

    button.disabled = false;
    button.textContent = id ? 'حفظ التعديل' : 'حفظ الشعبة';
  }
}

async function deleteSection(id) {
  if (!confirm('هل تريد حذف الشعبة؟ لن يسمح النظام بالحذف إذا كانت مرتبطة بطلاب أو تكليفات.')) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('sections')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await loadSchoolData();
    render();
  } catch (error) {
    alert('تعذر حذف الشعبة: ' + (error?.message || 'قد تكون مرتبطة ببيانات أخرى.'));
  }
}

/* =========================================================
   SUBJECTS + TEACHERS
========================================================= */

let pendingTeacherImport = [];

function csvCell(v){
  const x=String(v??'');
  return /[",\n]/.test(x) ? `"${x.replace(/"/g,'""')}"` : x;
}
function downloadTeacherImportTemplate(){
  const bom='\ufeff';
  const rows=[['اسم المدرس','التخصص','الرقم الوظيفي','الهاتف'],['أحمد علي حسن','الرياضيات','T001','']];
  downloadTextFile('masar-teachers-template.csv',bom+rows.map(r=>r.map(csvCell).join(',')).join('\n'));
}
function parseCsvLine(line){
  const out=[]; let cur='',q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){ if(q&&line[i+1]==='"'){cur+='"';i++;} else q=!q; }
    else if(c===','&&!q){out.push(cur.trim());cur='';}
    else cur+=c;
  }
  out.push(cur.trim()); return out;
}
function normalizeImportRows(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
  if(!lines.length)return [];
  let rows=lines.map(parseCsvLine);
  const header=rows[0].map(x=>x.trim());
  const hasHeader=header.some(x=>/اسم|التخصص|وظيف|هاتف/.test(x));
  if(hasHeader) rows=rows.slice(1);
  return rows.map((r,i)=>({
    row:i+1, full_name:(r[0]||'').trim(), specialization:(r[1]||'').trim(),
    employee_code:(r[2]||'').trim(), phone:(r[3]||'').trim()
  })).filter(x=>x.full_name);
}
function importRowIssues(rows){
  const names=new Set(),codes=new Set();
  const existingNames=new Set(state.teachers.map(t=>String(t.name||'').trim().toLowerCase()));
  const existingCodes=new Set(state.teachers.map(t=>String(t.employee_code||'').trim().toLowerCase()).filter(Boolean));
  return rows.map(r=>{
    const issues=[]; const n=r.full_name.toLowerCase(), c=r.employee_code.toLowerCase();
    if(r.full_name.length<3)issues.push('الاسم قصير');
    if(names.has(n)||existingNames.has(n))issues.push('اسم مكرر'); names.add(n);
    if(c&&(codes.has(c)||existingCodes.has(c)))issues.push('رقم وظيفي مكرر'); if(c)codes.add(c);
    return {...r,issues};
  });
}
function renderTeacherImportPreview(rows){
  pendingTeacherImport=importRowIssues(rows);
  const target=$('#teacherImportPreview'); if(!target)return;
  if(!pendingTeacherImport.length){target.innerHTML='<div class="empty">لا توجد أسماء صالحة للمعاينة.</div>';return;}
  target.innerHTML=`<div class="notice">تمت قراءة ${pendingTeacherImport.length} سجلاً. الصفوف ذات المشكلة لن يتم استيرادها.</div><div class="table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>التخصص</th><th>الرقم الوظيفي</th><th>الهاتف</th><th>الحالة</th></tr></thead><tbody>${pendingTeacherImport.map(r=>`<tr><td>${safeText(r.full_name)}</td><td>${safeText(r.specialization)}</td><td>${safeText(r.employee_code)}</td><td>${safeText(r.phone)}</td><td>${r.issues.length?`<span class="badge badge-danger">${safeText(r.issues.join('، '))}</span>`:'<span class="badge badge-success">جاهز</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
function openTeacherBulkImport(){
  pendingTeacherImport=[];
  showModal(modal('استيراد الكادر التدريسي',`<div class="notice">يمكنك لصق الأسماء فقط، أو لصق/رفع CSV بالأعمدة: اسم المدرس، التخصص، الرقم الوظيفي، الهاتف. لا يتم إنشاء حساب دخول تلقائياً.</div><div class="field"><label>لصق البيانات</label><textarea id="teacherImportText" rows="8" placeholder="أحمد علي حسن,الرياضيات,T001,\nمحمد كريم جاسم,الفيزياء,T002,"></textarea></div><div class="toolbar"><input id="teacherImportFile" type="file" accept=".csv,text/csv"><button type="button" class="btn btn-soft" id="previewTeacherImport">معاينة وفحص</button></div><div id="teacherImportPreview"></div><button type="button" class="btn btn-primary" id="commitTeacherImport" disabled>اعتماد وإضافة الكادر</button>`));
  const txt=$('#teacherImportText'),file=$('#teacherImportFile'),commit=$('#commitTeacherImport');
  $('#previewTeacherImport')?.addEventListener('click',()=>{renderTeacherImportPreview(normalizeImportRows(txt.value));commit.disabled=!pendingTeacherImport.some(r=>!r.issues.length);});
  file?.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;txt.value=await f.text();renderTeacherImportPreview(normalizeImportRows(txt.value));commit.disabled=!pendingTeacherImport.some(r=>!r.issues.length);});
  commit?.addEventListener('click',commitTeacherImport);
}
async function commitTeacherImport(){
  const valid=pendingTeacherImport.filter(r=>!r.issues.length); if(!valid.length)return alert('لا توجد سجلات جاهزة للاستيراد.');
  const btn=$('#commitTeacherImport'); btn.disabled=true; btn.textContent='جارٍ الاستيراد...';
  try{
    const payload=valid.map(r=>({user_id:null,full_name:r.full_name,employee_code:r.employee_code||null,specialization:r.specialization||null,phone:r.phone||null}));
    const {error}=await supabaseClient.from('teachers').insert(payload); if(error)throw error;
    await loadSchoolData(); $('.modal-backdrop')?.remove(); render(); alert(`تمت إضافة ${valid.length} من أفراد الكادر بنجاح.`);
  }catch(e){alert('تعذر استيراد الكادر: '+(e?.message||'خطأ غير معروف'));btn.disabled=false;btn.textContent='اعتماد وإضافة الكادر';}
}

function teachersView() {
  if (!isAdmin()) return denied();

  return `
    <div class="page-title">
      <h1>المعلمون والمواد</h1>
      <div class="toolbar"><button class="btn btn-primary" data-action="bulk-import-teachers">استيراد الكادر</button><button class="btn btn-soft" data-action="download-teacher-template">تنزيل نموذج CSV</button><button class="btn btn-primary" data-action="add-subject">+ إضافة مادة</button></div>
    </div>

    <div class="grid two-col">
      <div class="card">
        <h3>المدرسون</h3>
        ${table(
          state.teachers,
          ['المدرس', 'التخصص', 'المواد التي يدرسها', 'إجراءات'],
          r => {
            const teacherAssignments = state.assignments.filter(a => String(a.teacher_id) === String(r.id) && a.status === 'active');
            const subjectNames = [...new Set(teacherAssignments.map(a => subjectById(a.subject_id)?.name).filter(Boolean))];
            return [
              safeText(r.name),
              safeText(r.specialization || ''),
              subjectNames.length ? subjectNames.map(name => `<span class="badge badge-info">${safeText(name)}</span>`).join(' ') : '<span class="muted">لا توجد تكليفات</span>',
              `<button class="btn btn-soft btn-sm" data-edit-teacher="${r.id}">الملف</button> <button class="btn btn-soft btn-sm" data-add-assignment="${r.id}">إضافة تكليف</button> <button class="btn btn-soft btn-sm" data-manage-assignments="${r.id}">إدارة التكليفات</button>`
            ];
          }
        )}

        <div class="notice" style="margin-top:16px">
          إنشاء حساب تسجيل دخول جديد للمدرس أو الإدارة يحتاج وظيفة خادم آمنة، لذلك لا يتم وضع المفتاح السري داخل app.js.
        </div>
      </div>

      <div class="card">
        <h3>المواد</h3>

        ${
          state.subjects.length
            ? state.subjects
                .map(
                  s => `
                    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:9px;border-bottom:1px solid #edf1f7">
                      <span>${safeText(s.name)} ${s.code ? `(${safeText(s.code)})` : ''}</span>
                      <span>
                        <button class="btn btn-soft btn-sm" data-edit-subject="${s.id}">تعديل</button>
                        <button class="btn btn-soft btn-sm" data-delete-subject="${s.id}">حذف</button>
                      </span>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty">لا توجد مواد بعد.</div>'
        }
      </div>
    </div>
  `;
}

function openSubjectModal(subject = null) {
  showModal(
    modal(
      subject ? 'تعديل مادة' : 'إضافة مادة',
      `
        <form id="subjectForm">
          <input id="subjectId" type="hidden" value="${safeText(subject?.id || '')}">

          <div class="field">
            <label>اسم المادة</label>
            <input id="subjectName" required value="${safeText(subject?.name || '')}">
          </div>

          <div class="field">
            <label>رمز المادة</label>
            <input id="subjectCode" value="${safeText(subject?.code || '')}">
          </div>

          <button id="saveSubjectButton" class="btn btn-primary" type="submit">
            ${subject ? 'حفظ التعديل' : 'إضافة المادة'}
          </button>

          <div id="subjectFormMessage" class="notice" style="display:none; margin-top:12px"></div>
        </form>
      `
    )
  );

  $('#subjectForm')?.addEventListener('submit', saveSubject);
}

async function saveSubject(event) {
  event.preventDefault();

  const id = $('#subjectId')?.value || '';
  const name = $('#subjectName')?.value.trim();
  const code = $('#subjectCode')?.value.trim() || null;
  const message = $('#subjectFormMessage');
  const button = $('#saveSubjectButton');

  if (!name) return;

  try {
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';

    const payload = {
      name,
      code,
      is_active: true
    };

    const query = id
      ? supabaseClient.from('subjects').update(payload).eq('id', id)
      : supabaseClient.from('subjects').insert(payload);

    const { error } = await query;
    if (error) throw error;

    await loadSchoolData();
    $('.modal-backdrop')?.remove();
    render();
  } catch (error) {
    message.style.display = 'block';
    message.textContent =
      error?.code === '23505'
        ? 'اسم المادة أو رمزها مستخدم مسبقًا.'
        : 'تعذر حفظ المادة: ' + (error?.message || 'خطأ غير معروف');

    button.disabled = false;
    button.textContent = id ? 'حفظ التعديل' : 'إضافة المادة';
  }
}

async function deleteSubject(id) {
  if (!confirm('هل تريد حذف المادة؟')) return;

  try {
    const { error } = await supabaseClient
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await loadSchoolData();
    render();
  } catch (error) {
    alert('تعذر حذف المادة: ' + (error?.message || 'قد تكون مرتبطة بتكليفات.'));
  }
}

function openAssignmentModal(teacherId = '') {
  const year = activeYear();

  if (!year) {
    showModal(
      modal(
        'إضافة تكليف',
        `<div class="notice">يجب أولًا إنشاء سنة دراسية فعالة.</div>`
      )
    );
    return;
  }

  const yearSections = state.sections.filter(
    section =>
      String(section.academic_year_id) === String(year.id) &&
      section.is_active !== false
  );

  if (!yearSections.length) {
    showModal(
      modal(
        'إضافة تكليف',
        `<div class="notice">لا توجد شعب في السنة الدراسية الحالية.</div>`
      )
    );
    return;
  }

  const groups = new Map();

  yearSections.forEach(section => {
    const gradeName = section.grade || 'صف غير محدد';

    if (!groups.has(gradeName)) {
      groups.set(gradeName, []);
    }

    groups.get(gradeName).push(section);
  });

  const sectionsHtml = [...groups.entries()]
    .map(
      ([gradeName, sections]) => `
        <div
          style="
            border:1px solid #e5eaf2;
            border-radius:14px;
            padding:12px;
            margin-bottom:10px;
          "
        >
          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:10px;
              margin-bottom:10px;
            "
          >
            <strong>${safeText(gradeName)}</strong>

            <button
              type="button"
              class="btn btn-soft btn-sm"
              data-select-grade="${safeText(gradeName)}"
            >
              تحديد الكل
            </button>
          </div>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
              gap:8px;
            "
          >
            ${sections
              .map(
                section => `
                  <label
                    style="
                      display:flex;
                      gap:8px;
                      align-items:center;
                      padding:9px 10px;
                      border:1px solid #edf1f7;
                      border-radius:10px;
                      cursor:pointer;
                    "
                  >
                    <input
                      type="checkbox"
                      data-assignment-section
                      data-grade-name="${safeText(gradeName)}"
                      value="${section.id}"
                    >
                    <span>الشعبة ${safeText(section.name)}</span>
                  </label>
                `
              )
              .join('')}
          </div>
        </div>
      `
    )
    .join('');

  showModal(
    modal(
      'إضافة تكليفات للمدرس',
      `
        <form id="assignmentForm">
          <div class="field">
            <label>المدرس</label>

            <select id="assignmentTeacher" required>
              <option value="">اختر المدرس</option>

              ${state.teachers
                .map(
                  teacher => `
                    <option
                      value="${teacher.id}"
                      ${String(teacherId) === String(teacher.id) ? 'selected' : ''}
                    >
                      ${safeText(teacher.name)}
                    </option>
                  `
                )
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>المادة</label>

            <select id="assignmentSubject" required>
              <option value="">اختر المادة</option>

              ${state.subjects
                .map(
                  subject => `
                    <option value="${subject.id}">
                      ${safeText(subject.name)}
                    </option>
                  `
                )
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>الصفوف والشعب</label>

            <div
              class="notice"
              style="margin-bottom:10px"
            >
              يمكنك تكليف المدرس بأكثر من مرحلة وأكثر من شعبة في عملية واحدة.
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
              <button type="button" class="btn btn-soft btn-sm" id="selectAllAssignmentSections">تحديد جميع الشعب</button>
              <button type="button" class="btn btn-soft btn-sm" id="clearAllAssignmentSections">إلغاء تحديد الجميع</button>
            </div>

            <div id="assignmentSections">
              ${sectionsHtml}
            </div>

            <div
              id="assignmentSelectionCount"
              class="small"
              style="margin-top:8px;font-weight:700"
            >
              لم يتم اختيار أي شعبة.
            </div>
          </div>

          <div class="field">
            <label>تاريخ بداية التكليف</label>
            <input
              id="assignmentStart"
              type="date"
              value="${year.start_date || ''}"
              required
            >
          </div>

          <div class="field">
            <label>تاريخ نهاية التكليف</label>
            <input
              id="assignmentEnd"
              type="date"
              value="${year.end_date || ''}"
            >
          </div>

          <button
            id="saveAssignmentButton"
            class="btn btn-primary"
            type="submit"
          >
            حفظ التكليفات
          </button>

          <div
            id="assignmentFormMessage"
            class="notice"
            style="display:none;margin-top:12px"
          ></div>
        </form>
      `
    )
  );

  $$('[data-assignment-section]').forEach(
    checkbox =>
      checkbox.addEventListener(
        'change',
        updateAssignmentSelectionCount
      )
  );

  $$('[data-select-grade]').forEach(
    button =>
      button.addEventListener(
        'click',
        () => {
          const gradeName =
            button.dataset.selectGrade;

          const boxes =
            $$('[data-assignment-section]')
              .filter(
                box =>
                  box.dataset.gradeName === gradeName
              );

          const shouldCheck =
            boxes.some(box => !box.checked);

          boxes.forEach(
            box => {
              box.checked = shouldCheck;
            }
          );

          button.textContent =
            shouldCheck
              ? 'إلغاء تحديد الكل'
              : 'تحديد الكل';

          updateAssignmentSelectionCount();
        }
      )
  );

  $('#selectAllAssignmentSections')?.addEventListener('click', () => {
    $$('[data-assignment-section]').forEach(box => { box.checked = true; });
    $$('[data-select-grade]').forEach(button => { button.textContent = 'إلغاء تحديد الكل'; });
    updateAssignmentSelectionCount();
  });

  $('#clearAllAssignmentSections')?.addEventListener('click', () => {
    $$('[data-assignment-section]').forEach(box => { box.checked = false; });
    $$('[data-select-grade]').forEach(button => { button.textContent = 'تحديد الكل'; });
    updateAssignmentSelectionCount();
  });

  $('#assignmentForm')?.addEventListener(
    'submit',
    saveAssignment
  );

  updateAssignmentSelectionCount();
}

function updateAssignmentSelectionCount() {
  const count =
    $$('[data-assignment-section]:checked')
      .length;

  const target =
    $('#assignmentSelectionCount');

  if (!target) return;

  if (!count) {
    target.textContent = 'لم يتم اختيار أي شعبة.';
    return;
  }

  const byGrade = new Map();
  $$('[data-assignment-section]:checked').forEach(box => {
    const grade = box.dataset.gradeName || 'مرحلة غير محددة';
    byGrade.set(grade, (byGrade.get(grade) || 0) + 1);
  });

  const summary = [...byGrade.entries()]
    .map(([grade, total]) => `${grade}: ${total}`)
    .join(' • ');

  target.textContent = `تم اختيار ${count} شعبة — ${summary}`;
}

async function saveAssignment(event) {
  event.preventDefault();

  const year = activeYear();
  const message = $('#assignmentFormMessage');
  const button = $('#saveAssignmentButton');

  const teacherId =
    $('#assignmentTeacher')?.value;

  const subjectId =
    $('#assignmentSubject')?.value;

  const sectionIds =
    $$('[data-assignment-section]:checked')
      .map(box => box.value);

  const startDate =
    $('#assignmentStart')?.value;

  const endDate =
    $('#assignmentEnd')?.value || null;

  if (
    !teacherId ||
    !subjectId ||
    !year?.id ||
    !startDate ||
    !sectionIds.length
  ) {
    message.style.display = 'block';
    message.textContent =
      'اختر المدرس والمادة وشعبة واحدة على الأقل.';
    return;
  }

  const existingKeys = new Set(
    state.assignments
      .filter(
        assignment =>
          String(assignment.teacher_id) === String(teacherId) &&
          String(assignment.subject_id) === String(subjectId) &&
          String(assignment.academic_year_id) === String(year.id) &&
          assignment.status === 'active'
      )
      .map(
        assignment =>
          String(assignment.section_id)
      )
  );

  const newSectionIds =
    sectionIds.filter(
      sectionId =>
        !existingKeys.has(
          String(sectionId)
        )
    );

  if (!newSectionIds.length) {
    message.style.display = 'block';
    message.textContent =
      'كل الشعب المحددة مكلف بها هذا المدرس لهذه المادة بالفعل.';
    return;
  }

  const rows = newSectionIds.map(
    sectionId => ({
      teacher_id: teacherId,
      subject_id: subjectId,
      section_id: sectionId,
      academic_year_id: year.id,
      start_date: startDate,
      end_date: endDate,
      status: 'active'
    })
  );

  try {
    button.disabled = true;
    button.textContent =
      `جارٍ حفظ ${rows.length} تكليف...`;

    const { error } =
      await supabaseClient
        .from('teacher_assignments')
        .insert(rows);

    if (error) throw error;

    const skipped =
      sectionIds.length -
      newSectionIds.length;

    await loadSchoolData();

    $('.modal-backdrop')?.remove();
    render();

    if (skipped > 0) {
      alert(
        `تم حفظ ${rows.length} تكليف بنجاح، وتم تجاهل ${skipped} تكليف موجود مسبقًا.`
      );
    }

  } catch (error) {
    console.error(
      'Save assignments error:',
      error
    );

    message.style.display = 'block';
    message.textContent =
      'تعذر حفظ التكليفات: ' +
      (error?.message || 'خطأ غير معروف');

    button.disabled = false;
    button.textContent = 'حفظ التكليفات';
  }
}

function openManageAssignments(teacherId){
 const t=teacherById(teacherId); const rows=state.assignments.filter(a=>String(a.teacher_id)===String(teacherId));
 showModal(modal(`تكليفات ${safeText(t?.name||'المدرس')}`, rows.length?`<div class="assignment-list">${rows.map(a=>{const sec=sectionById(a.section_id),sub=subjectById(a.subject_id);return `<div class="assignment-manage-row"><span><strong>${safeText(sub?.name||'')}</strong> — ${safeText(sec?.grade||'')} / ${safeText(sec?.name||'')}</span><span><button class="btn btn-soft btn-sm" data-edit-assignment="${a.id}">تعديل</button> <button class="btn btn-soft btn-sm" data-delete-assignment="${a.id}">حذف</button></span></div>`}).join('')}</div>`:'<div class="empty">لا توجد تكليفات.</div>'));
 $$('[data-edit-assignment]').forEach(b=>b.addEventListener('click',()=>openEditAssignmentModal(b.dataset.editAssignment)));
 $$('[data-delete-assignment]').forEach(b=>b.addEventListener('click',()=>deleteAssignment(b.dataset.deleteAssignment)));
}
function openEditAssignmentModal(id){const a=state.assignments.find(x=>String(x.id)===String(id));if(!a)return;showModal(modal('تعديل التكليف',`<form id="editAssignmentForm"><div class="field"><label>المادة</label><select id="editAssignmentSubject">${state.subjects.map(x=>`<option value="${x.id}" ${String(x.id)===String(a.subject_id)?'selected':''}>${safeText(x.name)}</option>`).join('')}</select></div><div class="field"><label>الشعبة</label><select id="editAssignmentSection">${state.sections.map(x=>`<option value="${x.id}" ${String(x.id)===String(a.section_id)?'selected':''}>${safeText(x.grade)} / ${safeText(x.name)}</option>`).join('')}</select></div><div class="field"><label>بداية التكليف</label><input id="editAssignmentStart" type="date" value="${a.start_date||''}"></div><div class="field"><label>نهاية التكليف</label><input id="editAssignmentEnd" type="date" value="${a.end_date||''}"></div><div class="field"><label>الحالة</label><select id="editAssignmentStatus"><option value="active" ${a.status==='active'?'selected':''}>فعال</option><option value="inactive" ${a.status!=='active'?'selected':''}>غير فعال</option></select></div><button class="btn btn-primary" type="submit">حفظ</button></form>`));$('#editAssignmentForm').addEventListener('submit',async e=>{e.preventDefault();const {error}=await supabaseClient.from('teacher_assignments').update({subject_id:$('#editAssignmentSubject').value,section_id:$('#editAssignmentSection').value,start_date:$('#editAssignmentStart').value,end_date:$('#editAssignmentEnd').value||null,status:$('#editAssignmentStatus').value}).eq('id',id);if(error)return alert(error.message);await loadSchoolData();$('.modal-backdrop')?.remove();render();});}
async function deleteAssignment(id){if(!confirm('حذف هذا التكليف؟ سيتم حذف حصص الجدول المرتبطة به إذا كانت قاعدة البيانات مضبوطة على الحذف المتسلسل.'))return;const {error}=await supabaseClient.from('teacher_assignments').delete().eq('id',id);if(error)return alert('تعذر حذف التكليف: '+error.message);await loadSchoolData();$('.modal-backdrop')?.remove();render();}

/* =========================================================
   TIMETABLE CRUD
========================================================= */

let timetableDisplayMode = 'school';
let timetableDisplayTeacher = '';
let timetableDisplaySection = '';

function shortTeacherName(name) {
  return String(name || '').trim().split(/\s+/).slice(0,2).join(' ');
}
function subjectHue(subject) {
  let h=0; for (const ch of String(subject||'')) h=(h*31+ch.charCodeAt(0))%360;
  return h;
}
function timetableDayPeriods(day){ return Number(state.timetableSettings?.[day] ?? 7); }
function timetableMaxPeriods(){ return Math.max(1,...[1,2,3,4,5].map(timetableDayPeriods)); }
function ttCellStyle(subject){ const h=subjectHue(subject); return `--tt-h:${h}`; }
function timetableCellContent(row, mode) {
  if (!row) return '<span class="tt-empty">—</span>';
  if (mode === 'teacher') return `<div class="tt-entry" style="${ttCellStyle(row.subject)}"><strong>${safeText(row.grade)} / ${safeText(row.section)}</strong><small>${safeText(row.subject)}</small></div>`;
  if (mode === 'section') return `<div class="tt-entry" style="${ttCellStyle(row.subject)}"><strong>${safeText(row.subject)}</strong><small>${safeText(shortTeacherName(row.teacher))}</small></div>`;
  return `<div class="tt-entry" style="${ttCellStyle(row.subject)}"><strong>${safeText(row.subject)}</strong><small>${safeText(shortTeacherName(row.teacher))}</small></div>`;
}
function personalTimetableGrid(rows, mode) {
  const days=[1,2,3,4,5], max=timetableMaxPeriods();
  return `<div class="tt-scroll"><table class="tt-personal"><thead><tr><th class="tt-corner">اليوم / الحصة</th>${Array.from({length:max},(_,i)=>`<th>الحصة ${i+1}</th>`).join('')}</tr></thead><tbody>${days.map(d=>`<tr><th>${DAYS[d]}</th>${Array.from({length:max},(_,i)=>{const p=i+1;if(p>timetableDayPeriods(d))return '<td class="tt-closed">—</td>';const r=rows.find(x=>Number(x.dayOfWeek)===d&&Number(x.period)===p);return `<td>${timetableCellContent(r,mode)}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const STAGE_COLORS={1:'#2f6f9f',2:'#2f7d69',3:'#8a6a32',4:'#76528f',5:'#a65b5b',6:'#4d6478'};
function gradeStageLevel(sec){
  const direct=Number(sec.gradeLevel||state.grades.find(g=>String(g.id)===String(sec.grade_id))?.level); if(direct>=1&&direct<=6)return direct;
  const n=String(sec.grade||''); const words=[['الأول','الاول'],['الثاني'],['الثالث'],['الرابع'],['الخامس'],['السادس']];
  const i=words.findIndex(xs=>xs.some(x=>n.includes(x))); return i>=0?i+1:99;
}
function sectionNaturalCompare(a,b){return String(a.section||'').localeCompare(String(b.section||''),'ar',{numeric:true,sensitivity:'base'});}
function schoolTimetableGrid() {
  const days=[1,2,3,4,5].filter(d=>timetableDayPeriods(d)>0);
  const sections=[...new Map(state.sections.map(sec=>[String(sec.id),{id:sec.id,grade:sec.grade||'',grade_id:sec.grade_id,gradeLevel:sec.gradeLevel,section:sec.name}])).values()].sort((a,b)=>gradeStageLevel(a)-gradeStageLevel(b)||sectionNaturalCompare(a,b));
  if(!sections.length) return '<div class="notice">لا توجد شعب مسجلة.</div>';
  const header=`<tr><th class="tt-day-col">اليوم</th><th class="tt-period-col">الحصة</th>${sections.map(sec=>{const stage=gradeStageLevel(sec),color=STAGE_COLORS[stage]||'#64748b';return `<th class="tt-section-head tt-stage-${stage}" style="--stage-color:${color}">${safeText(sec.grade)}<small>${safeText(sec.section)}</small></th>`}).join('')}</tr>`;
  const body=days.map(d=>Array.from({length:timetableDayPeriods(d)},(_,i)=>{
    const period=i+1;
    const cells=sections.map(sec=>{const stage=gradeStageLevel(sec),color=STAGE_COLORS[stage]||'#64748b';const r=state.timetable.find(x=>String(x.sectionId)===String(sec.id)&&Number(x.dayOfWeek)===d&&Number(x.period)===period);return `<td class="tt-stage-cell tt-stage-${stage}" style="--stage-color:${color}">${timetableCellContent(r,'school')}</td>`}).join('');
    return `<tr>${period===1?`<th rowspan="${timetableDayPeriods(d)}" class="tt-day-name">${safeText(DAYS[d])}</th>`:''}<th class="tt-period-no">${period}</th>${cells}</tr>`;
  }).join('')).join('');
  return `<div class="tt-stage-legend">${[1,2,3,4,5,6].map(n=>`<span style="--stage-color:${STAGE_COLORS[n]}"><i></i>${['الأول','الثاني','الثالث','الرابع','الخامس','السادس'][n-1]}</span>`).join('')}</div><div class="tt-scroll tt-school-wrap"><table class="tt-school tt-school-master"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
}
function timetableDiagnostics(rows=state.timetable){
  const errors=[], warnings=[];
  const teacherSlot=new Map(), sectionSlot=new Map(), subjDay=new Map();
  for(const r of rows){
    const tk=`${r.teacherId}|${r.dayOfWeek}|${r.period}`, sk=`${r.grade}|${r.section}|${r.dayOfWeek}|${r.period}`;
    if(teacherSlot.has(tk)) errors.push(`المدرس ${shortTeacherName(r.teacher)} لديه أكثر من حصة في ${DAYS[r.dayOfWeek]} / الحصة ${r.period}`); else teacherSlot.set(tk,r);
    if(sectionSlot.has(sk)) errors.push(`${r.grade} / ${r.section} لديها أكثر من حصة في ${DAYS[r.dayOfWeek]} / الحصة ${r.period}`); else sectionSlot.set(sk,r);
    if(Number(r.period)>timetableDayPeriods(Number(r.dayOfWeek))) errors.push(`حصة خارج عدد حصص ${DAYS[r.dayOfWeek]}: ${r.grade}/${r.section} الحصة ${r.period}`);
    const k=`${r.grade}|${r.section}|${r.subject}|${r.dayOfWeek}`; subjDay.set(k,(subjDay.get(k)||0)+1);
  }
  for(const [k,n] of subjDay) if(n>1){
    const [g,sec,sub,d]=k.split('|');
    const sample=rows.find(r=>r.grade===g&&r.section===sec&&r.subject===sub&&Number(r.dayOfWeek)===Number(d));
    const a=state.assignments.find(x=>String(x.id)===String(sample?.assignmentId));
    const weekly=Number((state.timetableRules||[]).find(x=>String(x.assignment_id)===String(a?.id))?.weekly_periods||0);
    const active=[1,2,3,4,5].filter(day=>timetableDayPeriods(day)>0);
    const available=a?active.filter(day=>Array.from({length:timetableDayPeriods(day)},(_,i)=>i+1).some(p=>!((state.teacherAvailability||[]).find(x=>String(x.teacher_id)===String(a.teacher_id)&&Number(x.day_of_week)===day&&Number(x.period_number)===p)?.preference==='blocked'))):active;
    if(!weekly || weekly<=available.length) warnings.push(`تكررت ${sub} في ${g}/${sec} يوم ${DAYS[+d]} دون ضرورة توزيع واضحة (${n} حصص)`);
    else if(n>2) errors.push(`تكررت ${sub} أكثر من مرتين في ${g}/${sec} يوم ${DAYS[+d]}`);
  }
  return {errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
function timetableHealthHtml(){const d=timetableDiagnostics();const cls=d.errors.length?'tt-health-danger':d.warnings.length?'tt-health-warning':'tt-health-ok';const text=d.errors.length?`✕ ${d.errors.length} تضارب حرج`:d.warnings.length?`⚠ ${d.warnings.length} تحذير`:'✓ لا توجد تعارضات';return `<button class="tt-health ${cls}" data-action="show-timetable-issues">${text}</button>`;}
function showTimetableIssues(){const d=timetableDiagnostics();showModal(modal('فحص تعارضات الجدول',`${d.errors.length?`<div class="issue-block danger"><strong>تعارضات حرجة — يجب حلها</strong>${d.errors.map(x=>`<div>• ${safeText(x)}</div>`).join('')}</div>`:'<div class="issue-block ok">✓ لا توجد تعارضات حرجة.</div>'}${d.warnings.length?`<div class="issue-block warning"><strong>تحذيرات</strong>${d.warnings.map(x=>`<div>• ${safeText(x)}</div>`).join('')}</div>`:''}`));}
function timetableView() {
  if (!isAdmin()) return denied();
  const teacherOptions=[...new Map(state.timetable.map(r=>[String(r.teacherId),r.teacher])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'ar')).map(([id,n])=>`<option value="${id}" ${String(timetableDisplayTeacher)===id?'selected':''}>${safeText(n)}</option>`).join('');
  const sectionOptions=[...new Map(state.timetable.map(r=>[`${r.grade}|||${r.section}`,`${r.grade} / ${r.section}`])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'ar')).map(([id,n])=>`<option value="${safeText(id)}" ${timetableDisplaySection===id?'selected':''}>${safeText(n)}</option>`).join('');
  let grid='';
  if(timetableDisplayMode==='teacher'){
    if(!timetableDisplayTeacher && teacherOptions){const first=state.timetable.find(Boolean); timetableDisplayTeacher=first?String(first.teacherId):'';}
    grid=personalTimetableGrid(state.timetable.filter(r=>String(r.teacherId)===String(timetableDisplayTeacher)),'teacher');
  } else if(timetableDisplayMode==='section'){
    if(!timetableDisplaySection && state.timetable.length) timetableDisplaySection=`${state.timetable[0].grade}|||${state.timetable[0].section}`;
    const [g='',sec='']=timetableDisplaySection.split('|||'); grid=personalTimetableGrid(state.timetable.filter(r=>r.grade===g&&r.section===sec),'section');
  } else grid=schoolTimetableGrid();

  return `
    <div class="page-title"><h1>جدول الحصص الذكي</h1><div class="toolbar">
      <button class="btn btn-primary" data-action="generate-timetable">⚡ إنشاء تلقائي</button><button class="btn btn-soft" data-action="timetable-settings">🗓 إعداد أيام الدوام</button><button class="btn btn-soft" data-action="teacher-availability">⚙ تخصيص المدرسين</button><button class="btn btn-soft" data-action="add-timetable">+ إضافة حصة يدوياً</button><button class="btn btn-soft" data-action="print-timetable">🖨️ طباعة وتصدير</button>
    </div></div>
    <div class="notice">ينشئ مسار الجدول آلياً مع منع تعارض المدرس والشعبة واحترام تخصيصات المدرسين وعدد حصص كل يوم.</div>${timetableHealthHtml()}
    <div class="card tt-view-card">
      <div class="tt-tabs"><button class="btn ${timetableDisplayMode==='school'?'btn-primary':'btn-soft'}" data-tt-view="school">الجدول العام للمدرسة</button><button class="btn ${timetableDisplayMode==='teacher'?'btn-primary':'btn-soft'}" data-tt-view="teacher">جدول المدرس</button><button class="btn ${timetableDisplayMode==='section'?'btn-primary':'btn-soft'}" data-tt-view="section">جدول الشعبة</button></div>
      ${timetableDisplayMode==='teacher'?`<div class="tt-picker"><label>المدرس</label><select id="ttTeacherSelect"><option value="">اختر المدرس</option>${teacherOptions}</select></div>`:''}
      ${timetableDisplayMode==='section'?`<div class="tt-picker"><label>الشعبة</label><select id="ttSectionSelect"><option value="">اختر الشعبة</option>${sectionOptions}</select></div>`:''}
      ${grid}
    </div>`;
}

function openTimetablePrintModal() {
  if (!state.timetable.length) return alert('لا يوجد جدول حصص للطباعة بعد.');
  const teacherOptions = [...new Map(state.timetable.map(r => [String(r.teacherId), r.teacher])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'ar')).map(([id,name])=>`<option value="${id}">${safeText(name)}</option>`).join('');
  const sectionOptions = [...new Map(state.timetable.map(r => [`${r.grade}|||${r.section}`, `${r.grade} / ${r.section}`])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'ar')).map(([id,name])=>`<option value="${safeText(id)}">${safeText(name)}</option>`).join('');
  showModal(modal('طباعة وتصدير جدول الحصص', `
    <form id="timetablePrintForm">
      <div class="field"><label>نوع الجدول</label><select id="printTimetableType"><option value="school">الجدول العام للمدرسة</option><option value="teacher">جدول مدرس</option><option value="section">جدول شعبة</option></select></div>
      <div class="field" id="printTeacherField" style="display:none"><label>المدرس</label><select id="printTeacherId"><option value="">اختر المدرس</option>${teacherOptions}</select></div>
      <div class="field" id="printSectionField" style="display:none"><label>الشعبة</label><select id="printSectionId"><option value="">اختر الشعبة</option>${sectionOptions}</select></div>
      <div class="notice">ستفتح معاينة طباعة رسمية بوضع A4 أفقي. من نافذة الطباعة في iPad يمكنك اختيار حفظ كـ PDF.</div>
      <button class="btn btn-primary" type="submit">🖨️ فتح معاينة الطباعة</button>
    </form>`));
  const type=$('#printTimetableType'), tf=$('#printTeacherField'), sf=$('#printSectionField');
  type.addEventListener('change',()=>{tf.style.display=type.value==='teacher'?'block':'none';sf.style.display=type.value==='section'?'block':'none';});
  $('#timetablePrintForm').addEventListener('submit',e=>{e.preventDefault(); printTimetableReport(type.value,$('#printTeacherId')?.value,$('#printSectionId')?.value);});
}

function printTimetableReport(type, teacherId, sectionKey) {
  let rows=[...state.timetable], title='الجدول العام للمدرسة', content='';
  if(type==='teacher'){ if(!teacherId)return alert('اختر المدرس أولاً.'); rows=rows.filter(r=>String(r.teacherId)===String(teacherId)); title='جدول المدرس — '+(rows[0]?.teacher||''); content=personalTimetableGrid(rows,'teacher'); }
  else if(type==='section'){ if(!sectionKey)return alert('اختر الشعبة أولاً.'); const [g,sec]=sectionKey.split('|||'); rows=rows.filter(r=>r.grade===g&&r.section===sec); title='جدول الشعبة — '+g+' / '+sec; content=personalTimetableGrid(rows,'section'); }
  else { content=schoolTimetableGrid(); }
  if(!rows.length)return alert('لا توجد حصص ضمن الاختيار.');
  const year=safeText(activeYear()?.name||'');
  const w=window.open('','_blank'); if(!w)return alert('تعذر فتح معاينة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.');
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${safeText(title)}</title><style>@page{size:A3 landscape;margin:7mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#111;margin:0}.actions{text-align:center;margin:8px}.head{text-align:center;margin-bottom:8px}.head h1{font-size:20px;margin:0 0 4px}.meta{font-size:11px}.tt-scroll{overflow:visible}.tt-personal,.tt-school{width:100%;border-collapse:collapse;table-layout:fixed}.tt-personal th,.tt-personal td,.tt-school th,.tt-school td{border:1px solid #222;text-align:center;vertical-align:middle;padding:4px;font-size:9px}.tt-personal thead th,.tt-personal tbody th,.tt-school thead th,.tt-section-name{background:#eee;font-weight:700}.tt-personal td{height:58px}.tt-entry{height:100%;padding:4px;border-radius:5px;background:hsl(var(--tt-h) 70% 91%)!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.tt-personal strong,.tt-school strong{display:block;font-size:9px}.tt-personal small,.tt-school small{display:block;font-size:7px;margin-top:2px}.tt-school{min-width:0}.tt-school td{height:38px;padding:2px}.tt-day-group{font-size:11px!important}.tt-section-name{width:95px}.tt-empty{color:#aaa}@media print{.actions{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}}</style></head><body><div class="actions"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></div><div class="head"><h1>مسار لإدارة المدارس — ${safeText(title)}</h1><div class="meta">العام الدراسي: ${year} • إصدار مسار ${MASAR_VERSION}</div></div>${content}</body></html>`); w.document.close();
}

async function loadTimetablePreferences(retry = true) {
  // v1.3.1: verify the migration marker first and preserve the real Supabase error.
  const meta = await supabaseClient.from('system_meta').select('db_version').eq('id', 1).maybeSingle();
  if (meta.error) throw Object.assign(new Error('تعذر قراءة إصدار قاعدة البيانات: ' + meta.error.message), { code: meta.error.code });
  const dbVersion = Number(meta.data?.db_version || 0);
  if (dbVersion < 3) throw Object.assign(new Error('قاعدة البيانات تحتاج تحديث Smart Timetable (الإصدار 3).'), { code: 'MASAR_DB_OLD' });

  const [a, r, st] = await Promise.all([
    supabaseClient.from('teacher_availability').select('teacher_id, day_of_week, period_number, preference'),
    supabaseClient.from('assignment_timetable_rules').select('assignment_id, weekly_periods'),
    supabaseClient.from('timetable_day_settings').select('day_of_week, periods_count, is_working_day').eq('academic_year_id', activeYear()?.id).order('day_of_week')
  ]);
  const err = a.error || r.error || st.error;
  if (err) {
    // PostgREST can briefly retain an old schema cache immediately after a migration.
    if (retry && ['PGRST205','42P01'].includes(String(err.code || ''))) {
      await new Promise(resolve => setTimeout(resolve, 900));
      return loadTimetablePreferences(false);
    }
    throw Object.assign(new Error(err.message || 'تعذر تحميل إعدادات الجدول الذكي.'), { code: err.code, details: err.details, hint: err.hint });
  }
  state.teacherAvailability = a.data || [];
  state.timetableRules = r.data || [];
  state.timetableSettings = Object.fromEntries((st.data || []).map(x=>[Number(x.day_of_week),Number(x.periods_count)]));
}

function timetableSetupError(error) {
  console.error('Smart Timetable setup error', error);
  const code = String(error?.code || '');
  if (code === 'MASAR_DB_OLD') return error.message;
  if (['PGRST205','42P01'].includes(code)) return 'يوجد جزء ناقص من جداول الجدول الذكي في قاعدة البيانات. نفّذ UPDATE_DATABASE_v1.6.1.sql ثم أعد المحاولة. التفاصيل: ' + (error?.message || code);
  if (['42501','PGRST301'].includes(code)) return 'قاعدة البيانات محدثة، لكن حسابك لا يملك صلاحية الوصول إلى إعدادات الجدول الذكي. الخطأ: ' + (error?.message || code);
  return 'قاعدة البيانات محدثة، لكن تعذر تحميل إعدادات الجدول الذكي. الخطأ: ' + (error?.message || code || 'غير معروف');
}

async function openTeacherAvailabilityModal() {
  try { await loadTimetablePreferences(); } catch (e) { alert(timetableSetupError(e)); return; }
  if (!state.teachers.length) return alert('لا يوجد مدرسون.');
  const teacherOptions = state.teachers.map(t => `<option value="${t.id}">${safeText(t.name)}${t.specialization ? ` — ${safeText(t.specialization)}` : ''}</option>`).join('');
  showModal(modal('تخصيص جدول المدرسين', `
    <div class="teacher-pref-panel">
      <div class="field"><label>اسم المدرس</label><select id="availabilityTeacher">${teacherOptions}</select></div>
      <div id="teacherAssignmentSummary" class="notice small"></div>
      <div class="pref-section"><h4>أيام التفرغ</h4><p class="muted">لن يضع النظام أي حصة للمدرس في الأيام المحددة.</p><div class="choice-row">${[1,2,3,4,5].map(d=>`<label class="choice-chip"><input type="checkbox" data-off-day="${d}"><span>${DAYS[d]}</span></label>`).join('')}</div></div>
      <div class="pref-section"><h4>الحصص المستثناة</h4><p class="muted">تُمنع هذه الحصص في جميع أيام الدوام.</p><div class="choice-row">${Array.from({length:7},(_,i)=>`<label class="choice-chip"><input type="checkbox" data-blocked-period="${i+1}"><span>الحصة ${i+1}</span></label>`).join('')}</div></div>
      <div class="pref-section"><h4>الحصص المفضلة</h4><p class="muted">يحاول المولد الالتزام بالنطاق قدر الإمكان، وهو تفضيل وليس منعاً.</p><div class="form-grid"><div class="field"><label>من الحصة</label><select id="preferredFrom"><option value="">بدون تفضيل</option>${Array.from({length:7},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></div><div class="field"><label>إلى الحصة</label><select id="preferredTo"><option value="">بدون تفضيل</option>${Array.from({length:7},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></div></div></div>
      <details class="pref-section"><summary><strong>استثناءات يومية متقدمة</strong> — عند الحاجة فقط</summary><p class="muted">لمنع حصة في يوم محدد فقط.</p><div class="day-exception-grid">${[1,2,3,4,5].map(d=>`<div class="day-exception-row"><strong>${DAYS[d]}</strong><div class="choice-row">${Array.from({length:7},(_,i)=>`<label class="choice-chip compact"><input type="checkbox" data-day-exception="${d}" data-period="${i+1}"><span>${i+1}</span></label>`).join('')}</div></div>`).join('')}</div></details>
      <div class="pref-summary" id="prefSummary"></div>
      <button class="btn btn-primary" id="saveAvailability">حفظ تخصيص المدرس</button>
    </div>`));

  const updateSummary=()=>{
    const teacher=teacherById($('#availabilityTeacher').value);
    const off=$$('[data-off-day]:checked').map(x=>DAYS[+x.dataset.offDay]);
    const blocked=$$('[data-blocked-period]:checked').map(x=>x.dataset.blockedPeriod);
    const pf=$('#preferredFrom').value,pt=$('#preferredTo').value,parts=[];
    if(off.length)parts.push(`أيام التفرغ: ${off.join('، ')}`);
    if(blocked.length)parts.push(`الحصص المستثناة: ${blocked.join('، ')}`);
    if(pf&&pt)parts.push(`يفضل الحصص من ${pf} إلى ${pt}`);
    $('#prefSummary').innerHTML=`<strong>${safeText(teacher?.name||'')}</strong><br>${parts.length?parts.map(safeText).join(' • '):'لا توجد قيود عامة حالياً.'}`;
  };
  const draw=()=>{
    const tid=$('#availabilityTeacher').value,teacher=teacherById(tid);
    const rows=state.teacherAvailability.filter(x=>String(x.teacher_id)===String(tid));
    const map=new Map(rows.map(x=>[`${x.day_of_week}-${x.period_number}`,x.preference]));
    const tas=state.assignments.filter(a=>String(a.teacher_id)===String(tid)&&a.status==='active');
    const desc=tas.map(a=>{const sub=subjectById(a.subject_id),sec=sectionById(a.section_id);return `${sub?.name||''} — ${sec?.grade||''} / ${sec?.name||''}`;});
    $('#teacherAssignmentSummary').innerHTML=`<strong>التخصص:</strong> ${safeText(teacher?.specialization||'غير محدد')}<br><strong>التكليفات:</strong> ${desc.length?desc.map(safeText).join('، '):'لا توجد تكليفات فعالة'}`;
    $$('[data-off-day]').forEach(x=>x.checked=Array.from({length:7},(_,i)=>i+1).every(p=>map.get(`${x.dataset.offDay}-${p}`)==='blocked'));
    $$('[data-blocked-period]').forEach(x=>x.checked=[1,2,3,4,5].every(d=>map.get(`${d}-${x.dataset.blockedPeriod}`)==='blocked'));
    $$('[data-day-exception]').forEach(x=>x.checked=map.get(`${x.dataset.dayException}-${x.dataset.period}`)==='blocked');
    const pp=[];for(let p=1;p<=7;p++)if([1,2,3,4,5].some(d=>map.get(`${d}-${p}`)==='preferred'))pp.push(p);
    $('#preferredFrom').value=pp.length?Math.min(...pp):'';$('#preferredTo').value=pp.length?Math.max(...pp):'';updateSummary();
  };
  $('#availabilityTeacher').addEventListener('change',draw);
  $$('[data-off-day], [data-blocked-period], [data-day-exception], #preferredFrom, #preferredTo').forEach(el=>el.addEventListener('change',updateSummary));
  draw();
  $('#saveAvailability').addEventListener('click',async()=>{
    const tid=$('#availabilityTeacher').value;
    const off=new Set($$('[data-off-day]:checked').map(x=>+x.dataset.offDay));
    const blocked=new Set($$('[data-blocked-period]:checked').map(x=>+x.dataset.blockedPeriod));
    const exceptions=new Set($$('[data-day-exception]:checked').map(x=>`${x.dataset.dayException}-${x.dataset.period}`));
    const pf=+$('#preferredFrom').value||0,pt=+$('#preferredTo').value||0;
    if((pf&&!pt)||(!pf&&pt)||(pf&&pt&&pf>pt))return alert('تحقق من نطاق الحصص المفضلة.');
    const rows=[];
    for(let d=1;d<=5;d++)for(let p=1;p<=7;p++){let preference='available';if(off.has(d)||blocked.has(p)||exceptions.has(`${d}-${p}`))preference='blocked';else if(pf&&pt&&p>=pf&&p<=pt)preference='preferred';if(preference!=='available')rows.push({teacher_id:tid,day_of_week:d,period_number:p,preference});}
    const del=await supabaseClient.from('teacher_availability').delete().eq('teacher_id',tid);if(del.error)return alert('تعذر حفظ التخصيص: '+del.error.message);
    if(rows.length){const ins=await supabaseClient.from('teacher_availability').insert(rows);if(ins.error)return alert('تعذر حفظ التخصيص: '+ins.error.message);}
    await loadTimetablePreferences();alert('تم حفظ تخصيص المدرس بنجاح.');draw();
  });
}
function prefLabel(p){ return ({available:'متاح',preferred:'مفضّل',avoid:'غير مفضّل',blocked:'ممنوع'})[p]||p; }

async function openTimetableSettingsModal(){
  try{await loadTimetablePreferences();}catch(e){alert(timetableSetupError(e));return;}
  showModal(modal('إعداد أيام الدوام وعدد الحصص',`<div class="notice">حدد عدد الحصص الفعلي لكل يوم. القيمة 0 تعني أن اليوم ليس يوم دوام.</div><div class="day-period-settings">${[1,2,3,4,5].map(d=>`<div><strong>${DAYS[d]}</strong><input type="number" min="0" max="12" value="${timetableDayPeriods(d)}" data-day-periods="${d}"></div>`).join('')}</div><button class="btn btn-primary" id="saveDayPeriods">حفظ الإعدادات</button>`));
  $('#saveDayPeriods').addEventListener('click',async()=>{const yearId=activeYear()?.id;if(!yearId)return alert('لا توجد سنة دراسية فعالة.');const rows=$$('[data-day-periods]').map(i=>({academic_year_id:yearId,day_of_week:+i.dataset.dayPeriods,periods_count:Math.max(0,Math.min(12,+i.value||0)),is_working_day:(+i.value||0)>0}));const {error}=await supabaseClient.from('timetable_day_settings').upsert(rows,{onConflict:'academic_year_id,day_of_week'});if(error)return alert(error.message);state.timetableSettings=Object.fromEntries(rows.map(x=>[x.day_of_week,x.periods_count]));$('.modal-backdrop')?.remove();render();});
}
async function openGenerateTimetableModal(){
  try { await loadTimetablePreferences(); } catch(e){ alert(timetableSetupError(e)); return; }
  const active=state.assignments.filter(a=>a.status==='active' && (!activeYear() || String(a.academic_year_id)===String(activeYear().id)));
  if(!active.length) return alert('لا توجد تكليفات فعالة.');
  const ruleMap=new Map(state.timetableRules.map(r=>[String(r.assignment_id),r.weekly_periods]));
  showModal(modal('إنشاء الجدول تلقائياً',`
    <div class="notice">حدد عدد الحصص الأسبوعية لكل تكليف. الحصص المقفلة 🔒 ستبقى في مكانها عند إعادة التوليد.</div>
    <div class="smart-rule-list">${active.map(a=>{const t=teacherById(a.teacher_id),s=subjectById(a.subject_id),sec=sectionById(a.section_id);return `<div class="smart-rule-row"><span>${safeText(t?.name||'')} — ${safeText(s?.name||'')} — ${safeText(sec?.grade||'')}/${safeText(sec?.name||'')}</span><input type="number" min="1" max="10" value="${ruleMap.get(String(a.id))||1}" data-weekly="${a.id}"></div>`}).join('')}</div>
    <div class="notice">أيام الدوام الحالية: ${[1,2,3,4,5].filter(d=>timetableDayPeriods(d)>0).map(d=>`${DAYS[d]} ${timetableDayPeriods(d)} حصص`).join(' • ')}</div>
    <button id="runGenerator" class="btn btn-primary">⚡ إنشاء الجدول</button><div id="generatorMessage" class="notice" style="display:none;margin-top:12px"></div>
  `));
  $('#runGenerator').addEventListener('click',runSmartGenerator);
}

async function runSmartGenerator(){
  const btn=$('#runGenerator'), msg=$('#generatorMessage'); btn.disabled=true; btn.textContent='جارٍ إنشاء الجدول...';
  try{
    const weekly=new Map($$('[data-weekly]').map(i=>[String(i.dataset.weekly),Math.max(1,+i.value||1)]));
    const rules=[...weekly].map(([assignment_id,weekly_periods])=>({assignment_id,weekly_periods}));
    const up=await supabaseClient.from('assignment_timetable_rules').upsert(rules,{onConflict:'assignment_id'}); if(up.error) throw up.error;
    const activeDays=[1,2,3,4,5].filter(d=>timetableDayPeriods(d)>0); if(!activeDays.length) throw new Error('لا توجد أيام دوام مفعلة.');
    const locked=state.timetable.filter(x=>x.isLocked);
    const teacherBusy=new Set(locked.map(x=>`${x.teacherId}-${x.dayOfWeek}-${x.period}`));
    const sectionBusy=new Set(locked.map(x=>{const a=state.assignments.find(y=>String(y.id)===String(x.assignmentId));return `${a?.section_id}-${x.dayOfWeek}-${x.period}`}));
    const prefMap=new Map(state.teacherAvailability.map(x=>[`${x.teacher_id}-${x.day_of_week}-${x.period_number}`,x.preference]));
    const tasks=[];
    for(const a of state.assignments.filter(a=>a.status==='active')){
      const already=locked.filter(x=>String(x.assignmentId)===String(a.id)).length;
      const need=Math.max(0,(weekly.get(String(a.id))||1)-already);
      for(let i=0;i<need;i++) tasks.push(a);
    }
    const assignmentDayCount=new Map();
    for(const x of locked){const k=`${x.assignmentId}-${x.dayOfWeek}`;assignmentDayCount.set(k,(assignmentDayCount.get(k)||0)+1);}
    const teacherDayLoad=new Map(); for(const x of locked){const k=`${x.teacherId}-${x.dayOfWeek}`;teacherDayLoad.set(k,(teacherDayLoad.get(k)||0)+1);}
    const teacherAvailableDays=a=>activeDays.filter(d=>Array.from({length:timetableDayPeriods(d)},(_,i)=>i+1).some(p=>(prefMap.get(`${a.teacher_id}-${d}-${p}`)||'available')!=='blocked'));
    const slotsFor=a=>{const arr=[];const weeklyNeed=weekly.get(String(a.id))||1;const availDays=teacherAvailableDays(a);const repeatRequired=weeklyNeed>availDays.length;for(const d of activeDays)for(let p=1;p<=timetableDayPeriods(d);p++){const pref=prefMap.get(`${a.teacher_id}-${d}-${p}`)||'available';if(pref==='blocked')continue;const sameDay=assignmentDayCount.get(`${a.id}-${d}`)||0;if(sameDay>0&&!repeatRequired)continue;if(sameDay>=2)continue;let score=pref==='preferred'?0:pref==='available'?10:30;score+=(teacherDayLoad.get(`${a.teacher_id}-${d}`)||0)*8;score+=sameDay*60;arr.push({d,p,pref,score});}return arr.sort((x,y)=>x.score-y.score||x.d-y.d||x.p-y.p)};
    tasks.sort((a,b)=>slotsFor(a).length-slotsFor(b).length);
    const result=[];
    function place(i){if(i===tasks.length)return true;const a=tasks[i];for(const sl of slotsFor(a)){const tk=`${a.teacher_id}-${sl.d}-${sl.p}`,sk=`${a.section_id}-${sl.d}-${sl.p}`;if(teacherBusy.has(tk)||sectionBusy.has(sk))continue;teacherBusy.add(tk);sectionBusy.add(sk);const ad=`${a.id}-${sl.d}`,td=`${a.teacher_id}-${sl.d}`;assignmentDayCount.set(ad,(assignmentDayCount.get(ad)||0)+1);teacherDayLoad.set(td,(teacherDayLoad.get(td)||0)+1);result.push({assignment_id:a.id,day_of_week:sl.d,period_number:sl.p,room:null,is_active:true,is_locked:false});if(place(i+1))return true;result.pop();assignmentDayCount.set(ad,assignmentDayCount.get(ad)-1);teacherDayLoad.set(td,teacherDayLoad.get(td)-1);teacherBusy.delete(tk);sectionBusy.delete(sk);}return false;}
    if(!place(0)) throw new Error('تعذر إيجاد جدول يحقق القيود الحالية. خفف الأوقات الممنوعة أو زد أيام/حصص الدوام.');
    const unlockedIds=state.timetable.filter(x=>!x.isLocked).map(x=>x.id); if(unlockedIds.length){const del=await supabaseClient.from('timetable').delete().in('id',unlockedIds);if(del.error)throw del.error;}
    if(result.length){const ins=await supabaseClient.from('timetable').insert(result);if(ins.error)throw ins.error;}
    await loadSchoolData(); $('.modal-backdrop')?.remove(); render(); alert(`تم إنشاء الجدول بنجاح: ${result.length} حصة جديدة، مع الاحتفاظ بـ ${locked.length} حصة مقفلة.`);
  }catch(e){msg.style.display='block';msg.textContent=e.message||'تعذر إنشاء الجدول';btn.disabled=false;btn.textContent='⚡ إنشاء الجدول';}
}

async function toggleTimetableLock(id,locked){
  const {error}=await supabaseClient.from('timetable').update({is_locked:!locked}).eq('id',id); if(error)return alert(error.message); await loadSchoolData();render();
}

function openTimetableModal() {
  if (!activeYear()) { showModal(modal('إضافة حصة', `<div class="notice">يجب أولًا إنشاء سنة دراسية فعالة.</div>`)); return; }
  if (!state.assignments.length) { showModal(modal('إضافة حصة', `<div class="notice">يجب أولًا إنشاء تكليف للمدرس بمادة وشعبة.</div>`)); return; }
  showModal(modal('إضافة حصة',`<form id="timetableForm"><div class="field"><label>التكليف</label><select id="timetableAssignment" required><option value="">اختر التكليف</option>${state.assignments.map(a=>{const t=teacherById(a.teacher_id),s=subjectById(a.subject_id),sec=sectionById(a.section_id);return `<option value="${a.id}">${safeText(t?.name||'مدرس')} — ${safeText(s?.name||'')} — ${safeText(sec?.grade||'')}/${safeText(sec?.name||'')}</option>`}).join('')}</select></div><div class="field"><label>اليوم</label><select id="timetableDay" required>${Object.entries(DAYS).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></div><div class="field"><label>رقم الحصة</label><input id="timetablePeriod" type="number" min="1" max="12" required></div><div class="field"><label>القاعة</label><input id="timetableRoom"></div><button id="saveTimetableButton" class="btn btn-primary" type="submit">إضافة الحصة</button><div id="timetableFormMessage" class="notice" style="display:none;margin-top:12px"></div></form>`));
  $('#timetableForm')?.addEventListener('submit', saveTimetable);
}
async function saveTimetable(event){
  event.preventDefault();
  const message=$('#timetableFormMessage'),button=$('#saveTimetableButton');
  const assignmentId=$('#timetableAssignment')?.value,day=Number($('#timetableDay')?.value),period=Number($('#timetablePeriod')?.value);
  const a=state.assignments.find(x=>String(x.id)===String(assignmentId)); if(!a||!day||!period)return;
  const fail=text=>{message.style.display='block';message.textContent=text;};
  try{
    await loadTimetablePreferences();
    if(timetableDayPeriods(day)<=0) return fail(`تعارض: ${DAYS[day]} ليس يوم دوام.`);
    if(period>timetableDayPeriods(day)) return fail(`تعارض: ${DAYS[day]} يحتوي ${timetableDayPeriods(day)} حصص فقط.`);
    const pref=(state.teacherAvailability||[]).find(x=>String(x.teacher_id)===String(a.teacher_id)&&Number(x.day_of_week)===day&&Number(x.period_number)===period)?.preference;
    if(pref==='blocked') return fail(`تعارض: هذه الحصة ضمن وقت التفرغ/الاستثناء الخاص بالمدرس.`);
    const tc=state.timetable.find(x=>String(x.teacherId)===String(a.teacher_id)&&Number(x.dayOfWeek)===day&&Number(x.period)===period);
    const sc=state.timetable.find(x=>String(x.sectionId)===String(a.section_id)&&Number(x.dayOfWeek)===day&&Number(x.period)===period);
    if(tc||sc) return fail(tc?`تعارض: المدرس لديه حصة أخرى في ${DAYS[day]} / الحصة ${period}.`:`تعارض: الشعبة لديها حصة أخرى في ${DAYS[day]} / الحصة ${period}.`);
    const sameAssignmentDay=state.timetable.filter(x=>String(x.assignmentId)===String(a.id)&&Number(x.dayOfWeek)===day).length;
    if(sameAssignmentDay){
      const weekly=Number((state.timetableRules||[]).find(r=>String(r.assignment_id)===String(a.id))?.weekly_periods||1);
      const activeDays=[1,2,3,4,5].filter(d=>timetableDayPeriods(d)>0);
      const availableDays=activeDays.filter(d=>Array.from({length:timetableDayPeriods(d)},(_,i)=>i+1).some(p=>!((state.teacherAvailability||[]).find(x=>String(x.teacher_id)===String(a.teacher_id)&&Number(x.day_of_week)===d&&Number(x.period_number)===p)?.preference==='blocked')));
      if(weekly<=availableDays.length) return fail('تعارض: لا يجوز تكرار المادة للشعبة في اليوم نفسه ما دام يمكن توزيع حصصها على أيام دوام المدرس.');
      if(sameAssignmentDay>=1) return fail('تعارض: الاستثناء يسمح بتكرار المادة مرة واحدة فقط عند ضرورة التوزيع بسبب أيام تفرغ المدرس.');
    }
    button.disabled=true;button.textContent='جارٍ الحفظ...';
    const payload={assignment_id:assignmentId,day_of_week:day,period_number:period,room:$('#timetableRoom')?.value.trim()||null,is_active:true,is_locked:false};
    const {error}=await supabaseClient.from('timetable').insert(payload);if(error)throw error;
    await loadSchoolData();$('.modal-backdrop')?.remove();render();
  }catch(error){fail('تعذر حفظ الحصة: '+(error?.message||'خطأ غير معروف'));button.disabled=false;button.textContent='إضافة الحصة';}
}
async function deleteTimetable(id){if(!confirm('هل تريد حذف هذه الحصة؟'))return;try{const {error}=await supabaseClient.from('timetable').delete().eq('id',id);if(error)throw error;await loadSchoolData();render();}catch(error){alert('تعذر حذف الحصة: '+(error?.message||'خطأ غير معروف'));}}

/* =========================================================
   TEACHER PAGES
========================================================= */

function myClassesView() {
  const rows = teacherTimetable();
  const unique = [];

  rows.forEach(r => {
    if (!unique.some(x => x.subject === r.subject && x.grade === r.grade && x.section === r.section)) {
      unique.push(r);
    }
  });

  return `
    <div class="page-title"><h1>شعبي وحصصي</h1></div>

    <div class="grid teacher-sections">
      ${
        unique
          .map(
            r => `
              <div class="card section-card">
                <h3>${safeText(r.grade)} / ${safeText(r.section)}</h3>
                <p>${safeText(r.subject)}</p>
                <p>صلاحية فعالة من جدول الحصص</p>
                <span class="badge badge-success">مسموح ضمن الصلاحيات</span>
              </div>
            `
          )
          .join('') || '<div class="card empty">لا توجد تكليفات.</div>'
      }
    </div>
  `;
}

function attendanceView() {
  const allowed = teacherTimetable();

  return `
    <div class="page-title">
      <h1>الحضور والغياب</h1>

      <button class="btn btn-primary" data-action="record-attendance">
        + تسجيل حضور
      </button>
    </div>

    <div class="card">
      ${table(
        allowed,
        ['المدرس', 'المادة', 'الصف/الشعبة'],
        row => [
          safeText(row.teacher),
          safeText(row.subject),
          `${safeText(row.grade)} / ${safeText(row.section)}`
        ]
      )}
    </div>
  `;
}

function openAttendanceModal() {
  const rows = teacherTimetable();

  const uniqueAssignments = [];

  rows.forEach(row => {
    if (
      !uniqueAssignments.some(
        existing =>
          String(existing.assignmentId) ===
          String(row.assignmentId)
      )
    ) {
      uniqueAssignments.push(row);
    }
  });

  if (!uniqueAssignments.length) {
    showModal(
      modal(
        'تسجيل الحضور',
        `<div class="notice">لا توجد شعب مرتبطة بجدول الحصص.</div>`
      )
    );
    return;
  }

  showModal(
    modal(
      'تسجيل الحضور',
      `
        <form id="attendanceSetupForm">
          <div class="field">
            <label>المادة والشعبة</label>
            <select id="attendanceAssignment" required>
              <option value="">اختر</option>
              ${uniqueAssignments
                .map(
                  row => `
                    <option value="${row.assignmentId}">
                      ${safeText(row.subject)}
                      — ${safeText(row.grade)}/${safeText(row.section)}
                    </option>
                  `
                )
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>التاريخ</label>
            <input
              id="attendanceDate"
              type="date"
              value="${new Date().toISOString().slice(0, 10)}"
              required
            >
          </div>

          <button class="btn btn-primary" type="submit">
            عرض الطلاب
          </button>
        </form>
      `
    )
  );

  $('#attendanceSetupForm')?.addEventListener(
    'submit',
    loadAttendanceStudents
  );
}

async function loadAttendanceStudents(event) {
  event.preventDefault();

  const assignmentId = $('#attendanceAssignment')?.value;
  const date = $('#attendanceDate')?.value;

  const assignment = assignmentById(assignmentId);
  if (!assignment || !date) return;

  const students = state.students.filter(
    student =>
      String(student.section_id) ===
      String(assignment.section_id)
  );

  const { data: existing, error } = await supabaseClient
    .from('attendance')
    .select('id, student_id, status, note')
    .eq('assignment_id', assignmentId)
    .eq('attendance_date', date);

  if (error) {
    alert('تعذر تحميل الحضور: ' + error.message);
    return;
  }

  const map = new Map(
    (existing || []).map(item => [
      String(item.student_id),
      item
    ])
  );

  $('.modal-backdrop')?.remove();

  showModal(
    modal(
      'تسجيل الحضور',
      `
        <form id="attendanceForm">
          <input
            id="attendanceAssignmentId"
            type="hidden"
            value="${assignmentId}"
          >

          <input
            id="attendanceRecordDate"
            type="hidden"
            value="${date}"
          >

          ${
            students.length
              ? students
                  .map(student => {
                    const item = map.get(String(student.id));
                    const status = item?.status || 'present';

                    return `
                      <div
                        style="
                          display:grid;
                          grid-template-columns:2fr 1fr 2fr;
                          gap:8px;
                          align-items:center;
                          margin-bottom:10px
                        "
                      >
                        <strong>${safeText(student.name)}</strong>

                        <select data-attendance-student="${student.id}">
                          <option value="present" ${status === 'present' ? 'selected' : ''}>حاضر</option>
                          <option value="absent" ${status === 'absent' ? 'selected' : ''}>غائب</option>
                          <option value="late" ${status === 'late' ? 'selected' : ''}>متأخر</option>
                          <option value="excused" ${status === 'excused' ? 'selected' : ''}>غياب بعذر</option>
                        </select>

                        <input
                          data-attendance-note="${student.id}"
                          value="${safeText(item?.note || '')}"
                          placeholder="ملاحظة"
                        >
                      </div>
                    `;
                  })
                  .join('')
              : '<div class="empty">لا يوجد طلاب في هذه الشعبة.</div>'
          }

          <button
            id="saveAttendanceButton"
            class="btn btn-primary"
            type="submit"
          >
            حفظ الحضور
          </button>

          <div
            id="attendanceFormMessage"
            class="notice"
            style="display:none;margin-top:12px"
          ></div>
        </form>
      `
    )
  );

  $('#attendanceForm')?.addEventListener(
    'submit',
    event =>
      saveAttendance(
        event,
        assignmentId,
        date,
        students
      )
  );
}

async function saveAttendance(
  event,
  assignmentId,
  date,
  students
) {
  event.preventDefault();

  const button = $('#saveAttendanceButton');
  const message = $('#attendanceFormMessage');

  const rows = students.map(student => ({
    student_id: student.id,
    assignment_id: assignmentId,
    attendance_date: date,
    status:
      $(`[data-attendance-student="${student.id}"]`)?.value ||
      'present',
    note:
      $(`[data-attendance-note="${student.id}"]`)?.value.trim() ||
      null,
    created_by: state.user.id,
    updated_at: new Date().toISOString()
  }));

  try {
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';

    if (rows.length) {
      const { error } = await supabaseClient
        .from('attendance')
        .upsert(rows, {
          onConflict:
            'student_id,assignment_id,attendance_date'
        });

      if (error) throw error;
    }

    $('.modal-backdrop')?.remove();

  } catch (error) {
    console.error(error);

    message.style.display = 'block';
    message.textContent =
      'تعذر حفظ الحضور: ' +
      (error?.message || 'خطأ غير معروف');

    button.disabled = false;
    button.textContent = 'حفظ الحضور';
  }
}

function scoresView() {
  const allowed = teacherTimetable();

  const allowedAssignmentIds = new Set(
    allowed.map(row => String(row.assignmentId))
  );

  const exams = state.exams.filter(
    exam =>
      isAdmin() ||
      allowedAssignmentIds.has(String(exam.assignment_id))
  );

  return `
    <div class="page-title">
      <h1>الدرجات والاختبارات</h1>

      <button class="btn btn-primary" data-action="add-exam">
        + إضافة اختبار
      </button>
    </div>

    <div class="card">
      ${table(
        exams,
        ['الاختبار', 'النوع', 'التاريخ', 'الدرجة الكبرى', 'إجراءات'],
        exam => [
          safeText(exam.name),
          safeText(exam.exam_type),
          safeText(exam.exam_date || ''),
          safeText(exam.max_score),
          `
            <button
              class="btn btn-soft btn-sm"
              data-open-scores="${exam.id}"
            >
              إدخال الدرجات
            </button>
          `
        ]
      )}
    </div>
  `;
}

function availableAssignmentsForCurrentUser() {
  if (isAdmin()) {
    return state.assignments.filter(a => a.status === 'active');
  }

  return state.assignments.filter(
    a =>
      a.status === 'active' &&
      String(a.teacher_id) === String(state.user.teacherId) &&
      state.timetable.some(
        tt => String(tt.assignmentId) === String(a.id)
      )
  );
}

function openExamModal() {
  const assignments = availableAssignmentsForCurrentUser();

  if (!assignments.length) {
    showModal(
      modal(
        'إضافة اختبار',
        `<div class="notice">لا توجد تكليفات فعالة مرتبطة بجدول حصص.</div>`
      )
    );
    return;
  }

  showModal(
    modal(
      'إضافة اختبار',
      `
        <form id="examForm">
          <div class="field">
            <label>التكليف</label>
            <select id="examAssignment" required>
              <option value="">اختر المادة والشعبة</option>
              ${assignments
                .map(a => {
                  const teacher = teacherById(a.teacher_id);
                  const subject = subjectById(a.subject_id);
                  const section = sectionById(a.section_id);

                  return `
                    <option value="${a.id}">
                      ${safeText(teacher?.name || state.user.name)}
                      — ${safeText(subject?.name || '')}
                      — ${safeText(section?.grade || '')}/${safeText(section?.name || '')}
                    </option>
                  `;
                })
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>اسم الاختبار</label>
            <input id="examName" required>
          </div>

          <div class="field">
            <label>نوع الاختبار</label>
            <select id="examType">
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
              <option value="monthly" selected>شهري</option>
              <option value="midyear">نصف السنة</option>
              <option value="final">نهائي</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          <div class="field">
            <label>تاريخ الاختبار</label>
            <input id="examDate" type="date">
          </div>

          <div class="field">
            <label>الدرجة الكبرى</label>
            <input id="examMaxScore" type="number" min="0.01" step="0.01" value="100" required>
          </div>

          <button id="saveExamButton" class="btn btn-primary" type="submit">
            حفظ الاختبار
          </button>

          <div id="examFormMessage" class="notice" style="display:none;margin-top:12px"></div>
        </form>
      `
    )
  );

  $('#examForm')?.addEventListener('submit', saveExam);
}

async function saveExam(event) {
  event.preventDefault();

  const payload = {
    assignment_id: $('#examAssignment')?.value,
    name: $('#examName')?.value.trim(),
    exam_type: $('#examType')?.value || 'monthly',
    exam_date: $('#examDate')?.value || null,
    max_score: Number($('#examMaxScore')?.value),
    created_by: state.user.id
  };

  const button = $('#saveExamButton');
  const message = $('#examFormMessage');

  if (!payload.assignment_id || !payload.name || !(payload.max_score > 0)) {
    return;
  }

  try {
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';

    const { error } = await supabaseClient
      .from('exams')
      .insert(payload);

    if (error) throw error;

    await loadSchoolData();

    $('.modal-backdrop')?.remove();
    render();

  } catch (error) {
    console.error(error);

    message.style.display = 'block';
    message.textContent =
      'تعذر حفظ الاختبار: ' +
      (error?.message || 'خطأ غير معروف');

    button.disabled = false;
    button.textContent = 'حفظ الاختبار';
  }
}

async function openScoresModal(examId) {
  const exam = state.exams.find(
    item => String(item.id) === String(examId)
  );

  if (!exam) return;

  const assignment = assignmentById(exam.assignment_id);
  if (!assignment) return;

  const sectionStudents = state.students.filter(
    student =>
      String(student.section_id) ===
      String(assignment.section_id)
  );

  const { data: existingScores, error } = await supabaseClient
    .from('scores')
    .select('id, student_id, score, note')
    .eq('exam_id', exam.id);

  if (error) {
    alert('تعذر تحميل الدرجات: ' + error.message);
    return;
  }

  const scoreMap = new Map(
    (existingScores || []).map(score => [
      String(score.student_id),
      score
    ])
  );

  showModal(
    modal(
      `درجات: ${safeText(exam.name)}`,
      `
        <form id="scoresForm">
          <input id="scoresExamId" type="hidden" value="${exam.id}">

          ${
            sectionStudents.length
              ? sectionStudents
                  .map(student => {
                    const existing = scoreMap.get(String(student.id));

                    return `
                      <div
                        style="
                          display:grid;
                          grid-template-columns:2fr 1fr 2fr;
                          gap:8px;
                          align-items:center;
                          margin-bottom:10px
                        "
                      >
                        <strong>${safeText(student.name)}</strong>

                        <input
                          data-score-student="${student.id}"
                          type="number"
                          min="0"
                          max="${exam.max_score}"
                          step="0.01"
                          value="${existing?.score ?? ''}"
                          placeholder="الدرجة"
                        >

                        <input
                          data-score-note="${student.id}"
                          value="${safeText(existing?.note || '')}"
                          placeholder="ملاحظة"
                        >
                      </div>
                    `;
                  })
                  .join('')
              : '<div class="empty">لا يوجد طلاب في هذه الشعبة.</div>'
          }

          <button
            id="saveScoresButton"
            class="btn btn-primary"
            type="submit"
          >
            حفظ الدرجات
          </button>

          <div
            id="scoresFormMessage"
            class="notice"
            style="display:none;margin-top:12px"
          ></div>
        </form>
      `
    )
  );

  $('#scoresForm')?.addEventListener(
    'submit',
    event => saveScores(event, exam, sectionStudents)
  );
}

async function saveScores(event, exam, students) {
  event.preventDefault();

  const button = $('#saveScoresButton');
  const message = $('#scoresFormMessage');

  const rows = students
    .map(student => {
      const scoreInput = $(`[data-score-student="${student.id}"]`);
      const noteInput = $(`[data-score-note="${student.id}"]`);

      const raw = scoreInput?.value;

      if (raw === '' || raw == null) {
        return null;
      }

      const score = Number(raw);

      if (
        Number.isNaN(score) ||
        score < 0 ||
        score > Number(exam.max_score)
      ) {
        throw new Error(
          `درجة ${student.name} يجب أن تكون بين 0 و ${exam.max_score}.`
        );
      }

      return {
        exam_id: exam.id,
        student_id: student.id,
        score,
        note: noteInput?.value.trim() || null,
        entered_by: state.user.id,
        updated_at: new Date().toISOString()
      };
    })
    .filter(Boolean);

  try {
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';

    if (rows.length) {
      const { error } = await supabaseClient
        .from('scores')
        .upsert(rows, {
          onConflict: 'exam_id,student_id'
        });

      if (error) throw error;
    }

    $('.modal-backdrop')?.remove();

  } catch (error) {
    console.error(error);

    message.style.display = 'block';
    message.textContent =
      error?.message || 'تعذر حفظ الدرجات.';

    button.disabled = false;
    button.textContent = 'حفظ الدرجات';
  }
}

function reportsView() {
  return `
    <div class="page-title"><h1>التقارير</h1></div>

    <div class="grid stats">
      <div class="card">كشف حضور</div>
      <div class="card">كشف درجات</div>
      <div class="card">إحصاءات الطلاب</div>
      <div class="card">تقرير المدرسين</div>
    </div>
  `;
}

/* =========================================================
   ACADEMIC YEARS CRUD
========================================================= */

function settingsView() {
  if (!isAdmin()) return denied();

  return `
    <div class="page-title">
      <h1>الإعدادات</h1>
      <button class="btn btn-primary" data-action="add-year">+ إضافة سنة دراسية</button>
    </div>

    <div class="card">
      <h3>السنوات الدراسية</h3>

      ${table(
        state.academicYears,
        ['السنة', 'البداية', 'النهاية', 'الحالة', 'إجراءات'],
        y => [
          safeText(y.name),
          safeText(y.start_date),
          safeText(y.end_date),
          y.is_active
            ? '<span class="badge badge-success">الحالية</span>'
            : '<span class="badge">غير فعالة</span>',
          y.is_active
            ? ''
            : `
              <button class="btn btn-soft btn-sm" data-activate-year="${y.id}">تفعيل</button>
              <button class="btn btn-soft btn-sm" data-delete-year="${y.id}">حذف</button>
            `
        ]
      )}
    </div>

    <div class="card">
      <h3>حالة النظام والتحديثات</h3>
      <div class="system-status-grid">
        <div><span class="small">إصدار مسار</span><strong>v${MASAR_VERSION}</strong></div>
        <div><span class="small">إصدار قاعدة البيانات</span><strong>${state.systemHealth.dbVersion ?? 'قديم'}</strong></div>
        <div><span class="small">التوافق</span>${systemStatusBadge()}</div>
      </div>
      <p>${safeText(state.systemHealth.message || '')}</p>
      <div class="notice">لأسباب أمنية لا يحتفظ مسار بمفتاح إداري داخل المتصفح. بعد التهيئة الأولى، ستظهر حالة توافق كل إصدار هنا بوضوح قبل استخدامه.</div>
    </div>

    <div class="card">
      <h3>Supabase</h3>
      <p>الاتصال بقاعدة البيانات والمصادقة مفعّل.</p>
      <span class="badge badge-success">Connected</span>
    </div>
  `;
}

function openYearModal() {
  showModal(
    modal(
      'إضافة سنة دراسية',
      `
        <form id="yearForm">
          <div class="field">
            <label>اسم السنة الدراسية</label>
            <input id="yearName" placeholder="مثال: 2026–2027" required>
          </div>

          <div class="field">
            <label>تاريخ البداية</label>
            <input id="yearStart" type="date" required>
          </div>

          <div class="field">
            <label>تاريخ النهاية</label>
            <input id="yearEnd" type="date" required>
          </div>

          <label style="display:flex;gap:8px;align-items:center;margin:12px 0">
            <input id="yearActive" type="checkbox" checked>
            اجعلها السنة الدراسية الحالية
          </label>

          <button id="saveYearButton" class="btn btn-primary" type="submit">حفظ السنة الدراسية</button>
          <div id="yearFormMessage" class="notice" style="display:none; margin-top:12px"></div>
        </form>
      `
    )
  );

  $('#yearForm')?.addEventListener('submit', saveYear);
}

async function saveYear(event) {
  event.preventDefault();

  const name = $('#yearName')?.value.trim();
  const startDate = $('#yearStart')?.value;
  const endDate = $('#yearEnd')?.value;
  const makeActive = $('#yearActive')?.checked;
  const button = $('#saveYearButton');
  const message = $('#yearFormMessage');

  if (!name || !startDate || !endDate) return;

  if (endDate <= startDate) {
    message.style.display = 'block';
    message.textContent = 'تاريخ نهاية السنة يجب أن يكون بعد تاريخ البداية.';
    return;
  }

  try {
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';

    if (makeActive) {
      const { error: deactivateError } = await supabaseClient
        .from('academic_years')
        .update({ is_active: false })
        .eq('is_active', true);

      if (deactivateError) throw deactivateError;
    }

    const { error } = await supabaseClient
      .from('academic_years')
      .insert({
        name,
        start_date: startDate,
        end_date: endDate,
        is_active: !!makeActive
      });

    if (error) throw error;

    await loadSchoolData();
    $('.modal-backdrop')?.remove();
    render();
  } catch (error) {
    message.style.display = 'block';
    message.textContent =
      error?.code === '23505'
        ? 'هذه السنة الدراسية موجودة مسبقًا.'
        : 'تعذر حفظ السنة: ' + (error?.message || 'خطأ غير معروف');

    button.disabled = false;
    button.textContent = 'حفظ السنة الدراسية';
  }
}

async function activateYear(id) {
  try {
    const { error: offError } = await supabaseClient
      .from('academic_years')
      .update({ is_active: false })
      .eq('is_active', true);

    if (offError) throw offError;

    const { error } = await supabaseClient
      .from('academic_years')
      .update({ is_active: true })
      .eq('id', id);

    if (error) throw error;

    await loadSchoolData();
    render();
  } catch (error) {
    alert('تعذر تفعيل السنة: ' + (error?.message || 'خطأ غير معروف'));
  }
}

async function deleteYear(id) {
  if (!confirm('هل تريد حذف السنة الدراسية؟ لن يسمح النظام بالحذف إذا كانت مرتبطة بشعب أو تكليفات.')) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('academic_years')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await loadSchoolData();
    render();
  } catch (error) {
    alert('تعذر حذف السنة: ' + (error?.message || 'قد تكون مرتبطة ببيانات أخرى.'));
  }
}

/* =========================================================
   GENERIC UI
========================================================= */

function denied() {
  return `<div class="card empty">هذه الصفحة غير متاحة لصلاحيات حسابك.</div>`;
}

function table(rows, headers, rowFn) {
  if (!rows.length) return '<div class="empty">لا توجد بيانات.</div>';

  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>

        <tbody>
          ${rows
            .map(
              r =>
                `<tr>${rowFn(r)
                  .map(c => `<td>${c}</td>`)
                  .join('')}</tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function modal(title, body) {
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>${title}</h3>
          <button class="close" data-action="close-modal">×</button>
        </div>
        ${body}
      </div>
    </div>
  `;
}

function showModal(html) {
  document.body.insertAdjacentHTML('beforeend', html);
  bindModal();
}

function bindModal() {
  $('[data-action="close-modal"]')?.addEventListener('click', () => {
    $('.modal-backdrop')?.remove();
  });
}

/* =========================================================
   AUTH
========================================================= */

async function handleLogin(e) {
  e.preventDefault();

  const loginId =
    $('#loginId')?.value.trim() || '';

  const password =
    $('#password')?.value || '';

  const button =
    $('#loginButton');

  if (!loginId || !password) return;

  state.error = '';

  if (button) {
    button.disabled = true;
    button.textContent =
      'جارٍ تسجيل الدخول...';
  }

  try {
    let email;

    /*
      دعم مؤقت للحساب الإداري القديم:
      إذا كتب المستخدم بريدًا كاملًا نستعمله كما هو.
      أما الحسابات الجديدة فتدخل باسم المستخدم فقط.
    */
    if (loginId.includes('@')) {
      email = loginId;
    } else {
      const username =
        normalizeUsername(loginId);

      if (!isValidUsername(username)) {
        throw new Error(
          'اسم المستخدم غير صالح.'
        );
      }

      email =
        usernameToInternalEmail(
          username
        );
    }

    const { data, error } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });

    if (error) throw error;

    if (!data.user) {
      throw new Error(
        'تعذر الحصول على بيانات المستخدم.'
      );
    }

    await establishUser(
      data.user
    );

  } catch (err) {
    console.error(err);

    let message =
      err?.message ||
      'تعذر تسجيل الدخول';

    if (
      /invalid login credentials/i.test(message) ||
      /email not confirmed/i.test(message)
    ) {
      message =
        'اسم المستخدم أو كلمة المرور غير صحيحة.';
    } else if (
      /failed to fetch/i.test(message)
    ) {
      message =
        'تعذر الاتصال بخادم Supabase. تحقق من اتصال الإنترنت.';
    }

    state.error = message;
    state.user = null;
    state.loading = false;

    render();
  }
}

async function handleLogout() {
  try {
    await supabaseClient.auth.signOut();
  } finally {
    state.user = null;
    clearData();
    state.page = 'dashboard';
    render();
  }
}

/* =========================================================
   EVENTS
========================================================= */

function bind() {
  $('#loginForm')?.addEventListener('submit', handleLogin);
  $('#logout')?.addEventListener('click', handleLogout);

  $$('[data-page]').forEach(button =>
    button.addEventListener('click', () => {
      state.page = button.dataset.page;
      render();
    })
  );

  $('#studentSearch')?.addEventListener('input', filterStudents);
  $('#gradeFilter')?.addEventListener('change', filterStudents);

  $('[data-action="add-teacher-account"]')?.addEventListener(
    'click',
    () => openUserAccountModal('teacher')
  );

  $('[data-action="add-admin-account"]')?.addEventListener(
    'click',
    () => openUserAccountModal('admin')
  );

  $('[data-action="export-teacher-credentials"]')?.addEventListener('click', exportTeacherCredentials);
  $$('[data-download-credential]').forEach(b=>b.addEventListener('click',()=>downloadTeacherCredential(b.dataset.downloadCredential)));
  $$('[data-delete-user]').forEach(b=>b.addEventListener('click',()=>deleteSchoolUser(b.dataset.deleteUser,b.dataset.deleteTeacher||'')));

  $('[data-action="add-student"]')?.addEventListener('click', () => openStudentModal());
  $('[data-action="add-section"]')?.addEventListener('click', () => openSectionModal());
  $('[data-action="add-subject"]')?.addEventListener('click', () => openSubjectModal());
  $('[data-action="add-timetable"]')?.addEventListener('click', openTimetableModal);
  $('[data-action="generate-timetable"]')?.addEventListener('click', openGenerateTimetableModal);
  $('[data-action="timetable-settings"]')?.addEventListener('click', openTimetableSettingsModal);
  $('[data-action="show-timetable-issues"]')?.addEventListener('click', showTimetableIssues);
  $('[data-action="teacher-availability"]')?.addEventListener('click', openTeacherAvailabilityModal);
  $('[data-action="print-timetable"]')?.addEventListener('click', openTimetablePrintModal);
  $$('[data-tt-view]').forEach(b=>b.addEventListener('click',()=>{timetableDisplayMode=b.dataset.ttView;render();}));
  $('#ttTeacherSelect')?.addEventListener('change',e=>{timetableDisplayTeacher=e.target.value;render();});
  $('#ttSectionSelect')?.addEventListener('change',e=>{timetableDisplaySection=e.target.value;render();});
  $('[data-action="add-year"]')?.addEventListener('click', openYearModal);

  $('[data-action="record-attendance"]')?.addEventListener(
    'click',
    openAttendanceModal
  );

  $('[data-action="add-exam"]')?.addEventListener(
    'click',
    openExamModal
  );

  $$('[data-open-scores]').forEach(button =>
    button.addEventListener(
      'click',
      () => openScoresModal(button.dataset.openScores)
    )
  );

  $$('[data-edit-student]').forEach(button =>
    button.addEventListener('click', () => {
      const student = state.students.find(x => String(x.id) === String(button.dataset.editStudent));
      openStudentModal(student);
    })
  );

  $$('[data-delete-student]').forEach(button =>
    button.addEventListener('click', () => deleteStudent(button.dataset.deleteStudent))
  );

  $$('[data-edit-section]').forEach(button =>
    button.addEventListener('click', () => {
      const section = state.sections.find(x => String(x.id) === String(button.dataset.editSection));
      openSectionModal(section);
    })
  );

  $$('[data-delete-section]').forEach(button =>
    button.addEventListener('click', () => deleteSection(button.dataset.deleteSection))
  );

  $$('[data-edit-subject]').forEach(button =>
    button.addEventListener('click', () => {
      const subject = state.subjects.find(x => String(x.id) === String(button.dataset.editSubject));
      openSubjectModal(subject);
    })
  );

  $$('[data-delete-subject]').forEach(button =>
    button.addEventListener('click', () => deleteSubject(button.dataset.deleteSubject))
  );

  $$('[data-add-assignment]').forEach(button =>
    button.addEventListener('click', () => openAssignmentModal(button.dataset.addAssignment))
  );

  $$('[data-edit-teacher]').forEach(button => button.addEventListener('click',()=>openTeacherProfileModal(button.dataset.editTeacher)));
  $$('[data-edit-profile]').forEach(button => button.addEventListener('click',()=>openProfileEditModal(button.dataset.editProfile)));
  $$('[data-manage-assignments]').forEach(button => button.addEventListener('click',()=>openManageAssignments(button.dataset.manageAssignments)));

  $$('[data-delete-timetable]').forEach(button =>
    button.addEventListener('click', () => deleteTimetable(button.dataset.deleteTimetable))
  );
  $$('[data-toggle-lock]').forEach(button => button.addEventListener('click', () => toggleTimetableLock(button.dataset.toggleLock, button.dataset.locked === '1')));

  $$('[data-activate-year]').forEach(button =>
    button.addEventListener('click', () => activateYear(button.dataset.activateYear))
  );

  $$('[data-delete-year]').forEach(button =>
    button.addEventListener('click', () => deleteYear(button.dataset.deleteYear))
  );
}

function filterStudents() {
  const q = ($('#studentSearch')?.value || '').trim();
  const g = $('#gradeFilter')?.value || '';

  const rows = state.students.filter(
    student =>
      (!q || student.name.includes(q) || student.code.includes(q)) &&
      (!g || student.grade === g)
  );

  const target = $('#studentsTable');
  if (target) target.innerHTML = studentsTable(rows);

  $$('[data-edit-student]').forEach(button =>
    button.addEventListener('click', () => {
      const student = state.students.find(x => String(x.id) === String(button.dataset.editStudent));
      openStudentModal(student);
    })
  );

  $$('[data-delete-student]').forEach(button =>
    button.addEventListener('click', () => deleteStudent(button.dataset.deleteStudent))
  );
}

mount();

