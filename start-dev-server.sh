#!/bin/bash
# Load environment variables from .env file
set -a
source .env
set +a

# CopilotKit's BuiltInAgent uses the Vercel AI SDK internally, which expects
# standard OpenAI env vars. Azure OpenAI v1 API accepts the same auth pattern.
export OPENAI_API_KEY="${AZURE_OPENAI_API_KEY}"
export OPENAI_BASE_URL="https://${AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/"

# Start the server with environment variables loaded
npm run dev --workspace=@grading/server
