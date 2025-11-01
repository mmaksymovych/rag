# Resource Optimization Guide

## Problem Summary

The system was experiencing memory issues because:
- **Docker Total Memory**: 7.654 GiB
- **Model Required**: `llama3:8b` needs ~5.4 GiB when loaded
- **Available Memory**: Only ~4.4-4.5 GiB (after other containers use memory)
- **Result**: Model couldn't load, causing 500 errors

## Solutions

### ✅ Solution 1: Use Smaller Model (IMPLEMENTED)

**What we did:**
- Switched from `llama3:8b` (4.7 GB, needs 5.4 GiB RAM) to `phi3:mini` (2.2 GB, needs ~2.5 GiB RAM)
- Updated `docker-compose.yml` to use `phi3:mini`

**Status:** ✅ Working now!

**Model Comparison:**
| Model | Size | RAM Needed | Quality |
|-------|------|------------|---------|
| `llama3:8b` | 4.7 GB | ~5.4 GiB | High |
| `phi3:mini` | 2.2 GB | ~2.5 GiB | Good |
| `llama3:2b` | 1.3 GB | ~1.5 GiB | Lower |

### Solution 2: Increase Docker Memory

**For Docker Desktop (macOS/Windows):**
1. Open Docker Desktop
2. Go to Settings → Resources → Advanced
3. Increase Memory allocation to **8 GB or more**
4. Click "Apply & Restart"

**Command line (Linux):**
```bash
# Edit Docker daemon configuration
sudo nano /etc/docker/daemon.json

# Add:
{
  "default-ulimits": {
    "memlock": {
      "Hard": -1,
      "Name": "memlock",
      "Soft": -1
    }
  }
}

# Restart Docker
sudo systemctl restart docker
```

### Solution 3: Set Container Memory Limits

Add memory limits to `docker-compose.yml`:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    deploy:
      resources:
        limits:
          memory: 6G
        reservations:
          memory: 4G
```

**Note:** This requires Docker Swarm mode or Docker Compose v3 with deploy section.

### Solution 4: Use Quantized Models

Quantized models use less memory but maintain good quality:

```bash
# Pull quantized versions
docker exec rag-ollama-1 ollama pull llama3:8b-q4_0  # 4-bit quantization
docker exec rag-ollama-1 ollama pull llama3:8b-q5_0  # 5-bit quantization
```

**Trade-off:** Slightly lower quality, but much lower memory usage.

### Solution 5: Stop Unnecessary Containers

Free up memory by stopping services you're not using:

```bash
# Check memory usage
docker stats

# Stop unused containers
docker stop librechat  # If not using UI
docker stop mongodb    # If LibreChat is stopped
```

## Current Configuration

**Active Setup:**
- Model: `phi3:mini` (2.2 GB)
- Memory Usage: ~2.5 GiB when loaded
- Status: ✅ Working

**Docker Resources:**
- Total Memory: 7.654 GiB
- Available for Ollama: ~5 GiB (after other services)
- Margin: ✅ Sufficient

## Monitoring Memory

**Check current usage:**
```bash
# Overall Docker memory
docker stats --no-stream

# Ollama container specifically
docker stats rag-ollama-1 --no-stream

# System memory
docker info | grep -i memory
```

## Troubleshooting

### If you still get memory errors:

1. **Check actual memory available:**
   ```bash
   docker stats --no-stream
   ```

2. **Verify model size:**
   ```bash
   docker exec rag-ollama-1 ollama list
   ```

3. **Try an even smaller model:**
   ```bash
   docker exec rag-ollama-1 ollama pull llama3:2b
   # Then update docker-compose.yml to use llama3:2b
   ```

4. **Reduce other services' memory:**
   - Stop MongoDB if not needed
   - Stop LibreChat if only testing API
   - Limit Qdrant memory (if possible)

## Recommendations

**For Development:**
- ✅ Use `phi3:mini` or `llama3:2b` (current setup)
- Keep Docker memory at 7-8 GB minimum

**For Production:**
- Use larger models (`llama3:8b`) with more RAM (16+ GB)
- Consider quantized models for balance
- Use dedicated servers with 32+ GB RAM

## Performance Impact

**phi3:mini vs llama3:8b:**
- **Speed**: Faster inference (~2-3x)
- **Quality**: Slightly lower, but good for most tasks
- **Memory**: Uses 50% less RAM
- **Best for**: Development, testing, moderate workloads

The current setup with `phi3:mini` is optimal for development and should handle your RAG system well!

