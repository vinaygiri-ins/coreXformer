# Netlify Setup For CoreXformer

This site is ready to be hosted permanently on Netlify.

## Best recommendation

Use a permanent Netlify site under your own account and choose a free subdomain that matches the brand.

Recommended order to try:

1. `corexformer.netlify.app`
2. `corextransformer.netlify.app`
3. `corexformer-learning.netlify.app`
4. `corexformer-india.netlify.app`

`CoreXformer` is the strongest match with the current brand, so it is the best first choice if available.

## What to do now

1. Claim the latest anonymous deploy in your Netlify account.
2. Open the site settings in Netlify.
3. Change the site name to the branded subdomain you want.
4. Confirm the new `.netlify.app` address.

## How to update the site later

### Option 1: Manual updates

Good for now if you want the simplest workflow.

1. Edit the files in this folder.
2. Go to Netlify dashboard.
3. Open your site.
4. Upload a new deploy from this folder.

### Option 2: Git-based auto deploy

Best long-term option.

1. Put this project in a dedicated GitHub repository.
2. Connect that repository to Netlify.
3. Every time you push changes, Netlify redeploys automatically.

## Current project folder

`/Users/vinaygiri/Documents/New project/Experiential learning /rangpur-learning-website`

## Main files

- `index.html`
- `styles.css`
- `script.js`
- `concept.html`
- `approach.html`
- `who-it-is-for.html`
- `how-it-works.html`
- `why-it-matters.html`
- `thank-you.html`

## Current Netlify config

The site already has a working `netlify.toml`:

```toml
[build]
  publish = "."
```

## Suggested next step after claiming the site

Add a custom domain later if you want something like:

- `corexformer.com`
- `corexformer.in`

But the free `.netlify.app` subdomain is enough to launch and keep updating the site.
