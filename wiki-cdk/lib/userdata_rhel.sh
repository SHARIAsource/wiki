#!/bin/bash

# Redirects user-data output to /var/log/user-data.log and dev/console
# See https://aws.amazon.com/premiumsupport/knowledge-center/ec2-linux-log-user-data/
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

# Fetch latest updates
yum -qqy update

# Install jq - for parsing secrets, unzip for unzipping AWS CLI
wget -O jq https://github.com/stedolan/jq/releases/download/jq-1.6/jq-linux64
chmod +x ./jq
sudo cp jq /usr/bin

# Update AWS CLI to v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -qq awscliv2.zip
./aws/install

# From docker install instructions
yum install -y yum-utils
yum-config-manager \
    --add-repo \
    https://download.docker.com/linux/rhel/docker-ce.repo
yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Modify docker permissions
sudo usermod -a -G docker ec2-user
id ec2-user
newgrp docker
sudo chmod 666 /var/run/docker.sock

sudo systemctl enable docker.service
sudo systemctl start docker.service

# Create installation directory for Wiki.js
mkdir -p /etc/wiki

# Create internal docker network
sudo docker network create wikinet

# Get DB credentials from SSM and Secrets Manager
secretARN=$(aws ssm get-parameter --name "/wiki/wiki-rds-credentials-secret-arn" --query "Parameter.Value" --output text)
secret=$(aws secretsmanager get-secret-value --secret-id $secretARN)
dbhost=$(aws secretsmanager get-secret-value --secret-id $secretARN| jq --raw-output '.SecretString' | jq -r .host)
dbpass=$(aws secretsmanager get-secret-value --secret-id $secretARN| jq --raw-output '.SecretString' | jq -r .password)

# Create the containers
sudo docker create --name=wiki -e DB_TYPE=postgres -e DB_HOST=$dbhost -e DB_PORT=5432 -e DB_PASS=$dbpass -e DB_USER=postgres -e DB_NAME=wikidb -e UPGRADE_COMPANION=1 --restart=unless-stopped -h wiki --network=wikinet -p 80:3000 -p 443:3443 ghcr.io/requarks/wiki:2
sudo docker create --name=wiki-update-companion -v /var/run/docker.sock:/var/run/docker.sock:ro --restart=unless-stopped -h wiki-update-companion --network=wikinet ghcr.io/requarks/wiki-update-companion:latest

# Start containers
sudo docker start wiki
sudo docker start wiki-update-companion