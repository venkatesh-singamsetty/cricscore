# 🛠️ CricScore Command Cheatsheet

This cheatsheet provides a quick reference for all the commands used across the CricScore repository, organized by workflow.

## 1. Initial Setup & Infrastructure

```bash
# Clone the repository
git clone https://github.com/venkatesh-singamsetty/cricscore.git && cd cricscore

# Install all prerequisites (Node, Python3, Terraform, AWS CLI, security scanners)
./infra/scripts/setup.sh

# Copy environment templates
cp .env.local.example .env.local
cp apps/frontend/.env.example apps/frontend/.env

# Login to GitHub CLI (Required for CI/CD setup script)
gh auth login

# Configure GitHub Environment Variables & Secrets for Actions
./infra/scripts/setup_github_envs.sh
```

## 2. Local Frontend Development (Zero-AWS Setup)

```bash
# Install Node.js dependencies for the monorepo
npm install

# Start the Vite React development server (Runs on localhost:3000)
npm run dev --prefix apps/frontend
```

## 3. Terraform (Manual Overrides)

Usually, the `deploy.sh` script handles Terraform, but if you need to run it manually:

```bash
# Navigate to the bootstrap directory
cd infra/terraform/bootstrap

# Initialize the Terraform workspace
terraform init

# Apply the bootstrap infrastructure
terraform apply
```

## 4. Full Cloud Deployment

```bash
# Deploy to the Development Environment using local credentials
./infra/scripts/deploy.sh --env dev --use-local-env

# Deploy to the Production Environment using local credentials
./infra/scripts/deploy.sh --env prod --use-local-env
```

## 5. MLOps & Machine Learning (Local Training)

To run the machine learning data ingestion and training pipelines locally, you need Python installed (which `setup.sh` handles).

```bash
# Navigate to the ML Engine directory
cd apps/ml-engine

# Create a Python Virtual Environment
python3 -m venv venv

# Activate the Virtual Environment (Mac/Linux)
source venv/bin/activate

# Install Python ML dependencies (Pandas, Scikit-Learn)
pip install -r requirements.txt

# Run the data pipeline (Fetches JSONs from Cricsheet & generates live_data.csv)
python data_pipeline.py

# Train the model (Outputs live_win_predictor_model.joblib)
python live_train.py

# Run the Python test suite
pytest test_predict.py
```

## 6. Testing (Frontend & Backend)

```bash
# Run all fast Unit and Integration tests across both Frontend & Backend
npm run test:all

# Run Frontend tests only
npm run test --prefix apps/frontend

# Run Backend tests only
npm run test --prefix apps/backend

# Run Backend tests in Watch mode (Great for active development)
npm run test:watch --prefix apps/backend
```

## 7. Automated Security Scanning (Local)

These scanners also run automatically in GitHub Actions, but you can run them locally to verify before pushing:

```bash
# Scan for accidentally committed secrets
gitleaks detect -v

# Scan Node.js dependencies for vulnerabilities
trivy fs ./package-lock.json

# Scan Terraform code for security misconfigurations
checkov -d infra/terraform/
```
