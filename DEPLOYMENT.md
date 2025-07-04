# Production Deployment & Security Guide

This guide covers the complete production deployment and security implementation for the OpenAI Realtime Agents application.

## 🔒 Security Implementation

### Authentication System
- **NextAuth.js** with multiple providers (GitHub, Google, Credentials)
- **JWT-based sessions** with 30-day expiration
- **Role-based access control** (Admin, User, Guest)
- **API key management** for user sessions
- **Password hashing** with bcryptjs

### Security Middleware
- **Rate limiting** (per IP and per user)
- **CSRF protection** for state-changing operations
- **Input validation** and sanitization with Zod
- **Security headers** (CSP, HSTS, XSS protection)
- **Request logging** for security monitoring

### API Security
- **Input validation** for all endpoints
- **Content sanitization** to prevent XSS
- **Error handling** without information leakage
- **Timeout protection** for external API calls
- **Request size limits** and content validation

## 🚀 Deployment Options

### 1. Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Configure environment variables
vercel env add OPENAI_API_KEY
vercel env add AUTH_SECRET
```

**Features:**
- Automatic HTTPS
- Global CDN
- Serverless functions
- Built-in monitoring

### 2. Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy to Railway
railway deploy

# Set environment variables
railway variables set OPENAI_API_KEY=your-key
railway variables set AUTH_SECRET=your-secret
```

**Features:**
- Managed PostgreSQL
- Auto-scaling
- Built-in monitoring
- Simple configuration

### 3. Docker Deployment
```bash
# Build production image
docker build -t realtime-agents .

# Run with Docker Compose
docker-compose up -d

# Or run standalone
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your-key \
  -e AUTH_SECRET=your-secret \
  realtime-agents
```

**Features:**
- Multi-stage builds
- Non-root user execution
- Health checks
- Resource limits

### 4. AWS Deployment
```bash
# Using AWS App Runner or ECS
aws apprunner create-service --cli-input-json file://apprunner-service.json

# Using Elastic Beanstalk
eb init
eb create production
```

## 🔧 Environment Configuration

### Required Variables
```bash
# Core Requirements
NODE_ENV=production
OPENAI_API_KEY=sk-proj-your-key
AUTH_SECRET=your-32-char-secret

# Database (Optional)
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...

# Cache (Optional)
VALKEY_URL=redis://...
```

### OAuth Setup (Optional)
```bash
# GitHub OAuth
GITHUB_ID=your-github-app-id
GITHUB_SECRET=your-github-app-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Monitoring Setup (Optional)
```bash
MONITORING_ENABLED=true
LOG_LEVEL=info
LANGSMITH_API_KEY=your-langsmith-key
LANGSMITH_PROJECT=your-project
```

## 🏗️ CI/CD Pipeline

The GitHub Actions workflow includes:

### Security Checks
- **Dependency audit** (npm audit)
- **License validation** (only approved licenses)
- **Docker image scanning** (Trivy)
- **Code quality** (ESLint, TypeScript)

### Testing
- **Unit tests** (Vitest)
- **Security tests** (auth, validation, deployment)
- **E2E tests** (Playwright)
- **Performance tests** (Lighthouse, Artillery)

### Deployment
- **Staging deployment** (develop branch)
- **Production deployment** (main branch)
- **Health checks** after deployment
- **Rollback capability** on failure

## 📊 Monitoring & Logging

### Structured Logging
```typescript
import { logger } from './lib/monitoring/logger';

// Security events
logger.security('Failed login attempt', { ip, email });

// Performance metrics
logger.performance('API response', duration, { endpoint });

// API requests
logger.api('POST', '/api/session', 200, 150, { userId });
```

### Metrics Collection
```typescript
import { metrics, appMetrics } from './lib/monitoring/metrics';

// Track API usage
appMetrics.openaiRequest('gpt-4o', 1500);

// Track user actions
appMetrics.userAction('session_created');

// Track errors
appMetrics.error('validation_error', '/api/responses');
```

### Health Monitoring
- **Health check endpoint** (`/api/health`)
- **Service dependency checks**
- **Environment validation**
- **Performance metrics**

## 🔐 Security Best Practices

### 1. Environment Security
- ✅ Use environment variables for secrets
- ✅ Validate all environment variables
- ✅ Use strong random secrets (32+ characters)
- ✅ Enable HTTPS in production
- ✅ Set secure headers

### 2. API Security
- ✅ Rate limit all endpoints
- ✅ Validate and sanitize inputs
- ✅ Use CSRF protection
- ✅ Log security events
- ✅ Handle errors securely

### 3. Authentication
- ✅ Use JWT with expiration
- ✅ Implement role-based access
- ✅ Support multiple auth providers
- ✅ Hash passwords securely
- ✅ Rotate API keys regularly

### 4. Database Security
- ✅ Use connection pooling
- ✅ Enable SSL connections
- ✅ Parameterized queries only
- ✅ Regular backups
- ✅ Access control

## 🚨 Security Incident Response

### 1. Detection
- Monitor logs for suspicious activity
- Set up alerts for security events
- Regular security audits
- Dependency vulnerability scanning

### 2. Response
- Immediate threat isolation
- Log preservation
- Impact assessment
- Communication plan

### 3. Recovery
- System restoration
- Security patches
- Configuration updates
- Post-incident review

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Security tests passed
- [ ] Performance tests passed
- [ ] Database migrations ready
- [ ] SSL certificates configured

### Deployment
- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Verify health checks
- [ ] Monitor error rates
- [ ] Test critical user flows

### Post-Deployment
- [ ] Monitor application metrics
- [ ] Check error logs
- [ ] Verify security headers
- [ ] Test authentication flows
- [ ] Monitor performance

## 🔧 Troubleshooting

### Common Issues

1. **Environment Variable Errors**
   ```bash
   # Check environment validation
   curl https://your-app.com/api/health
   ```

2. **Authentication Issues**
   ```bash
   # Verify auth configuration
   curl -I https://your-app.com/api/auth/session
   ```

3. **Rate Limiting**
   ```bash
   # Check rate limit headers
   curl -I https://your-app.com/api/session
   ```

### Performance Optimization
- Enable Next.js compression
- Use CDN for static assets
- Implement Redis caching
- Optimize Docker images
- Monitor bundle size

## 📞 Support

For deployment issues:
1. Check the health endpoint: `/api/health`
2. Review application logs
3. Verify environment configuration
4. Check security middleware logs
5. Test API endpoints individually

## 🔄 Updates and Maintenance

### Regular Tasks
- Update dependencies monthly
- Rotate secrets quarterly
- Review access logs weekly
- Update security policies
- Backup configuration

### Security Updates
- Monitor CVE databases
- Update base Docker images
- Patch vulnerabilities immediately
- Test security configurations
- Update documentation