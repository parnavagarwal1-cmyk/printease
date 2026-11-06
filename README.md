# PrintEase - Multi-Shop Cloud Printing Platform

PrintEase is a complete multi-shop SaaS platform enabling printing shops to provide QR-based self-service printing.

## Architecture

- **Backend**: Laravel 11 (PHP 8.3+) + MySQL 8.4 + Sanctum Authentication
- **Frontend Web**: React 19 + TypeScript + Vite + Tailwind CSS
- **Desktop Agent**: Windows Electron.js Agent for local printer spooling

## Quick Start

1. Start Laragon or ensure MySQL is running on port 3306.
2. Run development servers:
   ```cmd
   .\dev.bat
   ```
   or in PowerShell:
   ```powershell
   .\scripts\dev.ps1
   ```

## Seeded Test Accounts

- **Super Admin**: `superadmin@printease.com` / `Secret@12345`
- **Shop Owner**: `owner@metroprint.com` / `Secret@12345`
- **Branch**: Connaught Place Main Branch
- **Demo Pairing Code**: `PRNT-8821-X9`
- **Demo QR Token**: `pe_demo_connaught_branch_token_99`
