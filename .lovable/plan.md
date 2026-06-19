## Problem

In-app notifications and emails never fire. Verified: the `notifications` table has 0 rows, even though the message/booking/review flows have been used. Cause: each call site fires the notification with `void notify...(...)` and immediately returns from the handler. On the serverless Worker runtime, returning from the handler terminates pending async work — the `INSERT` into `notifications` and the Resend `fetch` are killed before they run.

Affected sites:
- `src/lib/messages.functions.ts` → `sendMessage` (line 183)
- `src/lib/bookings.functions.ts` → booking event notify (line 156)
- `src/lib/reviews.functions.ts` → review notify (line 40)

## Fix

1. **Await all notify calls** instead of `void`-ing them. Keep them inside the existing `try/catch` so a notify/email failure still doesn't fail the user's action (message send, booking change, review submit). This guarantees the DB insert + Resend POST complete before the Worker returns.

2. **Tighten `notify.server.ts`** so email errors don't break in-app notifications:
   - Wrap each step (`createNotification`, `getRecipient`, `sendEmail`) so a failure in one is logged but doesn't throw past the caller.

3. **Sanity check the email path**:
   - `RESEND_API_KEY` and `LOVABLE_API_KEY` are present (confirmed in secrets).
   - The `FROM` address is `onboarding@resend.dev` — fine for testing, but Resend will only deliver to the verified account owner's email until a custom domain is set up. Note this in the closing message so the user isn't surprised when emails to other addresses don't arrive.

4. **No schema changes**, no new files, no UI changes — just await three call sites and harden one helper file.

## Verification

After the edit:
- Send a test message → check `select count(*) from notifications` returns ≥1.
- Confirm the bell in the app shell shows an unread badge.
- Check server-function logs for any `[email] send failed` lines if the email doesn't arrive (likely Resend sandbox restriction, not a code bug).