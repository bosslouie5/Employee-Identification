# Employees Identification

A modern employee lookup dashboard built with React, Vite, and a Node.js backend for Excel upload and employee data sync.

## Recommended deployment
For the best full deployment experience, use Render. It supports Node.js apps and can serve your frontend and backend together.

### Best host: Render
1. Create a GitHub repository and push the current project.
2. Sign in to Render at https://render.com.
3. Click **New** → **Web Service**.
4. Connect your GitHub account and select the repository.
5. Configure the service:
   - **Name**: `employees-identification`
   - **Branch**: `main` or your branch
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
6. Deploy the service.

In Render, set the site name to `Employees Identification` for a clean public display.

## Local setup and testing
```bash
npm install
npm run build
npm run start
```
Open `http://localhost:4000` and verify the app works.

## Alternative hosts
- **Railway**: fast deployment for Node.js apps, good if you already have an account.
- **Fly.io**: great for low-latency hosting.
- **Vercel / Netlify**: use only if you want static hosting and do not need the backend upload/API.

## Notes
- This project includes a backend server in `server/server.js`.
- `npm start` runs the production server after building the app.
- If you only deploy the static `dist/` folder, the upload API and live `/api/employees` endpoint will not work.

## Project structure
- `src/` — React frontend source
- `server/` — Node.js API server
- `dist/` — production build output

## Naming
The app name should be set as **Employees Identification** in your chosen hosting platform.
