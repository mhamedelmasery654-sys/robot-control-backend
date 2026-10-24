'use strict';

class UserRepository {
  constructor(dataSource) {
    this.repository = dataSource.getRepository('User');
  }

  findByEmail(email, withPassword = false) {
    const query = this.repository.createQueryBuilder('user').where('user.email = :email', { email });
    if (withPassword) query.addSelect('user.passwordHash');
    return query.getOne();
  }

  findById(id) {
    return this.repository.findOne({ where: { id } });
  }

  create(user) {
    return this.repository.save(this.repository.create(user));
  }

  listSafe({ take, skip }) {
    return this.repository.find({
      select: { id: true, email: true, role: true, mustChangePassword: true, createdAt: true },
      order: { createdAt: 'DESC' }, take, skip
    });
  }

  count() {
    return this.repository.count();
  }

  setAdmin(id, passwordHash) {
    return this.repository.update({ id }, { role: 'admin', passwordHash, mustChangePassword: false }).then(() => this.findById(id));
  }
}

module.exports = { UserRepository };
