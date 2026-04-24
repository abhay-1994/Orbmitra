# Contributing to OrbMitra

Thanks for wanting to help improve OrbMitra.

## Getting Started

1. Copy `backend/.env.example` to `backend/.env`.
2. Fill in your local secrets and database settings.
3. Run `npm install` at the repo root.
4. Start the backend with `npm start`.
5. Start the frontend with `npm run frontend`.

## Development Guidelines

- Keep changes focused and easy to review.
- Do not commit secrets, tokens, or generated data files.
- Follow the existing code style in each file.
- Prefer secure defaults when changing auth, cookies, CORS, or database access.

## Before Opening a Pull Request

- Verify the app still starts cleanly.
- Check for obvious syntax issues with `node --check` on touched backend files.
- Update documentation if behavior changes.
- Include screenshots for UI work when relevant.

## Security Fixes

If your change touches login, sessions, credentials, or admin routes, please mention the risk you addressed in the pull request description.
