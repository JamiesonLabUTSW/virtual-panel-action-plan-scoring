#!/bin/bash
# Run integration tests with environment variables properly loaded

# Load environment variables from .env file
set -a
source .env
set +a

# Set integration test flag
export RUN_INTEGRATION_TESTS=true

# Run the integration tests
npm test --workspace=@grading/server -- structured-output-integration
