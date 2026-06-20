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
            terraform) brew tap hashicorp/tap && brew install hashicorp/tap/terraform ;;
            aws)  brew install awscli ;;
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
check_cmd terraform
check_cmd aws

echo ""
echo "🚀 All tools are installed! You are ready to deploy."
echo "Next steps:"
echo "1. Ensure your .env.local is configured with your database and SES email."
echo "2. Run './deploy.sh' to start the deployment."
