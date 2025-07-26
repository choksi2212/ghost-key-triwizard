"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, Download, Trash2, Terminal, Server, UserX, Users, AlertTriangle } from "lucide-react"

interface User {
  username: string
  hasKeystrokeModel: boolean
  hasVoiceModel: boolean
  lastActivity?: string
}

export function AdminPanel() {
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState("")
  const [users, setUsers] = useState<string[]>([])
  const [selectedUser, setSelectedUser] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteResult, setDeleteResult] = useState<any>(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers()
    }
  }, [isAuthenticated])

  const adminLogin = () => {
    if (password === "admin123") {
      setIsAuthenticated(true)
      setError("")
    } else {
      setError("Invalid admin credentials")
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/list-users")
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
  }

  const deleteUserData = async () => {
    if (!selectedUser) {
      setError("Please select a user to delete")
      return
    }

    const confirmMessage = `⚠️ CRITICAL WARNING ⚠️

This will PERMANENTLY DELETE ALL DATA for user: ${selectedUser}

This includes:
• All trained keystroke models
• All voice authentication models  
• All authentication logs and history
• All raw training data
• All user-specific files

This action CANNOT be undone!

Type the username "${selectedUser}" to confirm:`

    const confirmation = prompt(confirmMessage)

    if (confirmation !== selectedUser) {
      alert("❌ Deletion cancelled - username confirmation did not match")
      return
    }

    setDeleteLoading(true)
    setDeleteResult(null)
    setError("")

    try {
      const response = await fetch("/api/delete-user-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedUser,
          adminPassword: password,
        }),
      })

      const result = await response.json()
      setDeleteResult(result)

      if (result.success) {
        alert(`✅ Successfully deleted all data for user: ${selectedUser}`)
        setSelectedUser("")
        fetchUsers() // Refresh user list
      } else {
        setError(result.message || "Failed to delete user data")
      }
    } catch (error) {
      setError("Failed to delete user data: " + error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const clearLogs = async () => {
    if (confirm("⚠️ WARNING: This will permanently delete all security logs. Continue?")) {
      try {
        await fetch("/api/clear-logs", { method: "POST" })
        alert("🧹 Security logs cleared successfully")
      } catch (error) {
        alert("❌ Failed to clear logs: " + error)
      }
    }
  }

  const exportAllData = async () => {
    try {
      const response = await fetch("/api/export-all-data")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `keystroke_auth_export_${new Date().toISOString().split("T")[0]}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      alert("❌ Failed to export data: " + error)
    }
  }

  if (!isAuthenticated) {
    return (
      <Card className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-700/50 dark:border-slate-600/50 shadow-2xl backdrop-blur-sm">
        <CardHeader
          className="border-b border-slate-700/50 dark:border-slate-600/50"
          style={{
            background: "linear-gradient(to right, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.8))",
          }}
        >
          <CardTitle className="flex items-center gap-2 text-slate-100 dark:text-slate-200">
            <Shield className="w-5 h-5 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Security Command Center
            </span>
          </CardTitle>
          <CardDescription className="text-slate-400 dark:text-slate-500">
            🔒 Administrative access required for system management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 bg-slate-800/30 dark:bg-slate-900/30">
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-slate-300 dark:text-slate-400">
              Admin Credentials
            </Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adminLogin()}
              placeholder="Enter admin password"
              className="bg-slate-700/50 dark:bg-slate-800/50 border-slate-600/50 dark:border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-purple-500/50 dark:focus:border-purple-400/50 transition-all duration-300"
            />
            <p className="text-xs text-slate-500">Default: admin123 (for demo purposes only)</p>
          </div>

          {error && (
            <Alert className="border-red-500/50 bg-red-500/10 text-red-300 dark:text-red-400">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={adminLogin}
            className="w-full bg-gradient-to-r from-purple-600/80 to-purple-700/80 hover:from-purple-500 hover:to-purple-600 border border-purple-500/50 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-medium backdrop-blur-sm"
          >
            <Shield className="w-4 h-4 mr-2" />
            Authenticate Administrator
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Data Management */}
      <Card className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-700/50 dark:border-slate-600/50 shadow-2xl backdrop-blur-sm">
        <CardHeader
          className="border-b border-slate-700/50 dark:border-slate-600/50"
          style={{
            background: "linear-gradient(to right, rgba(220, 38, 38, 0.8), rgba(239, 68, 68, 0.8))",
          }}
        >
          <CardTitle className="flex items-center gap-2 text-slate-100 dark:text-slate-200">
            <UserX className="w-5 h-5 text-red-400" />
            <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              🗑️ User Data Management
            </span>
          </CardTitle>
          <CardDescription className="text-slate-400 dark:text-slate-500">
            ⚠️ DANGER ZONE: Permanently delete all user data including models, logs, and training data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 bg-slate-800/30 dark:bg-slate-900/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Select User to Delete</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-slate-200">
                  <SelectValue placeholder="Choose user..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {users.map((user) => (
                    <SelectItem key={user} value={user} className="text-slate-200 hover:bg-slate-700">
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Found {users.length} registered users</p>
            </div>

            <div className="flex items-end">
              <Button
                onClick={deleteUserData}
                disabled={!selectedUser || deleteLoading}
                className="w-full bg-gradient-to-r from-red-600/80 to-red-700/80 hover:from-red-500 hover:to-red-600 border border-red-500/50 text-white font-medium"
              >
                <UserX className="w-4 h-4 mr-2" />
                {deleteLoading ? "Deleting..." : "🗑️ DELETE ALL USER DATA"}
              </Button>
            </div>
          </div>

          {deleteResult && (
            <Alert
              className={`border-${deleteResult.success ? "green" : "red"}-500/50 bg-${deleteResult.success ? "green" : "red"}-500/10`}
            >
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className={`text-${deleteResult.success ? "green" : "red"}-300`}>
                <div className="font-medium">{deleteResult.message}</div>
                {deleteResult.deletionResults && (
                  <div className="mt-2 text-sm">
                    <div>
                      ✅ Keystroke Models: {deleteResult.deletionResults.keystrokeModels ? "Deleted" : "Not Found"}
                    </div>
                    <div>✅ Voice Models: {deleteResult.deletionResults.voiceModels ? "Deleted" : "Not Found"}</div>
                    <div>✅ Auth Logs: {deleteResult.deletionResults.authLogs ? "Cleaned" : "Not Found"}</div>
                    {deleteResult.deletionResults.errors.length > 0 && (
                      <div className="mt-1 text-red-400">Errors: {deleteResult.deletionResults.errors.join(", ")}</div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-300">
                <div className="font-medium mb-1">⚠️ WARNING: This action is IRREVERSIBLE</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Deletes all trained ML models (keystroke & voice)</li>
                  <li>Removes all authentication logs and history</li>
                  <li>Erases all raw training data and samples</li>
                  <li>Clears user from audit dashboard</li>
                  <li>Cannot be undone - user will need to re-register</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Administration */}
      <Card className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-700/50 dark:border-slate-600/50 shadow-2xl backdrop-blur-sm">
        <CardHeader
          className="border-b border-slate-700/50 dark:border-slate-600/50"
          style={{
            background: "linear-gradient(to right, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.8))",
          }}
        >
          <CardTitle className="flex items-center gap-2 text-slate-100 dark:text-slate-200">
            <Terminal className="w-5 h-5 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              System Administration
            </span>
          </CardTitle>
          <CardDescription className="text-slate-400 dark:text-slate-500">
            ⚙️ Advanced system management and security controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 bg-slate-800/30 dark:bg-slate-900/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={exportAllData}
              className="flex items-center gap-2 bg-blue-600/80 hover:bg-blue-500 border border-blue-500/50"
            >
              <Download className="w-4 h-4" />
              Export All Security Data
            </Button>

            <Button
              onClick={clearLogs}
              variant="destructive"
              className="flex items-center gap-2 bg-red-600/80 hover:bg-red-500 border border-red-500/50"
            >
              <Trash2 className="w-4 h-4" />
              Purge Security Logs
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Button
              className="flex items-center gap-2 bg-purple-600/80 hover:bg-purple-500 border border-purple-500/50"
              onClick={fetchUsers}
            >
              <Users className="w-4 h-4" />
              Refresh User List ({users.length})
            </Button>

            <Button
              className="flex items-center gap-2 bg-cyan-600/80 hover:bg-cyan-500 border border-cyan-500/50"
              onClick={() => alert("Feature coming soon")}
            >
              <Server className="w-4 h-4" />
              System Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-700/50 dark:border-slate-600/50 shadow-2xl backdrop-blur-sm">
        <CardHeader
          className="border-b border-slate-700/50 dark:border-slate-600/50"
          style={{
            background: "linear-gradient(to right, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.8))",
          }}
        >
          <CardTitle className="text-slate-100 dark:text-slate-200">System Status</CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-slate-800/30 dark:bg-slate-900/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-slate-700/30 dark:bg-slate-800/30 rounded-lg border border-slate-600/30 dark:border-slate-700/30">
              <div className="text-2xl font-bold text-cyan-400">ACTIVE</div>
              <div className="text-sm text-slate-400">System Status</div>
            </div>
            <div className="p-4 bg-slate-700/30 dark:bg-slate-800/30 rounded-lg border border-slate-600/30 dark:border-slate-700/30">
              <div className="text-2xl font-bold text-cyan-400">{users.length}</div>
              <div className="text-sm text-slate-400">Registered Users</div>
            </div>
            <div className="p-4 bg-slate-700/30 dark:bg-slate-800/30 rounded-lg border border-slate-600/30 dark:border-slate-700/30">
              <div className="text-2xl font-bold text-cyan-400">256MB</div>
              <div className="text-sm text-slate-400">Storage Used</div>
            </div>
            <div className="p-4 bg-slate-700/30 dark:bg-slate-800/30 rounded-lg border border-slate-600/30 dark:border-slate-700/30">
              <div className="text-2xl font-bold text-cyan-400">0.02s</div>
              <div className="text-sm text-slate-400">Avg Response</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
