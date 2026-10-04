#!/bin/bash
# CricScore - Environment Setup Script (Mac/Linux)
set -e

echo "🔍 Checking prerequisites for CricScore..."

# Helper to detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

install_tool() {
    local tool=$1
    echo "⚠️  $tool is missing. Attempting to install..."
    
    if [ "$MACHINE" == "Mac" ]; then
        if ! command -v brew &> /dev/null; then
            echo "❌ Homebrew is required to auto-install on Mac. Please install Homebrew first: https://brew.sh/"
            exit 1
        fi
        
        case $tool in
            node) brew install node@24 ;;
            npm)  echo "npm is installed with node." ;;
            python3) brew install python3 ;;
            terraform) brew tap hashicorp/tap && brew install hashicorp/tap/terraform ;;
            aws)  brew install awscli ;;
            jq) brew install jq ;;
            gh) brew install gh ;;
            docker) echo "❌ Docker must be installed manually (e.g. Docker Desktop or Orbstack)." && exit 1 ;;
            checkov) brew install checkov ;;
            gitleaks) brew install gitleaks ;;
            trivy) brew install trivy ;;
            syft) brew install syft ;;
        esac
    elif [ "$MACHINE" == "Linux" ]; then
        echo "Please enter your sudo password to install $tool via apt-get:"
        sudo apt-get update -y
        
        case $tool in
            node) 
                curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
                sudo apt-get install -y nodejs
                ;;
            npm) echo "npm is installed with node." ;;
            python3)
                sudo apt-get install -y python3 python3-pip python3-venv
                ;;
            jq)
                sudo apt-get install -y jq
                ;;
            gh)
                type -p curl >/dev/null || (sudo apt update && sudo apt install curl -y)
                curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
                && sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
                && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
                && sudo apt update \
                && sudo apt install gh -y
                ;;
            docker)
                sudo apt-get install -y docker.io
                ;;
            terraform)
                sudo apt-get install -y gnupg software-properties-common
                wget -O- https://apt.releases.hashicorp.com/gpg | \
                gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null
                echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
                sudo tee /etc/apt/sources.list.d/hashicorp.list
                sudo apt-get update && sudo apt-get install terraform -y
                ;;
            aws) 
                sudo apt-get install -y awscli 
                ;;
            checkov)
                sudo apt-get install -y python3-pip
                pip3 install checkov || pip install checkov
                ;;
            gitleaks)
                curl -sSfL https://raw.githubusercontent.com/gitleaks/gitleaks/master/install.sh | sh -s -- -b /usr/local/bin
                ;;
            trivy)
                curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sudo sh -s -- -b /usr/local/bin
                ;;
            syft)
                curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sudo sh -s -- -b /usr/local/bin
                ;;
        esac
    else
        echo "❌ Auto-install not supported for $MACHINE. Please install $tool manually."
        exit 1
    fi
}

check_cmd() {
    if command -v $1 &> /dev/null; then
        echo "✅ $1 is installed ($($1 --version 2>&1 | head -n 1))"
    else
        install_tool $1
        
        # Verify installation succeeded
        if command -v $1 &> /dev/null; then
            echo "✅ Successfully installed $1!"
        else
            if [ "$1" != "npm" ]; then
                echo "❌ Failed to install $1. Please install it manually."
                exit 1
            fi
        fi
    fi
}

check_cmd node
check_cmd npm
check_cmd python3
check_cmd terraform
check_cmd aws
check_cmd jq
check_cmd gh
check_cmd docker
check_cmd checkov
check_cmd gitleaks
check_cmd trivy
check_cmd syft

echo ""
echo "🚀 All tools are installed! You are ready to deploy."
echo "Next steps:"
echo "1. Ensure your .env.local is configured with your database and SES email."
echo "2. Run './infra/scripts/deploy.sh' to start the deployment."
