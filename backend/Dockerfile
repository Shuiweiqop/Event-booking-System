# Laravel API — demo image (php artisan serve with multiple workers).
FROM php:8.2-cli

RUN apt-get update \
 && apt-get install -y --no-install-recommends git unzip libzip-dev \
 && docker-php-ext-install pdo_mysql zip \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Install dependencies first so this layer is cached between code changes.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist

COPY . .
RUN composer dump-autoload --optimize --no-dev \
 && sed -i 's/\r$//' docker/entrypoint.sh \
 && chmod +x docker/entrypoint.sh \
 && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache

# Linux supports multiple workers for the built-in server, so concurrent requests are handled in parallel.
ENV PHP_CLI_SERVER_WORKERS=8

EXPOSE 8000
ENTRYPOINT ["docker/entrypoint.sh"]
# --no-reload is required: without it `artisan serve` drops env vars that also exist in .env
# (so docker-compose's DB_HOST etc. would be ignored), and it ignores PHP_CLI_SERVER_WORKERS.
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000", "--no-reload"]
