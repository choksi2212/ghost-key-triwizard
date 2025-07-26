"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { KeystrokeCapture } from "@/components/keystroke-capture"
import { AuditDashboard } from "@/components/audit-dashboard"
import { AdminPanel } from "@/components/admin-panel"
import { ThemeToggle } from "@/components/theme-toggle"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("auth")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-black dark:via-slate-900 dark:to-black transition-all duration-500">
      {/* Cybersecurity Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>

      {/* Header */}
      <div className="relative border-b border-cyan-500/20 bg-slate-900/90 dark:bg-black/90 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <span className="text-white font-bold text-lg">🔐</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Keystroke Dynamic Authentication with Voice Biometrics
              </h1>
              <p className="text-xs text-cyan-300/70">Enterprise Cybersecurity Platform</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="relative container mx-auto max-w-6xl px-4 py-8">
        <div className="text-center mb-8 animate-fade-in">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Advanced Keystrokes & Voice Biometric Security
          </h2>
          <p className="text-lg text-slate-300 dark:text-slate-400 max-w-2xl mx-auto mb-6">
            Next-generation access control through behavioral biometric analysis and machine learning
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <div className="px-4 py-2 bg-cyan-500/10 text-cyan-300 rounded-full text-sm font-medium border border-cyan-500/30 backdrop-blur-sm">
              🛡️ Zero-Trust Security
            </div>
            <div className="px-4 py-2 bg-blue-500/10 text-blue-300 rounded-full text-sm font-medium border border-blue-500/30 backdrop-blur-sm">
              🤖 ML Powered
            </div>
            <div className="px-4 py-2 bg-purple-500/10 text-purple-300 rounded-full text-sm font-medium border border-purple-500/30 backdrop-blur-sm">
              🔒 Behavioral Auth
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 dark:bg-slate-900/50 border border-slate-700/50 dark:border-slate-600/50 backdrop-blur-sm">
            <TabsTrigger
              value="auth"
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/50 transition-all duration-300 font-medium text-slate-300"
            >
              🔐 Authentication
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300 data-[state=active]:border-blue-500/50 transition-all duration-300 font-medium text-slate-300"
            >
              📊 Threat Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="admin"
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 data-[state=active]:border-purple-500/50 transition-all duration-300 font-medium text-slate-300"
            >
              ⚙️ Command Center
            </TabsTrigger>
          </TabsList>

          <TabsContent value="auth" className="mt-6 animate-slide-up">
            <KeystrokeCapture />
          </TabsContent>

          <TabsContent value="audit" className="mt-6 animate-slide-up">
            <AuditDashboard />
          </TabsContent>

          <TabsContent value="admin" className="mt-6 animate-slide-up">
            <AdminPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
