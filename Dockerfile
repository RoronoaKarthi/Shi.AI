# Use official lightweight Node.js image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy configuration files first for efficient caching
COPY package.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies for both frontend and backend
RUN npm run install:all

# Copy the rest of the application files
COPY . .

# Build the static React frontend
RUN npm run build:frontend

# Create the uploads directory and grant write access for non-root users (required by Hugging Face Spaces)
RUN mkdir -p /app/backend/uploads && chmod -R 777 /app/backend/uploads

# Expose Hugging Face default port
EXPOSE 7860

# Set production environment variables
ENV PORT=7860
ENV NODE_ENV=production
ENV FACE_SWAP_PROVIDER=mock
ENV MAX_UPLOAD_MB=10

# Start the application
CMD ["npm", "start"]
