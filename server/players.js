'use strict';

class PlayerManager {
  constructor() {
    this.players = new Map();
  }

  addPlayer(socketId, name) {
    this.players.set(socketId, { id: socketId, name, joinedAt: Date.now() });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  getCount() {
    return this.players.size;
  }

  getAll() {
    return Array.from(this.players.values());
  }
}

module.exports = { PlayerManager };
