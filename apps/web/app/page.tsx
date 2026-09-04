import Image from 'next/image';
import {
  ShieldCheck,
  Layers,
  Compass,
  Box,
  Sparkles,
  Cpu,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { CONTRACT_VERSION } from '@handshake/contracts';

export default function StudioPage() {
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span>Worker Linearizable Authority Active</span>
          </div>
        </div>
      </header>

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
