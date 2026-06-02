# Private Hosting Checklist

Use this checklist to ship a private, non-technical experience for your client.

## 1) Deploy frontend and backend

- Frontend: Vercel (recommended)
- Backend: Render, Railway, Fly.io, or a private VPS

## 2) Configure environment variables

Frontend env:

- `VITE_API_BASE_URL` = backend URL + `/api`
- `VITE_APP_ACCESS_TOKEN` = same secret token as backend

Backend env:

- `PORT` = deployment port
- `APP_ACCESS_TOKEN` = secret token

## 3) Protect access

- Keep URL private.
- Use a strong `APP_ACCESS_TOKEN`.
- Only share with trusted family members handling donation decisions.

## 4) Validate non-technical flow

After deploy, test this exact sequence:

1. Open dashboard and confirm rankings load.
2. Open one organization detail page and confirm score reasons render.
3. Add one new organization from the form.
4. Run "Update from online sources".
5. Confirm "Last refresh" shows timestamp and results.

## 5) Monthly maintenance

- Review top 10 recommendations.
- Run data refresh once.
- Fill any newly missing fields for important organizations.
- Confirm confidence score trends upward over time.
