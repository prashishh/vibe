# Build v1 Ship Checklist

## Pre-Deploy
- [ ] All tasks marked done in `TASKS.md`
- [ ] All guards pass in CI full run (vibe check)
- [ ] Migration scripts reviewed and tested locally
- [ ] `argon2` available in production Node version
- [ ] Seed script tested — creates initial admin user

## Deploy
- [ ] Run migrations: `admin_roles`, `admin_users`
- [ ] Run seed script to create initial admin user
- [ ] Verify `ADMIN_PASSWORD` env var removed from production
- [ ] Confirm rate limiter is active

## Post-Deploy Smoke
- [ ] `POST /api/admin/login` with seeded admin credentials returns token
- [ ] `GET /api/admin/me` with valid token returns admin profile (no password_hash)
- [ ] Prompt Lab routes return 401 without token
- [ ] Prompt Lab routes return 403 for `finance` role
- [ ] Live config mutation returns 403 for `content` role
- [ ] Live config mutation succeeds for `admin` role

## Rollback
- [ ] Rollback procedure: revert migrations, redeploy previous build, re-add `ADMIN_PASSWORD`
- [ ] Rollback trigger: auth endpoints failing, or legitimate admin locked out
