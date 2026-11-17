# Production Dockerfile for PrintEase (Laravel 11 + Built React SPA)
FROM php:8.3-cli-alpine

# Install system dependencies & required PHP extensions for Laravel & SQLite
RUN apk add --no-cache \
    curl \
    git \
    unzip \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    sqlite-dev \
    sqlite \
    bash \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) gd pdo pdo_sqlite zip bcmath opcache

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy backend files
COPY backend /var/www/html

# Configure production environment
RUN cp .env.example .env \
    && sed -i 's/APP_ENV=local/APP_ENV=production/' .env \
    && sed -i 's/APP_DEBUG=true/APP_DEBUG=false/' .env \
    && sed -i 's/DB_CONNECTION=.*/DB_CONNECTION=sqlite/' .env

# Install production PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Create SQLite database and storage links
RUN mkdir -p database storage/framework/cache storage/framework/sessions storage/framework/views storage/logs \
    && touch database/database.sqlite \
    && php artisan key:generate --force \
    && php artisan storage:link \
    && chown -R www-data:www-data /var/www/html/storage /var/www/html/database \
    && chmod -R 775 /var/www/html/storage /var/www/html/database

# Copy startup entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose HTTP port
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
