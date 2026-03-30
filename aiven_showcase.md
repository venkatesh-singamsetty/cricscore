# 🏏 CricScore: A Case Study in Event-Driven Architecture (#AivenFreeTier)

CricScore is a real-time cricket match engine built to solve the "Live Score Lag" problem. This project serves as a showcase for building high-performance, event-driven applications using **100% Aiven Free Tier** services.

## 🚀 The v1.5.2 Evolution: Viral Sharing & Zero Friction
In v1.5.2, we finalized the pivot from legacy email-based reporting to an **Instant Viral Sharing Engine**. By leveraging **Aiven Kafka** as our high-speed event pipe and **Aiven PostgreSQL** as our reliable truth-of-source, we've enabled:

1. 🔗 **One-Tap Match Link Sharing**: Scorers can instantly broadcast a match link to thousands of fans via a single clipboard action.
2. 🚀 **Deep-Link Restoration**: Visitors hitting a sharable URL are instantly routed directly to the scoreboard via automated v1.5.2 fetch logic on the Viewer Hub.
3. 🛡️ **Identity Synchronization**: PIN-based authentication ensures that only matched scorers can modify the real-time stream.

## 🏆 Powered by Aiven Managed Services
The core of CricScore's performance resides in the synergy between its persistence and streaming layers:

### **Aiven for PostgreSQL: The Source of Truth**
- **Persistence Layer**: Every ball event, player stat, and match metadata record is safely archived in Aiven PG.
- **Deep-Link Recovery**: Our new **v1.5.2 restoration logic** relies on Aiven's optimized indexing to instantly hydrate the scoreboard state for spectators joining via direct links.

### **Aiven for Apache Kafka: The Sub-Second Pulse**
- **Real-Time Streaming**: Every score update is pushed as a Secure JSON packet through **Aiven Kafka** via a hardened **mTLS (Mutual TLS)** connection.
- **WebSocket Broadcast**: AWS Lambdas trigger directly from Kafka events, pushing live balls to fans globally with sub-second latency.

## 🛡️ Hardened Enterprise Standards
- **mTLS Encryption**: We've implemented full Mutual TLS for all Kafka communication, ensuring our serverless producers and consumers are securely authenticated.
- **Database Pruning & Isolation**: Integrated Admin controls for cleaning stale match data and enforcing session isolation to prevent data leakage between scorers.

---

**CricScore is officially production-hardened at v1.5.2.** 🏁🏏🥇🏆🛰️🛡️🛑🛡️
