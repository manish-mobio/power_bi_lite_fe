# Power BI Lite

A self-service BI dashboard where users can connect a data collection, choose dimensions (grouping) and measures (aggregation), and visualize results in Bar, Line, or Pie charts.

## Tech Stack

- **Frontend**: Next.js 14, React, Redux Toolkit, Apache ECharts, react-grid-layout
- **Backend**: Express.js (Node.js)

## Quick Start

### 1. Start the Backend (power_bi_BE)

From the backend project folder:

```bash
cd path/to/power_bi_BE
npm start
```

Backend runs at [http://localhost:8000](http://localhost:8000).

### 2. Start the Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) – you'll be redirected to the Power BI Lite dashboard.

### 3. Environment

Create `.env.local` in the project root:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users?limit=N` | Fetch users (limit optional) |
| GET | `/api/v1/dashboards` | List saved dashboards |
| POST | `/api/v1/dashboards` | Save a dashboard |

## Docker

```bash
docker-compose up
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## Features

- **Left Panel**: Field list (schema) from the data source
- **Center**: Draggable chart canvas (Bar, Line, Pie)
- **Right Panel**: Chart configuration (dimension, measure, aggregation)
- **Save/Load**: Persist dashboards

## Data Format

The `users` collection expects documents with fields such as: `_id`, `id`, `first_name`, `last_name`, `email`, `gender`, `ip_address`.
