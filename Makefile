# Makefile — Porra Mundial 2026
# Atajos para levantar y probar el proyecto en local (ver CLAUDE.md §14).
#
# Compose: este entorno no tiene `podman-compose`, pero `podman compose`
# funciona delegando en docker-compose. Cámbialo aquí si usas otra herramienta:
#   make COMPOSE="docker compose -f infra/compose.yaml" up
COMPOSE ?= podman compose -f infra/compose.yaml

.DEFAULT_GOAL := help

.PHONY: help env install db-up db-down db-wait db-logs db-shell db-reset \
        migrate seed bootstrap setup dev up lint test test-watch e2e check stop

help: ## Lista los targets disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

env: ## Crea .env desde la plantilla si no existe
	@test -f .env || (cp .env.example .env && echo "Creado .env desde .env.example — revísalo antes de seguir.")

install: ## Instala dependencias (--legacy-peer-deps por el estado del stack)
	npm install --legacy-peer-deps

# --- Base de datos (Postgres en contenedor) ---

db-up: ## Levanta Postgres y espera a que esté healthy
	$(COMPOSE) up -d --wait db

db-down: ## Para el contenedor de Postgres (conserva los datos)
	$(COMPOSE) stop db

db-logs: ## Sigue los logs de Postgres
	$(COMPOSE) logs -f db

db-shell: ## Abre una shell psql dentro del contenedor
	$(COMPOSE) exec db psql -U porra -d porra

db-reset: ## DESTRUCTIVO: borra el volumen de datos y reconstruye la BD desde cero
	$(COMPOSE) down -v
	$(MAKE) setup

# --- Esquema y datos ---

migrate: ## Aplica las migraciones de Drizzle
	npm run db:migrate

seed: ## Siembra equipos y partidos del Mundial (idempotente)
	npm run db:seed

bootstrap: ## Crea el usuario admin inicial (idempotente)
	npm run admin:bootstrap

setup: env db-up migrate seed bootstrap ## Prepara todo (BD + migraciones + seed + admin) sin arrancar la app
	@echo "Entorno listo. Arranca con: make dev"

# --- Aplicación ---

dev: ## Arranca el servidor de desarrollo en http://localhost:3000
	npm run dev

up: setup dev ## Prepara el entorno y arranca la app (one-shot)

# --- Calidad ---

lint: ## ESLint
	npm run lint

test: ## Tests unitarios (Vitest) — no necesitan BD
	npm test

test-watch: ## Tests unitarios en modo watch
	npm run test:watch

e2e: db-up migrate ## Tests end-to-end (Playwright); arranca dev y siembra solo
	npm run e2e

check: lint test ## Lo mínimo antes de mergear un slice (lint + unit)

stop: db-down ## Alias de db-down
