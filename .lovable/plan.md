## Goal

Make sign-in (and signup) route the user based on whether their profile is complete, instead of always going to `/`.

- Profile incomplete (`profiles.onboarded = false` or no profile row) → `/onboarding`
- Profile complete (`profiles.onboarded = true`) → `/dashboard`

`/dashboard` doesn't exist yet, so add a placeholder route (same style as the current `/onboarding` placeholder).

## Changes

### 1. New server function: `getPostAuthDestination`
File: `src/lib/profile.functions.ts` (new)

- `createServerFn` with `requireSupabaseAuth` middleware.
- Reads `profiles.onboarded` for `context.userId`.
- Returns `"/onboarding"` if no row or `onboarded === false`, else `"/dashboard"`.

### 2. `src/routes/auth.tsx`
- Replace the hard-coded `postAuthRedirectRef.current = "/"` / `"/onboarding"` logic with a single helper that:
  1. Calls `getPostAuthDestination` after a successful sign-in / verify.
  2. Navigates to the returned path.
- Update both flows:
  - `handleSignin` → after `signInWithPassword` succeeds, resolve destination and navigate.
  - `handleVerifySignup` → same (replaces the current hard-coded `/onboarding`).
- The `onAuthStateChange` listener keeps its current behavior as a fallback (defaults to `/` only if no explicit destination was set), but the explicit handlers above own the redirect so there's no flicker.
- Initial "already signed in" check in the `useEffect` also resolves destination instead of going to `/`.

### 3. `/onboarding` (existing placeholder)
- Change the "Continue to home" button to "Continue to dashboard" → `/dashboard`.
- Add a "Mark as complete" action (optional, see Question 1) that sets `profiles.onboarded = true` via a small server fn, then navigates to `/dashboard`. This lets the placeholder actually exit the onboarding loop during testing.

### 4. New placeholder route: `src/routes/dashboard.tsx`
- Top-level route (we don't have an `_authenticated` layout yet, so it self-guards by calling `supabase.auth.getUser()` client-side and redirecting to `/auth` if signed out — same pattern as the existing `/onboarding` page, for consistency).
- Simple placeholder card: "Dashboard — coming soon", with sign-out button. Same visual style as `/onboarding`.
- Sets `head()` meta with `noindex` since it's user-only.

## Technical notes

- `getPostAuthDestination` uses `requireSupabaseAuth`, so `attachSupabaseAuth` must already be wired in `src/start.ts` (it is — existing OTP fns use it).
- Profile row may not exist for users created via the custom OTP flow (no signup trigger guaranteed). The function treats "missing row" as "not onboarded" → `/onboarding`, which is the safe default.
- No DB migration needed — `profiles.onboarded` already exists.

## Question

1. For the placeholder `/onboarding` page, should I add a "Mark profile complete" button that flips `profiles.onboarded = true` so you can test the `/dashboard` redirect path? Or keep onboarding purely visual for now and leave the flag flip for when the real onboarding flow is built?