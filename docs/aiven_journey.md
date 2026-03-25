# 🏏 CricScore: The Aiven Free Tier Journey (#AivenFreeTier)

## 🏛️ The Problem: The "Live Score Lag"
Cricket is a game of moments. A ball delivery lasts seconds, but fans often experience 10-30 second delays between the field and their screens. Most real-time scoring platforms are either (a) expensive enterprise solutions or (b) poorly synchronized simple databases.

Our goal was to build a **Professional-Grade Scoring Engine** that:
1. Costs **$0/month** to run.
2. Achieves **sub-second latency** globally.
3. Ensures **data integrity** for historical analytics.

## 🏆 Why We Chose Aiven?
Modern serverless architecture needs more than just a place to store data; it needs a way to **stream events**. Aiven provided the two critical missing pieces for our stack:

### 1. **Aiven for Apache Kafka: The High-Throughput Heart**
We needed a way to broadcast ball-by-ball events to thousands of fans instantly. traditional database triggers are too slow. Aiven's Kafka Free Tier allowed us to:
- Implement a **Decoupled Architecture**: Our scoring API (Lambda) doesn't have to worry about broadcasting; it just publishes a message.
- **Mutual TLS (mTLS) Security**: Aiven's security-first approach gave us hands-on experience implementing enterprise-grade client certificates in a serverless environment—a rare feat in small-scale projects.

### 2. **Aiven for PostgreSQL: The Source of Truth**
While Kafka handles the "Now", PostgreSQL handles the "Always". 
- We use Aiven PG to maintain a **100% accurate historical record** of every ball, player stat, and match result.
- The ease of the Web Console allowed us to monitor and manage our schemas without heavy DBA overhead.

---

## 🛠️ The Technical "Wow" Factor: Dual-Write & mTLS
The true technical execution lies in our **Dual-Write Engine**:
- **Consistency:** Every `POST /update-score` performs an ACID-compliant transaction in PostgreSQL.
- **Propagation:** Simultaneously, it publishes an encrypted message to Aiven Kafka.
- **Broadcast:** An asynchronous broadcaster lambda picks up the Kafka stream and flushes scores to spectators via WebSockets with **<100ms internal latency**.

## 🚀 Challenges Overcome
- **The mTLS Handshake:** Handshaking with Kafka using client certificates is resource-intensive for standard 128MB Lambdas. We learned to optimize our library selection and memory allocation to ensure smooth, zero-latency connections.
- **Synchronizing State:** We implemented a custom **"Undo" engine** that synchronizes deletions across both Postgres and Kafka streams to ensure spectators never see "ghost" balls.

## 🏁 Conclusion
Aiven didn't just provide "databases-as-a-service"; it provided the **infrastructure foundation** that allowed us to move from a concept to a live product in just three days. 

CricScore is now live at [cricscore.venkateshsingamsetty.site](https://cricscore.venkateshsingamsetty.site) — powered by **Aiven Free Tier**.
