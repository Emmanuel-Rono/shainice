# Fieldnotes learning dashboard

A small learning dashboard for a first-year journalism student and her sibling. The curriculum comes from the supplied `edit2.xlsx`, including the earlier social-media/career month and the TED critical-thinking video. The workbook is the source for all 12 months, four weekly tasks, results, resources, review dates and weekly habits.

## Start locally

Use Node.js 22 or newer:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Local preview saves progress in this browser. Shared storage is enabled by Netlify deployment, not by the plain local preview server.

```bash
npm test
npm run build
```

## Deploy through Git to Netlify

1. Put this project in its own Git repository and push to GitHub, GitLab or Bitbucket. Do not commit `node_modules`, `dist`, `.env` or access codes.
2. In Netlify, import that repository. `netlify.toml` supplies the build command (`npm run build`), publish folder (`dist`), functions folder and Node.js version. Leave the base directory empty when this folder is the repository root.
3. Add **DASHBOARD_ACCESS_CODE** in Netlify environment variables, with **Functions** scope. Set a randomly generated value of at least 16 characters. To generate one locally: `node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"`.
4. Deploy or redeploy after adding the variable. Share the site URL and the access code privately with your sibling.
5. Both of you select **Connect shared space** and enter the same code. Choose Student or Sibling view. Each browser has a 12-hour signed session; reconnect after it expires.
6. Subsequent Git pushes rebuild and deploy automatically. Progress uses a site-wide Netlify Blobs store and remains across deployments. Do not delete the site or its `fieldnotes-learning` store if you want to keep the progress.

Netlify Functions and Blobs usage follows your Netlify plan and limits. No separate database account is required. Hosting and production storage were not deployed as part of this deliverable.

## How to support her

- **Weekly:** she ticks the tasks she actually completed, writes her own notes, and adds evidence. Review the work rather than asking for daily updates.
- **Monthly:** open Sibling reviews, discuss the 45-minute agenda, record the date, what she explained independently and one agreed action. Then mark the conversation complete.
- **Completion:** four weekly tasks + assigned learning + monthly result + a valid completed review = one completed month. Unticking a prerequisite updates progress.
- **Strengths:** save actual coursework and feedback. Compare enjoyment, quality, improvement and initiative. Month 7 identifies two promising areas; Month 9 chooses a main and supporting skill.
- **Opportunities:** track the organisation, pitch/application status, link and follow-up date. Add portfolio work she has permission to share.
- **Backups:** export a JSON backup monthly. Use Import to merge it into another browser. You can use backup exchange without enabling shared storage.

## Data and sharing

Local progress is stored in `localStorage` under `fieldnotes.learning.v1`. Shared progress is stored behind the Netlify API and an HttpOnly, Secure, SameSite cookie. The access code is never written to browser storage or the frontend bundle. Student/Sibling view is a navigation preference, not a separate permission system: both trusted people can edit all shared entries.

The public curriculum is visible to anyone with the URL. Progress is protected by the access code. A disconnected browser retains its local copy; use a trusted device. Changing the environment access code invalidates existing sessions. Each edit carries a timestamp; fields merge separately and conditional writes avoid lost edits across devices. A later edit to the same field wins. Deletions sync as tombstones. Keep device clocks accurate.

Local-first here means changes remain in a loaded browser tab if the connection drops. This project does not include a service worker that guarantees opening the entire site offline. Shared changes are pushed after editing and refreshed every minute while the page is visible. Network/session failures show a pending/local-save status. Export backups before clearing browser data.

Evidence uses links, not uploaded files. Backups contain all entered notes. Keep sensitive personal, source or classmate information out of the tracker. Sign-in is rate-limited through Netlify's function configuration.

## Design and resources

The screenshot informed the off-white surface, charcoal text, green progress ring and compact sans-serif typography. Fonts are system Arial/Helvetica, so there is no external font download. Main card headings are 18px; task descriptions are 12px. Exact original font identification is not possible from the screenshot alone. There are no animated transitions or autoplay videos.

The TED talk uses the official click-to-load embed, with a direct video link as fallback. Course platforms open in a new tab because sign-in pages and course sites often block embedding. There is exactly one learning resource per month; the ongoing faith-reading book is a separate habit. No additional course recommendations were added.

## Files

- `public/programme.json`: curriculum and resource links. Edit it to change the learning plan. Keep month IDs stable to retain progress.
- `public/app.js`, `state.js`, `styles.css`, `index.html`: UI, tracking logic and design.
- `server/api.mjs`: session authentication and shared-save implementation.
- `netlify/functions/`: deployable endpoints.
- `tests/`: state, authentication and concurrent-save checks.
- `scripts/`: static build and local preview.

Netlify implementation references:

- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/build/functions/api/
- https://docs.netlify.com/build/functions/configuration/

## Verification

The delivered project is checked with unit tests, desktop/mobile browser interaction tests and a static build. The shared API is tested with injected storage, including authentication and conditional-write conflicts. Live Netlify deployment, its platform rate limiting and persistent production Blobs storage still need verification after you deploy and set the environment variable. Browser video playback depends on the external provider and the viewer's connection.
