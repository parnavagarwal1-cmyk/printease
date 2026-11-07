<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\PricingRule;
use InvalidArgumentException;

class PricingService
{
    /**
     * Parse page range string into individual page numbers.
     * Examples:
     * - "all" -> returns 1..total
     * - "1-5" -> [1,2,3,4,5]
     * - "1, 3, 5-7" -> [1, 3, 5, 6, 7]
     */
    public function parsePageRange(?string $range, int $totalDocumentPages): array
    {
        if (empty($range) || strtolower(trim($range)) === 'all') {
            return range(1, max(1, $totalDocumentPages));
        }

        $pages = [];
        $parts = explode(',', $range);

        foreach ($parts as $part) {
            $part = trim($part);
            if (empty($part)) {
                continue;
            }

            if (str_contains($part, '-')) {
                $bounds = explode('-', $part, 2);
                $start = (int) trim($bounds[0]);
                $end = (int) trim($bounds[1]);

                if ($start > 0 && $end >= $start) {
                    $end = min($end, $totalDocumentPages);
                    for ($p = $start; $p <= $end; $p++) {
                        $pages[] = $p;
                    }
                }
            } else {
                $p = (int) $part;
                if ($p > 0 && $p <= $totalDocumentPages) {
                    $pages[] = $p;
                }
            }
        }

        $unique = array_values(array_unique($pages));
        sort($unique);

        return !empty($unique) ? $unique : range(1, max(1, $totalDocumentPages));
    }

    /**
     * Calculate price for print items at a specific branch.
     *
     * @param Branch $branch
     * @param array $items Array of items:
     *                     [
     *                       'total_pages' => int,
     *                       'page_range' => string|null,
     *                       'copies' => int,
     *                       'color_mode' => 'bw'|'color',
     *                       'duplex_mode' => 'single'|'duplex',
     *                       'paper_size' => 'A4'|'A3',
     *                     ]
     * @return array Calculated pricing breakdown
     */
    public function calculate(Branch $branch, array $items): array
    {
        if (empty($items)) {
            throw new InvalidArgumentException('At least one item is required for price calculation.');
        }

        $calculatedItems = [];
        $subtotal = 0.0;
        $maxTaxRate = 0.0;
        $minOrderAmount = 0.0;

        foreach ($items as $index => $item) {
            $paperSize = strtoupper($item['paper_size'] ?? 'A4');
            $colorMode = strtolower($item['color_mode'] ?? 'bw');
            $duplexMode = strtolower($item['duplex_mode'] ?? 'single');
            $copies = max(1, (int) ($item['copies'] ?? 1));
            $totalPages = max(1, (int) ($item['total_pages'] ?? 1));
            $pageRange = $item['page_range'] ?? 'all';

            // Find branch pricing rule for paper size
            $existingRule = PricingRule::where('branch_id', $branch->id)
                ->where('paper_size', $paperSize)
                ->first();

            if ($existingRule && !$existingRule->is_active) {
                throw new \InvalidArgumentException("Paper size {$paperSize} is currently disabled at this branch.");
            }

            $pricingRule = ($existingRule && $existingRule->is_active) ? $existingRule : null;

            if (!$pricingRule) {
                // Fallback default rule if not explicitly configured
                $pricingRule = (object) [
                    'id' => null,
                    'paper_size' => $paperSize,
                    'bw_single_price' => 2.00,
                    'bw_duplex_price' => 3.00,
                    'color_single_price' => 10.00,
                    'color_duplex_price' => 18.00,
                    'duplex_pricing_mode' => 'per_side',
                    'min_order_amount' => 5.00,
                    'tax_rate_percent' => 18.00,
                ];
            }

            $selectedPages = $this->parsePageRange($pageRange, $totalPages);
            $pageCount = count($selectedPages);

            // Unit price selection
            if ($colorMode === 'color') {
                $unitPrice = ($duplexMode === 'duplex')
                    ? (float) $pricingRule->color_duplex_price
                    : (float) $pricingRule->color_single_price;
            } else {
                $unitPrice = ($duplexMode === 'duplex')
                    ? (float) $pricingRule->bw_duplex_price
                    : (float) $pricingRule->bw_single_price;
            }

            // Sheet calculation
            if ($duplexMode === 'duplex') {
                $sheetsPerCopy = (int) ceil($pageCount / 2);
                if (($pricingRule->duplex_pricing_mode ?? 'per_side') === 'per_sheet') {
                    $itemTotal = round($sheetsPerCopy * $copies * $unitPrice, 2);
                } else {
                    // per_side
                    $itemTotal = round($pageCount * $copies * $unitPrice, 2);
                }
            } else {
                $sheetsPerCopy = $pageCount;
                $itemTotal = round($pageCount * $copies * $unitPrice, 2);
            }

            $totalSheets = $sheetsPerCopy * $copies;
            $subtotal += $itemTotal;

            $taxRate = (float) ($pricingRule->tax_rate_percent ?? 18.0);
            if ($taxRate > $maxTaxRate) {
                $maxTaxRate = $taxRate;
            }

            $minOrder = (float) ($pricingRule->min_order_amount ?? 5.0);
            if ($minOrder > $minOrderAmount) {
                $minOrderAmount = $minOrder;
            }

            $calculatedItems[] = [
                'item_index' => $index,
                'paper_size' => $paperSize,
                'color_mode' => $colorMode,
                'duplex_mode' => $duplexMode,
                'copies' => $copies,
                'total_document_pages' => $totalPages,
                'page_range' => $pageRange,
                'effective_page_count' => $pageCount,
                'sheets_per_copy' => $sheetsPerCopy,
                'total_sheets' => $totalSheets,
                'unit_price' => $unitPrice,
                'subtotal' => $itemTotal,
                'pricing_rule_snapshot' => [
                    'rule_id' => $pricingRule->id ?? null,
                    'paper_size' => $paperSize,
                    'unit_price' => $unitPrice,
                    'color_mode' => $colorMode,
                    'duplex_mode' => $duplexMode,
                    'pricing_mode' => $pricingRule->duplex_pricing_mode ?? 'per_side',
                ],
            ];
        }

        $minOrderAdjustment = 0.0;
        if ($subtotal < $minOrderAmount) {
            $minOrderAdjustment = round($minOrderAmount - $subtotal, 2);
            $subtotal = $minOrderAmount;
        }

        $taxAmount = round($subtotal * ($maxTaxRate / 100), 2);
        $totalAmount = round($subtotal + $taxAmount, 2);

        return [
            'currency' => 'INR',
            'items' => $calculatedItems,
            'subtotal' => $subtotal,
            'min_order_amount' => $minOrderAmount,
            'min_order_adjustment' => $minOrderAdjustment,
            'tax_rate_percent' => $maxTaxRate,
            'tax_amount' => $taxAmount,
            'total_amount' => $totalAmount,
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'shop_name' => $branch->shop->name ?? 'PrintEase Shop',
            ],
        ];
    }
}
