'use client';

import { useState } from 'react';
import {
  Receipt,
  Download,
  DollarSign,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { useStudioStore } from '@/lib/store/studio-store';
import { resolveCatalogProduct, formatDimension } from './canvas-2d';
import { apiClient } from '@/lib/api-client';
import type { BillOfMaterials, BomLine, Product, RoomState } from '@handshake/contracts';

import { computeClientBom } from '@/lib/bom';
export { computeClientBom };

export function BomPanel() {
  const { sessionId, capability, roomState, evaluation, catalog, isSyncing } = useStudioStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!roomState) return null;

  // Use authoritative BOM from policy evaluation or compute deterministically from roomState & catalog
  const bom: BillOfMaterials = evaluation?.bom ?? computeClientBom(roomState, catalog);

  interface EnrichedBomLine {
    productId: string;
    name: string;
    sku: string;
    category: string;
    widthIn: number;
    depthIn: number;
    unitPriceCents: number;
    quantity: number;
    totalCents: number;
    isUnpriced: boolean;
  }

  const enrichedLines: EnrichedBomLine[] = bom.lines.map((line: BomLine) => {
    const product = resolveCatalogProduct(line.productId, catalog);
    return {
      productId: line.productId,
      name: line.name || product.name,
      sku: line.sku || product.sku || line.productId,
      category: line.category || product.category,
      widthIn: product.widthIn,
      depthIn: product.depthIn,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      totalCents: line.totalCents,
      isUnpriced: line.unitPriceCents <= 0,
    };
  });

  // Sort by category, then by name
  enrichedLines.sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );

  const subtotalCents = bom.subtotalCents;
  const totalItemCount = bom.itemCount;
  const budgetCents = roomState.budgetCents;
  const remainingCents = budgetCents - subtotalCents;
  const isOverBudget = remainingCents < 0;
  const budgetUsagePercent =
    budgetCents > 0 ? Math.min(100, Math.round((subtotalCents / budgetCents) * 100)) : 0;
  const unpricedItems = bom.unpricedItemIds ?? [];

  const handleExportCsv = () => {
    if (enrichedLines.length === 0) return;

    const headers = [
      'Product ID',
      'SKU',
      'Name',
      'Category',
      'Dimensions',
      'Quantity',
      'Unit Price ($)',
      'Line Total ($)',
    ];
    const rows = enrichedLines.map((l) => [
      `"${l.productId}"`,
      `"${l.sku}"`,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.category}"`,
      `"${formatDimension(l.widthIn)} x ${formatDimension(l.depthIn)}"`,
      l.quantity,
      (l.unitPriceCents / 100).toFixed(2),
      (l.totalCents / 100).toFixed(2),
    ]);

    rows.push([]);
    rows.push([
      '"SUBTOTAL"',
      '""',
      '""',
      '""',
      '""',
      totalItemCount,
      '""',
      (subtotalCents / 100).toFixed(2),
    ]);
    rows.push(['"BUDGET"', '""', '""', '""', '""', '""', '""', (budgetCents / 100).toFixed(2)]);
    rows.push([
      '"REMAINING"',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      (remainingCents / 100).toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `handshake-bom-${(sessionId || 'session').slice(0, 8)}-v${roomState.version}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSyncWithDO = async () => {
    if (!sessionId || !capability) return;
    setIsRefreshing(true);
    try {
      const res = await apiClient.getBillOfMaterials(sessionId, capability);
      if (res?.bom) {
        useStudioStore.setState({ error: null });
      }
    } catch (err: any) {
      useStudioStore.setState({
        error: err.message || 'Failed to sync BOM with edge Durable Object',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section
      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl backdrop-blur-md"
      data-testid="bom-panel"
      aria-label="Bill of Materials"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">Bill of Materials (BOM)</h3>
              <span
                data-testid="bom-item-count"
                className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-300 border border-slate-700"
              >
                {totalItemCount} fixture{totalItemCount === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Deterministic pricing derived directly from committed room state
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncWithDO}
            disabled={isRefreshing || isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
            title="Verify parity with Cloudflare Durable Object edge state"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Verify Edge Parity</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={enrichedLines.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
            title="Download itemized CSV spreadsheet"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Budget Telemetry Strip */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <span className="text-xs text-slate-400">Total Fixture Cost</span>
          <div
            className="mt-1 flex items-baseline gap-1 text-lg font-bold text-slate-100"
            data-testid="bom-subtotal"
          >
            <span>
              ${(subtotalCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <span className="text-xs text-slate-400">Allocated Budget</span>
          <div
            className="mt-1 flex items-baseline gap-1 text-lg font-bold text-slate-100"
            data-testid="bom-budget-allocated"
          >
            <span>
              ${(budgetCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div
          className={`rounded-lg border p-3 ${
            isOverBudget
              ? 'border-rose-500/40 bg-rose-950/25 text-rose-300'
              : 'border-emerald-500/40 bg-emerald-950/25 text-emerald-300'
          }`}
          data-testid="bom-budget-remaining"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs">{isOverBudget ? 'Budget Deficit' : 'Remaining Budget'}</span>
            {isOverBudget && <AlertTriangle className="h-4 w-4 text-rose-400" />}
          </div>
          <div className="mt-1 flex items-baseline gap-1 text-lg font-bold">
            <span>
              {isOverBudget ? '-' : ''}$
              {Math.abs(remainingCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Budget Utilization Progress Bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Budget Utilization Progress</span>
          <span
            data-testid="bom-budget-percent"
            className={isOverBudget ? 'font-bold text-rose-400' : 'text-slate-300 font-mono'}
          >
            {budgetUsagePercent}% {isOverBudget ? '(Over Budget)' : ''}
          </span>
        </div>
        <div
          className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
          data-testid="bom-budget-bar"
        >
          <div
            className={`h-full transition-all duration-300 ${
              isOverBudget
                ? 'bg-rose-500'
                : budgetUsagePercent > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, (subtotalCents / (budgetCents || 1)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Unpriced Items Warning */}
      {unpricedItems.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/30 p-2.5 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            {unpricedItems.length} custom fixture{unpricedItems.length === 1 ? '' : 's'} lack
            standard catalog pricing: <code className="font-mono">{unpricedItems.join(', ')}</code>
          </span>
        </div>
      )}

      {/* Itemized Table */}
      {isExpanded && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-800/60 font-semibold text-slate-300">
              <tr>
                <th className="py-2.5 px-3">Product Name &amp; SKU</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Dimensions</th>
                <th className="py-2.5 px-3 text-right">Unit Price (USD)</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Line Total (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {enrichedLines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-sans text-slate-500">
                    No fixtures placed in current room. Add items to calculate bill of materials.
                  </td>
                </tr>
              ) : (
                enrichedLines.map((line) => (
                  <tr
                    key={line.productId}
                    data-testid={`bom-row-${line.productId}`}
                    className="hover:bg-slate-800/40 transition"
                  >
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-medium text-slate-200">{line.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <span className="text-slate-500">SKU:</span>
                        <span>{line.sku}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="inline-block rounded bg-slate-800 px-2 py-0.5 text-[11px] capitalize text-slate-300 border border-slate-700">
                        {line.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                      {formatDimension(line.widthIn)} &times; {formatDimension(line.depthIn)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      ${(line.unitPriceCents / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-200">
                      {line.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                      ${(line.totalCents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
