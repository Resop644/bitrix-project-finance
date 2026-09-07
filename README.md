# Bitrix24 Project Finance

Веб-приложение для ручного учета доходов и расходов по проектам. Подходит для совместной работы сотрудников и может быть встроено в Bitrix24 как отдельное приложение.

## Что реализовано

- проекты и статусы проектов;
- доходы и расходы по каждому проекту;
- расчет доходов, расходов, прибыли и рентабельности;
- стандартные статьи расходов:
  - Внешние программисты;
  - Внутренние программисты;
  - Расходы на ИИ;
  - Аренда сервера;
  - Дивиденды;
- добавление собственных статей доходов и расходов;
- добавление сотрудников к проекту;
- роли администратора, менеджера проекта и участника;
- авторизация и сессии;
- удаление/редактирование операций;
- сводный экран по всем доступным проектам;
- поле `bitrix_group_id` для связи проекта приложения с группой/проектом Bitrix24;
- SQLite с WAL для простой установки и одновременной работы нескольких сотрудников;
- адаптивный интерфейс.

## Запуск локально

Требуется Node.js 20+.

```bash
npm install
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=change-me npm start
```

Windows PowerShell:

```powershell
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="change-me"
npm install
npm start
```

Откройте `http://localhost:3000`.

Если переменные не заданы, первый запуск использует `admin@example.com / admin123`. Для реальной установки пароль обязательно измените.

## Docker

```bash
docker build -t bitrix-project-finance .
docker run -p 3000:3000 -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=change-me -v finance-data:/app/data bitrix-project-finance
```

Для Docker рекомендуется задать `DB_FILE=/app/data/finance.db`.

## Архитектура

Backend: Node.js + Express + SQLite.
Frontend: адаптивный SPA без тяжелого frontend build pipeline, чтобы приложение было максимально простым для сопровождения.

API разделен по сущностям: auth, users, categories, projects, transactions и project members.

## Bitrix24

Приложение уже хранит `bitrix_group_id` у проекта, поэтому финансовый учет не зависит от структуры данных внутри Bitrix24. Следующим этапом можно подключить OAuth/REST Bitrix24 и автоматически:

1. получать список групп/проектов;
2. сопоставлять сотрудников Bitrix24 с локальными пользователями;
3. открывать карточку финансов проекта непосредственно из Bitrix24;
4. передавать ID проекта в приложение при открытии.

REST/OAuth лучше подключать через серверный адаптер, не размещая секреты Bitrix24 в браузере.

## Основные API

- `POST /api/auth/login`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/transactions`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `POST /api/projects/:id/members`
- `GET /api/categories`
- `POST /api/categories`
- `GET /api/users`
- `POST /api/users`

## Важное для production

Перед боевым размещением рекомендуется поставить HTTPS, вынести SQLite на PostgreSQL при высокой нагрузке, добавить CSRF-защиту/cookie-based auth или внешний identity provider, резервное копирование БД и полноценную Bitrix24 OAuth-интеграцию.
