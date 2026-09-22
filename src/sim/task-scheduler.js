// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors — vendored from wokwi/avr8js demo.
// Lets the AVR simulation yield to the browser (via MessageChannel) so the UI
// stays responsive while the emulator runs in finite work units.

export class MicroTaskScheduler {
  constructor() {
    this.channel = new MessageChannel();
    this.executionQueue = [];
    this.stopped = true;
  }

  start() {
    if (this.stopped) {
      this.stopped = false;
      this.channel.port2.onmessage = this.handleMessage;
    }
  }

  stop() {
    this.stopped = true;
    this.executionQueue.splice(0, this.executionQueue.length);
    this.channel.port2.onmessage = null;
  }

  postTask(fn) {
    if (!this.stopped) {
      this.executionQueue.push(fn);
      this.channel.port1.postMessage(null);
    }
  }

  handleMessage = () => {
    const executeJob = this.executionQueue.shift();
    if (executeJob !== undefined) executeJob();
  };
}