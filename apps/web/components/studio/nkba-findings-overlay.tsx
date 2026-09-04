'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Crosshair,
  CheckCircle2,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import type { CheckFinding, CheckFindingCode } from '@handshake/contracts';
import { useStudioStore } from '@/lib/store/studio-store';

import { type FindingRuleMeta, NKBA_RULES_META, CORE_PASSED_GUIDELINES } from '@/lib/nkba-rules';
export { type FindingRuleMeta, NKBA_RULES_META, CORE_PASSED_GUIDELINES };

export function NkbaFindingsOverlay() {
  const { evaluation, selectItem, selectedItemId } = useStudioStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'blocked' | 'warning' | 'passed'>('all');

  const findings: CheckFinding[] = evaluation?.findings ?? [];

  const blockedCount = findings.filter((f) => f.severity === 'blocked').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const isFullyCompliant = findings.length === 0;

  const filteredFindings = findings.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'blocked') return f.severity === 'blocked';
    if (filter === 'warning') return f.severity === 'warning';
    return false;
  });

  return (
    <section
      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl backdrop-blur-md"
      data-testid="nkba-findings-overlay"
      aria-label="NKBA Real-Time Layout Findings"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
              isFullyCompliant
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : blockedCount > 0
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
          >
            {isFullyCompliant ? (
              <ShieldCheck className="h-5 w-5" />
            ) : blockedCount > 0 ? (
              <XCircle className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Real-Time NKBA Layout Findings
              </h3>
              {/* Badges */}
              {isFullyCompliant ? (
                <span
                  data-testid="badge-guidelines-passed"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400"
                >
                  <CheckCircle2 className="h-3 w-3" /> Guidelines Passed
                </span>
              ) : (
                <div className="flex items-center gap-1.5 text-xs">
                  {blockedCount > 0 && (
                    <span
                      data-testid="badge-blocked-error"
                      className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2.5 py-0.5 font-mono font-bold text-rose-300"
                    >
                      {blockedCount} Blocked
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span
                      data-testid="badge-warning"
                      className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 font-mono font-bold text-amber-300"
                    >
                      {warningCount} Warning{warningCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400">
              National Kitchen &amp; Bath Association deterministic layout safety &amp; ergonomic
              standards
            </p>
          </div>
        </div>

        {/* Filter Controls & Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                filter === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({findings.length})
            </button>
            {blockedCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('blocked')}
                className={`rounded px-2.5 py-1 font-medium transition ${
                  filter === 'blocked'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                Blocked ({blockedCount})
              </button>
            )}
            {warningCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('warning')}
                className={`rounded px-2.5 py-1 font-medium transition ${
                  filter === 'warning'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                Warnings ({warningCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilter('passed')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                filter === 'passed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              Passed
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            title={isExpanded ? 'Collapse findings' : 'Expand findings'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Findings Content */}
      {isExpanded && (
        <div className="mt-4 space-y-3">
          {filter === 'passed' || (isFullyCompliant && filter === 'all') ? (
            /* Passed Guidelines Section */
            <div className="space-y-2">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />
                <h4 className="mt-2 text-sm font-semibold text-emerald-200">
                  NKBA Standard Compliance Verified
                </h4>
                <p className="mt-1 text-xs text-emerald-300/80">
                  Current architectural layout satisfies all evaluated planning guidelines.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CORE_PASSED_GUIDELINES.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-slate-900/60 p-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-200">{item.title}</span>
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-mono text-emerald-300">
                          PASSED
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                        <BookOpen className="h-3 w-3 text-slate-500" />
                        <span>{item.citation}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300/90">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">
              No findings matching the selected filter ({filter}).
            </div>
          ) : (
            filteredFindings.map((finding, idx) => {
              const meta = NKBA_RULES_META[finding.code] || {
                title: finding.code.replace(/_/g, ' '),
                citation: finding.guideline || 'NKBA Planning Standards',
                remediation: 'Review fixture placement and spacing to satisfy NKBA standards.',
              };
              const isBlocked = finding.severity === 'blocked';
              const isWarning = finding.severity === 'warning';

              return (
                <div
                  key={`${finding.code}-${idx}`}
                  data-testid={`finding-card-${finding.code}`}
                  className={`rounded-lg border p-3.5 transition-colors ${
                    isBlocked
                      ? 'border-rose-500/40 bg-rose-950/25 hover:border-rose-500/60'
                      : isWarning
                        ? 'border-amber-500/40 bg-amber-950/25 hover:border-amber-500/60'
                        : 'border-blue-500/40 bg-blue-950/25 hover:border-blue-500/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {isBlocked ? (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                      ) : isWarning ? (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                      ) : (
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                      )}

                      <div className="space-y-1">
                        {/* Title & Badge */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${
                              isBlocked
                                ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
                                : isWarning
                                  ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                                  : 'border-blue-500/40 bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {finding.severity}
                          </span>
                          <h4 className="text-xs font-bold text-slate-100">{meta.title}</h4>
                        </div>

                        {/* Citation */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <BookOpen className="h-3 w-3 text-slate-500" />
                          <span className="font-mono text-slate-300">
                            {finding.guideline || meta.citation}
                          </span>
                        </div>

                        {/* Violation Message */}
                        <p className="text-xs leading-relaxed text-slate-200">{finding.message}</p>

                        {/* Metric Measurements */}
                        {(finding.recommendedIn !== undefined ||
                          finding.measuredIn !== undefined) && (
                          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 pt-0.5">
                            {finding.recommendedIn !== undefined && (
                              <span>
                                <span className="text-slate-500">Recommended: </span>
                                <strong className="text-slate-200">
                                  {finding.recommendedIn}&quot;
                                </strong>
                              </span>
                            )}
                            {finding.measuredIn !== undefined && (
                              <span>
                                <span className="text-slate-500">Measured: </span>
                                <strong
                                  className={
                                    isBlocked
                                      ? 'text-rose-300'
                                      : isWarning
                                        ? 'text-amber-300'
                                        : 'text-slate-200'
                                  }
                                >
                                  {finding.measuredIn}&quot;
                                </strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Remediation Suggestion */}
                        <div className="mt-2 flex items-start gap-1.5 rounded bg-slate-900/80 p-2 text-xs border border-slate-800">
                          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                          <div className="text-slate-300">
                            <strong className="text-amber-300">Remediation: </strong>
                            <span>{meta.remediation}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Target Item Locator Buttons */}
                    {finding.itemIds && finding.itemIds.length > 0 && (
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        {finding.itemIds.map((itemId) => {
                          const isSelected = selectedItemId === itemId;
                          return (
                            <button
                              key={itemId}
                              type="button"
                              onClick={() => selectItem(isSelected ? null : itemId)}
                              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-mono transition ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700'
                              }`}
                              title={`Focus fixture ${itemId} on floorplan`}
                            >
                              <Crosshair className="h-3 w-3" />
                              <span>{itemId}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
