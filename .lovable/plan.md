
# SwapStub — Page-by-Page Build Plan

Build the torn-ticket-themed Skill-Swap Marketplace one page at a time. After each page is delivered, you test it in the preview; once you approve, I move to the next page. No hardcoded/mock data anywhere — every page reads from Lovable Cloud. Every screen is fully responsive (mobile → tablet → desktop). Auth uses **6-digit email OTP** for both signup verification and password reset.

## Global foundations (built once, before Page 1)

These are not user-visible pages but are needed before any page works:

- Design tokens in `src/styles.css`: kraft tan `#EDE6D6`, ink `#2E2B26`, ochre `#C68A2E`, teal `#3B6F5E`, brick `#9C5B3C`.
- Fonts via `<link>` in `__root.tsx`: slab serif display (Alfa Slab One), humanist sans (Work Sans), mono (JetBrains Mono).
- `<TicketStub>` primitive (SVG perforation, two halves), `<PerforatedDivider>`, `<TicketCode>` mono badge.
- Lovable Cloud enabled; full database schema migrated (profiles, categories, listings, bookings, reviews, message_threads, messages, user_roles + has_role); RLS + GRANTs; auto-profile trigger; ticket-code generator.
- Email infrastructure provisioned (domain, queue, cron) for OTP and notification emails.
- Responsive shell: top nav on desktop/tablet, bottom tab bar on mobile.

## Build order (one page per round)

After each round I stop, you test, then say "next" (or give feedback first).

### Page 1 — Landing (`/`)
Hero with an oversized animated torn ticket ("I can teach ___ / I want to learn ___"), how-it-works (3 perforated steps), live counters pulled from the DB (active listings, swaps completed, members), featured categories pulled from the `categories` table, footer. CTA: Browse / Sign up. **No hardcoded copy data** — counters and categories query the DB.

### Page 2 — Auth (`/auth`)
Sign up + Sign in tabs. **Email + password with 6-digit OTP verification**:
- Sign up → account created → OTP code emailed → user enters code → verified.
- Sign in → password.
- "Forgot password?" → email entered → OTP emailed → user enters code → sets new password.
- Resend OTP with cooldown; rate-limited; OTP expires in 10 min.
Branded OTP email template using the ticket motif. Fully responsive.

### Page 3 — Onboarding (`/onboarding`)
First-login wizard (3 perforated steps): username + display name → avatar upload (Lovable Storage) + bio + timezone → pick categories you can teach / want to learn. Writes to `profiles`. Skippable steps allowed but required before creating a listing.

### Page 4 — Browse (`/browse`)
Search bar + filter rail (offered category, wanted category, min rating, availability day). Results as torn-ticket cards in a responsive grid. Filters live in the URL (`validateSearch`). Pagination / infinite scroll. All data from `listings` + joins; zero placeholders.

### Page 5 — Listing detail (`/listing/$id`)
Full-size ticket with offered/wanted halves, host profile snippet, host's rating, ticket code, availability, "Request a swap" CTA opening a scheduling modal.

### Page 6 — Public profile (`/u/$username`)
Avatar, bio, skills offered, skills wanted, listings, reviews, average rating. All from DB.

### Page 7 — Create / edit listing (`/_authenticated/listings/new` + `/edit`)
Form with two columns mirroring the ticket halves. Validation via Zod. Generates ticket code on insert.

### Page 8 — Dashboard (`/_authenticated/dashboard`)
My listings, my upcoming bookings, pending requests, recent reviews, and a "Perfect swaps for you" matching strip (computed server-side: two-way > one-way match).

### Page 9 — Bookings inbox + detail (`/_authenticated/bookings`, `/$id`)
Pending / Upcoming / Past tabs. Accept / decline / cancel / mark completed. Booking detail shows the thread and (once status = `completed`) unlocks the review form.

### Page 10 — Reviews
Inline on booking detail page. Insert blocked by RLS unless `booking.status = completed` and reviewer was a participant. Average rating recomputed for display.

### Page 11 — Messages (`/_authenticated/messages`, `/$threadId`)
Realtime chat (Supabase channel). Thread auto-created on booking request or two-way match. Unread badge in nav.

### Page 12 — Profile settings (`/_authenticated/profile`)
Edit display name, bio, avatar, timezone, skills, password change (via OTP), sign out.

### Page 13 — Email notifications
React Email templates for: OTP verify, OTP reset, booking request, accept/decline, 24h reminder (pg_cron), new review. Each branded with the ticket motif.

### Page 14 — Launch polish
SEO `head()` per route, OG image (torn ticket), favicon, 404 page (torn/ripped ticket), error boundaries, accessibility pass, final responsive audit, publish.

## Ground rules for every page

- **No hardcoded data.** All content from Lovable Cloud (DB / storage / auth). Empty states use real empty queries.
- **Responsive.** Each page is verified at mobile (375), tablet (768), and desktop (1280+).
- **Auth-gated routes** live under `_authenticated/` (managed gate).
- **One page per round.** I deliver, you test, you approve, I continue.

Starting with **Page 1 (Landing)** as soon as you approve this plan.
