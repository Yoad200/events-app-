-- ═══════════════════════════════════════════════
-- ניהול אירועים - Database Schema
-- ═══════════════════════════════════════════════

-- מנהלים (אתה)
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- עובדים (מתעדכן אוטומטית כשנרשמים)
CREATE TABLE IF NOT EXISTS workers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  total_events INT DEFAULT 0,
  total_cancellations INT DEFAULT 0,
  last_minute_cancellations INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- אירועים
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  share_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'open',
  notes TEXT,
  needed_waiters INT DEFAULT 0,
  needed_setup INT DEFAULT 0,
  needed_attractions INT DEFAULT 0,
  needed_food_stalls INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_share_id ON events(share_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- רישומים של עובדים לאירועים
CREATE TABLE IF NOT EXISTS signups (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  worker_id BIGINT REFERENCES workers(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  signup_time TIMESTAMPTZ DEFAULT NOW(),
  decision_time TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(event_id, worker_id, role)
);

CREATE INDEX IF NOT EXISTS idx_signups_event ON signups(event_id);
CREATE INDEX IF NOT EXISTS idx_signups_worker ON signups(worker_id);
CREATE INDEX IF NOT EXISTS idx_signups_status ON signups(status);

-- פונקציה לעדכון אוטומטי של סטטיסטיקות עובד
CREATE OR REPLACE FUNCTION update_worker_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE workers
    SET total_events = total_events + 1,
        updated_at = NOW()
    WHERE id = NEW.worker_id;
  END IF;

  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE workers
    SET total_cancellations = total_cancellations + 1,
        last_minute_cancellations = CASE
          WHEN EXISTS (
            SELECT 1 FROM events
            WHERE id = NEW.event_id
            AND (event_date - CURRENT_DATE) < 2
          ) THEN last_minute_cancellations + 1
          ELSE last_minute_cancellations
        END,
        updated_at = NOW()
    WHERE id = NEW.worker_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_worker_stats ON signups;
CREATE TRIGGER trigger_worker_stats
AFTER INSERT OR UPDATE ON signups
FOR EACH ROW
EXECUTE FUNCTION update_worker_stats();
