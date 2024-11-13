FROM node:22-slim

# Create app directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy your application code
COPY . .

# Command to run your script
# Replace "script.js" with your actual file name
CMD [ "node", "deob.js" ]
