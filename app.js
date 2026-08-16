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

function config() {
  return window.MASAR_CONFIG || {};
}

async function createSupabaseClient() {
  const cfg = config();

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error('إعدادات Supabase غير موجودة في config.js');
  }

  const { createClient } = await import(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
  );

  return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

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

    throw new Error(
      'الحساب موجود في المصادقة لكنه غير مربوط بملف مستخدم في النظام.'
    );
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

      throw new Error(
        'حساب المدرس غير مربوط بسجل مدرس.'
      );
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

  const isAdmin = state.user?.role === 'admin';

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
      .select(
        'id, name, grade_id, academic_year_id, is_active'
      ),

    supabaseClient
      .from('subjects')
      .select('id, name, code, is_active')
      .order('name'),

    supabaseClient
      .from('students')
      .select(
        'id, student_code, full_name, section_id, status'
      )
      .order('full_name'),

    supabaseClient
      .from('teachers')
      .select(
        'id, user_id, employee_code, specialization'
      ),

    supabaseClient
      .from('teacher_assignments')
      .select(
        'id, teacher_id, subject_id, section_id, academic_year_id, start_date, end_date, status'
      ),

    supabaseClient
      .from('timetable')
      .select(
        'id, assignment_id, day_of_week, period_number, room, is_active'
      )
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

    throw new Error(
      'تعذر تحميل بيانات المدرسة: ' + firstError.message
    );
  }

  state.academicYears = yearsRes.data || [];

  state.grades = (gradesRes.data || []).filter(
    x => x.is_active !== false
  );

  state.sections = sectionsRes.data || [];

  state.subjects = (subjectsRes.data || []).filter(
    x => x.is_active !== false
  );

  state.students = studentsRes.data || [];
  state.teachers = teachersRes.data || [];
  state.assignments = assignmentsRes.data || [];

  const gradeById = new Map(
    state.grades.map(g => [g.id, g])
  );

  const sectionById = new Map(
    state.sections.map(s => [s.id, s])
  );

  const subjectById = new Map(
    state.subjects.map(s => [s.id, s])
  );

  state.students = state.students.map(s => {
    const section = sectionById.get(s.section_id);
    const grade = section
      ? gradeById.get(section.grade_id)
      : null;

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
    grade: gradeById.get(s.grade_id)?.name || ''
  }));

  const profileNames = new Map();

  if (isAdmin && state.teachers.length) {
    const ids = state.teachers
      .map(t => t.user_id)
      .filter(Boolean);

    if (ids.length) {
      const { data: profiles, error } =
        await supabaseClient
          .from('profiles')
          .select('id, full_name')
          .in('id', ids);

      if (!error) {
        (profiles || []).forEach(p => {
          profileNames.set(
            p.id,
            p.full_name
          );
        });
      }
    }
  } else if (state.user?.role === 'teacher') {
    profileNames.set(
      state.user.id,
      state.user.name
    );
  }

  state.teachers = state.teachers.map(t => ({
    ...t,
    name:
      profileNames.get(t.user_id) ||
      t.employee_code ||
      'مدرس',

    subject:
      t.specialization || ''
  }));

  const mappedTeacherById = new Map(
    state.teachers.map(t => [t.id, t])
  );

  const assignmentById = new Map(
    state.assignments.map(a => [a.id, a])
  );

  state.timetable = (timetableRes.data || [])
    .map(tt => {
      const assignment =
        assignmentById.get(
          tt.assignment_id
        );

      if (!assignment) return null;

      const teacher =
        mappedTeacherById.get(
          assignment.teacher_id
        );

      const subject =
        subjectById.get(
          assignment.subject_id
        );

      const section =
        sectionById.get(
          assignment.section_id
        );

      const grade = section
        ? gradeById.get(
            section.grade_id
          )
        : null;

      return {
        id: tt.id,
        assignmentId: assignment.id,
        teacherId: assignment.teacher_id,

        teacher:
          teacher?.name ||
          state.user?.name ||
          'مدرس',

        subject:
          subject?.name || '',

        grade:
          grade?.name || '',

        section:
          section?.name || '',

        day:
          DAYS[tt.day_of_week] ||
          String(tt.day_of_week),

        dayOfWeek:
          tt.day_of_week,

        period:
          tt.period_number,

        room:
          tt.room || ''
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        (a.dayOfWeek - b.dayOfWeek) ||
        (a.period - b.period)
    );
}

function render() {
  if (state.loading) {
    $('#app').innerHTML =
      loadingView();

    return;
  }

  $('#app').innerHTML =
    state.user
      ? shell()
      : loginView();

  bind();
}

function loginView() {
  const errorBlock =
    state.error
      ? `
        <div
          class="notice"
          style="margin-top:14px"
        >
          ${safeText(state.error)}
        </div>
      `
      : '';

  return `
    <div class="login-wrap">

      <div class="login-card">

        <div class="brand">

          <div class="brand-mark">
            م
          </div>

          <h1>
            مسار لإدارة المدارس
          </h1>

          <p>
            نظام إدارة الثانوية
            من الأول المتوسط
            إلى السادس العلمي
          </p>

        </div>

        <form id="loginForm">

          <div class="field">

            <label>
              البريد الإلكتروني
            </label>

            <input
              id="email"
              type="email"
              autocomplete="username"
              required
            >

          </div>

          <div class="field">

            <label>
              كلمة المرور
            </label>

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

  return state.user.role === 'admin'
    ? admin
    : teacher;
}

function academicYearLabel() {
  const active =
    state.academicYears.find(
      y => y.is_active
    );

  return (
    active?.name ||
    'لم تُحدد سنة دراسية فعالة'
  );
}

function shell() {
  return `
    <div class="shell">

      <aside class="sidebar">

        <div class="logo">

          <div class="logo-badge">
            م
          </div>

          <h2>
            مسار للمدارس
          </h2>

        </div>

        <nav class="nav">

          ${navItems()
            .map(
              ([id, label]) => `
                <button
                  data-page="${id}"
                  class="${
                    state.page === id
                      ? 'active'
                      : ''
                  }"
                >
                  <span class="label">
                    ${label}
                  </span>
                </button>
              `
            )
            .join('')}

        </nav>

      </aside>

      <main class="main">

        <header class="topbar">

          <div>

            <b>
              ${safeText(
                academicYearLabel()
              )}
            </b>

            <div class="small">
              ثانوية — نظام إدارة مدرسي
            </div>

          </div>

          <div class="user">

            <div>

              <b>
                ${safeText(
                  state.user.name
                )}
              </b>

              <div class="small">

                ${
                  state.user.role ===
                  'admin'
                    ? 'الإدارة'
                    : 'مدرس'
                }

              </div>

            </div>

            <div class="avatar">
              ${safeText(
                state.user.name?.[0] ||
                  'م'
              )}
            </div>

            <button
              id="logout"
              class="btn btn-soft"
            >
              خروج
            </button>

          </div>

        </header>

        <section class="content">

          ${pageView()}

        </section>

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

  return (
    map[state.page] ||
    dashboardView
  )();
}

function teacherTimetable() {
  if (
    state.user.role === 'admin'
  ) {
    return state.timetable;
  }

  return state.timetable.filter(
    x =>
      x.teacherId ===
      state.user.teacherId
  );
}

function dashboardView() {
  const isAdmin =
    state.user.role === 'admin';

  const assignments =
    teacherTimetable();

  return `
    <div class="page-title">

      <h1>
        ${
          isAdmin
            ? 'لوحة الإدارة'
            : 'لوحة المدرس'
        }
      </h1>

    </div>

    ${
      !isAdmin
        ? `
          <div class="notice">

            صلاحياتك تُستخرج
            تلقائيًا من جدول الحصص
            الحالي، لذلك لا تظهر لك
            إلا الشعب والمواد المكلف بها.

          </div>
        `
        : ''
    }

    <div class="grid stats">

      <div class="card stat">

        <strong>
          ${state.students.length}
        </strong>

        <span>
          الطلاب
        </span>

      </div>

      <div class="card stat">

        <strong>
          ${state.teachers.length}
        </strong>

        <span>
          المدرسون
        </span>

      </div>

      <div class="card stat">

        <strong>
          ${state.sections.length}
        </strong>

        <span>
          الشعب
        </span>

      </div>

      <div class="card stat">

        <strong>
          ${assignments.length}
        </strong>

        <span>
          ${
            isAdmin
              ? 'حصص مسجلة'
              : 'تكليفاتي'
          }
        </span>

      </div>

    </div>

    <div class="grid two-col">

      <div class="card">

        <h3>
          ملخص الجدول
        </h3>

        ${table(
          assignments.slice(0, 6),

          [
            'اليوم',
            'الحصة',
            'المدرس',
            'المادة',
            'الصف/الشعبة'
          ],

          r => [
            safeText(r.day),
            r.period,
            safeText(r.teacher),
            safeText(r.subject),

            `${safeText(
              r.grade
            )} / ${safeText(
              r.section
            )}`
          ]
        )}

      </div>

      <div class="card">

        <h3>
          مبدأ الصلاحيات
        </h3>

        <p>

          المدرس لا يُمنح صلاحيات
          يدويًا على الشعب.

          وجود تكليف فعال له
          في جدول الحصص
          هو المرجع الذي يسمح له
          بالتعامل مع طلاب الشعبة
          ومادته فقط.

        </p>

        <span class="badge badge-success">
          محمي بسياسات RLS في Supabase
        </span>

      </div>

    </div>
  `;
}

function studentsView() {
  if (
    state.user.role !== 'admin'
  ) {
    return denied();
  }

  return `
    <div class="page-title">

      <h1>
        إدارة الطلاب
      </h1>

      <button
        class="btn btn-primary"
        data-action="add-student"
      >
        + إضافة طالب
      </button>

    </div>

    <div class="card">

      <div class="toolbar">

        <input
          id="studentSearch"
          placeholder="بحث بالاسم أو الرقم"
        >

        <select id="gradeFilter">

          <option value="">
            كل الصفوف
          </option>

          ${state.grades
            .map(
              g => `
                <option>
                  ${safeText(g.name)}
                </option>
              `
            )
            .join('')}

        </select>

      </div>

      <div id="studentsTable">

        ${studentsTable(
          state.students
        )}

      </div>

    </div>
  `;
}

function studentsTable(rows) {
  return table(
    rows,

    [
      'الرقم',
      'الاسم',
      'الصف',
      'الشعبة',
      'الحالة'
    ],

    r => [
      safeText(r.code),
      safeText(r.name),
      safeText(r.grade),
      safeText(r.section),

      `
        <span
          class="badge badge-success"
        >
          ${safeText(
            r.statusLabel
          )}
        </span>
      `
    ]
  );
}

function sectionsView() {
  if (
    state.user.role !== 'admin'
  ) {
    return denied();
  }

  return `
    <div class="page-title">

      <h1>
        الصفوف والشعب
      </h1>

      <button
        class="btn btn-primary"
        data-action="add-section"
      >
        + إضافة شعبة
      </button>

    </div>

    <div class="card">

      ${table(
        state.sections,

        [
          'الصف',
          'الشعبة'
        ],

        r => [
          safeText(r.grade),
          safeText(r.name)
        ]
      )}

    </div>
  `;
}

function teachersView() {
  if (
    state.user.role !== 'admin'
  ) {
    return denied();
  }

  return `
    <div class="page-title">

      <h1>
        المعلمون والمواد
      </h1>

    </div>

    <div class="grid two-col">

      <div class="card">

        <h3>
          المدرسون
        </h3>

        ${table(
          state.teachers,

          [
            'المدرس',
            'التخصص'
          ],

          r => [
            safeText(r.name),
            safeText(r.subject)
          ]
        )}

      </div>

      <div class="card">

        <h3>
          المواد
        </h3>

        ${
          state.subjects.length
            ? state.subjects
                .map(
                  s => `
                    <div
                      style="
                        padding:9px;
                        border-bottom:
                        1px solid #edf1f7
                      "
                    >
                      ${safeText(
                        s.name
                      )}
                    </div>
                  `
                )
                .join('')
            : `
              <div class="empty">
                لا توجد مواد بعد.
              </div>
            `
        }

      </div>

    </div>
  `;
}

function timetableView() {
  if (
    state.user.role !== 'admin'
  ) {
    return denied();
  }

  return `
    <div class="page-title">

      <h1>
        جدول الحصص
      </h1>

    </div>

    <div class="notice">

      جدول الحصص هو المرجع
      الفعلي لصلاحية المدرس.

      إنشاء التكليفات والحصص
      سيتم من قاعدة البيانات
      في المرحلة التالية.

    </div>

    <div class="card">

      ${table(
        state.timetable,

        [
          'اليوم',
          'الحصة',
          'المدرس',
          'المادة',
          'الصف',
          'الشعبة',
          'القاعة'
        ],

        r => [
          safeText(r.day),
          r.period,
          safeText(r.teacher),
          safeText(r.subject),
          safeText(r.grade),
          safeText(r.section),
          safeText(r.room)
        ]
      )}

    </div>
  `;
}

function myClassesView() {
  const rows =
    teacherTimetable();

  const unique = [];

  rows.forEach(r => {
    if (
      !unique.some(
        x =>
          x.subject ===
            r.subject &&
          x.grade ===
            r.grade &&
          x.section ===
            r.section
      )
    ) {
      unique.push(r);
    }
  });

  return `
    <div class="page-title">

      <h1>
        شعبي وحصصي
      </h1>

    </div>

    <div
      class="grid teacher-sections"
    >

      ${
        unique
          .map(
            r => `
              <div
                class="card section-card"
              >

                <h3>
                  ${safeText(
                    r.grade
                  )}
                  /
                  ${safeText(
                    r.section
                  )}
                </h3>

                <p>
                  ${safeText(
                    r.subject
                  )}
                </p>

                <p>
                  صلاحية فعالة
                  من جدول الحصص
                </p>

                <span
                  class="
                    badge
                    badge-success
                  "
                >
                  مسموح ضمن الصلاحيات
                </span>

              </div>
            `
          )
          .join('') ||
        `
          <div class="card empty">
            لا توجد تكليفات.
          </div>
        `
      }

    </div>
  `;
}

function attendanceView() {
  const allowed =
    teacherTimetable();

  return `
    <div class="page-title">

      <h1>
        الحضور والغياب
      </h1>

    </div>

    <div class="card">

      <p>

        هذه الشاشة مهيأة
        للمرحلة التالية.

        سيُسمح للمدرس بالتسجيل
        فقط ضمن التكليفات الموجودة
        في جدول الحصص.

      </p>

      ${table(
        allowed,

        [
          'المدرس',
          'المادة',
          'الصف/الشعبة'
        ],

        r => [
          safeText(r.teacher),
          safeText(r.subject),

          `${safeText(
            r.grade
          )} / ${safeText(
            r.section
          )}`
        ]
      )}

    </div>
  `;
}

function scoresView() {
  const allowed =
    teacherTimetable();

  return `
    <div class="page-title">

      <h1>
        الدرجات والاختبارات
      </h1>

    </div>

    <div class="card">

      <p>

        إدخال الدرجات
        سيكون مرتبطًا بنفس التكليف،
        لذلك لا يستطيع المدرس
        التعامل مع طالب خارج
        مادته وشعبته.

      </p>

      ${table(
        allowed,

        [
          'المادة',
          'الصف/الشعبة',
          'المدرس'
        ],

        r => [
          safeText(r.subject),

          `${safeText(
            r.grade
          )} / ${safeText(
            r.section
          )}`,

          safeText(r.teacher)
        ]
      )}

    </div>
  `;
}

function reportsView() {
  return `
    <div class="page-title">

      <h1>
        التقارير
      </h1>

    </div>

    <div class="grid stats">

      <div class="card">
        كشف حضور
      </div>

      <div class="card">
        كشف درجات
      </div>

      <div class="card">
        إحصاءات الطلاب
      </div>

      <div class="card">
        تقرير المدرسين
      </div>

    </div>
  `;
}

function settingsView() {
  if (
    state.user.role !== 'admin'
  ) {
    return denied();
  }

  return `
    <div class="page-title">

      <h1>
        الإعدادات
      </h1>

    </div>

    <div class="card">

      <h3>
        Supabase
      </h3>

      <p>
        الاتصال بقاعدة البيانات
        والمصادقة مفعّل.
      </p>

      <span
        class="badge badge-success"
      >
        Connected
      </span>

    </div>
  `;
}

function denied() {
  return `
    <div class="card empty">
      هذه الصفحة غير متاحة
      لصلاحيات حسابك.
    </div>
  `;
}

function table(
  rows,
  headers,
  rowFn
) {
  if (!rows.length) {
    return `
      <div class="empty">
        لا توجد بيانات.
      </div>
    `;
  }

  return `
    <div class="table-wrap">

      <table class="table">

        <thead>

          <tr>

            ${headers
              .map(
                h => `
                  <th>
                    ${h}
                  </th>
                `
              )
              .join('')}

          </tr>

        </thead>

        <tbody>

          ${rows
            .map(
              r => `
                <tr>

                  ${rowFn(r)
                    .map(
                      c => `
                        <td>
                          ${c}
                        </td>
                      `
                    )
                    .join('')}

                </tr>
              `
            )
            .join('')}

        </tbody>

      </table>

    </div>
  `;
}

function modal(
  title,
  body
) {
  return `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h3>
            ${title}
          </h3>

          <button
            class="close"
            data-action="close-modal"
          >
            ×
          </button>

        </div>

        ${body}

      </div>

    </div>
  `;
}

function showModal(html) {
  document.body.insertAdjacentHTML(
    'beforeend',
    html
  );

  bindModal();
}

function bindModal() {
  $(
    '[data-action="close-modal"]'
  )?.addEventListener(
    'click',
    () => {
      $(
        '.modal-backdrop'
      )?.remove();
    }
  );
}

async function handleLogin(e) {
  e.preventDefault();

  const email =
    $('#email')?.value.trim();

  const password =
    $('#password')?.value || '';

  const button =
    $('#loginButton');

  if (
    !email ||
    !password
  ) {
    return;
  }

  state.error = '';

  if (button) {
    button.disabled = true;

    button.textContent =
      'جارٍ تسجيل الدخول...';
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });

    if (error) {
      throw error;
    }

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
      /invalid login credentials/i.test(
        message
      ) ||
      /email not confirmed/i.test(
        message
      )
    ) {
      message =
        'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    } else if (
      /failed to fetch/i.test(
        message
      )
    ) {
      message =
        'تعذر الاتصال بخادم Supabase. تحقق من رابط المشروع في config.js واتصال الإنترنت.';
    }

    state.error = message;
    state.user = null;
    state.loading = false;

    render();
  }
}

async function handleLogout() {
  try {
    await supabaseClient.auth
      .signOut();
  } finally {
    state.user = null;

    clearData();

    state.page =
      'dashboard';

    render();
  }
}

function bind() {
  $('#loginForm')
    ?.addEventListener(
      'submit',
      handleLogin
    );

  $('#logout')
    ?.addEventListener(
      'click',
      handleLogout
    );

  $$('[data-page]')
    .forEach(
      button =>
        button.addEventListener(
          'click',
          () => {
            state.page =
              button.dataset.page;

            render();
          }
        )
    );

  $('#studentSearch')
    ?.addEventListener(
      'input',
      filterStudents
    );

  $('#gradeFilter')
    ?.addEventListener(
      'change',
      filterStudents
    );

  $(
    '[data-action="add-student"]'
  )?.addEventListener(
    'click',
    () => {
      showModal(
        modal(
          'إضافة طالب',

          `
            <div class="notice">

              ربط إضافة الطالب
              بقاعدة البيانات
              سيكون في الخطوة التالية.

              المصادقة والقراءة
              من Supabase تعمل الآن.

            </div>
          `
        )
      );
    }
  );

  $(
    '[data-action="add-section"]'
  )?.addEventListener(
    'click',
    () => {
      showModal(
        modal(
          'إضافة شعبة',

          `
            <div class="notice">

              ربط إنشاء الشعب
              بقاعدة البيانات
              سيكون في الخطوة التالية.

            </div>
          `
        )
      );
    }
  );
}

function filterStudents() {
  const q =
    (
      $('#studentSearch')
        ?.value ||
      ''
    ).trim();

  const g =
    $('#gradeFilter')
      ?.value ||
    '';

  const rows =
    state.students.filter(
      student =>
        (
          !q ||
          student.name.includes(q) ||
          student.code.includes(q)
        ) &&
        (
          !g ||
          student.grade === g
        )
    );

  const target =
    $('#studentsTable');

  if (target) {
    target.innerHTML =
      studentsTable(rows);
  }
}

mount();
