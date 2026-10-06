# Masar v1.6.0 Hotfix
- Fixes startup screen getting stuck on “جارٍ تحميل النظام...”.
- Adds the missing `timetable.is_locked` database field required by v1.6.0.
- Aligns flexible weekday-period settings with the table actually read by the app.
- Adds authenticated read access to `system_meta` and timetable settings.
- Adds a 20-second startup guard so database errors are shown instead of an endless loading screen.
