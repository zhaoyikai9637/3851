#!/bin/sh
set -eu
# Railway mounts volumes as root. Prepare only the fixed upload directory,
# then drop privileges before starting Node. Existing files are not traversed.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data/uploads
  chown node:node /data/uploads
  exec gosu node "$@"
fi
exec "$@"
