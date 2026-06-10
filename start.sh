#!/usr/bin/env bash
set -e
PROXY_DIR=/var/data/proxy
mkdir -p $PROXY_DIR
if [ ! -f $PROXY_DIR/tls-key.pem ]; then
  openssl req -x509 -nodes -newkey ec \
    -pkeyopt ec_paramgen_curve:secp384r1 \
    -pkeyopt ec_param_enc:named_curve \
    -subj '/CN=localhost' \
    -keyout $PROXY_DIR/tls-key.pem -out $PROXY_DIR/tls-cert.pem -sha256 -days 3650 \
    -addext "extendedKeyUsage = serverAuth" \
    -addext "keyUsage = digitalSignature, keyCertSign, keyAgreement" \
    -addext "subjectAltName = DNS:localhost"
fi
chmod +x bin/tesla-http-proxy
./bin/tesla-http-proxy \
  -tls-key $PROXY_DIR/tls-key.pem \
  -cert $PROXY_DIR/tls-cert.pem \
  -key-file /etc/secrets/tesla-fleet-key.pem \
  -host localhost \
  -port 4443 \
  -verbose &
sleep 2
exec node src/server.js
