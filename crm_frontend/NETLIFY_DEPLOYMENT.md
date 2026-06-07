# Netlify Deployment Guide

## Environment Variables

You **MUST** set the following environment variable in your Netlify dashboard:

### Required Environment Variable

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add a new variable:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://moustachecrm.onrender.com`
   - **Scopes**: Select "All scopes" (or specific scopes as needed)

### Deploy Branch

In **Site settings** → **Build & deploy** → **Continuous deployment**, set:

- **Branch to deploy**: `new_role_management` (not `main`)

### Build Settings

The `netlify.toml` file is already configured with:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 22

### After Setting Environment Variables

1. **Redeploy** your site:
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Clear cache and deploy site**

2. **Verify** the deployment:
   - Check the build logs to ensure `VITE_API_BASE_URL` is being used
   - Open browser console and check `API_BASE_URL` value
   - Test API calls in the Network tab

### Troubleshooting

**If the network tab is blank:**
- Check browser console for errors
- Verify `VITE_API_BASE_URL` is set correctly in Netlify
- Ensure the backend CORS allows your Netlify domain
- Check if the build completed successfully

**If API calls fail:**
- Verify backend is running at `https://moustachecrm.onrender.com`
- Check CORS settings in backend (should allow your Netlify domain)
- Check browser console for CORS errors

### CORS Configuration

The backend uses an explicit CORS allowlist in `backend/src/config/cors.ts`. Set `FRONTEND_URL` on Render to your Netlify URL, or add it to `ALLOWED_ORIGINS` (comma-separated).

