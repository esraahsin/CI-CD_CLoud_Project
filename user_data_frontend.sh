#!/bin/bash
set -xe  # Arrêt immédiat si erreur + log de chaque commande

apt update -y
apt install -y nginx git

cd /home/ubuntu
git clone ${frontend_repo} repo

# Copie les fichiers frontend dans le dossier servi par Nginx
cp -r repo/app/frontend/* /var/www/html/

# Remplace le placeholder __ALB_DNS__ par le vrai DNS de l'ALB
sed -i 's|__ALB_DNS__|http://${alb_dns}|g' /var/www/html/config.js

# Vérifie que le remplacement a bien eu lieu
grep "API_BASE" /var/www/html/config.js

systemctl enable nginx
systemctl restart nginx