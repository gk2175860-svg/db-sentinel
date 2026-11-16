import { useState } from "react"
import { api } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Play, RefreshCw, AlertCircle, FileText, Brain } from "lucide-react"
import { cn } from "@/lib/utils"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface Agent {
  agent_type: string
  name: string
  description: string
  version: string
  capabilities: string[]
  required_params: string[]
  optional_params: string[]
}

interface Task {
  task_id: string
  agent_type: string
  database_id: string | null
  status: string
  progress: number
  current_step: string | null
  result: any | null
  error: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

interface Database {
  id: string
  name: string
  type: string
  host: string
}

export function AgentsPage() {
  const queryClient = useQueryClient()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [formData, setFormData] = useState({
    database_id: "",
    parameters: {} as Record<string, string>,
  })
  const [activeTab, setActiveTab] = useState<"agents" | "tasks">("agents")

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const response = await api.getAgents()
      return response as Agent[]
    },
  })

  // Fetch tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const response = await api.getTasks()
      return response as Task[]
    },
    refetchInterval: 5000,
  })

  // Fetch databases
  const { data: databases = [] } = useQuery({
    queryKey: ["databases"],
    queryFn: async () => {
      const response = await api.getDatabases()
      return response as Database[]
    },
  })

  // Submit task mutation
  const submitTaskMutation = useMutation({
    mutationFn: async (data: { agent_type: string; database_id?: string; parameters: any }) => {
      const response = await api.submitAgentTask(data.agent_type, data)
      return response
    },
    onSuccess: () => {
      setShowSubmitModal(false)
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
    onError: (error: any) => {
      alert(error.response?.data?.error?.message || "Failed to submit task")
    },
  })

  // Retry task mutation
  const retryTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await api.retryAgentTask(taskId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  // Cancel task mutation
  const cancelTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await api.cancelAgentTask(taskId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      queued: "bg-gray-100 text-gray-800",
      running: "bg-blue-100 text-blue-800",
      waiting_input: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
    }
    return (
      <span className={cn("inline-flex items-center px-2 py-1 rounded-full text-xs font-medium", styles[status])}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
      </span>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params: Record<string, any> = {}
    for (const [key, value] of Object.entries(formData.parameters)) {
      // Try to parse as JSON, fallback to string
      try {
        params[key] = JSON.parse(value)
      } catch {
        params[key] = value
      }
    }
    submitTaskMutation.mutate({
      agent_type: selectedAgent!,
      database_id: formData.database_id || undefined,
      parameters: params,
    })
  }

  const openSubmitModal = (agentType: string) => {
    setSelectedAgent(agentType)
    const agent = agents.find(a => a.agent_type === agentType)
    const initialParams: Record<string, string> = {}
    if (agent) {
      for (const param of agent.required_params) {
        initialParams[param] = ""
      }
      for (const param of agent.optional_params) {
        initialParams[param] = ""
      }
    }
    setFormData({
      database_id: "",
      parameters: initialParams,
    })
    setShowSubmitModal(true)
  }

  const updateParam = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      parameters: { ...prev.parameters, [key]: value },
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agents & Tasks</h1>
          <p className="text-gray-500 mt-1">Manage AI agents and monitor task execution</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("agents")}
            className={cn(
              "py-3 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "agents"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <Brain className="w-4 h-4 inline mr-2" />
            Agents ({agents.length})
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={cn(
              "py-3 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "tasks"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Tasks ({tasks.length})
          </button>
        </nav>
      </div>

      {activeTab === "agents" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agentsLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-full mt-2" />
                </CardContent>
              </Card>
            ))
          ) : agents.length === 0 ? (
            <div className="col-span-3 text-center py-12 text-gray-500">
              No agents available
            </div>
          ) : (
            agents.map((agent) => (
              <Card key={agent.agent_type}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-primary" />
                        {agent.name}
                      </CardTitle>
                      <CardDescription>{agent.description}</CardDescription>
                    </div>
                    <span className="text-xs text-gray-500">v{agent.version}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Capabilities</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Required Parameters</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.required_params.map((param) => (
                        <span
                          key={param}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                        >
                          {param}*
                        </span>
                      ))}
                    </div>
                  </div>
                  {agent.optional_params.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Optional Parameters</p>
                      <div className="flex flex-wrap gap-1">
                        {agent.optional_params.map((param) => (
                          <span
                            key={param}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {param}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => openSubmitModal(agent.agent_type)}
                    disabled={submitTaskMutation.isPending}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Run Agent
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === "tasks" && (
        <Card>
          <CardContent className="p-0">
            {tasksLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Database</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Step</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tasks.map((task) => (
                      <tr key={task.task_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono text-sm text-gray-900">
                          {task.task_id.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {task.agent_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {task.database_id ? task.database_id.slice(0, 8) + "..." : "N/A"}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(task.status)}</td>
                        <td className="px-6 py-4">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full bg-primary transition-all duration-300",
                                task.status === "failed" && "bg-red-500",
                                task.status === "completed" && "bg-green-500"
                              )}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">
                          {task.current_step || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(task.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {task.status === "running" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelTaskMutation.mutate(task.task_id)}
                                disabled={cancelTaskMutation.isPending}
                              >
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                            {(task.status === "failed" || task.status === "cancelled") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => retryTaskMutation.mutate(task.task_id)}
                                disabled={retryTaskMutation.isPending}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                            {task.status === "completed" && task.result && (
                              <Button variant="ghost" size="sm" onClick={() => {
                                const resultStr = JSON.stringify(task.result, null, 2)
                                navigator.clipboard.writeText(resultStr)
                                alert("Result copied to clipboard!")
                              }}>
                                <FileText className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          No tasks yet. Run an agent to create a task.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit Task Modal */}
      {showSubmitModal && selectedAgent && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowSubmitModal(false)} />
            <Card className="w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Run {agents.find(a => a.agent_type === selectedAgent)?.name}</CardTitle>
                <CardDescription>Configure parameters and submit task</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="database_id">Database (Optional)</Label>
                    <Select value={formData.database_id} onValueChange={(v) => setFormData(prev => ({ ...prev, database_id: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select database" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {databases.map((db) => (
                          <SelectItem key={db.id} value={db.id}>
                            {db.name} ({db.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {Object.entries(formData.parameters).map(([key, value]) => {
                    const agent = agents.find(a => a.agent_type === selectedAgent)
                    const isRequired = agent?.required_params.includes(key)
                    return (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={key}>
                          {key} {isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        <Textarea
                          id={key}
                          value={value}
                          onChange={(e) => updateParam(key, e.target.value)}
                          placeholder={isRequired ? "Required" : "Optional"}
                          rows={3}
                          required={isRequired}
                        />
                      </div>
                    )
                  })}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowSubmitModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitTaskMutation.isPending}>
                      {submitTaskMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Submit Task
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// API service extensions
declare module "@/services/api" {
  interface ApiService {
    getAgents(): Promise<Agent[]>
    getTasks(): Promise<Task[]>
    submitAgentTask(agentType: string, data: any): Promise<any>
    retryAgentTask(taskId: string): Promise<void>
    cancelAgentTask(taskId: string): Promise<void>
  }
}