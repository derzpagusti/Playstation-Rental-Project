#!/bin/sh
set -eu

UPLOAD_ROOT=/var/www/app/uploads

mkdir -p \
    "$UPLOAD_ROOT/payment_proof" \
    "$UPLOAD_ROOT/identity_docs"

chown www-data:www-data \
    "$UPLOAD_ROOT" \
    "$UPLOAD_ROOT/payment_proof" \
    "$UPLOAD_ROOT/identity_docs"

chmod 750 \
    "$UPLOAD_ROOT" \
    "$UPLOAD_ROOT/payment_proof" \
    "$UPLOAD_ROOT/identity_docs"

echo "[NovaPS startup v2] Checking Apache MPM configuration"

a2dismod mpm_event mpm_worker
a2enmod mpm_prefork

echo "[NovaPS startup v2] Active MPM declarations"

grep -R -n 'LoadModule.*mpm_' \
    /etc/apache2/apache2.conf \
    /etc/apache2/mods-enabled \
    /etc/apache2/conf-enabled \
    /etc/apache2/sites-enabled || true

apache2ctl -t

exec apache2-foreground

exec apache2-foreground