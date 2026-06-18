This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

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

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase Keep-Alive Workflow

To prevent the Supabase database from pausing due to inactivity (which occurs automatically on the free tier after 7 days of no database activity), we have set up a lightweight GitHub Actions workflow.

The workflow runs on a cron schedule every 3 days and performs a `curl` request to the Supabase REST API `exercises` endpoint to register activity.

### Setting Up Repository Secrets

To enable the workflow, you must add your Supabase credentials as GitHub Repository Secrets:

1. Open your repository on GitHub.
2. Navigate to **Settings** (tab at the top of the repository page).
3. In the left sidebar, click on **Secrets and variables** and select **Actions**.
4. Click the **New repository secret** button.
5. Add the following secrets:
   - **`SUPABASE_URL`**: Your project's API URL (e.g., `https://your-project-id.supabase.co`). You can find this in your Supabase Dashboard under **Project Settings > API > Project URL**.
   - **`SUPABASE_ANON_KEY`**: Your project's anonymous public API key. You can find this in your Supabase Dashboard under **Project Settings > API > Project API keys > anon (public)**.
6. Click **Add secret** to save.

The workflow is located at `.github/workflows/supabase-keepalive.yml` and will run automatically every 3 days. You can also trigger it manually from the **Actions** tab of your repository on GitHub by selecting the **Supabase Keep-Alive** workflow and clicking **Run workflow**.
