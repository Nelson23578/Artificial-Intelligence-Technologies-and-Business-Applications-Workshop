# GitHub Pages Deployment

This project is preconfigured for a GitHub repository named `ai-experience-lab`.

1. Run `npm install` locally first. This creates `package-lock.json`, which is required by the deployment workflow's `npm ci` step.
2. Run `npm run build` to verify the production build.
3. Create a PUBLIC GitHub repository named `ai-experience-lab` and do not initialize it with README, .gitignore, or license.
4. Push this project to the repository's `main` branch.
5. On GitHub, go to Settings > Pages > Build and deployment > Source and select `GitHub Actions`.
6. Push a commit or open Actions and run the deployment workflow manually.
7. Your site URL will be `https://YOUR_GITHUB_USERNAME.github.io/ai-experience-lab/`.

If you use another repository name, change `base` in `vite.config.js` to `'/YOUR_REPOSITORY_NAME/'` before deploying.
