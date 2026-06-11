import { Zap, Shield, Brain, Bell } from 'lucide-react'

const FEATURES = [
  { icon: Brain,  text: 'LangGraph Multi-Agent AI triage' },
  { icon: Shield, text: 'VIP employee detection & prioritisation' },
  { icon: Bell,   text: 'Real-time Discord & email alerts' },
  { icon: Zap,    text: 'Sub-second SLA risk prediction' },
]

interface AuthBrandingProps {
  /** Optional tagline shown below the headline */
  subtitle?: string
}

export function AuthBranding({
  subtitle = 'AI agents that detect VIPs, score priorities, and escalate critical tickets — all in under 3 seconds.',
}: AuthBrandingProps) {
  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-12 border-r border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <span className="text-xl font-bold text-slate-100">VIPulse</span>
          <span className="ml-1.5 rounded-md bg-indigo-600/20 px-1.5 py-0.5 text-xs font-semibold text-indigo-400">
            AI
          </span>
        </div>
      </div>

      {/* Headline + features */}
      <div>
        <h2 className="text-4xl font-bold leading-tight text-slate-100">
          Intelligent VIP-Aware
          <br />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            IT Service Desk
          </span>
        </h2>
        <p className="mt-4 text-lg text-slate-400">{subtitle}</p>

        <div className="mt-10 space-y-4">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                <Icon className="h-4 w-4 text-indigo-400" />
              </div>
              <span className="text-sm text-slate-300">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600">© 2026 VIPulse AI. All rights reserved.</p>
    </div>
  )
}
