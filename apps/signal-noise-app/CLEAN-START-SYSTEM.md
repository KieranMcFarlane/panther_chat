# Clean Start System

**Created**: 2025-11-10  
**Purpose**: Perform a clean run and filter `/tenders` page to only show RFPs from that run onwards

---

## 🎯 Overview

After extensive iteration and testing, this system allows you to:
1. **Perform a clean run** - Reset progress and run one fresh batch with all 3 strategies
2. **Set a cutoff date** - `/tenders` page will only show RFPs created after this date
3. **Start fresh** - All previous test/iteration RFPs are filtered out

---

## 🚀 Usage

### Step 1: Run Clean Start

```bash
cd apps/signal-noise-app
./run-clean-start.sh
```

This script will:
- ✅ Set `RFP_CLEAN_RUN_DATE` in `.env` **FIRST** (before running batches)
- ✅ Reset ABC progress (`rfp-progress-abc.json`)
- ✅ Run **ALL batches** with all 3 strategies using `run-rfp-batches-abc.sh --reset`
- ✅ Process all entities and save results to Supabase
- ✅ Create marker files (`.clean-run-date`, `.clean-run-date-simple`)

### Step 2: Restart Next.js Server

After running the clean start script, restart your Next.js server to load the new environment variable:

```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
```

### Step 3: Verify Filter

Visit `/tenders` page - it should now only show RFPs created on or after the clean run date.

---

## 🔧 How It Works

### 1. Clean Start Script (`run-clean-start.sh`)

- Sets `RFP_CLEAN_RUN_DATE` in `.env` **FIRST** (before running batches)
- Resets `rfp-progress-abc.json` to start fresh
- Runs `run-rfp-batches-abc.sh --reset` to process **ALL batches** with all 3 strategies
- All RFPs from this run are saved to Supabase
- Creates marker files for reference

### 2. API Filter (`src/app/api/tenders/route.ts`)

The `/api/tenders` route now checks for `RFP_CLEAN_RUN_DATE` environment variable:

```typescript
const cleanRunDate = process.env.RFP_CLEAN_RUN_DATE || process.env.NEXT_PUBLIC_RFP_CLEAN_RUN_DATE;
if (cleanRunDate) {
  query = query.gte('created_at', cleanRunDate);
}
```

This filters the Supabase query to only return RFPs where `created_at >= cleanRunDate`.

### 3. API Response

The API response includes a `clean_run_filter` object:

```json
{
  "clean_run_filter": {
    "applied": true,
    "cutoff_date": "2025-11-10T12:00:00Z",
    "message": "Only showing RFPs created on or after 2025-11-10T12:00:00Z"
  }
}
```

---

## 📋 Environment Variables

After running `run-clean-start.sh`, your `.env` file will contain:

```bash
# Clean run cutoff date - /tenders page will only show RFPs from this date onwards
# Format: ISO 8601 UTC timestamp (e.g., 2025-11-10T12:00:00Z)
RFP_CLEAN_RUN_DATE=2025-11-10T12:00:00Z
NEXT_PUBLIC_RFP_CLEAN_RUN_DATE=2025-11-10T12:00:00Z
RFP_CLEAN_RUN_DATE_SIMPLE=2025-11-10
```

---

## 🔍 Checking Current Filter

### Via API

```bash
curl http://localhost:3000/api/tenders?action=opportunities&limit=1 | jq '.clean_run_filter'
```

### Via Marker Files

```bash
cat .clean-run-date        # Full ISO timestamp
cat .clean-run-date-simple # Simple date (YYYY-MM-DD)
```

---

## 🛠️ Disabling the Filter

To temporarily disable the filter (show all RFPs):

1. **Comment out** the environment variable in `.env`:
   ```bash
   # RFP_CLEAN_RUN_DATE=2025-11-10T12:00:00Z
   ```

2. **Restart** your Next.js server

3. The API will log: `📅 No clean run date filter applied (RFP_CLEAN_RUN_DATE not set)`

---

## 📊 Example Output

After running `./run-clean-start.sh`:

```
🧹 Starting Clean Run
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Step 1: Setting cutoff date...
   Clean run date: 2025-11-10T12:05:30Z
   Simple date: 2025-11-10
✅ Cutoff date saved to .env

🔄 Step 2: Resetting progress files...
✅ Progress reset

🚀 Step 3: Running ALL batches with ABC orchestrator...
   This will process all entities with all 3 strategies
   Results will be saved to Supabase

[Batch processing runs...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Clean Run Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary:
   - Cutoff date: 2025-11-10
   - All batches processed with 3 strategies (Perplexity, LinkedIn, BrightData)
   - Results saved to Supabase
```

---

## ✅ Benefits

1. **Clean Dataset**: Only shows RFPs from the current working system
2. **No Noise**: Filters out all test/iteration RFPs
3. **Easy Reset**: Run `./run-clean-start.sh` anytime to start fresh
4. **Transparent**: API response shows when filter is applied
5. **Reversible**: Can disable filter by commenting out env var

---

## 🎯 Next Steps

After running clean start:

1. ✅ Verify `/tenders` page only shows new RFPs
2. ✅ Run full batch processing: `./run-rfp-batches-abc.sh`
3. ✅ Monitor results in `/tenders` page
4. ✅ All new RFPs will be from the clean run date onwards

---

**Note**: Remember to restart your Next.js server after running `run-clean-start.sh` to load the new environment variable!

