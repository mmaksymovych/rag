# LM Studio Setup Guide

This guide explains how to configure the RAG system to use local LM Studio as the LLM provider.

## Prerequisites
- LM Studio installed on your local machine
- LM Studio running with local server enabled on port 1234

## Setup Steps

1. **Install LM Studio**
   - Download from https://lmstudio.ai
   - Install and launch the application

2. **Load Models in LM Studio**
   - **Chat Model**: Load `gemma:3n-e4b` (or any compatible chat model)
   - **Embedding Model**: Load `nomic-embed-text` (or any compatible embedding model)

3. **Enable Local Server**
   - In LM Studio, go to Settings → Local Server
   - Enable the local server
   - Ensure it's running on port 1234

4. **Configure docker-compose.yml**
   ```yaml
   environment:
     - LM_STUDIO_API_URL=http://host.docker.internal:1234/v1
   ```

5. **Start Services**
   ```bash
   docker-compose up -d
   ```

## Verification
```bash
# Test LM Studio connection
curl http://localhost:1234/v1/models

# Test NestJS API
curl http://localhost:3000/health
```

## Troubleshooting

### Cannot connect from Docker container
- **Solution**: Ensure `host.docker.internal` resolves correctly
  - On Mac/Windows: Works by default
  - On Linux: May need to add `extra_hosts: - "host.docker.internal:host-gateway"` to nestjs-api service in docker-compose.yml

### Port 1234 not accessible
- **Solution**: Check LM Studio local server is enabled and running
- Verify firewall isn't blocking the port

### Models not loading
- **Solution**: Ensure models are downloaded and loaded in LM Studio
- Check that both chat and embedding models are available
- Verify model names match the configuration in docker-compose.yml

### Slow responses
- **Solution**: Ensure you have sufficient RAM/VRAM for the models
- Consider using smaller quantized models if resources are limited
- Check LM Studio resource usage in Task Manager/Activity Monitor

## Model Compatibility

LM Studio supports OpenAI-compatible API, so various models work:

- **Chat Models**: `gemma:3n-e4b`, `llama-3.2-3b-instruct`, `phi-3-mini`, etc.
- **Embedding Models**: `nomic-embed-text`, `all-minilm`, etc.

Check the available models in LM Studio and update the `LM_STUDIO_CHAT_MODEL` and `LM_STUDIO_EMBEDDING_MODEL` environment variables accordingly.

## Configuration

Update these environment variables in `docker-compose.yml`:

```yaml
environment:
  - LM_STUDIO_API_URL=http://host.docker.internal:1234/v1
  - LM_STUDIO_EMBEDDING_MODEL=nomic-embed-text
  - LM_STUDIO_CHAT_MODEL=gemma:3n-e4b
  - LM_STUDIO_TIMEOUT_SECONDS=600
```

## Performance Tips

- **GPU Acceleration**: LM Studio automatically uses GPU if available
- **Model Selection**: Choose models that fit your hardware constraints
- **Quantization**: Use quantized models (Q4, Q5) for better performance on limited hardware
- **Resource Monitoring**: Monitor CPU/GPU usage in LM Studio to optimize performance
