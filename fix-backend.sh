#!/bin/bash

echo "🔧 Fixing Yellow Panther Backend Issues..."

# Kill any processes on ports 3000 and 3001
echo "1. Killing processes on ports 3000 and 3001..."
lsof -t -i:3000 | xargs -r kill -9
lsof -t -i:3001 | xargs -r kill -9

# Navigate to the project directory
cd /opt/yellow-panther-ai

# Check environment variables
echo "2. Checking environment variables..."
if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    touch .env.local
fi

# Ensure required environment variables are set
if ! grep -q "OPENAI_API_KEY" .env.local; then
    echo "⚠️  OPENAI_API_KEY not found in .env.local"
fi

if ! grep -q "BRIGHTDATA_API_KEY" .env.local; then
    echo "⚠️  BRIGHTDATA_API_KEY not found in .env.local"
fi

# Install dependencies if needed
echo "3. Installing/updating dependencies..."
npm install

# Start the backend
echo "4. Starting the backend..."
nohup npm run start > backend.log 2>&1 &

# Wait a few seconds and check if it's running
sleep 5

echo "5. Checking backend status..."
if lsof -i :3000 > /dev/null 2>&1; then
    echo "✅ Backend is running on port 3000"
    lsof -i :3000
elif lsof -i :3001 > /dev/null 2>&1; then
    echo "✅ Backend is running on port 3001"
    lsof -i :3001
else
    echo "❌ Backend is not running. Check logs:"
    tail -20 backend.log
fi

# Restart nginx
echo "6. Restarting nginx..."
systemctl restart nginx

echo "🎉 Backend fix complete!" 