# Employees Identification

A premium employee lookup dashboard with fast search, admin Excel sync, QR access tokens, and a polished modern interface.

## Publish-ready setup
This repository is now configured for easy local setup and GitHub Pages deployment.

### Local install
```bash
npm run setup
npm run dev
```
Open the URL shown by Vite to preview the app locally.

### Build for production
```bash
npm run build
```

### Publish to GitHub Pages
This project can publish the frontend automatically to GitHub Pages using the workflow in `.github/workflows/gh-pages.yml`.

To publish manually from your machine:
```bash
npm run deploy
```

> Note: GitHub Pages hosts the frontend only. The `/api` endpoints require a separate backend host for full upload and sync functionality.

## Full backend deployment
For a complete deployment with the Node.js backend, use Render, Railway, or any service that supports Node.

Recommended Render setup:
1. Push the repository to GitHub.
2. Create a new Web Service in Render.
3. Set the branch to `main`.
4. Set the build command to `npm install && npm run build`.
5. Set the start command to `npm start`.

## Production preview
After deployment, the app should render the static dashboard and fallback to sample employee data if the backend is not available.

## Project structure
- `src/` — React frontend source
- `server/` — Node.js API server
- `dist/` — production build output
- `.github/workflows/gh-pages.yml` — automatic frontend deployment

## Notes
- `npm start` builds the app and starts the backend server locally.
- `npm run deploy` publishes the built `dist` folder to GitHub Pages.
- The app now uses `base: './'` in Vite so static deployment works correctly from GitHub Pages.
