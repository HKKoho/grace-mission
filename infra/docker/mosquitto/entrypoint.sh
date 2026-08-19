#!/bin/sh
# infra/docker/mosquitto/entrypoint.sh
# Regenerates the password file from env vars on every start — so a
# credential rotation just needs a container restart, and the credential
# itself never gets baked into the image or committed to git.
set -eu

: "${MQTT_USERNAME:?MQTT_USERNAME is required}"
: "${MQTT_PASSWORD:?MQTT_PASSWORD is required}"

PASSWD_FILE=/mosquitto/data/passwd

rm -f "$PASSWD_FILE"
mosquitto_passwd -b -c "$PASSWD_FILE" "$MQTT_USERNAME" "$MQTT_PASSWORD"

# Optional per-peer credentials for federating with other Clawix-based
# instances, so a peer never shares this instance's own login. Format:
# "user1:pass1,user2:pass2". See docs/MQTT.md §5 — per-instance broker creds.
if [ -n "${MQTT_PEER_CREDENTIALS:-}" ]; then
  IFS=,
  for pair in $MQTT_PEER_CREDENTIALS; do
    peer_user=${pair%%:*}
    peer_pass=${pair#*:}
    [ -n "$peer_user" ] && [ -n "$peer_pass" ] && mosquitto_passwd -b "$PASSWD_FILE" "$peer_user" "$peer_pass"
  done
  unset IFS
fi

# This entrypoint runs as root, so the file above is created root:root
# mode 600 — but the mosquitto process itself drops privileges to the
# `mosquitto` user before reading its config, and can't open a file it
# doesn't own. Hand it over.
chown mosquitto:mosquitto "$PASSWD_FILE"

exec mosquitto -c /mosquitto/config/mosquitto.conf
