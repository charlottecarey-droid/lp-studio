# Dandy Meta Quest Setup SOP

Source for the six-page setup guide the Lab Tour in a Box page links to
(`/docs/dandy-meta-quest-setup-sop.pdf`, served from
`artifacts/lp-studio/public/docs/`). Same cover/format as the original
"Meet Dandy Meta Quest Upload" SOP.

Edit `dandy-meta-quest-setup-sop.html`, then re-render the PDF with the
repo's Playwright Chromium (no extra install):

```bash
node docs/sop/render.cjs "$PWD/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright" docs/sop/dandy-meta-quest-setup-sop.html artifacts/lp-studio/public/docs/dandy-meta-quest-setup-sop.pdf
```

Step wording follows Meta's help center as of October 2026
(setup: meta.com/help/quest/10004693912934783, store installs:
meta.com/help/quest/202382494824837, boundary: meta.com/help/quest/463504908043519,
charging: meta.com/help/quest/3482884435359892, pins and codes:
meta.com/help/quest/1396767491334420).
