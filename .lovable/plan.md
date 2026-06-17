
Building all six items in one pass. Each piece is independent so I'll batch the work.

## 1. Settings / edit profile — `/settings`

New authenticated route with three cards:
- **Profile** — display name, bio (280), timezone, teach/learn skills, available days, session length. Saves via a new `updateMyProfile` server fn.
- **Account** — change password (`supabase.auth.updateUser({ password })` client-side after re-asking current password) and shows email (read-only).
- **Notifications** — toggles for email-on-new-message and email-on-booking-update. Stored on `profiles` as `email_notify_messages` and `email_notify_bookings`.

Add a "Settings" link to the app nav (replacing the duplicate "Profile" link, which currently points to /dashboard).

## 2. Avatar upload

- Create private storage bucket `avatars` with RLS: owner-write, public-read via a public URL.
  - Path convention: `{user_id}/avatar.{ext}`.
- Replace the onboarding "Upload coming soon" stub and add the same component on `/settings`. Uses `supabase.storage.from('avatars').upload(..., { upsert: true })`, then writes the public URL back into `profiles.avatar_url`.

(Going with a **public** bucket for simplicity — avatars are intended to be shown publicly on `/u/:username`. If workspace blocks public buckets I'll fall back to signed URLs.)

## 3. Edit listings

- New route `/listings/$id/edit` mirroring `/listings/new` but pre-filled, calling existing `updateListing` server fn (already supports all fields).
- Enable the disabled "Edit" button on `/listings/` and link it to the new route.

## 4. Real-time chat

Replace the 5s polling on the messages route with Supabase Realtime:
- Add `messages` and `message_threads` to the `supabase_realtime` publication.
- In `messages.tsx`, subscribe to `postgres_changes` on `messages` (filtered to threads I'm in via per-thread channel) inside a `useEffect`, invalidate the relevant React Query keys on insert. Drop the `refetchInterval`.
- Keep a light 30s fallback poll only on the threads list for unread counts.

## 5. In-app notifications

- New table `notifications` (`user_id`, `kind`, `title`, `body`, `link`, `read_at`).
- Inserts happen inside existing server fns:
  - `sendMessage` → notify the other thread participant.
  - `proposeSwap` → notify host.
  - `respondBooking` (accept/decline/complete/cancel) → notify the other party.
  - `submitReview` → notify reviewee.
- App-shell bell icon with unread badge, dropdown of recent items. Realtime subscription on `notifications` filtered to `user_id=eq.{me}` to live-update the badge and play a subtle toast.
- Routes: `notifications.functions.ts` (list, markRead, markAllRead).

## 6. Email notifications via Resend

Resend connector is already linked (`RESEND_API_KEY` present). New server helper `src/lib/email.server.ts` posts to the connector gateway. Sent fire-and-forget from the same server fns above, only when the recipient's `email_notify_*` toggle is on. Templates are minimal HTML branded as SwapStub with a deep link back to the app.

From address: `SwapStub <onboarding@resend.dev>` for now (since no verified domain is configured) — I'll note this and the user can swap it once they verify one.

## Technical details

- One migration: `notifications` table + grants + RLS, `email_notify_messages`/`email_notify_bookings` columns on profiles, `avatars` bucket policies on `storage.objects`, realtime publication additions.
- Avatars bucket created via `supabase--storage_create_bucket` (separate tool call).
- New files:
  - `src/lib/notifications.functions.ts`
  - `src/lib/email.server.ts`
  - `src/components/avatar-upload.tsx`
  - `src/components/notifications-bell.tsx`
  - `src/routes/settings.tsx`
  - `src/routes/listings.$id.edit.tsx`
- Edits:
  - `profile.functions.ts` (add `updateMyProfile`, `getMySettings`)
  - `messages.functions.ts` (insert notification + email on send)
  - `listings.functions.ts` (insert notification + email on propose)
  - `bookings.functions.ts` (insert notification + email on status change)
  - `reviews.functions.ts` (insert notification on review)
  - `app-shell.tsx` (add Settings link, mount NotificationsBell)
  - `messages.tsx` (swap polling for realtime)
  - `listings.index.tsx` (enable Edit button → link)
  - `onboarding.tsx` (real avatar upload)

Reply "go" and I'll build it.
