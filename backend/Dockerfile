FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Render ignores the port number here, but it's good practice)
EXPOSE 8000

# Dynamically bind to Render's assigned PORT (defaults to 8000 locally)
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"