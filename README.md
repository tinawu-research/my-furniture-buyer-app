# Furniture Buyer App

A small web app for a furniture shop: anyone can browse a live product catalogue, and logging in tracks a budget and order history.

See [CLAUDE.md](./CLAUDE.md) for the full project summary, tech stack, and folder structure.

## One-time setup

1. **Create a free Supabase project** at [supabase.com](https://supabase.com).
2. **Run the database setup script:** open the SQL Editor in your Supabase project, paste in the contents of [supabase/schema.sql](./supabase/schema.sql), and run it. This creates the tables and security rules (no products yet — those come from step 5).
3. **Copy your project's API keys:** in the Supabase dashboard, go to Project Settings > API and copy the "Project URL", the "anon public" key, and the "service_role" secret key.
4. **Create your local env file:**
   ```bash
   cp .env.local.example .env.local
   ```
   Then fill in `.env.local`: your Supabase URL, anon key, and service role key, plus the `MONGODB_URI` given to you by the hackathon organizers.
5. **Install dependencies, then load the product catalogue:**
   ```bash
   npm install
   npm run sync-products
   ```
   This loads ~760 furniture products from the hackathon's MongoDB into your `products` table. Safe to re-run any time (e.g. if the source data changes) — it updates existing rows rather than duplicating them.

## Running the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the home page shows a live catalogue fetched directly from the hackathon's external Product Search API (`EXTERNAL_API_BASE_URL` in `.env.local`; no login or API key needed just to browse it). `/login` still lets you sign up and log in (every new user gets a $1000 budget, set in `supabase/schema.sql`), and `/orders` shows order history — but placing a *new* order isn't wired up on the home page right now, since it switched to the external API's product IDs. See [CLAUDE.md](./CLAUDE.md) for the full picture of how the two halves fit together.

`EXTERNAL_API_USER_ID` and `EXTERNAL_API_KEY` in `.env.local` aren't used by anything yet — they're only needed once account-specific calls (checking a balance, placing an order through the external API) get built.
