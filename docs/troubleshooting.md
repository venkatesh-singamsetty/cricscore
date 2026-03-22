# 🚀 Troubleshooting & Fix Log

This engineering trace documents the real-world resolutions for the CricScore backend integration.

---

## 🚦 Resolved Issues Summary

### 1. **`SSL Alert: Bad Certificate` (Phase 3)**
- **Symptom**: `SSLAlert: Bad Certificate` when Kafka Producer tried to connect.
- **Cause**: Broker was configured for **Mutual TLS (mTLS)** and was rejecting the client for missing certificates.
- **Fix**: 
    - Switched from SASL/PLAIN to Client Certificate authentication.
    - Downloaded Aiven `service.cert` and `service.key`.
    - Embedded `ca.pem`, `cert.pem`, and `key.pem` into the Lambda build.
    - Updated `index.js` `ssl` block to include `cert` and `key` buffers.

### 2. **`Connection Timeout` (Phase 3)**
- **Symptom**: `LambdaTimeout: 30s` exceeded during ball scoring.
- **Cause**: Initial 3s timeout + 128MB RAM was too slow for (1) PG SSL handshake + (2) Kafka mTLS handshake + (3) SQL dual-write.
- **Fix**: 
    - Increased memory to **256MB** (Giving the Lambda more CPU power for encryption).
    - Hardened the timeout to **30s**.

### 3. **`CERTIFICATE_UNKNOWN` (Phase 4)**
- **Symptom**: SSL Alert 46 from the broker.
- **Cause**: Mismatch between the broker listener port and the client's handshake protocol.
- **Fix**: Identified Port **17729** as the universal SSL listener for this specific Aiven cluster.

---

## ✅ Verified State
- **Ball ID `aeca9859-...`**: Confirmed in Aiven PostgreSQL.
- **Ball ID `05c1876c-...`**: Confirmed in WebSocket Broadcast (PieSocket).
- **Latency**: Sub-second end-to-end.
