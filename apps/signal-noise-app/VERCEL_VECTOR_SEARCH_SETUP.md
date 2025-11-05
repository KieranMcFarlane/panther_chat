# Vector Search Setup for Vercel

## The Problem
Vector search is returning 0 results because either:
1. **Environment variables are missing** on Vercel
2. **No embeddings have been initialized** in Supabase

## Solution

### Step 1: Set Environment Variables on Vercel

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Select your project (`panther-chat`)
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```
OPENAI_API_KEY=sk-... (your OpenAI API key)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... (your Supabase service role key)
```

5. **Important**: Make sure these are set for **Production**, **Preview**, and **Development** environments
6. Click **Save** and **Redeploy** your project

### Step 2: Initialize Embeddings in Supabase

The vector search needs embeddings stored in Supabase. You have two options:

#### Option A: Run the initialization script locally (Recommended)

```bash
cd apps/signal-noise-app
npm run vector-search:init
```

This will:
- Fetch entities from Neo4j
- Generate embeddings using OpenAI
- Store them in Supabase's `entity_embeddings` table

#### Option B: Use the Supabase SQL Editor

1. Go to your Supabase Dashboard → **SQL Editor**
2. Run the schema file: `lib/supabase-vector-schema.sql`
3. Manually insert some test embeddings

### Step 3: Verify It's Working

After redeploying and initializing embeddings:

1. Open your Vercel deployment URL
2. Open the browser console (F12)
3. Try searching for "arsenal" or "football club"
4. Check the console for:
   - ✅ Success messages with results
   - ⚠️ Warning messages explaining what's missing

### Troubleshooting

**If you see "missing_openai_api_key":**
- Add `OPENAI_API_KEY` to Vercel environment variables
- Redeploy the project

**If you see "missing_supabase_config":**
- Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Vercel
- Redeploy the project

**If you see "no_results":**
- Run `npm run vector-search:init` to initialize embeddings
- Or check if the `entity_embeddings` table in Supabase has data:
  ```sql
  SELECT COUNT(*) FROM entity_embeddings;
  ```

**If the table is empty:**
- You need to initialize embeddings from your Neo4j database
- The initialization script will do this automatically

## Quick Check

Run this in your browser console on your Vercel deployment:

```javascript
fetch('/api/vector-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'arsenal', limit: 5 })
})
.then(r => r.json())
.then(data => {
  console.log('Results:', data.results);
  console.log('Note:', data.note);
  console.log('Error:', data.error);
  console.log('Help:', data.help);
});
```

This will show you exactly what's wrong.
