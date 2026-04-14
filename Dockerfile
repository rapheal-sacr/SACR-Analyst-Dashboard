FROM node:23-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Vite frontend
RUN npm run build

# Expose port 3000 (Cloud Run will route traffic here)
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]
