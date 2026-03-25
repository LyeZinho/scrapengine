#!/bin/bash
# Fix Redis Connection Issue for ScrapEngine
# Execute this script on the remote server

set -e

echo "=== ScrapEngine Redis Fix Script ==="
echo ""

# 1. Check if Redis is running on port 7653
echo "1. Checking Redis status on port 7653..."
if sudo netstat -tlnp 2>/dev/null | grep -q ":7653"; then
    echo "   ✓ Redis is already running on port 7653"
    REDIS_RUNNING=true
elif sudo ss -tlnp 2>/dev/null | grep -q ":7653"; then
    echo "   ✓ Redis is already running on port 7653"
    REDIS_RUNNING=true
else
    echo "   ✗ Redis is NOT running on port 7653"
    REDIS_RUNNING=false
fi

# 2. Check Docker containers
echo ""
echo "2. Checking Docker containers..."
if docker ps | grep -q scrapengine-redis; then
    echo "   ✓ Redis container is running"
    REDIS_CONTAINER=true
else
    echo "   ✗ Redis container is NOT running"
    REDIS_CONTAINER=false
fi

# 3. Fix Redis if needed
if [ "$REDIS_RUNNING" = false ]; then
    echo ""
    echo "3. Starting Redis on port 7653..."
    
    # Check if we're in the project directory
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.coolify.yml" ]; then
        echo "   Found docker-compose file. Using Docker to start Redis..."
        
        # Stop existing Redis container if any
        if [ "$REDIS_CONTAINER" = true ]; then
            echo "   Stopping existing Redis container..."
            docker compose down redis 2>/dev/null || docker-compose down redis 2>/dev/null || true
        fi
        
        # Start Redis with port 7653
        echo "   Starting Redis on port 7653..."
        REDIS_PORT=7653 docker compose up -d redis 2>/dev/null || REDIS_PORT=7653 docker-compose up -d redis 2>/dev/null
        
        # Wait a moment for Redis to start
        sleep 3
        
        # Verify Redis is running
        if sudo netstat -tlnp 2>/dev/null | grep -q ":7653" || sudo ss -tlnp 2>/dev/null | grep -q ":7653"; then
            echo "   ✓ Redis started successfully on port 7653"
        else
            echo "   ✗ Failed to start Redis on port 7653"
            echo "   Checking Redis container logs..."
            docker logs scrapengine-redis 2>&1 | tail -20
            exit 1
        fi
    else
        echo "   Could not find docker-compose file. Please start Redis manually."
        echo "   Option 1: Install Redis locally and configure it to use port 7653"
        echo "   Option 2: Start Docker Redis with: docker run -d -p 7653:6379 redis:7-alpine"
        exit 1
    fi
fi

# 4. Test Redis connection
echo ""
echo "4. Testing Redis connection..."
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -h localhost -p 7653 ping 2>/dev/null | grep -q "PONG"; then
        echo "   ✓ Redis connection test successful (PONG)"
    else
        echo "   ✗ Redis connection test failed"
        echo "   Trying to connect with timeout..."
        timeout 5 redis-cli -h localhost -p 7653 ping || echo "   Connection timeout"
    fi
else
    echo "   redis-cli not installed, skipping connection test"
fi

# 5. Check Node.js application
echo ""
echo "5. Checking Node.js application..."
if docker ps | grep -q scrapengine-node; then
    echo "   ✓ Node.js container is running"
    echo "   Checking Node.js logs for Redis errors..."
    docker logs scrapengine-node 2>&1 | grep -i "redis\|econnrefused" | tail -10 || echo "   No Redis errors in recent logs"
else
    echo "   ✗ Node.js container is NOT running"
    echo "   Start it with: docker compose up -d node"
fi

echo ""
echo "=== Summary ==="
if [ "$REDIS_RUNNING" = true ] || [ "$REDIS_CONTAINER" = true ]; then
    echo "Redis should now be accessible on port 7653"
    echo "If Node.js application is still having issues, restart it:"
    echo "  docker compose restart node"
    echo ""
    echo "Or check the application logs:"
    echo "  docker logs scrapengine-node -f"
else
    echo "Redis is not running on port 7653"
    echo "Please check the errors above and fix manually"
fi