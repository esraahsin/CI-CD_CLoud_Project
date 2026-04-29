#!/bin/bash
apt update -y
apt install -y git nodejs npm

# Install PM2 for process management (auto-restart on crash)
npm install -g pm2

cd /home/ubuntu
git clone ${github_repo} repo
cd repo/app/backend

npm install

export DB_HOST=${db_host}
export DB_PASS=${db_password}
export PORT=3000

pm2 start npm --name "app" -- start
pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
