# Furniture Buyer App

## What this is

A Day 1 hackathon web app for a furniture shop. Anyone can browse the
product catalogue on the home page; logging in lets a user place orders,
each checked against that user's budget so they can't overspend. The user
(Tina) has no coding background; Claude is doing all the implementation, so
prioritize working, simple, well-explained code over cleverness.

Products are real furniture data (762 items) loaded from a MongoDB instance
provided for the hackathon — see "Catalogue data source" below.

## Tech stack (and why)

- **Next.js (App Router, JavaScript, `src/` dir)** — one project for both the
  pages the user sees and the server-side logic (API routes), instead of
  juggling a separate frontend and backend.
- **JavaScript, not TypeScript** — one less layer of strictness for a
  beginner-owned project.
- **Tailwind CSS** — styling via utility classes in JSX, no separate CSS
  files to maintain.
- **Supabase** — hosted Postgres database + built-in authentication (signup,
  login, sessions). Avoids hand-rolling password security. Also gives a
  spreadsheet-like dashboard for viewing/editing data directly.
- **Vercel** (not set up yet) — natural next step for free hosting when it's
  time to deploy; made by the same team as Next.js.

## Important: this Next.js version has breaking changes

This project was scaffolded with **Next.js 16.2.12**, which is newer than
much of the training data behind AI coding assistants. See `AGENTS.md` for
the full warning. Concrete things that differ from "classic" Next.js
tutorials/knowledge:

- `params` and `searchParams` in `page`/`layout`/`route` files are now
  **Promises** — must be `await`ed (or unwrapped with React's `use()` in
  Client Components). This project doesn't currently use dynamic route
  segments, so it hasn't come up yet, but it will the moment someone adds
  e.g. `app/products/[id]/page.js`.
- Route handlers (`app/api/.../route.js`) default to **dynamic** (not
  cached) for all HTTP methods now — no more surprise stale `GET` responses.
- Middleware is renamed: it's `proxy.js` (or `src/proxy.js`), not
  `middleware.js`.
- `.env*` files always live at the **project root**, even though the app
  code lives under `src/`.
- Before writing anything that isn't covered above, check
  `node_modules/next/dist/docs/01-app/` for the current API rather than
  relying on prior knowledge of Next.js.

## Auth model (deliberately simple for Day 1)

Auth is **client-side only** via the Supabase JS SDK
(`supabase.auth.signInWithPassword` for login), with the session cached in
the browser (localStorage) and shared through `src/lib/AuthContext.js`.

Sign-up does not use `supabase.auth.signUp()` directly. It goes through
`POST /api/signup`, a server route that calls
`supabase.auth.admin.createUser({ ..., email_confirm: true })` with the
service role key, creating the account already confirmed — then the client
immediately calls `signInWithPassword`. This sidesteps Supabase's
confirmation-email flow (and its low free-tier send-rate limit, which broke
signup entirely during testing) — reasonable for a hackathon demo where
verifying real email ownership doesn't matter; a production version would
use real email confirmation instead.
The home page is public (anyone can browse products); only `/orders` is
wrapped in `<RequireAuth>`, which redirects to `/login` if there's no
session — the home page instead swaps its "place order" button for a
"log in to order" link when there's no user. There is no server-side
session/cookie handling
(no `proxy.js`, no `@supabase/ssr`) — that's a reasonable thing to add later
if this grows past the hackathon, but it's extra complexity this app doesn't
need yet.

The one place the server matters is placing an order: the client sends its
Supabase access token in the `Authorization` header to
`POST /api/orders`, and that route re-checks the budget and re-looks-up
product prices itself rather than trusting whatever the browser sent. This
is the one part of the app where "don't trust the client" actually matters.
The home page also disables the "Place order" button and shows an inline
warning as soon as the cart exceeds the remaining budget, so the common
case is caught before a request is even made — but that's a UX nicety, not
the actual enforcement.

## Data model (see `supabase/schema.sql`)

- `profiles` — one row per user, holds `budget` (defaults to 1000, set by a
  Postgres trigger on signup — see the `handle_new_user()` function for a
  hardcoded special case giving one specific email a much bigger starting
  budget). Row Level Security (RLS) restricts each user to their own row.
- `products` — shop catalogue, readable by anyone (no login required to
  browse). Loaded from MongoDB by `scripts/sync-products.mjs`; see below.
- `orders` — one row per placed order (`user_id`, `total`). RLS restricts
  reads/writes to the owning user.
- `order_items` — line items per order (`product_id`, `quantity`, `price`
  captured at order time). RLS is enforced via the parent order's
  `user_id`.

"Remaining budget" is always computed on the fly as
`profiles.budget - sum(orders.total for that user)` — nothing decrements a
stored balance, which avoids concurrency/rollback headaches.

## Catalogue data source

`scripts/sync-products.mjs` (run via `npm run sync-products`) is a one-off
Node script — not part of the running app — that:

1. Connects to a MongoDB instance (`MONGODB_URI` env var; given out by the
   hackathon organizers, never hardcoded) and reads its `catalog`
   collection: 762 IKEA-style furniture documents (`product_name`,
   `price`, `category`, `colours`, `width`/`height`/`depth`,
   `image_url` + `image_mime_type` — the image as base64 text, not an
   actual URL despite the field name — `link`, `item_id`).
2. Maps each document onto a `products` row (`item_id` -> `external_id`,
   `image_url`/`image_mime_type` combined into one `data:` URI so
   `<img src>` needs no special handling, a short `description` synthesized
   from colours/dimensions since the source has no free-text description).
3. Writes to Supabase using the **service role key**
   (`SUPABASE_SERVICE_ROLE_KEY`, server-only, bypasses Row Level Security —
   deliberately not the anon key, since ordinary users/sessions should never
   be able to rewrite the catalogue), deletes any leftover rows without an
   `external_id` (old placeholder data), then upserts the real catalogue in
   batches of 25 keyed on `external_id` (re-running the script updates
   rather than duplicates).

This script talks to MongoDB only as a one-time import source — the running
app never connects to Mongo, only to Supabase.

## Folder structure

```
my-furniture-buyer-app/
  supabase/schema.sql        # run once in the Supabase SQL editor
  scripts/sync-products.mjs  # one-off: loads products from MongoDB (npm run sync-products)
  .env.local.example         # template for Supabase + Mongo env vars
  src/
    app/
      page.js                 # homepage: public product catalogue, cart, place order
      login/page.js           # login / signup form
      orders/page.js          # past orders + budget tracker (requires login)
      api/orders/route.js     # POST: server-side budget check + order insert
      layout.js               # wraps everything in <AuthProvider> + <Navbar>
    components/
      Navbar.js
      ProductCard.js
      BudgetTracker.js
      RequireAuth.js          # redirects to /login if not authenticated
    lib/
      supabaseClient.js       # the one Supabase client instance
      AuthContext.js          # React context exposing { user, session, signOut }
```

## Running it

See [README.md](./README.md) for the one-time Supabase setup, then
`npm run dev`.

## Conventions

- Plain JavaScript everywhere (no `.ts`/`.tsx`).
- Client-interactive files start with `"use client"`.
- Styling via Tailwind utility classes, not separate CSS files.
- Keep comments rare — only for non-obvious constraints (e.g. why the
  server re-validates budget/prices), not for restating what the code does.
