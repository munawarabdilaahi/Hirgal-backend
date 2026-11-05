# User directory

The authenticated `/users` route renders the collaborator directory for accounts that have `users.view_directory` without `users.view`. It calls `GET /api/v1/users/directory`, which returns active users with the sanitized directory fields: `id`, `name`, `email`, `avatar_url`, `timezone`, `job_title`, and `department`.

Search matches the backend's supported name, email, job-title, and department fields. The department filter is exact. Page size and pagination use the API's `meta.current_page`, `meta.last_page`, `meta.per_page`, and `meta.total`. Search and department input are debounced. Empty, loading, API failure, and retry states are explicit; a responsive table and card presentation share the same sanitized data.

The directory intentionally does not show account status, roles, permissions, or administrative details. Frontend permission checks control the route and navigation visibility; the backend directory policy is authoritative. Component tests use mocked API query data; API service tests assert endpoint and filter contracts without contacting Laravel.
