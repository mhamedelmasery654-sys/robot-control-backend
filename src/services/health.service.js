'use strict';

class HealthService {
  constructor({ dataSource, mongoose }) {
    this.dataSource = dataSource;
    this.mongoose = mongoose;
  }

  async readiness() {
    let postgres = false;
    let mongo = false;
    if (this.dataSource?.isInitialized) {
      try { await this.dataSource.query('SELECT 1'); postgres = true; } catch { postgres = false; }
    }
    if (this.mongoose?.connection?.readyState === 1 && this.mongoose.connection.db) {
      try { await this.mongoose.connection.db.admin().ping(); mongo = true; } catch { mongo = false; }
    }
    return { ready: postgres && mongo, dependencies: { postgres: postgres ? 'up' : 'down', mongodb: mongo ? 'up' : 'down' } };
  }
}

module.exports = { HealthService };
