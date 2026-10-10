#!/bin/sh
# Start the web app in Docker and remove the containers again on Ctrl+C.
# Volumes (node_modules cache) are kept so the next start is fast.
#   scripts/docker-dev.sh           # up, then clean up on exit
#   scripts/docker-dev.sh --build   # force an image rebuild (after package.json changes)
#   scripts/docker-dev.sh --reset   # also delete volumes and images
cd "$(dirname "$0")/.." || exit 1

if [ "$1" = "--reset" ]; then
  exec docker compose --profile tools down --volumes --rmi local --remove-orphans
fi

trap 'docker compose --profile tools down --remove-orphans' EXIT INT TERM
docker compose up "$@"
