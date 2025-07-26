"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

interface AuthLog {
  timestamp: string
  username: string
  result: "Pass" | "Fail"
  mse: number
  ip: string
  userAgent: string
}

interface SessionReportProps {
  logs: AuthLog[]
}

export function SessionReport({ logs }: SessionReportProps) {
  const [generating, setGenerating] = useState(false)

  const generatePDFReport = async () => {
    setGenerating(true)
    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs }),
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `session_report_${new Date().toISOString().split("T")[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to generate PDF report:", error)
    }
    setGenerating(false)
  }

  // Process data for charts
  const dailyStats = logs.reduce(
    (acc, log) => {
      const date = log.timestamp.split("T")[0]
      if (!acc[date]) {
        acc[date] = { date, pass: 0, fail: 0, totalMSE: 0, count: 0 }
      }
      acc[date][log.result.toLowerCase() as "pass" | "fail"]++
      acc[date].totalMSE += log.mse
      acc[date].count++
      return acc
    },
    {} as Record<string, any>,
  )

  const chartData = Object.values(dailyStats).map((day: any) => ({
    ...day,
    avgMSE: day.totalMSE / day.count,
  }))

  const userStats = logs.reduce(
    (acc, log) => {
      if (!acc[log.username]) {
        acc[log.username] = { username: log.username, pass: 0, fail: 0, avgMSE: 0, totalMSE: 0, count: 0 }
      }
      acc[log.username][log.result.toLowerCase() as "pass" | "fail"]++
      acc[log.username].totalMSE += log.mse
      acc[log.username].count++
      acc[log.username].avgMSE = acc[log.username].totalMSE / acc[log.username].count
      return acc
    },
    {} as Record<string, any>,
  )

  const userChartData = Object.values(userStats)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Session Report
          <Button onClick={generatePDFReport} disabled={generating}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </CardTitle>
        <CardDescription>Comprehensive analysis of authentication patterns</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Daily Authentication Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="pass" stroke="#10b981" name="Successful" />
                <Line type="monotone" dataKey="fail" stroke="#ef4444" name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Average MSE by User</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="username" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgMSE" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">User Performance Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 p-2 text-left">Username</th>
                  <th className="border border-gray-300 p-2 text-center">Total Attempts</th>
                  <th className="border border-gray-300 p-2 text-center">Successful</th>
                  <th className="border border-gray-300 p-2 text-center">Failed</th>
                  <th className="border border-gray-300 p-2 text-center">Success Rate</th>
                  <th className="border border-gray-300 p-2 text-center">Avg MSE</th>
                </tr>
              </thead>
              <tbody>
                {userChartData.map((user: any) => (
                  <tr key={user.username}>
                    <td className="border border-gray-300 p-2">{user.username}</td>
                    <td className="border border-gray-300 p-2 text-center">{user.count}</td>
                    <td className="border border-gray-300 p-2 text-center text-green-600">{user.pass}</td>
                    <td className="border border-gray-300 p-2 text-center text-red-600">{user.fail}</td>
                    <td className="border border-gray-300 p-2 text-center">
                      {((user.pass / user.count) * 100).toFixed(1)}%
                    </td>
                    <td className="border border-gray-300 p-2 text-center font-mono">{user.avgMSE.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
