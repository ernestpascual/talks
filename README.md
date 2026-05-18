This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Routes & features

| Route | File | Description |
|-------|------|-------------|
| `/admin` | `app/admin/` | Password-protected admin area (client-side auth via `localStorage`) |
| `/talk` | `app/talk/page.tsx` | Talk page (placeholder content for now) |
| `/experience` | `app/experience/page.tsx` | Experience page (placeholder content for now) |

### Admin (`/admin`)

- Sign in with a fixed password (see [Changing the admin password](#changing-the-admin-password) below).
- Session is stored in `localStorage` under the key `admin-auth`.
- Sessions expire **7 days** after login; you must sign in again after that.
- Use the **Log out** button on the admin page, or call `logout()` from `lib/admin-auth.ts`.

Relevant files:

- `lib/admin-config.ts` — admin password constant
- `lib/admin-auth.ts` — `login()`, `logout()`, `isAuthenticated()`
- `app/admin/AdminPage.tsx` — login form and protected UI

**Note:** Admin protection is client-side only. It is suitable for casual access control on a personal site, not for sensitive data.

### Talk & Experience

Placeholder copy lives in each route’s `page.tsx`. Edit those files to update the content.

## Changing the admin password

1. Open `lib/admin-config.ts`.
2. Change the value of `ADMIN_PASSWORD`:

```ts
export const ADMIN_PASSWORD = "your-new-password";
```

3. Save the file and restart the dev server if it is running.
4. Anyone already signed in keeps their session until it expires (7 days) or they log out. After a password change, old sessions still work until expiry—use **Log out** or clear `admin-auth` in browser `localStorage` if you need to force re-login immediately.

Default password before you change it: `change-me`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
