# Configuração do Coolify para ScrapEngine

## Problema
O erro `ECONNREFUSED` na porta 7653 acontece porque:
1. O Redis não está rodando na porta 7653 no host, OU
2. O container Node está tentando se conectar ao Redis usando `localhost:7653` em vez de `redis:6379`

## Solução: Configurar Variáveis de Ambiente no Coolify

No painel do Coolify, configure estas variáveis de ambiente:

### Para o serviço Node:
```
NODE_ENV=production
PORT=7650
ADMIN_API_KEY=nk&c3mpjs3e74ah^k8yeb&hjedth*t26+99672fhomupb-q^
DATABASE_URL=postgresql://scrapengine:aYUmCcrfB8k9gV2iOLfnTW0Y@postgres:5432/scrapengine
REDIS_URL=redis://redis:6379
PYTHON_API_URL=http://python:8000
DEFAULT_RATE_LIMIT=60
WEBHOOK_TIMEOUT_MS=5000
WEBHOOK_MAX_RETRIES=3
SCRAPE_TIMEOUT=60000
ALLOWED_ORIGINS=http://scrapping.devscafe.org
```

### Para o serviço Redis:
```
REDIS_PORT=7653
```

### Para o serviço PostgreSQL:
```
POSTGRES_PORT=7652
DB_PASSWORD=aYUmCcrfB8k9gV2iOLfnTW0Y
```

## Por que `redis://redis:6379` e não `redis://localhost:7653`?

- **`redis://redis:6379`**: Conexão interna do Docker. O container Node se conecta ao container Redis pelo nome do serviço (`redis`) na porta interna do container (`6379`).
- **`redis://localhost:7653`**: Conexão externa. Se usado dentro do container, ele tentará se conectar a si mesmo, não ao container Redis.

## Portas no Host vs. Portas no Container

```
Host (seu servidor)          Container Redis
Porta 7653  -------------->  Porta 6379
```

- Redis roda na **porta 6379** dentro do container
- Docker mapeia a **porta 7653** do host para a **porta 6379** do container
- O container Node se conecta usando `redis:6379` (nome do serviço + porta interna)

## Deploy

Após configurar as variáveis de ambiente no Coolify:
1. Faça um novo deploy
2. Verifique os logs do container Node para erros
3. Teste a conexão: `docker exec scrapengine-node curl -s http://localhost:7650/health/ready`

## Verificação

Para verificar se o Redis está rodando na porta 7653 no host:
```bash
# No servidor remoto
sudo netstat -tlnp | grep 7653
# ou
sudo ss -tlnp | grep 7653
```

Deve mostrar algo como:
```
0.0.0.0:7653  0.0.0.0:*  LISTEN  <pid>/docker-proxy
```

Para testar conexão Redis:
```bash
redis-cli -h localhost -p 7653 ping
# Deve retornar "PONG"
```