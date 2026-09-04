'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import {
  ShieldCheck,
  Layers,
  Compass,
  Box,
  Sparkles,
  Cpu,
  CheckCircle2,
  Plus,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Hash,
  DollarSign,
  Tag,
} from 'lucide-react';
import { CONTRACT_VERSION } from '@handshake/contracts';
import { useStudioStore } from '@/lib/store/studio-store';

export default function StudioPage() {
  const {
    sessionId,
    roomState,
    evaluation,
    isLoading,
    isSyncing,
    error,
    initSession,
    resetSession,
    refreshState,
    hydrate,
  } = useStudioStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const committedItemsCount = roomState?.items.length ?? 0;
  const version = roomState?.version ?? 0;
  const roomType = roomState?.roomType ?? 'bathroom';
  const budgetFormatted = roomState ? `$${(roomState.budgetCents / 100).toLocaleString()}` : '$0';
  const remainingBudgetFormatted =
    evaluation?.remainingCents !== undefined
      ? `$${(evaluation.remainingCents / 100).toLocaleString()}`
      : budgetFormatted;

  return (
    <main className="flex min-h-screen flex-col bg-[#0b0f19] text-slate-100">
      {/* Studio Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800 bg-[#0b0f19]/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Handshake Logo"
              width={140}
              height={32}
              priority
              className="h-8 w-auto"
            />
          </div>
          <span className="hidden rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 sm:inline-block">
            v{CONTRACT_VERSION}
          </span>
        </div>

        {/* Live Session Telemetry Bar */}
        <div className="flex items-center gap-3">
          {sessionId && roomState && (
            <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs md:flex">
              <span className="flex items-center gap-1 font-mono text-slate-300">
                <Hash className="h-3 w-3 text-blue-400" />
                {sessionId.slice(0, 8)}...
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 font-medium capitalize text-slate-300">
                <Tag className="h-3 w-3 text-indigo-400" />
                {roomType}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300">
                v{version} &bull; {committedItemsCount} item{committedItemsCount === 1 ? '' : 's'}
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <DollarSign className="h-3 w-3" />
                {remainingBudgetFormatted} left
              </span>
            </div>
          )}

          {/* Connection State Badge */}
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              isLoading || isSyncing
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                : sessionId
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-700 bg-slate-800/40 text-slate-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLoading || isSyncing
                  ? 'animate-pulse bg-amber-400'
                  : sessionId
                    ? 'animate-pulse bg-emerald-400'
                    : 'bg-slate-500'
              }`}
            />
            <span>
              {isLoading
                ? 'Connecting...'
                : isSyncing
                  ? 'Syncing State...'
                  : sessionId
                    ? 'Worker Authority Active'
                    : 'Offline / No Session'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {sessionId ? (
              <>
                <button
                  type="button"
                  onClick={() => refreshState()}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
                  title="Refresh state from Cloudflare Durable Object"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Sync</span>
                </button>
                <button
                  type="button"
                  onClick={() => resetSession()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
                  title="Reset and clear session storage"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => initSession('kitchen')}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Kitchen</span>
                </button>
                <button
                  type="button"
                  onClick={() => initSession('bathroom')}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Bath</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Error Notification Banner */}
      {error && (
        <div className="flex items-center justify-between border-b border-rose-500/30 bg-rose-950/40 px-6 py-2.5 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => useStudioStore.setState({ error: null })}
            className="text-slate-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Studio Viewport Container */}
      <div className="flex flex-1 flex-col p-6">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
          {/* Hero Banner */}
          <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/40 p-8 shadow-2xl">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Next.js 16 App Router &bull; React 19 &bull; WebMCP Governance</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Kitchen &amp; Bath Co-Design Studio
              </h1>
              <p className="text-base text-slate-400 sm:text-lg">
                Deterministic spatial planning with WebMCP consensus governance, dual 2D
                architectural floorplans, React Three Fiber 3D spatial visualization, and
                tamper-evident receipts.
              </p>
            </div>
          </section>

          {/* Dual Viewports Preview Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 2D Architectural Viewport Card */}
            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="h-5 w-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">2D Architectural Plan</h2>
                </div>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  12&quot; Grid Snap
                </span>
              </div>
              <div className="relative flex aspect-video flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700/60 bg-slate-950/50 p-6 text-center">
                <div className="space-y-2">
                  <Layers className="mx-auto h-8 w-8 text-slate-500" />
                  <p className="text-sm font-medium text-slate-300">Architectural Layout Engine</p>
                  <p className="text-xs text-slate-500">
                    Wall boundaries, openings, utility anchors, and drag-and-drop fixture snapping
                  </p>
                </div>
              </div>
            </div>

            {/* 3D Spatial Visualizer Card */}
            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-white">3D Spatial Studio</h2>
                </div>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  R3F &bull; React 19
                </span>
              </div>
              <div className="relative flex aspect-video flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700/60 bg-slate-950/50 p-6 text-center">
                <div className="space-y-2">
                  <Cpu className="mx-auto h-8 w-8 text-slate-500" />
                  <p className="text-sm font-medium text-slate-300">React Three Fiber Visualizer</p>
                  <p className="text-xs text-slate-500">
                    PBR materials, parametric 3D models, OrbitControls, and First-Person Walkthrough
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Governance & Architectural Features */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-900/40 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
              <div>
                <h3 className="text-sm font-medium text-white">Constitutional Governance</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Proposals never mutate state directly. Human review and approval gates required.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-900/40 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <h3 className="text-sm font-medium text-white">NKBA Rule Checking</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Deterministic guidelines for walkways, work triangles, landing areas, and
                  clearances.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-900/40 p-4">
              <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-purple-400" />
              <div>
                <h3 className="text-sm font-medium text-white">Cloudflare DO Backend</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Linearizable edge state machine with SHA-256 evidence receipts and rate limiting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
