CREATE TABLE IF NOT EXISTS municipality (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat  REAL NOT NULL,
  lon  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_weather (
  municipality_code TEXT NOT NULL,
  date        TEXT NOT NULL,
  temp_max    REAL,
  temp_min    REAL,
  temp_mean   REAL,
  precip_sum  REAL,
  sunshine_h  REAL,
  weather_code INTEGER,
  et0         REAL,
  wind_max    REAL,
  fetched_at  TEXT,
  PRIMARY KEY (municipality_code, date),
  FOREIGN KEY (municipality_code) REFERENCES municipality(code)
);
