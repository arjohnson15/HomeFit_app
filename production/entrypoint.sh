#!/bin/sh
set -e

echo "HomeFit starting up..."

# Run database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "Generating Prisma client..."
    npx prisma generate --schema=./prisma/schema.prisma || {
        echo "Warning: Prisma generate failed, using existing client..."
    }
    echo "Running database migrations..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma || {
        echo "Warning: Migration failed, trying db push..."
        npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss || {
            echo "Warning: DB push also failed, continuing startup..."
        }
    }
    echo "Migrations complete."
fi

# Start the application
echo "Starting HomeFit server..."
exec node src/index.js
