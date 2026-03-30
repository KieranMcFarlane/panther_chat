# BrightData FastMCP Droplet Deployment

This is the production deployment shape for the BrightData FastMCP gateway:

- Bright Data MCP stays the upstream retrieval backend
- FastMCP runs as a persistent HTTP service
- the app points to the FastMCP URL instead of cold-starting MCP per request

## Build the image

From `apps/signal-noise-app`:

```bash
docker build -f Dockerfile.fastmcp -t signal-noise-brightdata-fastmcp .
```

## Run it locally

```bash
docker run --rm -p 8000:8000 \
  -e BRIGHTDATA_API_TOKEN="$BRIGHTDATA_API_TOKEN" \
  -e BRIGHTDATA_FASTMCP_HOST=0.0.0.0 \
  -e BRIGHTDATA_FASTMCP_PORT=8000 \
  signal-noise-brightdata-fastmcp
```

## Health check

The container exposes:

- `GET /health`
- `POST /mcp`

Verify locally:

```bash
curl -fsS http://localhost:8000/health
```

Expected output:

```text
OK
```

## Droplet deployment

On a DigitalOcean Droplet:

1. Install Docker.
2. Pull or build the image.
3. Run the container with the Bright Data API token injected as an environment variable.
4. Map port `8000`.
5. Point the pipeline at:

```bash
export BRIGHTDATA_FASTMCP_URL=http://<droplet-ip>:8000/mcp
export PIPELINE_USE_BRIGHTDATA_FASTMCP=true
export PIPELINE_BRIGHTDATA_SHARED_CLIENT=true
```

## Notes

- The container binds `0.0.0.0` so it is reachable from outside the container.
- The app still uses DeepSeek for reasoning; FastMCP is only the retrieval transport.
- Do not bake the Bright Data token into the image. Pass it at runtime.
