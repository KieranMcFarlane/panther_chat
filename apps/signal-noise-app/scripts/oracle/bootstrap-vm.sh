#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this as the default VM user, not root." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl git gnupg postgresql-client ufw

sudo install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
  sudo chmod a+r /etc/apt/keyrings/docker.asc
fi

. /etc/os-release
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"

sudo ufw allow OpenSSH
sudo ufw allow 5432/tcp
sudo ufw --force enable

cat <<'EOF'
Bootstrap complete.

Next steps:
1. Log out and back in so your docker group membership applies.
2. Clone or pull this repository onto the VM.
3. Copy apps/signal-noise-app/.env.oracle.example to apps/signal-noise-app/.env.oracle and fill secrets.
4. In Oracle Cloud networking, add matching ingress rules for SSH 22 and Postgres 5432.
EOF
