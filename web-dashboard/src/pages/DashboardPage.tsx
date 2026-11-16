import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, Cpu, HardDrive, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardPage() {
  const { user } = useAuth()

  const stats = [
    { label: "Databases", value: "3", icon: Database, color: "text-blue-600 bg-blue-100" },
    { label: "Active Queries", value: "12", icon: Activity, color: "text-green-600 bg-green-100" },
    { label: "CPU Usage", value: "45%", icon: Cpu, color: "text-yellow-600 bg-yellow-100" },
    { label: "Storage Used", value: "2.3 GB", icon: HardDrive, color: "text-purple-600 bg-purple-100" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {user?.full_name || user?.email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{stat.label}</CardTitle>
                <Icon className={cn("h-4 w-4", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Query Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-400">
              Chart placeholder - Query performance over time
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Slow Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                "SELECT * FROM orders WHERE created_at > '2024-01-01'",
                "UPDATE users SET last_login = NOW() WHERE id = ?",
                "SELECT COUNT(*) FROM analytics_events WHERE event_type = 'purchase'",
              ].map((query, i) => (
                <div key={i} className="text-sm text-gray-600 font-mono truncate">{query}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}