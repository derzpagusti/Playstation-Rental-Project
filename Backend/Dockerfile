FROM php:8.3-apache-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq-dev \
        libonig-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql mbstring \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/app

COPY . .

# Hanya folder public yang dilayani melalui HTTP.
RUN sed -ri \
        's!/var/www/html!/var/www/app/public!g' \
        /etc/apache2/sites-available/000-default.conf \
    && sed -ri \
        's/Listen 80/Listen 10000/' \
        /etc/apache2/ports.conf \
    && sed -ri \
        's/<VirtualHost \*:80>/<VirtualHost *:10000>/' \
        /etc/apache2/sites-available/000-default.conf \
    && printf '%s\n' \
        'ServerName localhost' \
        '<Directory /var/www/app/public>' \
        '    Options -Indexes' \
        '    AllowOverride None' \
        '    Require all granted' \
        '</Directory>' \
        > /etc/apache2/conf-available/app.conf \
    && a2enconf app

# Konfigurasi produksi dan batas upload.
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && printf '%s\n' \
        'variables_order = "EGPCS"' \
        'expose_php = Off' \
        'display_errors = Off' \
        'log_errors = On' \
        'error_log = /proc/self/fd/2' \
        'upload_max_filesize = 2M' \
        'post_max_size = 4M' \
        'date.timezone = Asia/Jakarta' \
        > "$PHP_INI_DIR/conf.d/app.ini"

# Normalisasi line ending script yang mungkin dibuat dari Windows.
RUN sed -i 's/\r$//' /var/www/app/start.sh

# Pastikan Apache hanya menggunakan MPM prefork.
RUN a2dismod mpm_event mpm_worker \
    && a2enmod mpm_prefork \
    && apache2ctl -t

ENV PORT=10000

EXPOSE 10000

CMD ["sh", "/var/www/app/start.sh"]