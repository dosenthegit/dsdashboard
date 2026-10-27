# Applying changes to existing GitHub repository

This ZIP contains ONLY changed or added files, not the entire DSDashboard application. Clone the current full repository first:

```sh
git clone https://github.com/dosenthegit/dsdashboard.git
cd dsdashboard
```

Copy all files from this ZIP's `DSDashboard-weekly-update/` directory to matching paths in the clone, keeping the original `server.js`, `site/`, `defaults/`, `package.json` and existing Compose files. Check the README changes against the newest upstream README before overwriting it, because the README in this ZIP is based on an earlier saved project copy plus a new update section. You can instead copy just the appended `Automated weekly Docker rebuilds` section into your GitHub README.

Do not commit `.env`, live `site/config.json`, or `data/security.json`. Review with `git diff` before commit. Push to `main` and check GitHub Actions. The image update helper needs to be copied to the dashboard deployment directory before use.
