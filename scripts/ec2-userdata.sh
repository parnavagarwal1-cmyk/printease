#!/bin/bash
set -e

# Update packages
apt-get update -y
apt-get install -y ca-certificates curl gnupg git

# Install Docker official repository
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker engine and compose
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

# Clone PrintEase repository
mkdir -p /opt/printease
git clone https://github.com/parnavagarwal1-cmyk/printease.git /opt/printease

cd /opt/printease

# Build and start container in detached mode
docker compose up -d --build

echo "PrintEase successfully booted and running on Port 80!"
