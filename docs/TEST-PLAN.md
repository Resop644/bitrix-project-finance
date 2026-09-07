# Acceptance test plan

## 1. Local launch
1. `npm install`
2. Copy `.env.example` to `.env` and set `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. `npm start`
4. Open `http://localhost:3000`.

Expected: login page opens without build step.

## 2. Deterministic demo
Run `npm run demo` once.

Expected project: **Демонстрационный проект**.
- Income: 1,000,000 ₽
- Expenses: 500,000 ₽
- Profit: 500,000 ₽
- Profitability: 50.0%

The seed is idempotent: repeating the command does not duplicate demo transactions.

## 3. Income
Create an income operation with the income article and amount 100,000 ₽.

Expected: project income and profit increase by 100,000 ₽.

## 4. Expenses by article
Add expenses for external programmers, internal programmers, AI, server rent and dividends.

Expected: each amount appears under the selected article and total expenses increase exactly by that amount.

## 5. Negative profit
Make expenses larger than income.

Expected: profit becomes negative and profitability is negative, calculated as `(income - expenses) / income * 100`.

## 6. Zero income
Create a project with expenses but no income.

Expected: profitability is displayed as 0.0%, avoiding division by zero; profit equals `0 - expenses`.

## 7. Custom categories
As administrator, create a new income or expense article.

Expected: the article becomes selectable for operations of the matching type only.

## 8. Team access
Add a user to a project as member, then remove them.

Expected: the member can see and work with the assigned project; after removal, access is denied.

## 9. Manager permissions
Assign a project member the manager role.

Expected: manager can edit project details and manage project members, but cannot delete the whole project unless administrator.

## 10. Transaction lifecycle
Create, edit and delete a transaction.

Expected: all dashboard/project totals update consistently after every operation.

## 11. Bitrix24 bootstrap
Open `/bitrix` from an installed Bitrix24 application.

Expected: `BX24.init()` obtains authorization, `/api/bitrix/bootstrap` creates/updates the local user and encrypted token storage, and the app opens the finance interface.

## 12. Bitrix24 project synchronization
With `sonet_group` permission granted, press **Синхронизировать проекты**.

Expected: active Bitrix24 groups are created/updated locally and mapped through `bitrix_group_id`; repeating sync does not create duplicates.

## 13. OAuth refresh
Use a Bitrix connection with an expired access token but valid refresh token.

Expected: the server refreshes the token through Bitrix OAuth and retries the API call without exposing the token to the browser.

## 14. Security smoke test
- Open a protected `/api/*` endpoint without Authorization.
- Try another user's project ID as a non-admin.
- Put SQL-like text into a project name.

Expected: unauthenticated requests return 401, unauthorized project access returns 403, and input is stored as data rather than executed as SQL.
