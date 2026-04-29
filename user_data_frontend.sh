#!/bin/bash
apt update -y
apt install -y nginx git

cd /home/ubuntu
git clone ${frontend_repo} repo
cp -r repo/app/frontend/* /var/www/html/

# Inject the ALB DNS into the JS config so the frontend calls the right backend
sed -i 's|__ALB_DNS__|http://${alb_dns}|g' /var/www/html/config.js

systemctl enable nginx
systemctl start nginx
