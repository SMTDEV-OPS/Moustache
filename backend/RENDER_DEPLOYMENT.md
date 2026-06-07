# Render Deployment Guide

## Configuration

The backend is configured to build and run in production mode on Render.

### Build Process
1. **Build Command**: `npm install && npm run build`
   - Installs dependencies
   - Compiles TypeScript to JavaScript in the `dist/` folder

2. **Start Command**: `npm start`
   - Runs the compiled JavaScript: `node dist/server.js`

### Environment Variables

Make sure to set these in your Render dashboard:

- `PORT` - Port number (Render sets this automatically, but defaults to 4000)
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `NODE_ENV` - Set to `production`
- `NODE_OPTIONS` - Set to `--max-old-space-size=4096` (increases memory limit)
- `FRONTEND_URL` - Your Netlify frontend URL for OAuth redirects (e.g. `https://your-app.netlify.app`). All `https://*.netlify.app` origins are allowed for CORS automatically.

### Render Dashboard Configuration

If using Render dashboard (not render.yaml):

1. **Branch**: `new_role_management` (not `main`)
2. **Root Directory**: `backend`
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm start`
5. **Environment**: `Node`

Set `FRONTEND_URL` to your Netlify site URL (e.g. `https://tubular-mooncake-84659c.netlify.app`) for OAuth redirects. CORS allows any `https://*.netlify.app` origin; use `ALLOWED_ORIGINS` for custom domains.

### Troubleshooting

If you get "JavaScript heap out of memory" errors:
- Ensure `NODE_OPTIONS=--max-old-space-size=4096` is set
- Verify Render is using `npm start` (not `npm run dev`)
- Check that the build completes successfully before starting

