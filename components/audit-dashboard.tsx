"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, AlertTriangle, Users, Clock, Activity, RefreshCw } from "lucide-react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import { AnomalyHeatmap } from "./anomaly-heatmap"

interface AuthLog {
  timestamp: string
  username: string
  result: "Pass" | "Fail"
  mse: number | null
  ip: string
  userAgent: string
  reason?: string
}

export function AuditDashboard() {
  const [logs, setLogs] = useState<AuthLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avgHeatmapData, setAvgHeatmapData] = useState<number[]>([])

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/auth-logs", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setLogs(Array.isArray(data) ? data : [])

      // Calculate average heatmap data from all attempts
      if (data.length > 0) {
        // Simulate heatmap data for demo (in real app, this would come from stored deviations)
        const avgDeviations = Array.from({ length: 11 }, () => Math.random() * 0.8)
        setAvgHeatmapData(avgDeviations)
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch logs")
      setLogs([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const exportLogs = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/export-logs")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `security_audit_${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to export logs:", error)
      setError("Failed to export logs")
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    totalAttempts: logs.length,
    successfulAttempts: logs.filter((log) => log.result === "Pass").length,
    failedAttempts: logs.filter((log) => log.result === "Fail").length,
    uniqueUsers: new Set(logs.map((log) => log.username)).size,
    avgMSE:
      logs.length > 0
        ? logs.reduce((sum, log) => sum + (log.mse || 0), 0) / logs.filter((log) => log.mse != null).length || 0
        : 0,
    successRate: logs.length > 0 ? (logs.filter((log) => log.result === "Pass").length / logs.length) * 100 : 0,
  }

  // Process data for charts
  const hourlyData = logs.reduce(
    (acc, log) => {
      const hour = new Date(log.timestamp).getHours()
      if (!acc[hour]) {
        acc[hour] = { hour: `${hour}:00`, pass: 0, fail: 0, total: 0 }
      }
      acc[hour][log.result.toLowerCase() as "pass" | "fail"]++
      acc[hour].total++
      return acc
    },
    {} as Record<number, any>,
  )

  const hourlyChartData = Array.from(
    { length: 24 },
    (_, i) => hourlyData[i] || { hour: `${i}:00`, pass: 0, fail: 0, total: 0 },
  )

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="bg-red-900/20 border-red-500/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>Error loading dashboard: {error}</span>
            </div>
            <button
              onClick={fetchLogs}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="border-0 shadow-lg"
          style={{ background: "linear-gradient(135deg, rgb(51, 65, 85), rgb(30, 41, 59))" }}
        >
          <CardContent className="p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{stats.totalAttempts}</div>
                <p className="text-slate-300">Total Attempts</p>
              </div>
              <Activity className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-lg"
          style={{ background: "linear-gradient(135deg, rgb(8, 145, 178), rgb(6, 182, 212))" }}
        >
          <CardContent className="p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{stats.successfulAttempts}</div>
                <p className="text-cyan-100">Authorized</p>
                <p className="text-xs text-cyan-200">{stats.successRate.toFixed(1)}% success rate</p>
              </div>
              <Shield className="w-8 h-8 text-cyan-300" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-lg"
          style={{ background: "linear-gradient(135deg, rgb(220, 38, 38), rgb(239, 68, 68))" }}
        >
          <CardContent className="p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{stats.failedAttempts}</div>
                <p className="text-red-100">Unauthorized</p>
                <p className="text-xs text-red-200">{(100 - stats.successRate).toFixed(1)}% blocked</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-300" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-lg"
          style={{ background: "linear-gradient(135deg, rgb(37, 99, 235), rgb(59, 130, 246))" }}
        >
          <CardContent className="p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{stats.uniqueUsers}</div>
                <p className="text-blue-100">Registered Users</p>
                <p className="text-xs text-blue-200">Avg MSE: {stats.avgMSE ? stats.avgMSE.toFixed(4) : "N/A"}</p>
              </div>
              <Users className="w-8 h-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Average Heatmap */}
      {avgHeatmapData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4">📊 Average Threat Pattern Analysis</h3>
          <AnomalyHeatmap data={avgHeatmapData} />
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Hourly Activity Chart */}
        <Card className="bg-slate-800/50 border-slate-700/50 shadow-xl backdrop-blur-sm">
          <CardHeader
            className="border-b border-slate-700/50"
            style={{ background: "linear-gradient(to right, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.8))" }}
          >
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Security Activity Timeline
              </span>
            </CardTitle>
            <CardDescription className="text-slate-400">Authentication attempts by hour of day</CardDescription>
          </CardHeader>
          <CardContent className="p-6 bg-slate-800/30">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" stroke="#475569" />
                <XAxis dataKey="hour" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                  }}
                />
                <Area type="monotone" dataKey="pass" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} />
                <Area type="monotone" dataKey="fail" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card className="bg-slate-800/50 border-slate-700/50 shadow-xl backdrop-blur-sm">
        <CardHeader
          className="border-b border-slate-700/50"
          style={{ background: "linear-gradient(to right, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.8))" }}
        >
          <CardTitle className="flex items-center justify-between text-slate-100">
            <span className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Recent Security Events
            </span>
            <div className="flex gap-2">
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="px-3 py-1 bg-green-600/80 hover:bg-green-500 text-white text-sm rounded border border-green-500/50 transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={exportLogs}
                disabled={loading}
                className="px-3 py-1 bg-blue-600/80 hover:bg-blue-500 text-white text-sm rounded border border-blue-500/50 transition-colors"
              >
                Export CSV
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-slate-800/30">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No authentication logs found</p>
              <p className="text-sm">Logs will appear here after authentication attempts</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-600">
                <thead>
                  <tr className="bg-slate-700/50">
                    <th className="border border-gray-600 p-2 text-left text-slate-300">Timestamp</th>
                    <th className="border border-gray-600 p-2 text-left text-slate-300">User</th>
                    <th className="border border-gray-600 p-2 text-center text-slate-300">Result</th>
                    <th className="border border-gray-600 p-2 text-center text-slate-300">MSE</th>
                    <th className="border border-gray-600 p-2 text-left text-slate-300">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 10).map((log, index) => (
                    <tr key={index} className="hover:bg-slate-700/30">
                      <td className="border border-gray-600 p-2 text-slate-300 font-mono text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="border border-gray-600 p-2 text-slate-300">{log.username}</td>
                      <td className="border border-gray-600 p-2 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            log.result === "Pass"
                              ? "bg-green-500/20 text-green-300 border border-green-500/30"
                              : "bg-red-500/20 text-red-300 border border-red-500/30"
                          }`}
                        >
                          {log.result}
                        </span>
                      </td>
                      <td className="border border-gray-600 p-2 text-center font-mono text-slate-300">
                        {log.mse != null ? log.mse.toFixed(5) : "N/A"}
                      </td>
                      <td className="border border-gray-600 p-2 text-slate-300 font-mono">{log.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
