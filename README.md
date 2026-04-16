<div align="center">
  <img src="https://gtfs-validator.vercel.app/assets/gtfs-validator-logo-DdpwlSJc.png" alt="GTFS Validator Logo" width="200" />

  <h1>GTFS GeoSpatial Validator</h1>

  <p><strong>A High-Performance Web Application for analyzing, validating, and visualizing General Transit Feed Specification (GTFS) datasets.</strong></p>

  <p>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" /></a>
    <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
    <a href="https://postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
    <a href="https://redis.io/"><img src="https://img.shields.io/badge/redis-%23DD0031.svg?&style=for-the-badge&logo=redis&logoColor=white" alt="Redis" /></a>
    <a href="https://deck.gl/"><img src="https://img.shields.io/badge/Deck.gl-000000?style=for-the-badge&logo=uber&logoColor=white" alt="Deck.gl" /></a>
  </p>
</div>

<br/>

## 🌐 Live Demo

- **Live App**: [gtfs-validator.vercel.app](https://gtfs-validator.vercel.app/)

---

## 📖 Welcome!

Welcome to the **GTFS GeoSpatial Validator**. This system was built to handle massive public transportation datasets, evaluating the quality of geographic coordinates, routing integrities, and temporal accuracy within the GTFS standard.

As a **portfolio project**, it demonstrates the ability to architect complex **asynchronous distributed systems**, ingest large streams of data efficiently without blocking the event loop ("**Zero-Memory**" stream pipelines in Node.js), and perform advanced **geospatial queries** using **PostGIS** in a real cloud environment (Supabase). This ensures robust scalability and top-tier performance for processing urban transit networks data.

---

## ⚡ Core Features

- **Asynchronous Ingestion & Task Queue**: Uses `BullMQ` combined with Upstash Redis to decouple the heavy Zip processing from the API server, providing a blazing-fast response to clients.
- **Node.js Stream Processing ("Zero Memory")**: Immediately decompresses ZIP datasets using `unzipper` and Node Streams, pipelining millions of GTFS CSV rows straight to PostgreSQL via the native `COPY ... FROM STDIN` command.
- **Advanced PostGIS Validation**: Offloads CPU-intensive tasks to the database. Uses SQL queries inside Supabase to find missing trips, temporally orphaned stop times, Lat/Lng errors (e.g., coordinates mapping to default [0,0]), and directional route errors using geographic distances.
- **Ephemeral Workspaces**: The backend dynamically creates an isolated Postgres schema for each validation job and completely purges the schema (`DROP SCHEMA CASCADE`) after completion to prevent db bloat.
- **GPU-Powered Visualizations**: The frontend utilizes Vite + React along with `Deck.gl` and `Mapbox / Maplibre` to effortlessly render and explore massive clusters of spatial routes and transit stops.

---

## 🛠️ Architecture & Tech Stack

### Data Flow Overview

1. **Frontend**: The user uploads a compressed `.zip` containing GTFS tables (stops, trips, routes, stop_times, etc.).
2. **REST API**: Express server receives the request, stores the zip in disk temporarily, and queues a job in Redis. It returns an HTTP 202 Accepted.
3. **Queue / Polling**: The frontend begins transparently polling the backend to reflect real-time progress.
4. **Worker**: A background Node worker fetches the job, creates a Postgres schema, and pipes the CSV datasets.
5. **Database (PostGIS)**: Performs spatial indexing, SQL aggregations, and identifies structural/geospatial errors.
6. **Delivery**: Job status is fulfilled, and the client displays Interactive KPIs, Data Tables, and Deck.gl visual maps.

### Technologies

- **Backend**: Node.js, Express, BullMQ, `pg-copy-streams`
- **Infrastructure**: PostgreSQL, PostGIS, Supabase, Upstash Redis
- **Frontend**: React, Vite, Tailwind CSS, Lucide, Radix UI
- **Geospatial Processing**: Deck.gl, Maplibre GL JS

---

## 🚀 Getting Started

### Prerequisites

You will need the following accounts/services to run this locally:

- [Node.js](https://nodejs.org/) (v18+)
- A PostgreSQL Database with the `PostGIS` extension enabled (e.g., [Supabase](https://supabase.com/)).
- A Redis instance (e.g., [Upstash Redis](https://upstash.com/)).

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/GTFS-validator.git
   cd GTFS-validator
   ```

2. **Backend Setup:**

   ```bash
   cd GTFS-validator-backend
   npm install
   ```

   Create a `.env` file in the backend directory based on your DB keys:

   ```env
   # .env example
   PORT=3000
   DATABASE_URL="postgresql://user:password@hostname:5432/postgres"
   REDIS_URL="rediss://user:password@hostname:port"
   ```

3. **Frontend Setup:**
   ```bash
   cd ../GTFS-validator-frontend
   npm install
   ```
   Create a `.env` file in the frontend directory:
   ```env
   # .env example
   VITE_API_URL="http://localhost:3000"
   ```

### Running Locally

To run the full stack concurrently, open two terminal windows.

**Terminal 1 (Backend & Worker):**

```bash
cd GTFS-validator-backend
npm run dev
# This will use concurrently to launch both the API and the Worker
```

**Terminal 2 (Frontend):**

```bash
cd GTFS-validator-frontend
npm run dev
```

Finally, open your browser at `http://localhost:5173`.

---

## 🗺️ Visual Architecture Diagram

```mermaid
sequenceDiagram
    participant User
    participant API (Express)
    participant Redis (Upstash)
    participant Worker (Service)
    participant PostgreSQL (Supabase)

    User->>API: POST /validate (Uploads ZIP)
    API->>Redis: Queue Task(ZIP Path)
    API-->>User: Http 202 { jobId }

    loop Real-time Polling (Frontend)
        User->>API: GET /validate/{jobId}
        API-->>User: { status, progress, message }
    end

    Redis->>Worker: Consume Task
    Worker->>Worker: Decompress & Unzip Streams
    Worker->>PostgreSQL: Massive Ingestion (COPY stream)
    Worker->>Redis: Update state: "Ingesting Data"
    Worker->>PostgreSQL: Run SQL & PostGIS Validators
    PostgreSQL-->>Worker: Returns Issues/Errors Array
    Worker->>Redis: Save result doc / state "completed"
```

---

## 👨‍💻 Author

**Gabriel Bustos**  
_Looking for exciting opportunities as a Full Stack Developer / Backend / Data Engineer._

If you find this project interesting, feel free to reach out or connect with me on [LinkedIn](https://www.linkedin.com/in/gabrielbustosdev/)!
