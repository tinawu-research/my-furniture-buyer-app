# Furniture Buyer App

A small web app where a logged-in user can browse a furniture catalogue and place orders against a budget.

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

Open [http://localhost:3000](http://localhost:3000) — this is the product catalogue, visible to anyone. Sign up with any email/password on the `/login` page (Supabase will send a confirmation email unless you disable that in Authentication > Providers > Email in the Supabase dashboard — handy to turn off for a quick demo) to unlock placing orders.

Every new user starts with a $1000 budget (set in `supabase/schema.sql`, table `profiles`).
