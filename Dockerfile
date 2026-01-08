# Dockerfile for ORC-OS FastAPI Backend
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ORC_HOME=/app/data
ENV ORC_UPLOAD_DIRECTORY=/app/data/uploads


# Install system dependencies required for rasterio, opencv, and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    libffi-dev \
    libpq-dev \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set GDAL environment variables
ENV GDAL_CONFIG=/usr/bin/gdal-config

# Set working directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY pyproject.toml ./
COPY LICENSE ./
COPY README.md ./
# Copy application code
COPY orc_api/ ./orc_api/

# Copy entrypoint script, make executable
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
#    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir .

# Create data directories
RUN mkdir -p /app/data/uploads /app/data/uploads/videos /app/data/uploads/incoming /app/data/logs /app/data/tmp

# Expose the FastAPI port
EXPOSE 5000

# Run the FastAPI application
CMD ["./entrypoint.sh"]
