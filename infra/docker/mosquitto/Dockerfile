FROM eclipse-mosquitto:2

COPY mosquitto.conf /mosquitto/config/mosquitto.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 1883

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD mosquitto_pub -h localhost -p 1883 -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" -t healthcheck -m ok -q 0 || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
