'use strict';

function sessionOwnerCondition(session, user) {
  return user?.role === 'admin' || session?.ownerId === user?.id;
}

module.exports = { sessionOwnerCondition };
