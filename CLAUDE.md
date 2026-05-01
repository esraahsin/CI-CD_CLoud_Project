# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack Todo application deployed on AWS via Terraform. No containers — EC2 instances run Node.js directly, bootstrapped by User Data scripts. No CI/CD pipeline exists yet; deployment is manual `terraform apply`.

## Architecture

```
Internet → [ALB] → [ASG: 2–4 backend EC2s in private subnets] → [RDS MySQL in private subnets]
         → [Frontend EC2 in public subnet, Nginx serving static files]
```

- Backend EC2s are in private subnets, only reachable through the ALB
- Frontend EC2 is public, serves static HTML/JS and proxies API calls to the ALB DNS
- NAT Gateway provides outbound internet for private subnets
- Multi-AZ across two availability zones

## Key Paths

- `app/backend/` — Express REST API (server.js, package.json)
- `app/frontend/` — Static HTML/CSS/JS frontend (no build step, no framework)
- `app/terraformconfig/` — All Terraform configs and User Data scripts
- `.terraform/` — Legacy root-level Terraform files (project moved to `app/terraformconfig/`)

## Commands

### Terraform (run from `app/terraformconfig/`)
```bash
terraform init
terraform plan -var="db_password=<pw>" -var="key_name=<keypair>"
terraform apply -var="db_password=<pw>" -var="key_name=<keypair>"
terraform destroy -var="db_password=<pw>" -var="key_name=<keypair>"
```

### Backend (run from `app/backend/`)
```bash
npm install
npm start          # node server.js on port 3000
```

Required env vars for local backend: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## Terraform Variables

Required: `db_password`, `key_name`
Optional with defaults: `aws_region` (us-east-1), `github_repo`, `frontend_repo`, `ssh_cidr_block` (0.0.0.0/0), `skip_final_snapshot` (true)

## How Deployment Works

1. `terraform apply` creates VPC, subnets, ALB, ASG, RDS, frontend EC2
2. `user_data_backend.sh` runs on each backend EC2: installs Node.js, clones repo, starts server via PM2
3. `user_data_frontend.sh` runs on frontend EC2: installs Nginx, clones repo, injects ALB DNS into `config.js` via sed
4. Frontend's `config.js` contains `API_BASE` — a placeholder replaced at boot with the actual ALB endpoint

## Backend API

All routes under `/api/todos`: GET, POST (title in body), PATCH /:id (title/completed), DELETE /:id. Health check at `/health`. Rate limited to 100 req/min per IP.

## Things to Know

- The backend auto-creates the `todos` table on startup if it doesn't exist
- PM2 manages the backend process (auto-restart on crash)
- Security groups are strict: ALB accepts 80/443, backend only accepts 3000 from ALB SG, RDS only accepts 3306 from backend SG
- Frontend has no build process — edit HTML/CSS/JS directly
- `terraform.tfstate` is local (no remote backend configured)
