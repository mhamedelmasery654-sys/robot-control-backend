'use strict';

class SessionRepository {
  constructor(dataSource) {
    this.repository = dataSource.getRepository('ControlSession');
  }

  create(values) {
    return this.repository.save(this.repository.create(values));
  }

  findById(id) {
    return this.repository.findOne({ where: { id } });
  }

  listForOwner(ownerId, { take, skip }) {
    return this.repository.find({ where: { ownerId }, order: { startedAt: 'DESC' }, take, skip });
  }

  close(id, endedAt) {
    return this.repository.update({ id, status: 'active' }, { status: 'closed', endedAt }).then(() => this.findById(id));
  }
}

module.exports = { SessionRepository };
