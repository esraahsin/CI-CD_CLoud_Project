#!/bin/bash
apt update -y
apt install -y nginx git

# Replace this block with your actual frontend files
cd /home/ubuntu
git clone <YOUR_FRONTEND_REPO> frontend
cp -r frontend/* /var/www/html/

# Inject the ALB DNS into the JS config so the frontend calls the right backend
sed -i 's|__ALB_DNS__|http://${alb_dns}|g' /var/www/html/config.js

systemctl enable nginx
systemctl start nginx
