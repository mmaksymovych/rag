# Local Hugging Face Whisper Setup

## Overview

The system now uses **Hugging Face Whisper models** running locally via `@xenova/transformers`. This means:

✅ **No OpenAI API key required!**  
✅ **All processing happens locally** (privacy-friendly)  
✅ **Models are cached after first download**  
✅ **Automatic fallback to OpenAI** (if configured)

## Configuration

### Environment Variables

In `docker-compose.yml`, the following variables are set:

```yaml
environment:
  - USE_LOCAL_WHISPER=true  # Enable local Whisper (default)
  - WHISPER_MODEL=Xenova/whisper-small  # Model to use
```

### Available Models

You can choose different Whisper model sizes based on your needs:

| Model | Size | Speed | Accuracy | Memory |
|-------|------|-------|----------|--------|
| `Xenova/whisper-tiny` | ~39M params | ⚡⚡⚡ Fastest | Good | Low |
| `Xenova/whisper-base` | ~74M params | ⚡⚡ Fast | Better | Medium |
| `Xenova/whisper-small` | ~244M params | ⚡ Balanced | **Best** | Medium-High |
| `Xenova/whisper-medium` | ~769M params | Slow | Excellent | High |
| `Xenova/whisper-large` | ~1.55B params | Slowest | Best | Very High |

**Recommended:** `whisper-small` (default) - best balance of accuracy and speed.

### Changing the Model

Edit `docker-compose.yml`:

```yaml
environment:
  - WHISPER_MODEL=Xenova/whisper-base  # Use smaller model for faster processing
  # or
  - WHISPER_MODEL=Xenova/whisper-medium  # Use larger model for better accuracy
```

Then restart:
```bash
docker-compose restart nestjs-api
```

## First Run

On the first transcription request, the model will be downloaded from Hugging Face:

1. **Download time:** ~500MB for `whisper-small` (downloads once)
2. **Cached location:** `./huggingface_cache/` (persisted via Docker volume)
3. **Subsequent runs:** Instant model loading from cache

## How It Works

```
┌─────────────┐
│ Audio/Video │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  Local Hugging Face      │
│  Whisper Model          │
│  (Xenova/whisper-small) │
│  ┌───────────────────┐ │
│  │ @xenova/transformers│ │
│  │ - Runs on CPU      │ │
│  │ - No API calls     │ │
│  │ - Fully local      │ │
│  └───────────────────┘ │
└──────┬──────────────────┘
       │
       ▼
┌─────────────┐
│  Text       │
│  (Chunked & │
│  Embedded)  │
└─────────────┘
```

## Fallback Behavior

The system automatically falls back to OpenAI Whisper API if:
- Local Whisper fails
- `USE_LOCAL_WHISPER=false` is set
- OpenAI API key is configured

To disable local Whisper and use OpenAI only:
```yaml
environment:
  - USE_LOCAL_WHISPER=false
  - OPENAI_API_KEY=sk-your-key-here
```

## Performance Notes

### CPU Processing
- Models run on CPU by default
- First transcription: ~30-60 seconds (model loading + transcription)
- Subsequent transcriptions: ~5-20 seconds (depending on audio length)

### GPU Support (Optional)
If you have NVIDIA GPU, you can enable GPU acceleration:
- Requires CUDA setup in Docker
- Much faster inference (5-10x speedup)
- Currently set to `cpu` - can be changed to `gpu` in code

### Memory Usage
- `whisper-small`: ~1-2GB RAM during transcription
- `whisper-base`: ~500MB-1GB RAM
- `whisper-medium`: ~2-4GB RAM
- `whisper-large`: ~4-8GB RAM

## Troubleshooting

### Model Download Issues

If model fails to download:
```bash
# Check network connectivity in container
docker-compose exec nestjs-api curl https://huggingface.co

# Check cache directory
ls -lh huggingface_cache/
```

### Out of Memory Errors

If you get memory errors:
1. Use a smaller model: `Xenova/whisper-base` or `Xenova/whisper-tiny`
2. Increase Docker memory allocation
3. Process shorter audio files

### Slow Transcription

For faster processing:
- Use `whisper-tiny` or `whisper-base`
- Enable GPU if available
- Process shorter audio segments

## Model Cache

Models are cached in `./huggingface_cache/` directory:
- **Size:** ~500MB-3GB depending on model
- **Persistent:** Survives container restarts
- **Shared:** All containers use the same cache

To clear cache and re-download:
```bash
rm -rf huggingface_cache/
docker-compose restart nestjs-api
```

## Testing

### Test Audio Transcription

```bash
# Upload an audio file
curl -X POST http://localhost:3000/file/upload/audio \
  -F "file=@test-audio.mp3"
```

### Test Video Transcription

```bash
# Upload a video file
curl -X POST http://localhost:3000/file/upload/video \
  -F "file=@test-video.mp4"
```

### Check Logs

Watch the transcription process:
```bash
docker-compose logs -f nestjs-api | grep -E "AudioService|Whisper|transcription"
```

Expected log output:
```
[AudioService] Transcribing audio file: /app/uploads/...
[AudioService] Using local Hugging Face Whisper model: Xenova/whisper-small
[AudioService] Model loaded, starting transcription...
[AudioService] Local Whisper transcription completed - Text length: 1234 chars, Duration: 15234ms
```

## Advantages Over OpenAI API

✅ **No API costs** - Free to use  
✅ **Privacy** - Data never leaves your server  
✅ **No rate limits** - Process as many files as you want  
✅ **Offline capable** - Works without internet (after initial download)  
✅ **Customizable** - Choose model size based on your needs  

## Language Support

Whisper models support **99+ languages** automatically:
- English, Spanish, French, German, Chinese, Japanese, etc.
- Auto-detects language from audio
- Set `language: 'en'` in code to force English only

## Summary

The system is now configured to use **local Hugging Face Whisper models** by default:
- ✅ No API key needed
- ✅ Models cached locally
- ✅ Fully private and local
- ✅ Automatic fallback to OpenAI if configured

Just upload your audio/video files and transcription happens automatically!
