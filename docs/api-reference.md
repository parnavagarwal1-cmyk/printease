# PrintEase REST API Specification

Base URL: `http://127.0.0.1:8000/api`

---

## 1. Public Endpoints

### Health Check
- `GET /health`
  - Returns service status for MySQL, storage, queue, and Laravel runtime.

### QR Code & Order Flow
- `GET /public/qr/{token}`
  - Resolves branch details, active printers, and pricing rules from a scanned QR token.
- `POST /public/qr/{token}/upload`
  - Uploads a customer PDF file to private storage and computes SHA-256 hash and page count.
- `POST /public/qr/{token}/estimate`
  - Calculates subtotal, 18% GST, and total order cost based on page count, duplex mode, and paper size.
- `POST /public/qr/{token}/orders`
  - Creates a customer order with status `UPLOADED`.
- `GET /public/orders/{orderNumber}`
  - Returns live order status, queue position, and print telemetry.

### Payments
- `POST /public/orders/{orderNumber}/pay`
  - Initiates Razorpay payment and returns `razorpay_order_id`, key, and amount in paise.
- `POST /public/orders/{orderNumber}/verify-payment`
  - Verifies Razorpay checkout signature and moves order to `PRINT_QUEUED`.
- `POST /webhooks/razorpay`
  - Idempotent webhook receiver for automated asynchronous payment events.

---

## 2. Desktop Agent Endpoints

All desktop agent endpoints require the header `X-Device-Token: <token>` (except `/pair`).

- `POST /desktop/pair`
  - Pairs a Windows workstation using a single-use pairing code (`PRNT-XXXX-XX`).
  - Returns `device_token` and device metadata.
- `POST /desktop/heartbeat`
  - Sends hardware telemetry and confirms device online status.
- `GET /desktop/printers`
  - Lists assigned printers for the device's branch.
- `GET /desktop/jobs/poll`
  - Polls for queued print jobs waiting for this branch.
- `POST /desktop/jobs/{id}/claim`
  - Claims an exclusive 2-minute lease lock on a print job.
  - Returns `job_lease_token` and secure download URL.
- `GET /desktop/jobs/{id}/download`
  - Downloads the encrypted PDF stream. Requires `X-Job-Lease-Token` header.
- `POST /desktop/jobs/{id}/status`
  - Reports status transitions (`DOWNLOADING`, `PRINTING`, `COMPLETED`, `PRINT_FAILED`) and telemetry.

---

## 3. Shop Owner & Tenant Endpoints

Requires `Authorization: Bearer <sanctum_token>` header.

### Authentication
- `POST /auth/register`
  - Registers a new shop owner, shop, default branch, pricing rules, and QR token.
- `POST /auth/login`
  - Authenticates user and returns Sanctum Bearer token.
- `GET /auth/me`
  - Returns currently authenticated user profile and memberships.
- `POST /auth/logout`
  - Revokes current API token.

### Fleet & Branch Management
- `GET /branches` / `POST /branches`
  - Lists or creates branches (enforcing subscription plan limits).
- `GET /branches/{id}` / `PUT /branches/{id}`
  - Retrieves or updates branch metadata.
- `GET /branches/{id}/analytics`
  - Returns daily revenue, completed prints, active printers, and online devices.
- `GET /branches/{id}/orders`
  - Lists all orders for the branch with pagination and filtering.
- `PUT /branches/{id}/pricing-rules`
  - Updates pricing rules per paper size, duplex mode, and GST percentage.
- `POST /branches/{id}/printers`
  - Adds a new physical printer with capabilities (color, duplex, paper sizes).
- `POST /branches/{id}/pairing-code`
  - Generates a 15-minute single-use pairing code for a Windows workstation.
- `GET /branches/{id}/qr-poster`
  - Returns high-resolution printable QR code poster data for branch counters.

### SaaS Subscriptions
- `POST /shops/{id}/subscribe`
  - Switches shop tier (`starter`, `pro`, `fleet`) and adjusts branch/printer quotas.

---

## 4. Super Admin Control Plane

Requires `Authorization: Bearer <sanctum_token>` where `user.role === 'super_admin'`.

- `GET /admin/metrics`
  - System-wide GMV, total orders, completed prints, active shops, and subscriber distribution.
- `GET /admin/shops`
  - Lists all registered shops with owner info, branch counts, and active plans.
- `PUT /admin/shops/{id}/status`
  - Activates or suspends a shop account.
- `GET /admin/audit-logs`
  - Tamper-evident administrative audit trail with IP address and action details.
- `GET /admin/plans`
  - Lists available subscription tiers and pricing configurations.
