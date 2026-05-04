#!/bin/bash
set -xe  # Arrêt immédiat si erreur + log de chaque commande

# Met à jour les paquets et installe les dépendances de base
apt update -y
apt install -y curl git

# Installe Node.js 18.x depuis NodeSource (pas la version obsolète d'apt)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Vérifie la version installée (visible dans /var/log/cloud-init-output.log)
node --version
npm --version

# Installe PM2 globalement pour gérer le process Node
npm install -g pm2

# Clone le repo
cd /home/ubuntu
git clone ${github_repo} repo
cd repo/app/backend

# Installe les dépendances de l'application
npm install

# Exporte TOUTES les variables d'environnement nécessaires
export DB_HOST="${db_host}"
export DB_PASS="${db_password}"
export DB_USER="admin"
export DB_NAME="appdb"
export PORT="3000"
export ELK_HOST="${elk_host}" 
# Démarre l'application avec PM2
pm2 start npm --name "app" -- start

# Configure le démarrage automatique au boot
# La commande | tail -1 | bash exécute directement la commande générée par PM2
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash

# Sauvegarde la liste des process PM2 pour la restauration au boot
pm2 save

# Change le propriétaire du dossier pour ubuntu
chown -R ubuntu:ubuntu /home/ubuntu/repo