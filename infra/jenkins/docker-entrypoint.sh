#!/usr/bin/env bash
set -euo pipefail

if [ -S /var/run/docker.sock ]; then
  docker_gid="$(stat -c "%g" /var/run/docker.sock)"

  if ! getent group "${docker_gid}" >/dev/null; then
    groupadd --gid "${docker_gid}" docker-host
  fi

  docker_group="$(getent group "${docker_gid}" | cut -d: -f1)"
  usermod --append --groups "${docker_group}" jenkins
fi

exec runuser --user jenkins -- /usr/local/bin/jenkins-agent "$@"
