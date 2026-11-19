#!/bin/sh
set -e

# .env is not part of the image: create it from the example. Values passed in by
# docker-compose (DB_HOST, ...) are real environment variables and take precedence.
if [ ! -f .env ]; then
  cp .env.example .env
fi

if ! grep -q '^APP_KEY=base64:' .env; then
  php artisan key:generate --force --no-interaction
fi

echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
until php -r 'try { new PDO("mysql:host=".getenv("DB_HOST").";port=".getenv("DB_PORT"), getenv("DB_USERNAME"), getenv("DB_PASSWORD")); exit(0); } catch (Throwable $e) { exit(1); }'; do
  sleep 2
done

# Idempotent: migrations only run once, the seeder uses firstOrCreate.
php artisan migrate --force --seed --no-interaction

exec "$@"
