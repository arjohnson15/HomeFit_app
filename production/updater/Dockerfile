# HomeFit Updater Service
# Handles automatic updates by pulling changes and restarting containers

FROM docker:24-cli

# Install Node.js and other tools
RUN apk add --no-cache nodejs npm git curl wget bash

WORKDIR /updater

# Copy updater files
COPY package.json ./
COPY server.js ./

# Install dependencies
RUN npm install --production

EXPOSE 9999

CMD ["/usr/bin/node", "server.js"]
