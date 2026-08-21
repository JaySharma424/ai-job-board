import os
from qdrant_client import QdrantClient
from qdrant_client.http import models
from fastembed import TextEmbedding
from typing import List, Optional

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

# Must match the collection name and model used in Colab
COLLECTION_NAME = "jobs_vector_collection_local"
VECTOR_DIMENSION = 384

qdrant_client = None
try:
    if QDRANT_URL and QDRANT_API_KEY:
        qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        print("✅ Connected to Qdrant Cloud API successfully!")
    else:
        print("⚠️ QDRANT_URL or QDRANT_API_KEY missing.")
except Exception as e:
    print(f"⚠️ Failed to connect to Qdrant API: {e}")

# Initialize FastEmbed with the exact model used during migration
print("🧠 Loading local FastEmbed model (sentence-transformers/all-MiniLM-L6-v2)...")
embedding_model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
print("✅ Local FastEmbed model loaded successfully!")

def init_vector_db():
    if not qdrant_client:
        return False
    try:
        collections = qdrant_client.get_collections().collections
        exists = any(c.name == COLLECTION_NAME for c in collections)
        if not exists:
            qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=VECTOR_DIMENSION,
                    distance=models.Distance.COSINE
                )
            )
        return True
    except Exception as e:
        print(f"⚠️ Qdrant initialization error: {e}")
        return False

def generate_embedding(text: str, is_query: bool = False) -> Optional[List[float]]:
    """Generates a 384-dimensional query vector matching Qdrant."""
    try:
        vectors = list(embedding_model.embed([text]))
        return vectors[0].tolist()
    except Exception as e:
        print("Local Embedding Generation Error:", e)
        return None