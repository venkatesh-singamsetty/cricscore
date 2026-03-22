# CricGenius Scorer - Environment Setup Script (Windows PowerShell)

Write-Host "🔍 Checking prerequisites for CricGenius Scorer..." -ForegroundColor Cyan

function Check-Command($cmd) {
    try {
        if (Get-Command $cmd -ErrorAction SilentlyContinue) {
            $versionInfo = & $cmd --version 2>&1 | Select-Object -First 1
            Write-Host "✅ $cmd is installed ($versionInfo)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ $cmd is NOT installed." -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ $cmd is NOT installed." -ForegroundColor Red
        return $false
    }
}

$missing = $false

if (-not (Check-Command "node")) { $missing = $true }
if (-not (Check-Command "npm")) { $missing = $true }
if (-not (Check-Command "terraform")) { $missing = $true }
if (-not (Check-Command "aws")) { $missing = $true }

if ($missing) {
    Write-Host "`n⚠️  Some tools are missing. Please install them to proceed:" -ForegroundColor Yellow
    Write-Host "- Node.js & npm: https://nodejs.org/"
    Write-Host "- Terraform: https://developer.hashicorp.com/terraform/install"
    Write-Host "- AWS CLI: https://aws.amazon.com/cli/"
    exit 1
} else {
    Write-Host "`n🚀 All tools found! You are ready to deploy." -ForegroundColor Green
    Write-Host "Next steps:"
    Write-Host "1. Update terraform/terraform.tfvars with your domain."
    Write-Host "2. Run '.\deploy.sh' (requires Git Bash) or follow the README for manual steps."
}
