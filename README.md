# CI-CD Cloud Project

Deploy a full-stack web application on AWS using Terraform — no Ansible, no Elastic Beanstalk.
Everything is provisioned with `terraform apply` and bootstrapped via EC2 User Data scripts.

## Architecture

```
Internet
   │
   ▼
[ALB] ── public subnets (AZ-A, AZ-B)
   │
   ▼
[ASG: 2–4 backend EC2s] ── private subnets
   │
   ▼
[RDS MySQL] ── private subnets

[Frontend EC2] ── public subnet (serves the static/SPA frontend)
```

## Project structure

```
project/
├── main.tf                 # provider config
├── variables.tf            # input variables
├── outputs.tf              # ALB DNS, frontend IP, RDS endpoint
├── vpc.tf                  # VPC, subnets, IGW, NAT GW, route tables
├── security_groups.tf      # SGs for ALB, backend, RDS, frontend
├── rds.tf                  # RDS MySQL instance
├── alb.tf                  # ALB, target group, HTTP listener
├── asg.tf                  # Launch Template, ASG, CPU scaling policy
├── frontend.tf             # single public EC2 for the frontend
├── user_data_backend.sh    # bootstraps Node.js app on backend instances
├── user_data_frontend.sh   # bootstraps Nginx + frontend on the public EC2
├── app/
│   ├── backend/            # Node.js + Express REST API (Todo app)
│   │   ├── package.json
│   │   └── server.js
│   └── frontend/           # Static HTML/CSS/JS frontend (served by Nginx)
│       ├── index.html
│       ├── config.js       # API_BASE placeholder replaced at EC2 boot
│       ├── style.css
│       └── app.js
```

## Application

The `app/` directory contains a simple **Todo List** full-stack application.

### Backend (`app/backend/`)

- **Runtime:** Node.js 18+
- **Framework:** Express
- **Database:** MySQL (RDS) via `mysql2`
- **Port:** `3000` (set via `PORT` env var)
- **Env vars injected at boot by `user_data_backend.sh`:**

| Variable | Description |
|---|---|
| `DB_HOST` | RDS endpoint |
| `DB_PASS` | RDS master password |
| `PORT` | Listening port (default `3000`) |

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/todos` | List all todos |
| `POST` | `/api/todos` | Create a todo `{ "title": "..." }` |
| `PATCH` | `/api/todos/:id` | Toggle `{ "completed": true\|false }` |
| `DELETE` | `/api/todos/:id` | Delete a todo |

The server creates the `todos` table automatically on first start.

### Frontend (`app/frontend/`)

Pure HTML/CSS/JS — served statically by Nginx on the public EC2.

`config.js` contains the placeholder `__ALB_DNS__` which
`user_data_frontend.sh` replaces with the real ALB DNS name at boot time,
so every API call is directed to the correct backend.

## Prerequisites

1. [Terraform](https://developer.hashicorp.com/terraform/install) installed locally
2. AWS credentials (Access Key ID, Secret Access Key, and optionally a Session Token)
3. Your backend app in a **public GitHub repository** (or update `user_data_backend.sh` to pull from S3)
4. An EC2 Key Pair already created in the target AWS region (optional, for SSH access)

Before the sandbox starts, run `terraform validate` locally to catch any syntax errors.

## Usage

```bash
# 1. Export AWS credentials
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...   # required for sandbox/temporary credentials

# 2. Initialise Terraform
terraform init

# 3. Apply — supply your variable values
#    Point github_repo and frontend_repo at the app/ sub-directories in this repo
terraform apply \
  -var="db_password=MySecret123!" \
  -var="github_repo=https://github.com/esraahsin/CI-CD_CLoud_Project.git" \
  -var="frontend_repo=https://github.com/esraahsin/CI-CD_CLoud_Project.git" \
  -var="key_name=your-key-pair-name"
```

> **Note:** Both `user_data_backend.sh` and `user_data_frontend.sh` clone the full
> repo and then use the relevant sub-directory (`app/backend` or `app/frontend`).
> If you split the app into its own repository, update the clone URLs accordingly.

`terraform apply` takes roughly **8–12 minutes** (RDS and NAT Gateway are the slowest parts).

## Customising the User Data scripts

### `user_data_backend.sh`
Replace the `npm install` / `npm start` block with whatever runtime your app uses
(Python, Java, Go, etc.). The following template variables are injected automatically:

| Variable | Value |
|---|---|
| `${github_repo}` | Full HTTPS clone URL |
| `${db_host}` | RDS endpoint address |
| `${db_password}` | RDS master password |

### `user_data_frontend.sh`
1. Replace `<YOUR_FRONTEND_REPO>` with your frontend repository URL.
2. Add a `config.js` to your frontend with `const API_BASE = "__ALB_DNS__";` — the script
   will substitute the real ALB DNS name at boot time.

## Outputs

| Output | Description |
|---|---|
| `alb_dns` | ALB DNS name — point your frontend API calls here |
| `frontend_ip` | Public IP of the frontend EC2 |
| `rds_endpoint` | Internal RDS hostname (accessible only from backend SG) |

## Timing guide (3-hour sandbox)

| Phase | Estimated time |
|---|---|
| `terraform apply` | ~12 min |
| EC2 User Data scripts finish | ~3 min |
| Health checks turn green | ~10 min |
| Demo / verification | remaining time |

## Teardown

```bash
terraform destroy \
  -var="db_password=MySecret123!" \
  -var="github_repo=https://github.com/yourname/yourrepo.git"
```

`skip_final_snapshot = true` on RDS ensures destroy completes without hanging.
