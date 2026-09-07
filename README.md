# Bitrix24 Project Finance

Веб-приложение для ручного учета доходов и расходов по проектам с интеграцией Bitrix24.

## Возможности

- доходы и расходы по проектам;
- прибыль и рентабельность;
- стандартные статьи: внешние программисты, внутренние программисты, ИИ, аренда сервера, дивиденды;
- пользовательские статьи доходов и расходов;
- сотрудники и роли проекта;
- авторизация сотрудников;
- Bitrix24 OAuth 2.0 и серверное хранение refresh/access token;
- автоматическое определение текущего пользователя Bitrix24 через `user.current`;
- получение проектов/групп Bitrix24 через `sonet_group.get`;
- получение пользователей Bitrix24 через `user.get`;
- синхронизация Bitrix24-групп с локальными проектами;
- интерфейс `public/bitrix.html`, рассчитанный на запуск внутри iframe Bitrix24;
- поле `bitrix_group_id` для устойчивого сопоставления проекта.

## Запуск

Node.js 20+.

```bash
cp .env.example .env
npm install
npm start
```

Для production обязательно задайте `ADMIN_PASSWORD`, `BITRIX_CLIENT_ID`, `BITRIX_CLIENT_SECRET` и длинный случайный `BITRIX_ENCRYPTION_KEY`.

## Подключение Bitrix24

1. Разверните приложение на HTTPS-домене, доступном из Bitrix24.
2. Создайте локальное/внешнее приложение Bitrix24 и укажите URL обработчика `https://YOUR-DOMAIN/bitrix`.
3. В разрешениях приложения включите минимум `user_basic`, `user` и `sonet_group`.
4. В переменных окружения сервера задайте `BITRIX_CLIENT_ID` и `BITRIX_CLIENT_SECRET`.
5. URL установки/обработчика можно взять из `bitrix24/app.json`; замените `YOUR-DOMAIN` на фактический домен.
6. После запуска приложения внутри Bitrix24 страница вызывает `BX24.getAuth()`, передает данные на `/api/bitrix/bootstrap`, а сервер сохраняет OAuth credentials зашифрованными.
7. Refresh token обновляется сервером автоматически при истечении access token.

**Важно:** секрет приложения и refresh token не хранятся в браузере и не должны попадать в Git. В репозитории нет реальных credentials.

## API Bitrix24

- `POST /bitrix/install` — прием install/auth payload;
- `POST /api/bitrix/bootstrap` — создание локальной сессии из `BX24.getAuth()`;
- `GET /api/bitrix/context` — статус подключения;
- `GET /api/bitrix/groups` — группы/проекты Bitrix24;
- `GET /api/bitrix/users` — пользователи Bitrix24;
- `POST /api/bitrix/sync-projects` — синхронизация групп в локальные проекты.

## Архитектура

Backend: Node.js + Express + SQLite.
Frontend: HTML/CSS/JS без обязательного build pipeline. Это упрощает поддержку и размещение в Bitrix24 iframe.

Для high-load production рекомендуется PostgreSQL, HTTPS, reverse proxy, резервное копирование БД и централизованный identity provider.
