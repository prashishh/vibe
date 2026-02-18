# Build v2 Ship Checklist

## Pre-Deploy
- [ ] All tasks marked done in `TASKS.md`
- [ ] All guards pass in CI full run (vibe check)
- [ ] v1 is deployed and stable
- [ ] `admin_audit_logs` migration script reviewed

## Deploy
- [ ] Run migration: `admin_audit_logs`
- [ ] Verify audit logging active on login and user management
- [ ] Verify admin dashboard login page accessible

## Post-Deploy Smoke
- [ ] Admin can log in via dashboard UI
- [ ] Session persists across page refresh
- [ ] Logout clears session completely
- [ ] `admin` role sees all navigation modules
- [ ] `content` role sees only Prompt Lab + generation logs
- [ ] `finance` role sees only finance modules
- [ ] Admin can create a new admin user
- [ ] Admin can soft delete an admin user
- [ ] Audit logs record login + user management events
- [ ] No password_hash visible in any API response or audit log

## Rollback
- [ ] Rollback procedure: revert migration, redeploy v1-only build
- [ ] Rollback trigger: UI login broken, audit logging causing errors, user management failing
