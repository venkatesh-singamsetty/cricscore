# Domain Migration Log & Guide

This document outlines the exact steps taken to migrate the application from the `.site` domain to the `.com` domain, serving as both a historical log and a guide for any future domain migrations.

## 1. DNS & Nameserver Updates

- Created a new Hosted Zone in AWS Route 53 for the `.com` domain.
- Copied the 4 AWS Nameservers (NS records) provided by Route 53.
- Logged into the domain registrar (Spaceship/Namecheap) and replaced the default nameservers with the AWS Route 53 nameservers.
- Allowed time for DNS propagation.

## 2. Infrastructure as Code (.tfvars)

Updated the environment variables to point to the new `.com` domain:

- **`infra/terraform/environments/dev.tfvars`**: Changed `zone_domain` and `domain_name`.
- **`infra/terraform/environments/prod.tfvars`**: Changed `zone_domain` and `domain_name`.

## 3. Local Environment Updates

- Updated `.env.local` to use the new `.com` domain.
- Updated `TF_SES_SOURCE_EMAIL` in `.env.local` to `noreply@yournewdomain.com`.

## 4. Redeploy Environments

Ran the deployment scripts to provision the new SSL certificates, update API Gateway domains, and redirect CloudFront to the new domain:

```bash
./infra/scripts/deploy.sh --env dev
./infra/scripts/deploy.sh --env prod
```

## 5. Email (Amazon SES) Configuration

- Navigated to AWS SES → Configuration → Identities.
- Created a new Domain Identity for the `.com` domain.
- Selected **Easy DKIM** and **RSA_2048_BIT**.
- Ensured "Publish DNS records to Route53" was checked so AWS automatically verified the domain.

## 6. Cleanup of Old Resources

To prevent unnecessary AWS charges (like the $0.50/month Route 53 fee), the old domain was completely removed:

- Deleted the old `.site` Domain Identity from Amazon SES.
- Deleted all non-default records (TXT, CNAMEs) from the old `.site` Route 53 Hosted Zone.
- Deleted the `.site` Route 53 Hosted Zone itself.

## 7. GitHub Actions Synchronization

To ensure the CI/CD pipeline deploys using the correct new domain, the GitHub Secrets and Variables were updated automatically by running:

```bash
./infra/scripts/setup_github_envs.sh
```

This pushed the updated `DOMAIN_NAME`, `ZONE_DOMAIN`, and `TF_SES_SOURCE_EMAIL` to both the `dev` and `prod` GitHub environments.

## 8. Documentation Updates

- Updated all hardcoded `.site` URLs in `README.md` and `docs/terraform_guide.md` to `.com`.
- Introduced a dedicated `infra/terraform/bootstrap` folder to cleanly manage the core Terraform state bucket and Route 53 zone.
- Updated `docs/deployment.md` to guide new users on how to run the bootstrap folder first.
