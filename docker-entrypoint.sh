#!/bin/bash
set -e

# Ensure SQLite file exists
if [ ! -f /var/www/html/database/database.sqlite ]; then
    touch /var/www/html/database/database.sqlite
    chown www-data:www-data /var/www/html/database/database.sqlite
    chmod 664 /var/www/html/database/database.sqlite
fi

# Ensure storage directories have proper write permissions
chown -R www-data:www-data /var/www/html/storage /var/www/html/database
chmod -R 775 /var/www/html/storage /var/www/html/database

# Run database migrations
echo "Running database migrations..."
php artisan migrate --force

# Optimize Laravel for production
echo "Caching production configurations..."
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

# Start web server
echo "Starting PrintEase production server on port 80..."
exec php artisan serve --host=0.0.0.0 --port=80
