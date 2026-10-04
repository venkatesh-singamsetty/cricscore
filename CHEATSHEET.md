# 🛠️ CricScore Expert Engineer Cheatsheet

This cheatsheet provides a comprehensive, quick reference for all commands needed to manage, develop, and troubleshoot the CricScore repository like an expert. It covers the entire end-to-end developer lifecycle.

## 1. Initial Setup & Infrastructure

```bash
# Authenticate with GitHub CLI (Required for cloning private repos or setting up CI/CD)
gh auth login

# Clone the repository and enter the directory
git clone https://github.com/venkatesh-singamsetty/cricscore.git && cd cricscore

# Install all prerequisites (Node, Python3, Terraform, AWS CLI, security scanners)
./infra/scripts/setup.sh

# Copy environment templates
cp .env.local.example .env.local
cp apps/frontend/.env.example apps/frontend/.env

# Configure GitHub Environment Variables & Secrets for CI/CD
./infra/scripts/setup_github_envs.sh
```

## 2. Git Workflow & PR Management

Follow the standard PR workflow (Never push directly to `main`).

```bash
# Fetch latest changes and update local main
git checkout main && git pull origin main

# Create a new feature or fix branch
git checkout -b feature/your-feature-name

# Add, commit, and push changes
git add .
git commit -m "feat: your descriptive commit message"
git push -u origin HEAD

# Rebase your feature branch on top of main (if main has moved forward)
git fetch origin
git rebase origin/main

# Create a Pull Request using the GitHub CLI (gh)
gh pr create --title "feat: added new feature" --body "Detailed description" --base main

# Auto-merge a Pull Request (Squashes and deletes branch ONLY after approvals & CI status checks pass)
gh pr merge --auto --squash --delete-branch
```

## 3. Node.js & Project Scripts (Monorepo Root)

We use npm workspaces. You can run these commands from the **root** of the repository:

```bash
# Install dependencies for the monorepo
npm install

# Clean install dependencies (Ideal for CI/CD or fixing broken node_modules)
npm ci

# Start the Vite React development server locally
npm run dev

# Build the frontend production bundle locally
npm run build

# Preview the built production bundle locally (Serves the /dist folder)
npm run preview

# Run the Linter across the frontend
npm run lint

# Format code using prettier via npx
npx prettier --write "apps/**/*.{ts,tsx,js,jsx,json,md}"
```

## 4. Testing & Validation

```bash
# Run Frontend tests only
npm run test

# Run all fast Unit and Integration tests (Frontend & Backend)
npm run test:all

# Install Playwright browser binaries (Required before running E2E tests for the first time)
npx playwright install --with-deps

# Run End-to-End (E2E) UI Tests
npm run test:e2e

# Run AI Chatbot Evaluation Tests (Validates LLM tool-calling logic)
npm run test:ai

# Run Backend tests in Watch mode (Must run from backend folder)
npm run test:watch --prefix apps/backend
```

## 5. MLOps & Machine Learning (Local Training)

```bash
# Navigate to the ML Engine directory
cd apps/ml-engine

# Create and Activate Python Virtual Environment
python3 -m venv venv
source venv/bin/activate

# Install Python ML dependencies
pip install -r requirements.txt

# Run the data pipeline (Fetches Cricsheet JSONs & generates live_data.csv)
python data_pipeline.py

# Train the model (Outputs live_win_predictor_model.joblib)
python live_train.py

# Run the ML Unit tests
pytest test_predict.py -v

# Build the ML Docker Container locally (for deployment debugging)
docker build --platform linux/amd64 -t cricscore-ml-predict .
```

## 6. Pre-Push Security & Code Scanning (Local)

Run these checks to catch issues before pushing to GitHub:

```bash
# Audit Node.js dependencies for security vulnerabilities
npm audit

# Automatically fix security vulnerabilities in dependencies (if possible)
npm audit fix

# Scan for accidentally committed secrets (API Keys, tokens, etc.)
gitleaks detect -v

# Deep scan dependencies & containers for CVE vulnerabilities
trivy fs ./package-lock.json

# Scan Terraform code for security misconfigurations
checkov -d infra/terraform/

# Generate an SBOM (Software Bill of Materials) using Syft
syft dir:. -o spdx-json=cricscore-sbom.spdx.json
```

## 7. Full Cloud Deployment

Usually, deployments are handled by the bash scripts which inject the correct environment variables, but you can also run them manually.

```bash
# Deploy to Development Environment (using local credentials)
./infra/scripts/deploy.sh --env dev --use-local-env

# Deploy to Production Environment (using local credentials)
./infra/scripts/deploy.sh --env prod --use-local-env

# Full Pre-Push Validation (Runs tests, terraform validate, and security scans)
./infra/scripts/validate_local.sh

# --- Manual Terraform Overrides ---

# Initialize Terraform (Downloads providers and sets up state)
terraform -chdir=infra/terraform init

# Plan Terraform infrastructure changes (Dry-run)
terraform -chdir=infra/terraform plan

# Apply Terraform infrastructure changes (Requires confirmation)
terraform -chdir=infra/terraform apply
```

## 8. AWS Troubleshooting (Expert CLI Commands)

If the deployment succeeds but the app behaves unexpectedly, use these AWS CLI commands to debug:

```bash
# Tailing Lambda Logs for the Backend API
aws logs tail /aws/lambda/cricscoredev-score-update --follow --format short

# Tailing Lambda Logs for the AI Chat API
aws logs tail /aws/lambda/cricscoredev-chat-api --follow

# Check CloudFront Invalidation Status (If UI looks stale)
aws cloudfront list-invalidations --distribution-id <YOUR_DISTRIBUTION_ID>

# List items in DynamoDB Connections Table (to see active WebSockets)
aws dynamodb scan --table-name cricscoredev-connections --select COUNT

# Verify S3 Static Website Bucket Contents
aws s3 ls s3://cricscoredev-app-<hash>/

# Force an update to a Lambda function if image was pushed manually
aws lambda update-function-code --function-name cricscoredev-ml-predict --image-uri <ECR_IMAGE_URI>

# Force unlock Terraform state locally
terraform -chdir=infra/terraform force-unlock <LOCK_ID>

# Force unlock Terraform state remotely via GitHub Actions (Recommended!)
gh workflow run terraform-unlock.yml -f environment=dev -f lock_id=<LOCK_ID>

# Trigger remote Terraform drift detection via GitHub Actions
gh workflow run drift.yml
```

## 9. Database (PostgreSQL) Troubleshooting

Since CricScore uses PostgreSQL, you can use standard `psql` commands to debug the database manually.

```bash
# Extract your DATABASE_URL from .env.local and connect via psql
psql "postgres://username:password@hostname:port/defaultdb?sslmode=require"

# --- Once connected to PostgreSQL ---

# List all schemas
\dn

# Switch to your environment schema (e.g. dev or prod)
SET search_path TO dev;

# List all tables in the current schema
\dt

# Check if a specific match exists (UUID match ID)
SELECT * FROM matches WHERE id = 'YOUR_MATCH_ID';

# View the last 5 ball events (to check for missing or stuck live data)
SELECT * FROM balls ORDER BY created_at DESC LIMIT 5;

# Check active database connections (Useful if AWS Lambdas are exhausting the connection pool)
SELECT count(*) FROM pg_stat_activity;

# View detailed connection activity to identify hanging queries
SELECT pid, usename, state, query FROM pg_stat_activity WHERE state = 'active';

# Exit psql
\q
```
