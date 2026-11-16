# DB Sentinel Deployment Guide

## Overview

DB Sentinel is a production-ready AI-powered database management platform. This guide covers deployment options for different environments and scales.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Load      │────▶│  Frontend   │     │  Backend    │
│  Balancer   │     │  (nginx)    │────▶│  (FastAPI)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                    ┌─────────────┐     ┌───────▼───────┐
                    │   Ollama    │     │  PostgreSQL   │
                    │  (Local LLM)│     │  (Metadata)   │
                    └─────────────┘     └───────────────┘
                                                │
                    ┌─────────────┐     ┌───────▼───────┐
                    │   Redis     │     │  Monitored    │
                    │  (Queue)    │     │  Databases    │
                    └─────────────┘     └───────────────┘
```

## Quick Start (Development)

```bash
# Clone and configure
git clone <repo>
cd db-sentinel
cp .env.example .env
# Edit .env with your secrets

# Start all services
docker-compose up -d

# Access at http://localhost:5173
# Login: admin@db-sentinel.io / admin123
```

## Production Deployment

### Prerequisites

- Docker 24+ and Docker Compose 2+
- 4GB+ RAM, 2+ CPU cores
- Domain name with SSL certificate
- PostgreSQL 16+ (external or containerized)
- Redis 7+ (external or containerized)

### Environment Variables

Create `.env` from `.env.example`:

```bash
# Required - generate with: openssl rand -hex 32
JWT_SECRET=your-32-char-secret
ENCRYPTION_KEY=your-32-char-key
SEED_ADMIN_PASSWORD=secure-admin-password

# Database
POSTGRES_PASSWORD=secure-db-password
POSTGRES_ROOT_PASSWORD=secure-root-password

# Optional
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
```

### Deploy with Docker Compose

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: db-sentinel-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: db-sentinel-backend
  template:
    metadata:
      labels:
        app: db-sentinel-backend
    spec:
      containers:
      - name: backend
        image: ghcr.io/your-org/db-sentinel-agent-engine:latest
        ports:
        - containerPort: 8000
        envFrom:
        - secretRef:
            name: db-sentinel-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: db-sentinel-backend
spec:
  selector:
    app: db-sentinel-backend
  ports:
  - port: 8000
    targetPort: 8000
```

### Cloud Provider Options

| Provider | Services | Estimated Cost/Month |
|----------|----------|---------------------|
| **AWS** | ECS Fargate, RDS PostgreSQL, ElastiCache, ALB, Certificate Manager | $150-400 |
| **GCP** | Cloud Run, Cloud SQL, Memorystore, Cloud Load Balancing | $120-350 |
| **Azure** | Container Apps, PostgreSQL Flexible Server, Redis Cache, Front Door | $130-380 |
| **DigitalOcean** | App Platform, Managed Databases, Load Balancer | $80-200 |
| **Self-hosted** | Docker Swarm / Kubernetes on VMs | $50-150 |

### SSL/TLS Setup

```bash
# Using Let's Encrypt with certbot
certbot certonly --standalone -d db-sentinel.example.com

# Or use cloud provider managed certificates
# AWS: ACM, GCP: Managed SSL, Azure: App Gateway
```

### Database Migrations

Migrations run automatically on startup via entrypoint script:

```bash
# Manual migration
docker-compose -f docker-compose.prod.yml exec agent-engine alembic upgrade head

# Create new migration
docker-compose -f docker-compose.prod.yml exec agent-engine alembic revision --autogenerate -m "description"
```

### Scaling

```yaml
# Horizontal scaling in docker-compose.prod.yml
agent-engine:
  deploy:
    replicas: 3
    resources:
      limits:
        cpus: '2'
        memory: 2G
```

For Kubernetes:
```bash
kubectl scale deployment db-sentinel-backend --replicas=5
kubectl autoscale deployment db-sentinel-backend --cpu-percent=70 --min=3 --max=10
```

### Monitoring

- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000` (admin/admin)
- **Metrics endpoint**: `/metrics` on backend
- **Health checks**: `/api/v1/health`

Key metrics to monitor:
- API latency (p50, p95, p99)
- Error rates (4xx, 5xx)
- Task queue length
- Database connection pool
- Memory/CPU usage
- Task success/failure rates

### Backup Strategy

```bash
# PostgreSQL backup
pg_dump -h localhost -U db_sentinel db_sentinel > backup_$(date +%Y%m%d).sql

# Automated with cron
0 2 * * * pg_dump -h postgres -U db_sentinel db_sentinel | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz

# Redis backup
redis-cli BGSAVE
cp /data/dump.rdb /backups/redis_$(date +%Y%m%d).rdb
```

### Security Checklist

- [ ] Strong JWT_SECRET (32+ chars)
- [ ] Strong ENCRYPTION_KEY (32+ chars)
- [ ] Strong database passwords
- [ ] HTTPS enforced
- [ ] CORS restricted to production domains
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Non-root containers
- [ ] Regular security scans (Trivy, Bandit)
- [ ] Dependency updates scheduled

### Troubleshooting

```bash
# Check service health
curl http://localhost:8000/api/v1/health

# View backend logs
docker-compose -f docker-compose.prod.yml logs -f agent-engine

# Check database connectivity
docker-compose -f docker-compose.prod.yml exec agent-engine python -c "
from app.db.session import get_session_factory
import asyncio
async def test():
    async with get_session_factory()() as s:
        print('DB connected')
asyncio.run(test())
"

# Reset admin password
docker-compose -f docker-compose.prod.yml exec agent-engine python -c "
from app.core.security import hash_password
from app.db.session import get_session_factory
from sqlalchemy import update
from app.models import User
import asyncio
async def reset():
    async with get_session_factory()() as s:
        await s.execute(update(User).where(User.email=='admin@db-sentinel.io').values(password_hash=hash_password('newpassword')))
        await s.commit()
asyncio.run(reset())
"

# Migration issues
docker-compose -f docker-compose.prod.yml exec agent-engine alembic current
docker-compose -f docker-compose.prod.yml exec agent-engine alembic history
```

## Support

- Documentation: https://docs.db-sentinel.io
- Issues: https://github.com/your-org/db-sentinel/issues
- Security: security@db-sentinel.io