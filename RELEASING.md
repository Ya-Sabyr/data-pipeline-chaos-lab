# Releasing solana-chaoslab

This is a maintainer reference. Drop into the GH UI is simpler — see the `Release` workflow.

## One-time setup

1. Create an npm account at https://www.npmjs.com/signup. The unscoped name `solana-chaoslab` must be available; if it's already taken, switch to a scope (e.g. `@ya-sabyr/solana-chaoslab`) by editing `package.json`.
2. Generate an **automation** access token (Account -> Access Tokens -> Generate New Token -> Automation). This is the kind that bypasses 2FA for CI.
3. Add the token to GitHub repo secrets as `NPM_TOKEN`:
   ```
   gh secret set NPM_TOKEN --body 'npm_xxx...' --repo Ya-Sabyr/data-pipeline-chaos-lab
   ```
4. Confirm the repo's Actions settings allow workflows to publish (Settings -> Actions -> General -> Workflow permissions -> "Read and write" + "Allow GitHub Actions to create and approve PRs").

## Cutting a release

1. Update `CHANGELOG.md`: move `[Unreleased]` items into a new dated section.
2. Bump the version:
   ```bash
   npm version patch    # 0.1.0 -> 0.1.1, also creates a v0.1.1 tag
   # or: npm version minor / major / 0.2.0
   ```
   `npm version` updates `package.json`, commits the change, and creates a matching `v<version>` git tag.
3. Push the commit and the tag:
   ```bash
   git push origin main --follow-tags
   ```
4. The `Release` workflow fires on the tag, runs typecheck + build + tests, publishes to npm with provenance, and creates a GitHub Release with auto-generated notes.

## Verifying the release

After the workflow completes:

```bash
npm view solana-chaoslab version          # should match the tag
npx solana-chaoslab@latest --version      # should match the tag
```

The npm package page will show a "Built and signed on GitHub Actions" provenance badge.

## Pre-releases

Tags containing a hyphen (e.g. `v0.2.0-rc.1`) are auto-marked as pre-releases on GitHub. To publish to a non-`latest` npm tag, run `npm version 0.2.0-rc.1` then push, and edit the workflow's `npm publish` step to add `--tag next` if you want the dist-tag to be `next` rather than `latest`. (V0 ships without this — add it when needed.)

## Yanking

If a release is broken:

```bash
npm deprecate solana-chaoslab@<version> "This version is broken; use <next>."
```

Do NOT `npm unpublish` after 24 hours — it breaks anyone who installed it. Deprecate, ship a fix, move on.
