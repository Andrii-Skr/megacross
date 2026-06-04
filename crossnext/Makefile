# Makefile
SHELL := /bin/bash
COMPOSE := docker compose
PROFILE ?= dev
APP_SERVICE := $(if $(filter $(PROFILE),prod),app,app-dev)
DB_SERVICE  := $(if $(filter $(PROFILE),prod),db,db-dev)

.PHONY: help build up down logs sh psql migrate push generate seed prod clean \
        sync-once sync-cron sync-up sync-down sync-logs sync-sh \
        sync-once-debug sync-up-debug \
        mysql-up mysql-down mysql-restart mysql-wait mysql-import mysql-cli mysql-logs pma-open \
        pg-wait pg-import pg-cli pg-logs pgadmin-open pgadmin-up pgadmin-down pgadmin-logs \
        deploy-prod

help:
	@echo "PROFILE=$(PROFILE) (dev|prod)"
	@echo "Targets: build, up, down, logs, sh, psql, migrate, push, generate, seed, prod, clean"
	@echo "Sync: sync-once, sync-cron, sync-up, sync-down, sync-logs, sync-sh"
	@echo "Debug: sync-once-debug, sync-up-debug"
	@echo "Postgres: pg-import PG_DUMP=./file.sql(.gz|.dump), pg-cli, pg-logs"
	@echo "Deploy: deploy-prod (wraps scripts/deploy-prod.sh)"

## One-command production deploy helper (wraps scripts/deploy-prod.sh)
## Env: BRANCH=main MIGRATE=1 SEED=0 PRUNE=0 HEALTH_URL=http://127.0.0.1:3000/api/healthz REPO_ROOT=/path/to/megacross
## If REPO_ROOT is not a git repo, deploy falls back to syncing crossnext/cross separately.
deploy-prod:
	bash ./scripts/deploy-prod.sh
	@echo "pgAdmin: pgadmin-up, pgadmin-logs, pgadmin-down, pgadmin-open"

build:
	$(COMPOSE) --profile $(PROFILE) build

up:
	$(COMPOSE) --profile $(PROFILE) up -d

down:
	$(COMPOSE) --profile $(PROFILE) down -v

logs:
	$(COMPOSE) --profile $(PROFILE) logs -f $(APP_SERVICE)

sh:
	$(COMPOSE) --profile $(PROFILE) exec $(APP_SERVICE) sh -lc 'command -v bash >/dev/null && exec bash || exec sh'

psql:
	$(COMPOSE) --profile $(PROFILE) exec $(DB_SERVICE) sh -lc 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'

# dev: prisma migrate dev (через pnpm), prod: prisma migrate deploy (без pnpm)
migrate:
ifneq ($(PROFILE),prod)
	$(COMPOSE) --profile $(PROFILE) exec $(APP_SERVICE) sh -lc 'pnpm prisma migrate dev'
else
	$(COMPOSE) --profile $(PROFILE) run --rm $(APP_SERVICE) sh -lc '/app/node_modules/.bin/prisma migrate deploy || node /app/node_modules/prisma/build/index.js migrate deploy'
endif

# dev: prisma db push (через pnpm), prod: prisma db push (без pnpm)
push:
ifneq ($(PROFILE),prod)
	$(COMPOSE) --profile $(PROFILE) exec $(APP_SERVICE) sh -lc 'pnpm prisma db push'
else
	$(COMPOSE) --profile $(PROFILE) run --rm $(APP_SERVICE) sh -lc '/app/node_modules/.bin/prisma db push || node /app/node_modules/prisma/build/index.js db push'
endif

generate:
ifneq ($(PROFILE),prod)
	$(COMPOSE) --profile $(PROFILE) exec $(APP_SERVICE) sh -lc 'pnpm prisma generate'
else
	$(COMPOSE) --profile $(PROFILE) exec $(APP_SERVICE) sh -lc '/app/node_modules/.bin/prisma generate || node /app/node_modules/prisma/build/index.js generate'
endif

seed:
ifneq ($(PROFILE),prod)
	$(COMPOSE) --profile $(PROFILE) exec $(APP_SERVICE) sh -lc 'pnpm run prisma:seed || pnpm run seed || true'
else
	$(COMPOSE) --profile $(PROFILE) exec $(APP_SERVICE) sh -lc '/app/node_modules/.bin/prisma db seed || node /app/node_modules/prisma/build/index.js db seed || true'
endif

prod:
	$(MAKE) PROFILE=prod up

clean:
	-docker image prune -f
	-docker volume prune -f

# ---- MySQL local (optional) ----
COMPOSE ?= docker compose
MYSQL_PROFILE ?= mysql

# имена контейнеров из compose-патча
MYSQL_CONT ?= crossnext-mysql-dev
PMA_CONT   ?= crossnext-pma-dev

# параметры импорта
MYSQL_ROOT ?= root
MYSQL_DB   ?= legacydb
DUMP       ?= /home/user/my_temp/zenit_mysql.sql
MYSQL_IMPORT_CHARSET ?=



## Поднять MySQL (+phpMyAdmin) из профиля `mysql`
mysql-up:
	$(COMPOSE) --profile $(MYSQL_PROFILE) up -d mysql-dev phpmyadmin-dev

## Перезапустить MySQL
mysql-restart:
	$(COMPOSE) restart mysql-dev

## Остановить и удалить только MySQL и phpMyAdmin
mysql-down:
	$(COMPOSE) --profile $(MYSQL_PROFILE) rm -sf mysql-dev phpmyadmin-dev || true
	# Удаляем ресурсы профиля mysql вместе с volume, чтобы избежать несовместимости данных 8.0 → 5.7
	$(COMPOSE) --profile $(MYSQL_PROFILE) down -v || true

## Подождать готовности MySQL
mysql-wait:
	@echo "⏳ Ждём готовности MySQL в контейнере $(MYSQL_CONT)..."
	@until docker exec $(MYSQL_CONT) mysqladmin ping -p$(MYSQL_ROOT) --silent; do sleep 2; done
	@echo "✅ MySQL готов."

## Импортировать дамп .sql в $(MYSQL_DB)
## Использование: make mysql-import DUMP=./path/to/dump.sql

mysql-import: mysql-wait
	@[ -f "$(DUMP)" ] || (echo "⛔ Файл не найден: $(DUMP)"; exit 1)
	@echo "📥 Импорт $(DUMP) → $(MYSQL_DB)..."
	@docker exec -e MYSQL_IMPORT_CHARSET="$(MYSQL_IMPORT_CHARSET)" -i $(MYSQL_CONT) \
		sh -lc 'mysql -uroot -p$(MYSQL_ROOT) $${MYSQL_IMPORT_CHARSET:+--default-character-set=$${MYSQL_IMPORT_CHARSET}} $(MYSQL_DB)' < "$(DUMP)"
	@echo "✅ Импорт завершён."

## Открыть mysql-клиент внутри контейнера
mysql-cli:
	docker exec -it $(MYSQL_CONT) mysql -uroot -p$(MYSQL_ROOT) $(MYSQL_DB)

## Логи MySQL
mysql-logs:
	docker logs -f $(MYSQL_CONT)

## Быстро открыть phpMyAdmin в браузере (macOS)
pma-open:
	open http://localhost:8081 || xdg-open http://localhost:8081

# ---- Postgres import helpers ----
# Если первый путь отсутствует, используется запасной
PG_DUMP ?= $(firstword $(wildcard /home/user/my_temp/zenit_4.11.sql) /home/radmin/bak/zenit_4.11.sql)
PG_JOBS ?= 4                # параллелизм для pg_restore -j
COMPOSE_PROJECT_NAME ?= crossnext
COMPOSE_NETWORK ?= $(COMPOSE_PROJECT_NAME)_backend
HOST_GATEWAY_IP ?= $(shell ip route | awk '/default/ {print $$3}')
PGPORT ?= 5432
PGUSER ?= $(shell awk -F= '/^POSTGRES_USER[[:space:]]*=/{print $$2}' .env 2>/dev/null)
PGDATABASE ?= $(shell awk -F= '/^POSTGRES_DB[[:space:]]*=/{print $$2}' .env 2>/dev/null)
# Параметры подключения по умолчанию зависят от PROFILE: в prod хост=db и пароль берём из secrets,
# в dev хост=db-dev и пароль читаем из .env
ifeq ($(PROFILE),prod)
PGHOST ?= db
PGPASS ?= $(shell cat secrets/postgres_password 2>/dev/null)
else
PGHOST ?= db-dev
PGPASS ?= $(shell awk -F= '/^POSTGRES_PASSWORD[[:space:]]*=/{print $$2}' .env 2>/dev/null)
endif
# Версию клиента подбираем под профиль: prod=16 (см. образ БД), dev=17 по умолчанию
ifeq ($(PROFILE),prod)
PG_CLIENT_TAG ?= 16
else
PG_CLIENT_TAG ?= 17
endif

## Подождать готовности PostgreSQL
pg-wait:
	@echo "⏳ Ждём готовности Postgres (service $(DB_SERVICE))..."
	@$(COMPOSE) --profile $(PROFILE) exec -T $(DB_SERVICE) sh -lc 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB -q && echo "✅ Postgres готов."'

## Импорт дампа в Postgres
## Примеры:
##  - make pg-import PG_DUMP=./dump.sql
##  - make pg-import PG_DUMP=./dump.sql.gz
##  - make pg-import PG_DUMP=./dump.dump  (custom формат pg_dump)
pg-import: pg-wait
	@[ -f "$(PG_DUMP)" ] || (echo "⛔ Файл не найден: $(PG_DUMP)"; exit 1)
	@echo "📥 Импорт $(PG_DUMP) → $$POSTGRES_DB ..."
	@set -e; \
	if echo "$(PG_DUMP)" | grep -Ei '\\.sql\\.gz$$' >/dev/null; then \
		gzip -dc "$(PG_DUMP)" | $(COMPOSE) --profile $(PROFILE) exec -T $(DB_SERVICE) sh -lc 'psql -v ON_ERROR_STOP=1 -U $$POSTGRES_USER -d $$POSTGRES_DB'; \
	elif echo "$(PG_DUMP)" | grep -Ei '\\.(dump|tar|custom|backup)(\\.gz)?$$' >/dev/null; then \
		$(MAKE) pg-restore PG_DUMP="$(PG_DUMP)" PG_JOBS="$(PG_JOBS)" PG_CLIENT_TAG="$(PG_CLIENT_TAG)"; \
	else \
		if [ "$$(head -c 5 "$(PG_DUMP)" 2>/dev/null)" = "PGDMP" ]; then \
			$(MAKE) pg-restore PG_DUMP="$(PG_DUMP)" PG_JOBS="$(PG_JOBS)" PG_CLIENT_TAG="$(PG_CLIENT_TAG)"; \
		else \
			$(COMPOSE) --profile $(PROFILE) exec -T $(DB_SERVICE) sh -lc 'psql -v ON_ERROR_STOP=1 -U $$POSTGRES_USER -d $$POSTGRES_DB' < "$(PG_DUMP)"; \
		fi; \
	fi
	@echo "✅ Импорт завершён."

## Открыть psql внутри контейнера
pg-cli:
	$(COMPOSE) --profile $(PROFILE) exec $(DB_SERVICE) sh -lc 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'

## Логи Postgres
pg-logs:
	$(COMPOSE) --profile $(PROFILE) logs -f $(DB_SERVICE)

## Быстро открыть pgAdmin в браузере (кроссплатформенно)
pgadmin-open:
	@URL=http://localhost:5050; \
	if command -v xdg-open >/dev/null 2>&1; then \
		xdg-open $$URL; \
	elif command -v open >/dev/null 2>&1; then \
		open $$URL; \
	elif command -v powershell.exe >/dev/null 2>&1; then \
		powershell.exe Start-Process $$URL; \
	else \
		echo "Открой вручную: $$URL"; \
	fi

## Запустить только pgAdmin (без dev db), чтобы подключаться к prod db по общей сети
pgadmin-up:
	$(COMPOSE) --profile dev up -d --no-deps pgadmin

## Логи pgAdmin
pgadmin-logs:
	$(COMPOSE) --profile dev logs -f pgadmin

## Остановить/удалить контейнер pgAdmin (volume остаётся)
pgadmin-down:
	-$(COMPOSE) --profile dev rm -sf pgadmin || true

## Параллельное восстановление из custom/tar (.backup/.dump/.tar) с pg_restore
## Пример: make pg-restore PG_DUMP=./dump.backup PG_JOBS=8 [PG_CLIENT_TAG=17]
pg-restore: pg-wait
	@[ -f "$(PG_DUMP)" ] || (echo "⛔ Файл не найден: $(PG_DUMP)"; exit 1)
	@echo "📤 Восстановление (pg_restore -j $(PG_JOBS)) из $(PG_DUMP) → $(PGDATABASE) ..."
	@docker run --rm --network $(COMPOSE_NETWORK) -e PGPASSWORD="$(PGPASS)" -v "$(dir $(PG_DUMP))":/work:ro postgres:$(PG_CLIENT_TAG) \
		sh -lc 'pg_restore --no-owner --clean --if-exists -j $(PG_JOBS) -h $(PGHOST) -p $(PGPORT) -U $(PGUSER) -d $(PGDATABASE) ${PG_RESTORE_ARGS:-} "/work/$(notdir $(PG_DUMP))"'
	@echo "✅ Восстановление завершено."

# ---- Legacy sync (PG -> MySQL) ----
# Локальный однократный запуск (использует .env.local):
sync-once:
	pnpm run sync:legacy:once

# Локальный запуск с расписанием. Можно переопределить CRON, напр.:
# make sync-cron CRON="0 * * * *"
CRON ?= 0 * * * *
sync-cron:
	SYNC_CRON="$(CRON)" pnpm run sync:legacy:once

# Через docker compose: поднимем сервис синхронизации (и его зависимости)
SYNC_SERVICE ?= legacy-sync-dev
SYNC_SERVICE_PROD ?= legacy-sync
sync-up:
	HOST_GATEWAY_IP=$(HOST_GATEWAY_IP) LEGACY_MYSQL_URL=mysql://legacy:legacy@mysql-dev:3306/legacydb $(COMPOSE) --profile dev --profile mysql --profile sync up -d $(SYNC_SERVICE)

# Однократный запуск локально с детальными логами
sync-once-debug:
	LOG_LEVEL=debug SYNC_BATCH_SIZE=10000 SYNC_BATCH_SIZE_WORDS=10000 SYNC_BATCH_SIZE_OPREDS=10000 pnpm run sync:legacy:once

# Поднять контейнер синка с детальными логами (и зависимостями)
sync-up-debug:
	HOST_GATEWAY_IP=$(HOST_GATEWAY_IP) LOG_LEVEL=debug SYNC_BATCH_SIZE=10000 SYNC_BATCH_SIZE_WORDS=10000 SYNC_BATCH_SIZE_OPREDS=10000 LEGACY_MYSQL_URL=mysql://legacy:legacy@mysql-dev:3306/legacydb $(COMPOSE) --profile dev --profile mysql --profile sync up -d $(SYNC_SERVICE)

# Остановить и удалить только сервис синхронизации (БД не трогаем)
sync-down:
	-$(COMPOSE) --profile dev --profile mysql --profile sync rm -sf $(SYNC_SERVICE) || true

# Логи сервиса синхронизации
sync-logs:
	$(COMPOSE) --profile dev --profile mysql --profile sync logs -f $(SYNC_SERVICE)

# Шелл внутри контейнера синхронизации
sync-sh:
	$(COMPOSE) --profile dev --profile mysql --profile sync exec $(SYNC_SERVICE) sh -lc 'command -v bash >/dev/null && exec bash || exec sh'

# Prod sync helpers (uses prod Postgres and external MySQL via LEGACY_MYSQL_URL)
# Usage examples:
#   make sync-up-prod LEGACY_MYSQL_URL="mysql://user:pass@host:3306/legacydb"
#   make sync-logs-prod
#   make sync-sh-prod
#   make sync-down-prod
sync-up-prod:
	HOST_GATEWAY_IP=$(HOST_GATEWAY_IP) $(COMPOSE) --profile prod --profile sync up -d $(SYNC_SERVICE_PROD)

sync-logs-prod:
	$(COMPOSE) --profile prod --profile sync logs -f $(SYNC_SERVICE_PROD)

sync-sh-prod:
	$(COMPOSE) --profile prod --profile sync exec $(SYNC_SERVICE_PROD) sh -lc 'command -v bash >/dev/null && exec bash || exec sh'

sync-down-prod:
	-$(COMPOSE) --profile prod --profile sync rm -sf $(SYNC_SERVICE_PROD) || true

# Prod sync against local mysql-dev container (for testing)
# Brings up mysql-dev and points DSN to it
sync-up-prod-local-mysql:
	HOST_GATEWAY_IP=$(HOST_GATEWAY_IP) LEGACY_MYSQL_URL=mysql://legacy:legacy@mysql-dev:3306/legacydb $(COMPOSE) --profile prod --profile mysql --profile sync up -d $(SYNC_SERVICE_PROD)
