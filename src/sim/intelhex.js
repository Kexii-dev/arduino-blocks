// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors — vendored from wokwi/avr8js demo.
/** Minimal Intel HEX loader: writes raw bytes of each '00' data record into target[addr..]. */
export function loadHex(source, target) {
  for (const line of source.split('\n')) {
    if (line[0] === ':' && line.substr(7, 2) === '00') {
      const bytes = parseInt(line.substr(1, 2), 16);
      const addr = parseInt(line.substr(3, 4), 16);
      for (let i = 0; i < bytes; i++) {
        target[addr + i] = parseInt(line.substr(9 + i * 2, 2), 16);
      }
    }
  }
}