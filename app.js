const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

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
  students: [],
  assignments: [],
  timetable: [],
  exams: []
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
      await establishUser(data.session.user);
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
      .select('id, user_id, employee_code, specialization'),

    supabaseClient
      .from('teacher_assignments')
      .select('id, teacher_id, subject_id, section_id, academic_year_id, start_date, end_date, status'),

    supabaseClient
      .from('timetable')
      .select('id, assignment_id, day_of_week, period_number, room, is_active')
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
    grade: gradeMap.get(s.grade_id)?.name || ''
  }));

  const profileNames = new Map();

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
    name: profileNames.get(t.user_id) || t.employee_code || 'مدرس',
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
        day: DAYS[tt.day_of_week] || String(tt.day_of_week),
        dayOfWeek: tt.day_of_week,
        period: tt.period_number,
        room: tt.room || ''
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.period - b.period));
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
            <label>اسم المستخدم</label>
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
            <div class="small">ثانوية — نظام إدارة مدرسي</div>
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

function usersView() {
  if (!isAdmin()) return denied();

  return `
    <div class="page-title">
      <h1>الحسابات والمستخدمون</h1>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" data-action="add-teacher-account">
          + إضافة مدرس
        </button>

        <button class="btn btn-soft" data-action="add-admin-account">
          + إضافة إدارة
        </button>
      </div>
    </div>

    <div class="grid two-col">
      <div class="card">
        <h3>المدرسون</h3>

        ${table(
          state.teachers,
          ['الاسم', 'التخصص', 'الرقم الوظيفي', 'إجراءات'],
          teacher => [
            safeText(teacher.name),
            safeText(teacher.specialization || ''),
            safeText(teacher.employee_code || ''),
            `
              <button
                class="btn btn-soft btn-sm"
                data-add-assignment="${teacher.id}"
              >
                إضافة تكليف
              </button>
            `
          ]
        )}
      </div>

      <div class="card">
        <h3>آلية إنشاء الحساب</h3>

        <p>
          عند إضافة مدرس أو إدارة، يرسل التطبيق الطلب إلى
          Edge Function آمنة داخل Supabase. كلمة المرور لا تُحفظ
          في جداول المدرسة، ولا يوجد أي مفتاح سري داخل المتصفح.
        </p>

        <span class="badge badge-success">
          إنشاء الحسابات من جهة الخادم
        </span>
      </div>
    </div>
  `;
}

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
            <label>اسم المستخدم</label>
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
            <label>كلمة المرور الأولية</label>
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

  $('#userAccountForm')?.addEventListener(
    'submit',
    saveUserAccount
  );
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

    await loadSchoolData();

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

function teachersView() {
  if (!isAdmin()) return denied();

  return `
    <div class="page-title">
      <h1>المعلمون والمواد</h1>
      <button class="btn btn-primary" data-action="add-subject">+ إضافة مادة</button>
    </div>

    <div class="grid two-col">
      <div class="card">
        <h3>المدرسون</h3>
        ${table(
          state.teachers,
          ['المدرس', 'التخصص', 'إجراءات'],
          r => [
            safeText(r.name),
            safeText(r.subject),
            `<button class="btn btn-soft btn-sm" data-add-assignment="${r.id}">إضافة تكليف</button>`
          ]
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

/* =========================================================
   TIMETABLE CRUD
========================================================= */

function timetableView() {
  if (!isAdmin()) return denied();

  return `
    <div class="page-title">
      <h1>جدول الحصص</h1>
      <button class="btn btn-primary" data-action="add-timetable">+ إضافة حصة</button>
    </div>

    <div class="notice">
      جدول الحصص هو المرجع الفعلي لصلاحية المدرس.
    </div>

    <div class="card">
      ${table(
        state.timetable,
        ['اليوم', 'الحصة', 'المدرس', 'المادة', 'الصف', 'الشعبة', 'القاعة', 'إجراءات'],
        r => [
          safeText(r.day),
          r.period,
          safeText(r.teacher),
          safeText(r.subject),
          safeText(r.grade),
          safeText(r.section),
          safeText(r.room),
          `<button class="btn btn-soft btn-sm" data-delete-timetable="${r.id}">حذف</button>`
        ]
      )}
    </div>
  `;
}

function openTimetableModal() {
  if (!activeYear()) {
    showModal(modal('إضافة حصة', `<div class="notice">يجب أولًا إنشاء سنة دراسية فعالة.</div>`));
    return;
  }

  if (!state.assignments.length) {
    showModal(modal('إضافة حصة', `<div class="notice">يجب أولًا إنشاء تكليف للمدرس بمادة وشعبة.</div>`));
    return;
  }

  showModal(
    modal(
      'إضافة حصة',
      `
        <form id="timetableForm">
          <div class="field">
            <label>التكليف</label>
            <select id="timetableAssignment" required>
              <option value="">اختر التكليف</option>
              ${state.assignments
                .map(a => {
                  const t = teacherById(a.teacher_id);
                  const s = subjectById(a.subject_id);
                  const sec = sectionById(a.section_id);

                  return `
                    <option value="${a.id}">
                      ${safeText(t?.name || 'مدرس')} — ${safeText(s?.name || '')} — ${safeText(sec?.grade || '')}/${safeText(sec?.name || '')}
                    </option>
                  `;
                })
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>اليوم</label>
            <select id="timetableDay" required>
              ${Object.entries(DAYS)
                .map(([id, name]) => `<option value="${id}">${name}</option>`)
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>رقم الحصة</label>
            <input id="timetablePeriod" type="number" min="1" max="12" required>
          </div>

          <div class="field">
            <label>القاعة</label>
            <input id="timetableRoom">
          </div>

          <button id="saveTimetableButton" class="btn btn-primary" type="submit">إضافة الحصة</button>
          <div id="timetableFormMessage" class="notice" style="display:none; margin-top:12px"></div>
        </form>
      `
    )
  );

  $('#timetableForm')?.addEventListener('submit', saveTimetable);
}

async function saveTimetable(event) {
  event.preventDefault();

  const message = $('#timetableFormMessage');
  const button = $('#saveTimetableButton');

  const payload = {
    assignment_id: $('#timetableAssignment')?.value,
    day_of_week: Number($('#timetableDay')?.value),
    period_number: Number($('#timetablePeriod')?.value),
    room: $('#timetableRoom')?.value.trim() || null,
    is_active: true
  };

  if (!payload.assignment_id || !payload.day_of_week || !payload.period_number) return;

  try {
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';

    const { error } = await supabaseClient
      .from('timetable')
      .insert(payload);

    if (error) throw error;

    await loadSchoolData();
    $('.modal-backdrop')?.remove();
    render();
  } catch (error) {
    message.style.display = 'block';
    message.textContent =
      error?.code === '23505'
        ? 'هذه الحصة موجودة مسبقًا لنفس التكليف.'
        : 'تعذر حفظ الحصة: ' + (error?.message || 'خطأ غير معروف');

    button.disabled = false;
    button.textContent = 'إضافة الحصة';
  }
}

async function deleteTimetable(id) {
  if (!confirm('هل تريد حذف هذه الحصة؟')) return;

  try {
    const { error } = await supabaseClient
      .from('timetable')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await loadSchoolData();
    render();
  } catch (error) {
    alert('تعذر حذف الحصة: ' + (error?.message || 'خطأ غير معروف'));
  }
}

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

  $('[data-action="add-student"]')?.addEventListener('click', () => openStudentModal());
  $('[data-action="add-section"]')?.addEventListener('click', () => openSectionModal());
  $('[data-action="add-subject"]')?.addEventListener('click', () => openSubjectModal());
  $('[data-action="add-timetable"]')?.addEventListener('click', openTimetableModal);
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

  $$('[data-delete-timetable]').forEach(button =>
    button.addEventListener('click', () => deleteTimetable(button.dataset.deleteTimetable))
  );

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

