# Masar v1.6.1 — Smart Timetable Compatibility Hotfix

- Fixed automatic generation failing because the app queried `school_timetable_settings` while the deployed database uses `timetable_day_settings`.
- Added an idempotent migration that guarantees `teacher_availability`, `assignment_timetable_rules`, `timetable_day_settings`, and `timetable.is_locked` exist.
- Day-period settings are now scoped to the active academic year.
- Missing-schema errors now report the actual missing smart-timetable component instead of suggesting only a refresh.
