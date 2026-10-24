'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { appError } = require('../errors');

class AuthService {
  constructor({ userRepository, jwtSecret, jwtExpiresIn, bcryptRounds }) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
    this.bcryptRounds = bcryptRounds;
  }

  async register({ email, password }) {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) throw appError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    const passwordHash = await bcrypt.hash(password, this.bcryptRounds);
    let user;
    try {
      user = await this.userRepository.create({ email, passwordHash, role: 'operator', mustChangePassword: false });
    } catch (error) {
      if (error.code === '23505') throw appError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
      throw error;
    }
    return { user: this.safeUser(user), token: this.issueToken(user) };
  }

  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email, true);
    const valid = user && await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw appError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    return { user: this.safeUser(user), token: this.issueToken(user) };
  }

  getProfile(userId) {
    return this.userRepository.findById(userId).then((user) => {
      if (!user) throw appError(404, 'USER_NOT_FOUND', 'User was not found.');
      return this.safeUser(user);
    });
  }

  issueToken(user) {
    return jwt.sign({ role: user.role }, this.jwtSecret, { subject: user.id, expiresIn: this.jwtExpiresIn, issuer: 'robot-control-backend', audience: 'robot-control-clients' });
  }

  verifyToken(token) {
    return jwt.verify(token, this.jwtSecret, { issuer: 'robot-control-backend', audience: 'robot-control-clients' });
  }

  safeUser(user) {
    return { id: user.id, email: user.email, role: user.role, mustChangePassword: Boolean(user.mustChangePassword), createdAt: user.createdAt };
  }
}

module.exports = { AuthService };
