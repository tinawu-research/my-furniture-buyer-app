# Furniture Buyer App

## What this is

A Day 1 hackathon web app for a furniture shop. The user (Tina) has no
coding background; Claude is doing all the implementation, so prioritize
working, simple, well-explained code over cleverness.

The app has two largely-separate systems sharing one UI:

- **Home page (`/`)** — a live listing (category/name/price) of 762
  furniture products, fetched on every request from an external "Product
  Search API" the hackathon organizers provide (a mock third-party
  service, separate from this app's own database — see "External Product
  Search API" below). Each product has a **Buy** button that places a real
  order through that same external API (`POST /orders`) and shows the
  resulting order ID, amount charged, and updated balance right there in
  the card. Logged-out visitors see "Log in to buy" instead. This whole
  page is a "Level 2: calling external APIs" exercise.
- **Login (`/login`)** — Supabase auth, unchanged.
- **Orders (`/orders`)** — shows your **real** balance and **real** order
  history, both fetched live from the external API (`GET /api/balance`,
  `GET /api/order-history`) — not Supabase data. This used to show the
  Supabase-backed order system's own history instead, which was confusing
  side-by-side with the real balance (the two were entirely different
  ledgers with no relationship to each other); now both halves of this
  page agree with each other and with what Buy actually did.

There's also an **older, separate, self-contained system** still present
but not linked from anywhere in the UI: `POST /api/orders` places orders
against a Supabase-backed copy of the same underlying furniture data (762
items, synced from MongoDB — see "Catalogue data source" below), checked
against a budget server-side (`profiles.budget`). It still works, but
nothing calls it anymore — the home page's original cart/"place order"
flow (which used to call it) was replaced by the Buy button above, which
calls the external API instead. Kept around rather than deleted since it's
a complete, tested feature that might be useful again later, but it's
effectively dead code today.

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
`/orders` is wrapped in `<RequireAuth>`, which redirects to `/login` if
there's no session. There is no server-side session/cookie handling (no
`proxy.js`, no `@supabase/ssr`) — that's a reasonable thing to add later if
this grows past the hackathon, but it's extra complexity this app doesn't
need yet.

The one place the server matters is placing an order: the client would send
its Supabase access token in the `Authorization` header to
`POST /api/orders`, and that route re-checks the budget and re-looks-up
product prices itself rather than trusting whatever the browser sent. This
is the one part of the app where "don't trust the client" actually
matters — still true and unit-tested, just currently unreachable from any
page (see "What this is" above).

## Data model (see `supabase/schema.sql`)

- `profiles` — one row per user, holds `budget` (defaults to 1000, set by a
  Postgres trigger on signup — see the `handle_new_user()` function for a
  hardcoded special case giving one specific email a much bigger starting
  budget). Row Level Security (RLS) restricts each user to their own row.
  Still used by `POST /api/orders`'s budget check; no longer shown in the
  UI anywhere, since `/orders` displays the external API's balance instead.
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

## External Product Search API (Level 2 — powers the home page)

A separate, organizer-run mock third-party API at `EXTERNAL_API_BASE_URL`
(currently `https://day1.training.cognitivo.com.au`) — not part of this
app's own infrastructure, and not the same thing as the Supabase
`products` table below (though it happens to serve the same underlying
762-item furniture dataset). Relevant endpoints:

- `GET /catalogue/search-index?category=&limit=&skip=` — no auth needed;
  what `src/app/page.js` calls. Returns `item_id`, `product_name`, `price`,
  `category`, `colours`, dimensions, `link` — **no image**. Deliberately not
  `GET /catalogue` (same data, but with every image embedded as base64 —
  the docs warn this can take 20+ seconds against the full catalogue).
- `GET /catalogue/{item_id}` / `GET /catalogue/{item_id}/image` — full
  detail / raw image bytes for one product. Not currently used anywhere.
- `GET /users/{user_id}` — needs `X-Api-Key` (must match the `user_id`,
  e.g. `u001`, being queried). What `GET /api/balance` calls, using
  `EXTERNAL_API_USER_ID`/`EXTERNAL_API_KEY`; `/orders/page.js` shows the
  result as "Balance."
- `POST /orders` — same auth. **The Day 1 Participant Guide's example body,
  `{ user_id, item_id, quantity }`, is wrong** — confirmed by testing
  directly against the live API. The real shape is
  `{ user_id, items: [{ item_id, quantity }] }` (an array, even for one
  item); the flat shape gets a 422 with no `item_id`/`quantity` fields at
  all. `POST /api/buy` sends the correct (real) shape. On success returns
  `order_id`, `items` (per-line `unit_price`/`line_total`), `total_price`,
  `remaining_balance` — the last two, plus `order_id`, get passed straight
  through to the Buy button, which shows all three inline; no separate call
  to `GET /api/balance` needed since the order response already includes
  the new balance.
- `GET /orders/{user_id}` — same auth. What `GET /api/order-history` calls;
  `/orders/page.js` renders the result as the order history list (each
  order's `items`, `total_amount`, `timestamp`).
- `GET /orders/{order_id}/invoice` — same auth. Not called from anywhere
  yet; would return a PDF (raw bytes, not JSON) if wired up.

`GET /api/balance`, `POST /api/buy`, and `GET /api/order-history`
(`src/app/api/{balance,buy,order-history}/route.js`) exist as their own
routes, not direct calls from client code, purely so `EXTERNAL_API_KEY`
stays server-side — the
pages/components calling them are Client Components (need `useAuth`), and
client code can't read non-`NEXT_PUBLIC_` env vars. All three first check
the caller has a valid Supabase session (mirroring `/api/orders`'s
pattern) before calling the external API — none of these calls are
actually per-Supabase-account (there's only one `EXTERNAL_API_USER_ID`
configured for this whole app), but there's no reason to let any of them
be hit by random unauthenticated requests either. `POST /api/buy` maps the external
API's error codes to plain-language messages: 402 → "Insufficient
balance...", 404 → "This item is no longer available.", 429 →
rate-limited (echoes back the `Retry-After` seconds if the API sent one).
Both `/api/buy` (a network failure reaching the external API, or a
malformed request body) and `BuyButton.js` (a network failure reaching our
own `/api/buy`) wrap their fetch calls in try/catch so a failure of either
kind always turns into a clean error message and a re-enabled Buy button —
never an unhandled exception. Verified the 402/404/429/200/network-down
paths against a throwaway local mock server (the real API can't be told to
fail in a specific way on request), then verified 200 and 404 for real
too, against a real account/order (see below) — 404's real body is
`{"detail": "No product with item_id '...'"}`, a plain string, but a real
422 (e.g. from a malformed request) comes back as `{"error": [{"type",
"loc", "msg", ...}, ...]}` — an *array* of objects, not a string.
`toErrorMessage()` in `api/buy/route.js` coerces any of these shapes
(string, array, arbitrary object) to a plain string before it ever reaches
`Response.json()` — passing an array/object straight into React as
`{error}` would genuinely crash the page ("Objects are not valid as a
React child"), so this isn't just tidiness.

**This app has real credentials configured** (`EXTERNAL_API_USER_ID`,
`EXTERNAL_API_KEY` in `.env.local` — Tina's own `cognitivo028` account).
Balance and Buy were both verified against the live API for real, not just
mocked: fetched the real balance ($5000 starting), bought the two
cheapest real items in the catalogue (a $1.20 "Knob" and a $2.00
"Cross-brace") through `/api/buy`, and confirmed the balance actually
dropped by the right amount each time ($5000 → $4998.80 → $4996.80).
Discovering the wrong request-body shape above only happened *because* of
this real test — the mock server (built from the docs) couldn't have
caught it, since it was mocking the documented shape, not the real one.

`src/app/page.js` is an **async Server Component** (no `"use client"`),
calling `fetch(..., { cache: "no-store" })` directly — required here:
without an explicit no-store (or some other dynamic API), Next.js will
statically prerender this page at *build* time, freezing the catalogue at
whatever the external API returned during `next build` instead of fetching
fresh data per request. Confirmed by checking the build output's route
list: `○ (Static)` vs `ƒ (Dynamic)`.

## Catalogue data source (Supabase's own copy — separate from the above)

`scripts/sync-products.mjs` (run via `npm run sync-products`) is a one-off
Node script — not part of the running app — that:

1. Connects to a MongoDB instance (`MONGODB_URI` env var; given out by the
   hackathon organizers, never hardcoded) and reads its `catalog`
   collection: 762 IKEA-style furniture documents (`product_name`,
   `price`, `category`, `colours`, `width`/`height`/`depth`,
   `image_url` + `image_mime_type` — the image as base64 text, not an
   actual URL despite the field name — `link`, `item_id`).
2. Uploads each product's image to the public `product-images` Storage
   bucket (20 concurrent uploads) and maps the document onto a `products`
   row (`item_id` -> `external_id`, `image_url` set to the resulting
   Storage URL, a short `description` synthesized from colours/dimensions
   since the source has no free-text description).
3. Writes to Supabase using the **service role key**
   (`SUPABASE_SERVICE_ROLE_KEY`, server-only, bypasses Row Level Security —
   deliberately not the anon key, since ordinary users/sessions should never
   be able to rewrite the catalogue), deletes any leftover rows without an
   `external_id` (old placeholder data), then upserts the real catalogue in
   batches of 100 keyed on `external_id` (re-running the script updates
   rather than duplicates).

This script talks to MongoDB only as a one-time import source — the running
app never connects to Mongo, only to Supabase.

**Why images live in Storage, not the `products` row:** the first version
of this script stored each image as base64 text directly in `image_url`.
That worked, but 762 products averaging ~120KB of image data each made a
`select *` on `products` — which the home page ran on every load, back
when it was Supabase-backed rather than the external API — slow and large
enough to hit Postgres's statement timeout (confirmed: it failed
consistently with `"canceling statement due to statement timeout"`).
Uploading images to Storage and keeping only a URL in the row fixed it —
the same query went from timing out to ~1.3s and ~342KB.

## Folder structure

```
my-furniture-buyer-app/
  supabase/schema.sql        # run once in the Supabase SQL editor
  scripts/sync-products.mjs  # one-off: loads products from MongoDB (npm run sync-products)
  .env.local.example         # template for Supabase + Mongo + external-API env vars
  src/
    app/
      page.js                 # homepage: live product listing + Buy button (Level 2, external API)
      login/page.js           # login / signup form
      orders/page.js          # real balance + real order history, both from the external API (requires login)
      api/orders/route.js     # POST: Supabase-backed order system; dead code, nothing calls it
      api/signup/route.js     # POST: creates a Supabase user already-confirmed
      api/balance/route.js    # GET: proxies GET /users/{id} on the external API
      api/buy/route.js        # POST: proxies POST /orders on the external API
      api/order-history/route.js  # GET: proxies GET /orders/{user_id} on the external API
      layout.js               # wraps everything in <AuthProvider> + <Navbar>
    components/
      Navbar.js
      BuyButton.js            # "Buy" button on each product card; calls /api/buy
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
