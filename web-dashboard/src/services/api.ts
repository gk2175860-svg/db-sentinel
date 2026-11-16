import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios"

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: "/api/v1",
      headers: {
        "Content-Type": "application/json",
      },
    })

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem("token")
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Don't redirect on login page - let the component handle the error
          const isLoginRequest = error.config?.url?.includes("/auth/login")
          if (!isLoginRequest) {
            localStorage.removeItem("token")
            localStorage.removeItem("refreshToken")
            window.location.href = "/login"
          }
        }
        return Promise.reject(error)
      }
    )
  }

  async login(email: string, password: string) {
    const response = await this.client.post("/auth/login", { email, password })
    return response.data
  }

  async getCurrentUser(token: string) {
    const response = await this.client.get("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  }

  async getDatabases() {
    const response = await this.client.get("/databases")
    return response.data
  }

  async getDatabase(id: string) {
    const response = await this.client.get(`/databases/${id}`)
    return response.data
  }

  async createDatabase(data: any) {
    const response = await this.client.post("/databases", data)
    return response.data
  }

  async updateDatabase(id: string, data: any) {
    const response = await this.client.put(`/databases/${id}`, data)
    return response.data
  }

  async deleteDatabase(id: string) {
    const response = await this.client.delete(`/databases/${id}`)
    return response.data
  }

  async testDatabaseConnection(id: string) {
    const response = await this.client.post(`/databases/${id}/test`)
    return response.data
  }

  // Agents API
  async getAgents() {
    const response = await this.client.get("/agents")
    return response.data
  }

  async getAgent(agentType: string) {
    const response = await this.client.get(`/agents/${agentType}`)
    return response.data
  }

  async submitAgentTask(agentType: string, data: any) {
    const response = await this.client.post(`/agents/${agentType}/tasks`, data)
    return response.data
  }

  async getTask(taskId: string) {
    const response = await this.client.get(`/agents/tasks/${taskId}`)
    return response.data
  }

  async getTasks(status?: string, limit: number = 100) {
    const params = new URLSearchParams()
    if (status) params.append("status", status)
    params.append("limit", limit.toString())
    const response = await this.client.get(`/agents/tasks?${params.toString()}`)
    return response.data
  }

  async retryAgentTask(taskId: string) {
    const response = await this.client.post(`/agents/tasks/${taskId}/retry`)
    return response.data
  }

  async cancelAgentTask(taskId: string) {
    const response = await this.client.delete(`/agents/tasks/${taskId}`)
    return response.data
  }
}

export const api = new ApiService()