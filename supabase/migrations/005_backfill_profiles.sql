-- Backfill `public.profiles` for existing auth users.
--
-- The `handle_new_user` trigger only runs on *new* inserts into `auth.users`.
-- If the trigger was added after users already existed, `profiles` will remain empty
-- until we backfill.

insert into public.profiles (id, email, created_at, updated_at)
select u.id, u.email, now(), now()
from auth.users u
where u.id is not null
on conflict (id) do nothing;

