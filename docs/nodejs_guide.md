# 🟢 The NodeJS & NPM Crash Course

This guide explains the fundamental differences between how Node.js is utilized for the Frontend (React/Vite) versus the Backend (AWS Lambdas), and demystifies the command-line tools we use every day.

---

## 1. What is `node_modules`?

Whenever you see a folder named `node_modules`, it is simply a **giant storage pantry** where third-party code lives.

When you run `npm install`, your computer reaches out to the internet, downloads all the libraries your project needs to function (like React, AWS SDKs, or testing tools), and dumps them into this folder.

**The Golden Rules of `node_modules`:**

1. **Never edit it:** It is 100% managed by NPM. If you delete it, running `npm install` brings it right back.
2. **It is massive:** It can easily contain 30,000+ files and consume hundreds of megabytes.
3. **Never put it on GitHub:** Because it is so massive and auto-generated, we explicitly add `node_modules/` to our `.gitignore` file.

---

## 2. Frontend vs Backend Dependency Rules

Cloud architecture treats frontend and backend code entirely differently. If you mix these rules up, your app will either fail to build or crash in production!

### 💻 The Frontend Rule: Full Install (`npm install`)

For the frontend (React), we **do not** upload the `node_modules` folder to AWS. We only upload the final squished `HTML/CSS/JS` files.
However, in order to _create_ those squished files, the frontend desperately needs heavy developer tools (like TypeScript, Vite, and ESLint). These tools are stored in `"devDependencies"`.

- **Action**: We must run a full `npm install` to download everything required to build the code.

### ☁️ The Backend Rule: Production Install (`npm install --omit=dev`)

For your AWS Lambdas (Backend), there is no "build" step. The AWS Lambda actually takes your raw JavaScript files **and** your entire `node_modules` folder, zips them up, and runs them natively in the cloud.

- **Action**: We must strictly run `npm install --omit=dev` (formerly `--production`). This tells NPM to completely ignore heavy testing tools and only download the bare essentials. If we uploaded massive testing libraries to AWS, our Lambdas would be slow, bloated, and hit AWS size limits.

**In Short:**

- **Frontend (AWS S3)**: Needs a massive install to build, but uploads _nothing_ from `node_modules`.
- **Backend (AWS Lambda)**: Needs a tiny install, because it uploads _everything_ from `node_modules`.

---

## 3. The Frontend Command Lifecycle (Vite)

In modern frontend development (using Vite), there are three primary commands you will use:

### 🛠️ `npm run dev` (The Sandbox)

- **What it does:** Starts up a lightweight, hyper-fast local server for you to write code on.
- **Special Powers:** Hot Module Replacement (HMR). When you click "Save" in your IDE, the changes appear instantly on your screen without a browser refresh.
- **When to use it:** 99% of the time you are actively writing code.

### 🏭 `npm run build` (The Factory)

- **What it does:** It takes all of your raw development code and brutally squishes, minifies, and optimizes it down into a tiny `dist/` folder.
- **Special Powers:** It deletes unused code (Tree-Shaking), translates TypeScript into pure JavaScript, and ensures the website will load at lightning speed.
- **When to use it:** When you are preparing to deploy to AWS (this is exactly what GitHub Actions runs).

### 🎭 `npm run preview` (The Rehearsal)

- **What it does:** It acts as a local "dry run" for your production code. It boots up a fast local web server that reads directly from the optimized `dist/` folder that `npm run build` just created.
- **Special Powers:** Lets you test the exact, minified code that your end-users will experience to ensure the optimizer didn't accidentally break any CSS or logic.
- **When to use it:** Right before you push code to `main`, just to verify that the squished production bundle looks exactly the same as your development sandbox.

---

## 4. Local Code Quality & Testing

Before you push your code to GitHub and wait for the CI/CD pipeline to analyze it, you can (and should!) run these quality checks locally on your own machine.

### 🧪 `npm run test` (The Test Suite)

- **What it does:** Runs **Vitest** to execute the entire suite of automated unit tests.
- **Special Powers:** You can use `npm run test:watch` to keep the test runner open. Every time you save a file, it will instantly re-run only the tests related to that specific file!
- **When to use it:** While writing new logic, or right before pushing a branch to ensure you haven't broken any existing features.

### 🧹 `npm run lint` (The Code Police)

- **What it does:** Runs the TypeScript Compiler (`tsc --noEmit`) to verify that all of your data types are perfectly aligned across the entire application without actually building the app.
- **Special Powers:** We also have `npm run lint:eslint` which sweeps through your files and enforces strict coding standards (like preventing unused variables or bad React hooks).
- **When to use it:** If you want to make absolutely sure the GitHub Actions pipeline won't reject your code for a silly typo.

---

## 5. Dependency Security (`npm audit`)

Because `node_modules` pulls in code written by thousands of strangers on the internet, it is entirely possible that a hacker discovers a vulnerability (like a backdoor or data leak) in one of those third-party libraries.

To protect against this, NPM has a built-in security scanner:

### 🛡️ `npm audit`

- **What it does:** It cross-references the exact versions of every library in your `package-lock.json` against the global GitHub Advisory Database of known vulnerabilities (CVEs).
- **When to use it:** We actually automated this! It runs automatically via our `./infra/scripts/validate_local.sh` script every time you type `git push`. If it finds a `High` or `Critical` vulnerability, it will intentionally block your push.

### 🔧 How to fix a vulnerability

If `npm audit` ever blocks your push by flagging a vulnerable package, you can almost always fix it instantly by running:

```bash
npm audit fix
```

This tells NPM to automatically upgrade the compromised package to the newest, safe version patched by the community.
