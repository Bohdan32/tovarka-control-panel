-- Нова роль аналітика: адвокат диявола, що шукає слабкі місця у висновках інших ролей.
alter table public.analyst_reports drop constraint analyst_reports_role_check;
alter table public.analyst_reports add constraint analyst_reports_role_check
  check (role in ('lead','scout','sourcer','finance','marketing','auditor','critic'));
