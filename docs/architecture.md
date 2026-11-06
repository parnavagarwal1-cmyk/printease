# PrintEase Architecture & Engineering Specification

## 1. System Overview

PrintEase is a multi-tenant cloud SaaS and distributed hardware spooler platform engineered for high-throughput self-service printing in India. It bridges customer smartphones, cloud infrastructure, and physical Windows print workstations without requiring customers to install mobile apps or send sensitive documents over WhatsApp or Bluetooth.

```
                    ┌────────────────────────┐
                    │  Customer Smartphone   │
                    │  (Scan QR / Mobile Web)│
                    └───────────┬────────────┘
                                │ HTTPS
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                     PrintEase Cloud API                      │
 │                   (Laravel 11 / Sanctum)                     │
 │  ┌─────────────────┬──────────────────┬──────────────────┐   │
 │  │ Pricing Engine  │ Razorpay Gateway │ Job Queue Lease  │   │
 │  └─────────────────┴──────────────────┴──────────────────┘   │
 └──────────────┬──────────────────────────────▲────────────────┘
                │                              │ Polling + Leases
                │ Encrypted Storage            │ (X-Device-Token)
                ▼                              │
         ┌──────────────┐         ┌────────────┴─────────────┐
         │ Private Disk │         │  Windows Desktop Agent   │
         │  Storage     │         │  (Electron + Spooler)    │
         └──────────────┘         └────────────┬─────────────┘
                                               │ Win32 API
                                               ▼
                                      ┌─────────────────┐
                                      │ Physical Printer│
                                      │ (LaserJet / iR) │
                                      └─────────────────┘
```

---

## 2. Multi-Tenant Isolation Model

Tenant isolation is enforced across all layers of the database and API:

1. **User Role Hierarchy**:
   - `super_admin`: Platform owner with global visibility, shop activation/suspension, SaaS subscription control, and system-wide GMV analytics.
   - `shop_owner`: Tenant owner managing shops, branches, printers, pricing rules, and pairing codes.
   - `staff`: Shop operator with branch-level execution visibility.

2. **Scoped Foreign Keys**:
   - `shops` -> `branches` -> `printers`, `desktop_devices`, `qr_codes`, `pricing_rules`.
   - All tenant queries are strictly constrained by `shop_id` or `branch_id`.
   - `canAccessShop($id)` and `canAccessBranch($id)` methods on `User` enforce access at the controller layer.

3. **Plan Quotas Matrix**:
   | Plan Tier | Monthly Price | Max Branches | Max Printers / Branch | Routing Features |
   |:---|:---|:---|:---|:---|
   | **Starter** | ₹499 | 1 | 2 | Single branch, basic analytics |
   | **Pro** | ₹1,499 | 3 | 10 | Up to 3 branches, advanced fleet routing |
   | **Fleet** | ₹3,999 | Unlimited | Unlimited | Unlimited branches, high-volume queuing |

---

## 3. Order Lifecycle State Machine

An order moves through strict sequential states:

```
[UPLOADED] ──> [PAYMENT_PENDING] ──> [PRINT_QUEUED] ──> [DOWNLOADING] ──> [PRINTING] ──> [COMPLETED]
                     │
                     └──> [FAILED] (Payment signature failure)
```

1. **UPLOADED**: Customer scanned QR and uploaded PDF. Page count is validated and SHA-256 checksum generated.
2. **PAYMENT_PENDING**: Customer initiated Razorpay checkout modal with exact calculated subtotal + GST.
3. **PRINT_QUEUED**: Payment verified via HMAC-SHA256 signature or asynchronous webhook; `PrintJob` enqueued.
4. **DOWNLOADING**: Windows Desktop Agent claimed the job with a 2-minute exclusive lease token.
5. **PRINTING**: Windows Desktop Agent verified SHA-256 checksum and spooled file to Win32 print queue.
6. **COMPLETED**: Print queue completed physical document output.

---

## 4. Conflict-Free Multi-Device Lease Locking

In print shops with multiple counter workstations connected to the same printer fleet:
- The backend uses `SELECT ... FOR UPDATE` row-level locks during `POST /api/desktop/jobs/{id}/claim`.
- An exclusive `job_lease_token` with an expiration timestamp (`leased_until`) is granted to the claiming workstation.
- If a second workstation attempts to claim the same job, the API immediately returns `HTTP 409 Conflict`.
- If an agent crashes while printing, the expired lease is automatically re-opened for other agents upon the next poll cycle.

---

## 5. Security & Data Integrity

- **Document Isolation**: Uploaded customer files are placed in `storage/app/private/orders/YYYY/MM/DD/` and are inaccessible via direct URL.
- **Integrity Checksums**: SHA-256 hashes are recorded upon upload and verified prior to physical spooling.
- **Single-Use Pairing**: Desktop pairing codes (`PRNT-XXXX-XX`) expire after 15 minutes and are destroyed immediately upon successful device pairing.
- **Persistent Device Authentication**: Paired workstations receive a cryptographically random device token (`dtk_...`) stored as a SHA-256 hash in the database.
- **Audit Trail**: Key administrative events (device pairing, quota upgrades, payment captures) are logged to the `audit_logs` table.
