# PrintEase - Multi-Shop Cloud Self-Service Printing SaaS

[![Laravel](https://img.shields.io/badge/Laravel-11-FF2D20.svg?logo=laravel)](https://laravel.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg?logo=vite)](https://vitejs.dev)
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg?logo=electron)](https://www.electronjs.org)
[![Tests](https://img.shields.io/badge/Tests-46%20Passed%20(299%20Assertions)-success.svg)]()

**PrintEase** is an end-to-end, multi-tenant cloud printing SaaS platform built for print shops across India. It eliminates manual queues and unsecure file sharing via WhatsApp/Bluetooth by empowering customers to scan a counter QR code, configure print options (color, duplex, copies, paper sizes), pay online via Razorpay/UPI, and have documents automatically dispatched to local physical printers via a secure Windows Desktop Agent.

---

## Architecture Overview

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

## Key System Modules

### 1. Customer Self-Service Web Portal (`frontend/`)
- **Zero Install**: Direct mobile web interface triggered by scanning a counter QR code.
- **Smart Upload**: Fast PDF processing with automatic page count detection and SHA-256 integrity checksumming.
- **Real-Time Pricing Engine**: Calculates duplex sheet optimization (`per_sheet` vs `per_side`), color/mono rates, and 18% GST with configurable minimum order thresholds.
- **Payment Gateway**: Seamless Razorpay UPI/Card checkout modal with HMAC-SHA256 signature verification.
- **Live Order Tracking**: Visual step-by-step progress tracking from payment confirmation to physical spooling.

### 2. Windows Desktop Agent & Print Spooler (`desktop/`)
- **Single-Use Secure Pairing**: Pairs to a branch in seconds using a time-limited pairing code (`PRNT-XXXX-XX`).
- **Conflict-Free Lease Locking**: Multi-device queue polling with atomic `job_lease_token` granting to prevent duplicate printing across shop computers.
- **Secure Document Streaming**: Direct signed chunk streaming from private storage directly into Windows spooler buffer.
- **Hardware Telemetry & Heartbeat**: Real-time printer status monitoring (`idle`, `printing`, `offline`).

### 3. Shop Owner Fleet Dashboard (`frontend/` + `backend/`)
- **Fleet Analytics**: Daily revenue tracking, order volume, completed print jobs, and online device monitors.
- **Dynamic Pricing Editor**: Configure custom rates per paper size (A4, A3, Legal), color modes, and duplex modes.
- **Printable QR Poster Generator**: One-click generation of branded printable counter standees.
- **Printer Management**: Register and configure hardware capabilities (duplex, color, paper sizes).

### 4. Super Admin SaaS Control Plane (`frontend/` + `backend/`)
- **Platform Analytics**: Gross Platform Volume (GMV), total active branches, print counts, and SaaS subscriber distribution.
- **Tenant Management**: Instantly activate or suspend shop accounts.
- **Plan Quota Enforcement**: Tiered subscription controls:
  - **Starter** (₹499/mo): 1 branch, 2 printers/branch.
  - **Pro** (₹1,499/mo): 3 branches, 10 printers/branch.
  - **Fleet** (₹3,999/mo): Unlimited branches & printers.
- **Tamper-Evident Audit Logs**: Complete trail of system actions with IP tracking.

---

## Quick Start & Dev Runner

### Prerequisites
- **PHP**: 8.3+ (e.g. Laragon or PHP CLI)
- **MySQL**: 8.4+ running on port `3306` (database `printease`)
- **Node.js**: 20+ and npm

### Single-Command Start (Windows)
Double-click `dev.bat` in the project root, or execute via PowerShell:

```powershell
.\scripts\dev.ps1
```

This starts all three services in their own terminal windows:
1. **Backend API**: `http://127.0.0.1:8000`
2. **Frontend Web**: `http://localhost:5173`
3. **Desktop Agent**: Electron Window

---

## Seeded Demo Credentials

| Role | Email | Password | Details |
|:---|:---|:---|:---|
| **Super Admin** | `superadmin@printease.com` | `Secret@12345` | Global Control Plane access |
| **Shop Owner** | `owner@metroprint.com` | `Secret@12345` | Metro Express Print fleet manager |

### Pre-Configured Test Identifiers
- **Branch**: Connaught Place Main Branch
- **Active Pairing Code**: `PRNT-8821-X9`
- **Demo Customer QR Token**: `pe_demo_connaught_branch_token_99`
- **Customer Direct Link**: `http://localhost:5173/?qr=pe_demo_connaught_branch_token_99`

---

## Automated Verification Suite

The platform includes 10 comprehensive PHPUnit feature test suites verifying every layer of the architecture:

```cmd
cd backend
php artisan test
```

### Test Results
```
Tests:    46 passed (299 assertions)
Duration: 2.54s
```

| Test Suite | Tests | Key Behaviors Verified |
|:---|:---:|:---|
| `EndToEndFlowTest.php` | 1 | Complete customer scan -> upload -> payment -> desktop lease -> spooler -> analytics journey (82 assertions) |
| `SuperAdminControlPlaneTest.php` | 7 | GMV metrics, shop status updates, plan quota enforcement, audit logs |
| `ShopOwnerDashboardTest.php` | 7 | Fleet metrics, pricing rules updates, printer registration, pairing code generation |
| `DesktopJobWorkflowTest.php` | 6 | Multi-device polling, lease locking, conflict resolution, file streaming, telemetry |
| `DesktopPairingTest.php` | 5 | Single-use pairing code verification, token hashing, expiration handling |
| `RazorpayPaymentTest.php` | 6 | Order initiation, HMAC-SHA256 signature verification, idempotent webhook processing |
| `PublicOrderTest.php` | 6 | QR token resolution, PDF upload, duplex price calculation, order creation |
| `TenantIsolationTest.php` | 5 | Multi-tenant authorization boundaries, branch scoping, shop scoping |
| `AuthTest.php` | 2 | Shop owner registration, default branch auto-provisioning, Sanctum token issuing |
| `ExampleTest.php` | 1 | Basic application health check |

---

## Project Structure

```
printease/
├── backend/                  # Laravel 11 REST API
│   ├── app/
│   │   ├── Http/Controllers/Api/  # Auth, Orders, Payments, Desktop, Admin
│   │   ├── Models/                # Shop, Branch, Printer, Order, PrintJob, Plan
│   │   └── Services/              # RazorpayPaymentService, PricingEngineService
│   ├── database/migrations/       # 18 schema migrations
│   └── tests/Feature/             # 46 automated PHPUnit tests
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind CSS
│   └── src/
│       ├── components/            # Customer Portal, Shop Dashboard, Admin Plane
│       └── App.tsx                # Multi-view navigation and tabs
├── desktop/                  # Windows Electron.js Spooler Agent
│   └── src/
│       ├── main.js                # Secure lifecycle & IPC
│       ├── preload.js             # Context-isolated bridge
│       ├── worker/printWorker.js  # Atomic job polling & lease execution
│       └── adapters/              # Win32 spooler hardware adapter
├── docs/                     # Architectural & API specifications
│   ├── architecture.md
│   └── api-reference.md
├── scripts/
│   └── dev.ps1               # PowerShell multi-service development launcher
└── dev.bat                   # 1-click Windows development runner
```

---

## License

This software is developed and distributed under the MIT License.
