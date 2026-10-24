'use strict';

class AdminService {
  constructor({ userRepository, auditRepository }) {
    this.userRepository = userRepository;
    this.auditRepository = auditRepository;
  }

  async listUsers(page, limit) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.userRepository.listSafe({ take: limit, skip }),
      this.userRepository.count()
    ]);
    return { items, page, limit, total };
  }

  listAudit(page, limit) {
    return this.auditRepository.list({ take: limit, skip: (page - 1) * limit });
  }
}

module.exports = { AdminService };
