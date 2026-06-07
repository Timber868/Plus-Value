## ETL Layer

Translates DuckDB datasets into the shape expected by our Mongoose schemas.

Layout:

- `duckdb/` — shared DuckDB connection helpers.
- `readers/` — one file per source table. Reads rows from DuckDB; returns plain JS objects.
- `mappers/` — pure transformations from a raw DuckDB row into the shape of a Mongoose model. No I/O.

Readers + mappers are composed by orchestration scripts in `src/jobs/` and by domain services in `src/services/`.

### Competitions

DuckDB table:

### Competitions
<p align="left">
  <img src="..\..\images\competitions-table.png" alt="Database ER diagram" width="20%" />
</p>

<p align="center">
  <img src="..\..\images\ligue1-duckdb.png" alt="Database ER diagram" width="100%" />
</p>

### Clubs:
<p align="left">
  <img src="..\..\images\clubs-table.png" alt="Database ER diagram" width="20%" />
</p>

<p align="left">
  <img src="..\..\images\parisfc-duckdb.png" alt="Database ER diagram" width="50%"/>
</p>

