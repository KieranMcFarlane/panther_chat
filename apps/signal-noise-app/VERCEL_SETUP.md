# Vercel Root Directory Configuration

## How to Change the Root Directory in Vercel

Since this is a monorepo and your Next.js app is in `apps/signal-noise-app`, you need to configure Vercel to use that directory as the root.

### Steps:

1. **Go to your Vercel Dashboard**
   - Navigate to: https://vercel.com/dashboard
   - Select your project (`panther-chat`)

2. **Open Project Settings**
   - Click on **Settings** tab in the top navigation
   - Or go directly to: https://vercel.com/YOUR_ACCOUNT/YOUR_PROJECT/settings

3. **Navigate to Build and Deployment**
   - Click on **Build and Deployment** in the left sidebar (NOT "General")
   - This is where the Root Directory setting is located

4. **Configure Root Directory**
   - Scroll down to find **Root Directory** section
   - Click **Edit** or **Override**

4. **Set the Root Directory**
   - Enter: `apps/signal-noise-app`
   - Click **Save**

5. **Redeploy**
   - Go to the **Deployments** tab
   - Click **•••** (three dots) on the latest deployment
   - Select **Redeploy**

### Alternative: Using vercel.json at Repository Root

If you prefer to configure it via code, you can also move the `vercel.json` to the repository root with this configuration:

```json
{
  "buildCommand": "cd apps/signal-noise-app && npm run build",
  "outputDirectory": "apps/signal-noise-app/.next",
  "installCommand": "cd apps/signal-noise-app && npm install"
}
```

However, **the recommended approach is to use Vercel's dashboard setting** as shown above.

### Verification

After setting the root directory, verify it's working by:
1. Checking that the build logs show it's running from `apps/signal-noise-app`
2. The deployment should complete successfully
3. Your app should be accessible at your Vercel URL
