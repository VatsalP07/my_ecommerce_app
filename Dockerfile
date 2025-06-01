# 1. Base Image - Use an official Node.js image.
# Alpine versions are smaller, but sometimes lack common utilities.
# Slim versions are a good compromise. Choose an LTS version.
FROM node:20-slim AS builder
# Or: FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for building TS)
# Using 'npm ci' for cleaner installs based on lock file if available
RUN npm ci

# Copy the rest of your application source code to the working directory
# This includes your 'src/' for backend and 'frontend/' for frontend static files and compiled JS
COPY . .

# Build TypeScript backend (compiles src -> dist)
RUN npm run build:backend

# Build TypeScript frontend (compiles frontend/ts -> frontend/js)
RUN npm run build:frontend

# --- Second Stage: Production Image ---
# Now create a smaller production image by copying only necessary artifacts
FROM node:20-slim AS production

WORKDIR /usr/src/app

# Copy package.json and package-lock.json again
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev
# Alternatively, if you want to copy node_modules from the builder stage:
# COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy compiled backend code from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy the entire frontend (which includes static assets and compiled JS from frontend/js)
COPY --from=builder /usr/src/app/frontend ./frontend

# Expose the port the app runs on (as defined in your .env PORT, e.g., 5001)
# This is documentation; actual port mapping happens in `docker run`
EXPOSE 5001

# Define the command to run your application
# This will be `node dist/app.js`
CMD [ "node", "dist/app.js" ]