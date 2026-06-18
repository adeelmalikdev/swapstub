
# One Significant Function for the Exam Answer

Instead of the big `proposeSwap` (too long to hand-write), I'll showcase **`has_role`** — the Postgres SECURITY DEFINER function that powers role-based access control across the app. It's ~10 lines, easy to reproduce on paper, and technically meaningful (prevents RLS recursion + privilege escalation).

## What the answer will contain

1. **2-line project intro** — SwapStub: peer-to-peer student skill-swap marketplace built on TanStack Start + Lovable Cloud (Postgres + RLS + Auth).

2. **The code block** (short enough to memorize):

```sql
create or replace function public.has_role(
  _user_id uuid,
  _role app_role
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
```

Plus the one-line usage inside an RLS policy:
```sql
create policy "Admins read all"
on public.listings for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));
```

3. **Explanation (4 short points)** — exactly what to write under the code:
   - **Separate `user_roles` table** prevents privilege escalation (roles never live on `profiles`, which the user can update).
   - **`SECURITY DEFINER`** runs with the function owner's rights → bypasses RLS on `user_roles`, avoiding infinite recursion when policies on other tables call it.
   - **`stable` + `set search_path = public`** → query planner can cache results within a statement, and a fixed search_path blocks search-path hijack attacks.
   - **Reusable across every policy** → single source of truth for authorization; used by listings, bookings, admin endpoints.

## Why this one (vs alternatives)

| Candidate | Lines | Exam-friendly? | Significance |
|---|---|---|---|
| `proposeSwap` | ~60 | No | High but unrealistic to write |
| `sendMessage` + realtime | ~40 | Borderline | Medium |
| **`has_role` + RLS policy** | **~12** | **Yes** | **High — security architecture** |
| `requireSupabaseAuth` middleware | ~20 | Maybe | Medium |

If you'd rather feature a **TypeScript** server function instead of SQL, I can swap in a trimmed ~15-line version of `submitReview` (validates rating, inserts, updates listing avg) — tell me which flavor you want.
