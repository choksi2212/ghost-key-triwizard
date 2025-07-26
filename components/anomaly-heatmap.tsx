"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, AlertTriangle } from "lucide-react"

interface AnomalyHeatmapProps {
  data: number[]
}

export function AnomalyHeatmap({ data }: AnomalyHeatmapProps) {
  const getColorIntensity = (value: number) => {
    // Normalize value to 0-1 range for color intensity
    const normalized = Math.min(Math.max(value, 0), 1)

    // Create cybersecurity-themed color gradient
    if (normalized < 0.3) {
      // Low deviation - green (secure)
      return `rgba(6, 182, 212, ${0.2 + normalized * 0.5})`
    } else if (normalized < 0.7) {
      // Medium deviation - yellow/orange (warning)
      const intensity = Math.floor(normalized * 255)
      return `rgb(245, ${200 - intensity / 2}, 66, ${0.5 + normalized * 0.3})`
    } else {
      // High deviation - red (alert)
      return `rgba(239, 68, 68, ${0.5 + normalized * 0.5})`
    }
  }

  const getRiskLevel = (value: number) => {
    if (value < 0.3) return { level: "Low", color: "text-cyan-400", icon: "🟢" }
    if (value < 0.7) return { level: "Medium", color: "text-yellow-400", icon: "🟡" }
    return { level: "High", color: "text-red-400", icon: "🔴" }
  }

  const avgDeviation = data.reduce((sum, val) => sum + val, 0) / data.length
  const maxDeviation = Math.max(...data)
  const riskAssessment = getRiskLevel(avgDeviation)

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 shadow-xl backdrop-blur-sm transition-all duration-300 hover:shadow-cyan-500/10">
      <CardHeader
        className="border-b border-slate-700/50"
        style={{ background: "linear-gradient(to right, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.8))" }}
      >
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Biometric Pattern Analysis
          </span>
        </CardTitle>
        <CardDescription className="text-slate-400">
          🔍 Real-time visualization of typing pattern deviations from baseline
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {/* Risk Assessment Summary */}
        <div className="mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Threat Assessment</span>
            <div className={`flex items-center gap-1 ${riskAssessment.color} font-medium`}>
              {riskAssessment.icon} {riskAssessment.level} Risk
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Avg Deviation:</span>
              <span className="ml-2 font-mono text-slate-200">{avgDeviation.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-slate-400">Max Deviation:</span>
              <span className="ml-2 font-mono text-slate-200">{maxDeviation.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-300">Keystroke Pattern Analysis</h4>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <AlertTriangle className="w-3 h-3" />
              Hover for details
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-w-2xl mx-auto">
            {data.map((value, index) => {
              const risk = getRiskLevel(value)
              return (
                <div key={index} className="relative group">
                  <div
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border-2 border-slate-600/50 flex items-center justify-center text-xs font-mono font-bold transition-all duration-300 hover:scale-110 hover:shadow-lg cursor-pointer text-slate-200"
                    style={{ backgroundColor: getColorIntensity(value) }}
                    title={`Key ${index + 1}: ${value.toFixed(3)} (${risk.level} Risk)`}
                  >
                    {index + 1}
                  </div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-700 text-slate-200 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 border border-slate-600/50">
                    Key {index + 1}: {value.toFixed(3)}
                    <br />
                    {risk.icon} {risk.level} Risk
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div
          className="mt-6 p-4 rounded-lg border border-slate-600/30"
          style={{ background: "linear-gradient(to right, rgba(51, 65, 85, 0.3), rgba(51, 65, 85, 0.2))" }}
        >
          <h4 className="text-sm font-medium text-slate-300 mb-3">Threat Level Legend</h4>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-slate-600/50"
                style={{ backgroundColor: getColorIntensity(0.1) }}
              ></div>
              <span className="text-cyan-400">🟢 Low Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-slate-600/50"
                style={{ backgroundColor: getColorIntensity(0.5) }}
              ></div>
              <span className="text-yellow-400">🟡 Medium Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-slate-600/50"
                style={{ backgroundColor: getColorIntensity(0.9) }}
              ></div>
              <span className="text-red-400">🔴 High Risk</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            💡 Lower deviations indicate consistent typing patterns, while higher deviations may suggest anomalous
            behavior
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
