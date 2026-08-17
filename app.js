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
  timetable: []
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
}

async function establishUser(authUser) {
  state.loading = true;
  render();

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, full_name, role, phone, is_active')
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
    timetableRes
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
      .eq('is_active', true)
  ]);

  const responses = [
    yearsRes,
    gradesRes,
    sectionsRes,
    subjectsRes,
    studentsRes,
    teachersRes,
    assignmentsRes,
    timetableRes
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
            <label>البريد الإلكتروني</label>
            <input id="email" type="email" autocomplete="username" required>
          </div>

          <div class="field">
            <label>كلمة المرور</label>
            <input id="password" type="password" autocomplete="current-password" required>
          </div>

          <button id="loginButton" class="btn btn-primary" type="submit">
            تسجيل الدخول
          </button>
        </form>

        ${errorBlock}
      </div>
    </div>
  `;
}

function navItems() {
  const admin = [
    ['dashboard', 'الرئيسية'],
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
    showModal(modal('إضافة تكليف', `<div class="notice">يجب أولًا إنشاء سنة دراسية فعالة.</div>`));
    return;
  }

  const yearSections = state.sections.filter(
    s => String(s.academic_year_id) === String(year.id) && s.is_active !== false
  );

  showModal(
    modal(
      'إضافة تكليف للمدرس',
      `
        <form id="assignmentForm">
          <div class="field">
            <label>المدرس</label>
            <select id="assignmentTeacher" required>
              <option value="">اختر المدرس</option>
              ${state.teachers
                .map(
                  t => `
                    <option value="${t.id}" ${String(teacherId) === String(t.id) ? 'selected' : ''}>
                      ${safeText(t.name)}
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
                .map(s => `<option value="${s.id}">${safeText(s.name)}</option>`)
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>الشعبة</label>
            <select id="assignmentSection" required>
              <option value="">اختر الشعبة</option>
              ${yearSections
                .map(s => `<option value="${s.id}">${safeText(s.grade)} / ${safeText(s.name)}</option>`)
                .join('')}
            </select>
          </div>

          <div class="field">
            <label>تاريخ بداية التكليف</label>
            <input id="assignmentStart" type="date" value="${year.start_date || ''}" required>
          </div>

          <div class="field">
            <label>تاريخ نهاية التكليف</label>
            <input id="assignmentEnd" type="date" value="${year.end_date || ''}">
          </div>

          <button id="saveAssignmentButton" class="btn btn-primary" type="submit">حفظ التكليف</button>
          <div id="assignmentFormMessage" class="notice" style="display:none; margin-top:12px"></div>
        </form>
      `
    )
  );

  $('#assignmentForm')?.addEventListener('submit', saveAssignment);
}

async function saveAssignment(event) {
  event.preventDefault();

  const year = activeYear();
  const message = $('#assignmentFormMessage');
  const button = $('#saveAssignmentButton');

  const payload = {
    teacher_id: $('#assignmentTeacher')?.value,
    subject_id: $('#assignmentSubject')?.value,
    section_id: $('#assignmentSection')?.value,
    academic_year_id: year?.id,
    start_date: $('#assignmentStart')?.value,
    end_date: $('#assignmentEnd')?.value || null,
    status: 'active'
  };

  if (!payload.teacher_id || !payload.subject_id || !payload.section_id || !payload.academic_year_id || !payload.start_date) {
    return;
  }

  try {
    button.disabled = true;
    button.textContent = 'جارٍ الحفظ...';

    const { error } = await supabaseClient
      .from('teacher_assignments')
      .insert(payload);

    if (error) throw error;

    await loadSchoolData();
    $('.modal-backdrop')?.remove();
    render();
  } catch (error) {
    message.style.display = 'block';
    message.textContent = 'تعذر حفظ التكليف: ' + (error?.message || 'خطأ غير معروف');

    button.disabled = false;
    button.textContent = 'حفظ التكليف';
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
    <div class="page-title"><h1>الحضور والغياب</h1></div>

    <div class="card">
      <p>إدخال الحضور مرتبط بتكليف المدرس وجدول الحصص.</p>

      ${table(
        allowed,
        ['المدرس', 'المادة', 'الصف/الشعبة'],
        r => [
          safeText(r.teacher),
          safeText(r.subject),
          `${safeText(r.grade)} / ${safeText(r.section)}`
        ]
      )}
    </div>
  `;
}

function scoresView() {
  const allowed = teacherTimetable();

  return `
    <div class="page-title"><h1>الدرجات والاختبارات</h1></div>

    <div class="card">
      <p>إدخال الدرجات مرتبط بالتكليف نفسه، لذلك لا يستطيع المدرس التعامل مع طالب خارج مادته وشعبته.</p>

      ${table(
        allowed,
        ['المادة', 'الصف/الشعبة', 'المدرس'],
        r => [
          safeText(r.subject),
          `${safeText(r.grade)} / ${safeText(r.section)}`,
          safeText(r.teacher)
        ]
      )}
    </div>
  `;
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

  const email = $('#email')?.value.trim();
  const password = $('#password')?.value || '';
  const button = $('#loginButton');

  if (!email || !password) return;

  state.error = '';

  if (button) {
    button.disabled = true;
    button.textContent = 'جارٍ تسجيل الدخول...';
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (!data.user) {
      throw new Error('تعذر الحصول على بيانات المستخدم.');
    }

    await establishUser(data.user);
  } catch (err) {
    console.error(err);

    let message = err?.message || 'تعذر تسجيل الدخول';

    if (
      /invalid login credentials/i.test(message) ||
      /email not confirmed/i.test(message)
    ) {
      message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    } else if (/failed to fetch/i.test(message)) {
      message = 'تعذر الاتصال بخادم Supabase. تحقق من رابط المشروع في config.js واتصال الإنترنت.';
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

  $('[data-action="add-student"]')?.addEventListener('click', () => openStudentModal());
  $('[data-action="add-section"]')?.addEventListener('click', () => openSectionModal());
  $('[data-action="add-subject"]')?.addEventListener('click', () => openSubjectModal());
  $('[data-action="add-timetable"]')?.addEventListener('click', openTimetableModal);
  $('[data-action="add-year"]')?.addEventListener('click', openYearModal);

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
