-- Migration to add Vector RAG support (pgvector and tournament_rules table)

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the tournament_rules table for storing PDF rulebook chunks and embeddings
CREATE TABLE IF NOT EXISTS tournament_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_text TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create an HNSW index to dramatically speed up semantic vector similarity searches
CREATE INDEX IF NOT EXISTS tournament_rules_embedding_idx 
ON tournament_rules 
USING hnsw (embedding vector_cosine_ops);
