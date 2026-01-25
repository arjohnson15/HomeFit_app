#!/bin/sh
set -e

echo "HomeFit starting up..."

# Run database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "Running database migrations..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma || {
        echo "Warning: Migration failed, but continuing startup..."
    }
    echo "Migrations complete."
fi

# Start the application
echo "Starting HomeFit server..."
exec node src/index.js
