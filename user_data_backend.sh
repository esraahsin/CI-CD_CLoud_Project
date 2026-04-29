#!/bin/bash
apt update -y
apt install -y git nodejs npm

cd /home/ubuntu
git clone ${github_repo} app
cd app

npm install

export DB_HOST=${db_host}
export DB_PASS=${db_password}
export PORT=3000

npm start &
