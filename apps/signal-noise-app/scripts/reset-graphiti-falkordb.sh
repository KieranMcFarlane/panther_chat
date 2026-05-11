#!/usr/bin/env bash
set -euo pipefail

compose_file="docker-compose.graphiti.yml"

echo "This will stop local Docker FalkorDB and delete the graphiti_falkordb_data volume."
echo "Postgres dossiers, canonical entities, and materialized opportunities are not deleted."
read -r -p "Type reset-graphiti to continue: " confirmation

if [[ "${confirmation}" != "reset-graphiti" ]]; then
  echo "Reset cancelled."
  exit 0
fi

docker compose -f "${compose_file}" down -v
echo "Local Graphiti FalkorDB volume deleted. Rebuild graph memory from Postgres before relying on Graphiti retrieval."
