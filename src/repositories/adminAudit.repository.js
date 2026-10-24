'use strict';

class AdminAuditRepository {
  constructor(dataSource) {
    this.repository = dataSource.getRepository('AdminAudit');
  }

  record(values) {
    return this.repository.save(this.repository.create(values));
  }

  list({ take, skip }) {
    return this.repository.find({ order: { createdAt: 'DESC' }, take, skip });
  }
}

module.exports = { AdminAuditRepository };
