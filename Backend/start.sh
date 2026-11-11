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

exec apache2-foreground