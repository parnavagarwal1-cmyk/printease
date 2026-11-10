<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\OrderFile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PurgeCloudFilesCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'printease:purge-files {--hours=2 : Purge abandoned files older than this many hours}';

    /**
     * The console command description.
     */
    protected $description = 'Permanently purge customer PDF files from cloud storage for completed and abandoned orders.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $hours = (int) $this->option('hours');
        $cutoff = now()->subHours($hours);
        $totalPurged = 0;

        $this->info("Scanning for customer files to purge (cutoff: {$cutoff->toDateTimeString()})...");

        // 1. Completed orders with remaining files
        $completedOrders = Order::where('status', 'COMPLETED')
            ->whereHas('files', function ($q) {
                $q->where('storage_path', '!=', '[PURGED]')
                  ->whereNotNull('storage_path');
            })
            ->with('files')
            ->get();

        foreach ($completedOrders as $order) {
            $purged = $order->purgeFiles();
            $totalPurged += $purged;
            $this->line("Purged {$purged} file(s) for completed Order #{$order->order_number}");
        }

        // 2. Abandoned orders (older than cutoff and unpaid/cancelled)
        $abandonedOrders = Order::whereIn('status', ['UPLOADED', 'PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED'])
            ->where('created_at', '<', $cutoff)
            ->whereHas('files', function ($q) {
                $q->where('storage_path', '!=', '[PURGED]')
                  ->whereNotNull('storage_path');
            })
            ->with('files')
            ->get();

        foreach ($abandonedOrders as $order) {
            $purged = $order->purgeFiles();
            $totalPurged += $purged;
            $this->line("Purged {$purged} file(s) for abandoned Order #{$order->order_number}");
        }

        // 3. Scan storage directory for orphaned temporary files
        $disk = Storage::disk('local');
        if ($disk->exists('orders')) {
            $allFiles = $disk->allFiles('orders');
            $activePaths = OrderFile::whereNotNull('storage_path')
                ->where('storage_path', '!=', '[PURGED]')
                ->pluck('storage_path')
                ->flip();

            foreach ($allFiles as $filePath) {
                // Check if file is orphaned and older than cutoff
                $lastModified = $disk->lastModified($filePath);
                if ($lastModified < $cutoff->timestamp && !isset($activePaths[$filePath])) {
                    $disk->delete($filePath);
                    $totalPurged++;
                    $this->line("Deleted orphaned cloud file: {$filePath}");
                }
            }
        }

        $this->info("Successfully purged {$totalPurged} customer document(s) from cloud storage.");
        return Command::SUCCESS;
    }
}
