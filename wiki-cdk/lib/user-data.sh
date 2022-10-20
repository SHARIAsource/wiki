#!/bin/bash

# Redirects user-data output to /var/log/user-data.log and dev/console
# See https://aws.amazon.com/premiumsupport/knowledge-center/ec2-linux-log-user-data/
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

# Fetch latest updates
apt -qqy update

# Install all updates automatically
DEBIAN_FRONTEND=noninteractive apt-get -qqy -o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold' dist-upgrade

# Install jq - for parsing secrets, unzip for unzipping AWS CLI
apt-get update
apt-get install -y jq unzip zip

# Install dependencies to install Docker
apt -qqy -o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold' install ca-certificates curl gnupg lsb-release

# Register Docker package registry
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Refresh package udpates and install Docker
apt -qqy update
apt -qqy -o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold' install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# debug:
echo "Unzip installed?"
unzip -v
pwd

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Create installation directory for Wiki.js
mkdir -p /etc/wiki

# Generate DB secret
openssl rand -base64 32 > /etc/wiki/.db-secret

# Create internal docker network
docker network create wikinet

# Get DB credentials from SSM and Secrets Manager
secretARN=$(aws ssm get-parameter --name "/wiki/wiki-rds-credentials-secret-arn" --query "Parameter.Value" --output text)
secret=$(aws secretsmanager get-secret-value --secret-id $secretARN)
dbhost=$(aws secretsmanager get-secret-value --secret-id $secretARN| jq --raw-output '.SecretString' | jq -r .host)
dbpass=$(aws secretsmanager get-secret-value --secret-id $secretARN| jq --raw-output '.SecretString' | jq -r .password)

# Create the containers
docker create --name=wiki -e "LETSENCRYPT_DOMAIN=wiki.shariasource.com" -e "LETSENCRYPT_EMAIL=cole_crawford@fas.harvard.edu" -e "SSL_ACTIVE=true" -e DB_TYPE=postgres -e DB_HOST=$dbhost -e DB_PORT=5432 -e DB_PASS=$dbpass -e DB_USER=postgres -e DB_NAME=wikidb -e UPGRADE_COMPANION=1 --restart=unless-stopped -h wiki --network=wikinet -p 80:3000 -p 443:3443 ghcr.io/requarks/wiki:2
docker create --name=wiki-update-companion -v /var/run/docker.sock:/var/run/docker.sock:ro --restart=unless-stopped -h wiki-update-companion --network=wikinet ghcr.io/requarks/wiki-update-companion:latest

# Firewall
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Start containers
docker start wiki
docker start wiki-update-companion