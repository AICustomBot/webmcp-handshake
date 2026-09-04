'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  ShieldCheck,
  Compass,
  Box,
  Sparkles,
  Bot,
  Cpu,
  CheckCircle2,
  Plus,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Hash,
  DollarSign,
  Tag,
  Grid,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Move,
  RotateCw,
  Eye,
  Footprints,
  Camera,
  FileCheck,
  Receipt,
} from 'lucide-react';
import { CONTRACT_VERSION } from '@handshake/contracts';
import { useStudioStore } from '@/lib/store/studio-store';
import { useWebMCP } from '@/lib/hooks/use-webmcp';
import { Canvas2D, formatDimension, resolveCatalogProduct } from '@/components/studio/canvas-2d';
import { Canvas3DWrapper } from '@/components/studio/canvas-3d-wrapper';
import { WebGLFallbackBanner } from '@/components/studio/webgl-fallback-banner';
import { WebMCPFallbackBanner } from '@/components/studio/webmcp-fallback-banner';
import { CopilotDrawer } from '@/components/studio/copilot-drawer';
import { BomPanel } from '@/components/studio/bom-panel';
import { NkbaFindingsOverlay } from '@/components/studio/nkba-findings-overlay';
import { ProposalReviewModal } from '@/components/studio/proposal-review-modal';
import { ConfirmationDialog } from '@/components/studio/confirmation-dialog';
import { ReceiptModal } from '@/components/studio/receipt-modal';
import { captureCanvasSnapshot } from '@/lib/studio-export';

export default function StudioPage() {
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [activeStudioTab, setActiveStudioTab] = useState<'bom' | 'nkba' | 'fixtures'>('bom');
  const {
    sessionId,
    roomState,
    evaluation,
    catalog,
    viewportMode,
    cameraMode,
    zoom,
    gridSnap,
    selectedItemId,
    isLoading,
    isSyncing,
    error,
    isCopilotOpen,
    setCopilotOpen,
    isReceiptOpen,
    setReceiptOpen,
    initSession,
    resetSession,
    refreshState,
    hydrate,
    setViewportMode,
    setCameraMode,
    setZoom,
    setPan,
    setGridSnap,
    selectItem,
    moveItem,
  } = useStudioStore();

  const { isAvailable: isWebMCPAvailable, registeredCount } = useWebMCP();

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

  const selectedItem = roomState?.items.find((i) => i.id === selectedItemId);
  const selectedProduct = selectedItem
    ? resolveCatalogProduct(selectedItem.productId, catalog)
    : null;

  const handleRotateSelected = () => {
    if (!selectedItem) return;
    const nextRotation = ((selectedItem.rotation + 90) % 360) as 0 | 90 | 180 | 270;
    moveItem(selectedItem.id, selectedItem.x, selectedItem.y, nextRotation);
  };

  const handleTakeSnapshot = async () => {
    const dataUrl = await captureCanvasSnapshot({
      viewportMode,
      sessionId,
      version,
    });
    if (dataUrl) {
      setSnapshotMessage(`Saved snapshot: handshake-${viewportMode}-snapshot-v${version}.png`);
      setTimeout(() => setSnapshotMessage(null), 4000);
    } else {
      useStudioStore.setState({ error: 'Failed to capture snapshot' });
    }
  };

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
                  onClick={handleTakeSnapshot}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
                  title="Capture high-resolution PNG snapshot of current viewport"
                >
                  <Camera className="h-3.5 w-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Snapshot</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
                  title="View and download tamper-evident signed audit receipt"
                >
                  <FileCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Receipt</span>
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

            {/* AI Copilot Toggle */}
            <button
              type="button"
              onClick={() => setCopilotOpen(!isCopilotOpen)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                isCopilotOpen
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                  : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-white'
              }`}
              title="Toggle Handshake AI Copilot"
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI Copilot</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
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

      {/* Snapshot Download Toast */}
      {snapshotMessage && (
        <div className="flex items-center justify-between border-b border-emerald-500/30 bg-emerald-950/40 px-6 py-2.5 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{snapshotMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSnapshotMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* WebGL Fallback Notification Banner */}
      <WebGLFallbackBanner />

      {/* WebMCP & ChatGPT In-App Browser Fallback Banner */}
      <WebMCPFallbackBanner />

      {/* Main Studio Viewport Container */}
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5">
          {/* Viewport Mode & Quick Controls Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 backdrop-blur-md">
            {/* Viewport Mode Switcher */}
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/80 p-1">
              <button
                type="button"
                onClick={() => setViewportMode('2d')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewportMode === '2d'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>2D Architectural</span>
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('3d')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewportMode === '3d'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="h-3.5 w-3.5" />
                <span>3D Spatial (R3F)</span>
              </button>
            </div>

            {/* 3D Camera Mode Switcher (Visible in 3D Mode) */}
            {viewportMode === '3d' && (
              <div className="flex items-center rounded-lg border border-indigo-500/30 bg-slate-800/90 p-1">
                <button
                  type="button"
                  onClick={() => setCameraMode('orbit')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    cameraMode === 'orbit'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Perspective Fly-Around Orbit"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Orbit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCameraMode('first-person')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    cameraMode === 'first-person'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title='First-Person Walkthrough (Eye-Level 60" Elevation with WASD / Touch)'
                >
                  <Footprints className="h-3.5 w-3.5" />
                  <span>Walkthrough (60&quot;)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCameraMode('orthographic')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    cameraMode === 'orthographic'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Orthographic Top-Down Plan (North-Aligned)"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Top-Down</span>
                </button>
              </div>
            )}

            {/* Global Studio Canvas Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 12" Grid Snap Toggle */}
              <button
                type="button"
                onClick={() => setGridSnap(!gridSnap)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  gridSnap
                    ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                    : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Grid className="h-3.5 w-3.5" />
                <span>12&quot; Grid Snap</span>
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setZoom(Math.max(0.4, Number((zoom - 0.15).toFixed(2))))}
                  className="rounded p-1.5 text-slate-300 hover:bg-slate-700"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1.0);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="px-2 py-1 font-mono text-xs text-slate-300 hover:bg-slate-700"
                  title="Reset Zoom & Pan (Fit to View)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(Math.min(3.0, Number((zoom + 0.15).toFixed(2))))}
                  className="rounded p-1.5 text-slate-300 hover:bg-slate-700"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1.0);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="rounded p-1.5 text-slate-300 hover:bg-slate-700 border-l border-slate-700 ml-0.5"
                  title="Fit View"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Selected Item Rotate / Info */}
              {selectedItem && selectedProduct && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-950/40 px-3 py-1 text-xs text-blue-300">
                  <span className="font-semibold">{selectedProduct.name}</span>
                  <span className="text-slate-500">&bull;</span>
                  <span className="font-mono">
                    ({selectedItem.x}&quot;, {selectedItem.y}&quot;)
                  </span>
                  <button
                    type="button"
                    onClick={handleRotateSelected}
                    className="ml-1 inline-flex items-center gap-1 rounded bg-blue-600/30 px-1.5 py-0.5 text-[11px] text-blue-200 hover:bg-blue-600/50"
                    title="Rotate 90 degrees clockwise"
                  >
                    <RotateCw className="h-3 w-3" />
                    <span>{selectedItem.rotation}&deg;</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Primary Viewport Area */}
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-2xl min-h-[560px] md:min-h-[640px]">
            {viewportMode === '2d' ? <Canvas2D /> : <Canvas3DWrapper />}
          </div>

          {/* Tabbed Studio Inspector: BOM, NKBA Guidelines & Placed Fixtures */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveStudioTab('bom')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeStudioTab === 'bom'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Receipt className="h-4 w-4" />
                  <span>Bill of Materials</span>
                  {roomState && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                        activeStudioTab === 'bom'
                          ? 'bg-blue-700 text-blue-100'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {roomState.items.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStudioTab('nkba')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeStudioTab === 'nkba'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>NKBA Rules</span>
                  {evaluation && evaluation.findings.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                        evaluation.findings.some((f) => f.severity === 'blocked')
                          ? 'bg-rose-500/30 text-rose-300'
                          : 'bg-amber-500/30 text-amber-300'
                      }`}
                    >
                      {evaluation.findings.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStudioTab('fixtures')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeStudioTab === 'fixtures'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>Placed Fixtures</span>
                  {roomState && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                        activeStudioTab === 'fixtures'
                          ? 'bg-blue-700 text-blue-100'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {roomState.items.length}
                    </span>
                  )}
                </button>
              </div>

              <span className="text-xs text-slate-500">
                {activeStudioTab === 'bom' && 'Deterministic budget and itemized procurement BOM'}
                {activeStudioTab === 'nkba' && 'Automated architectural layout rule compliance'}
                {activeStudioTab === 'fixtures' && 'Click a fixture or drag to reposition'}
              </span>
            </div>

            {/* Tab Contents */}
            {activeStudioTab === 'bom' && <BomPanel />}
            {activeStudioTab === 'nkba' && <NkbaFindingsOverlay />}
            {activeStudioTab === 'fixtures' &&
              (roomState && roomState.items.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {roomState.items.map((item) => {
                    const prod = resolveCatalogProduct(item.productId, catalog);
                    const isSelected = selectedItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => selectItem(isSelected ? null : item.id)}
                        className={`cursor-pointer rounded-lg border p-2.5 transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-950/30 text-white'
                            : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs truncate">{prod.name}</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {formatDimension(prod.widthIn)} &times; {formatDimension(prod.depthIn)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>
                            Pos: ({item.x}&quot;, {item.y}&quot;)
                          </span>
                          <span>Rot: {item.rotation}&deg;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  No fixtures placed in room yet. Click catalog items on the left to add them.
                </div>
              ))}
          </div>

          {/* Constitutional Governance & Rule Checking Footers */}
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

      {/* Slide-Over AI Copilot Drawer */}
      <CopilotDrawer />

      {/* Proposal Review Modal (Amber Overlay -> Human Approval Gate) */}
      <ProposalReviewModal />

      {/* Confirmation Dialog for Protected Actions (Single-Use Proof Token Gate) */}
      <ConfirmationDialog />

      {/* Signed Cryptographic Receipt Modal */}
      <ReceiptModal isOpen={isReceiptOpen} onClose={() => setReceiptOpen(false)} />
    </main>
  );
}
