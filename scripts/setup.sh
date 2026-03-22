#!/bin/bash
# CricGenius Scorer - Environment Setup Script (Unix/Mac/Linux)

echo "🔍 Checking prerequisites for CricGenius Scorer..."

check_cmd() {
    if command -v $1 &> /dev/null; then
        echo "✅ $1 is installed ($($1 --version | head -n 1))"
    else
        echo "❌ $1 is NOT installed."
        MISSING=1
    fi
}

MISSING=0

check_cmd node
check_cmd npm
check_cmd terraform
check_cmd aws

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "⚠️  Some tools are missing. Please install them to proceed:"
    echo "- Node.js & npm: https://nodejs.org/"
    echo "- Terraform: https://developer.hashicorp.com/terraform/install"
    echo "- AWS CLI: https://aws.amazon.com/cli/"
    exit 1
else
    echo ""
    echo "🚀 All tools found! You are ready to deploy."
    echo "Next steps:"
    echo "1. Update terraform/terraform.tfvars with your domain."
    echo "2. Run './deploy.sh' to start the deployment."
fi
