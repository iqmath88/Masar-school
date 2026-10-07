# Masar v1.8.0 — Production Stabilization

هذه نسخة تثبيت قبل إضافة ميزات جديدة.

- إعادة بناء الجدول العام: الأعمدة للشعب، والصفوف مجمعة حسب اليوم والحصة، وفق النموذج المرجعي.
- تحسين أبعاد خلايا الجدول والطباعة الملونة.
- إضافة sectionId/subjectId إلى نموذج الجدول في الواجهة لمنع المطابقة النصية الهشة.
- توحيد فحص التعارض عند الإضافة اليدوية: عدد حصص اليوم، تفرغ المدرس، تضارب المدرس، تضارب الشعبة، وتكرار المادة.
- تكرار المادة في اليوم نفسه لا يسمح به إلا عند ضرورة ناتجة عن عدد الحصص الأسبوعية مقابل أيام توفر المدرس، وبحد أقصى حصتين في اليوم.
- عدم حفظ الرموز المؤقتة بصورة دائمة في localStorage؛ أصبحت محصورة في جلسة الإدارة الحالية.
- تضمين Edge Functions الخاصة بإنشاء وحذف حسابات المدرسة داخل المشروع لضمان قابلية الاستعادة والنشر.
- تعديل علاقة teachers.user_id إلى ON DELETE SET NULL للمحافظة على السجل الأكاديمي للمدرس عند حذف حساب الدخول.

## قبل رفع ملفات الواجهة
نفّذ `UPDATE_DATABASE_v1.8.0.sql` في Supabase SQL Editor.

## Edge Functions
انشر/حدّث:
- `create-school-user`
- `delete-school-user`

واجعل Verify JWT with legacy secret = OFF للوظيفتين لأن كل وظيفة تتحقق من جلسة المستخدم وصلاحية الإدارة داخل الكود.

## Final stabilization build
- Synchronized bundled `create-school-user` with the reviewed deployed function.
- New accounts are marked `must_change_password = true` and start with an empty permissions object.
- Teacher phone is synchronized into the teacher record on creation.
- `delete-school-user` now verifies that the calling admin is active and returns the `ok` contract expected by the web app.
- Account deletion preserves teacher academic/history records through the v1.8.0 `ON DELETE SET NULL` relationship.
