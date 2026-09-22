// SPDX-License-Identifier: MIT (adapted from wokwi/avr8js demo)
// Board bootstrap for a full ATmega328p (Arduino Uno) using the AVR8js core:
// CPU + 3 timers (millis/delay/PWM) + GPIO ports B/C/D + USART (Serial) + ADC (analogRead).
import {
  avrInstruction, AVRIOPort, AVRTimer, AVRUSART, AVRADC, CPU,
  portBConfig, portCConfig, portDConfig, PinState,
  timer0Config, timer1Config, timer2Config, usart0Config, adcConfig,
} from 'avr8js';
import { loadHex } from './intelhex.js';
import { MicroTaskScheduler } from './task-scheduler.js';

// ATmega328p flash = 32 KB
const FLASH = 0x8000;
const MHZ = 16e6;

export { PinState };

export class AVRRunner {
  constructor(hex) {
    this.program = new Uint16Array(FLASH);
    loadHex(hex, new Uint8Array(this.program.buffer));
    this.cpu = new CPU(this.program);
    this.timer0 = new AVRTimer(this.cpu, timer0Config);
    this.timer1 = new AVRTimer(this.cpu, timer1Config);
    this.timer2 = new AVRTimer(this.cpu, timer2Config);
    this.portB = new AVRIOPort(this.cpu, portBConfig);
    this.portC = new AVRIOPort(this.cpu, portCConfig);
    this.portD = new AVRIOPort(this.cpu, portDConfig);
    this.usart = new AVRUSART(this.cpu, usart0Config, MHZ);
    this.adc = new AVRADC(this.cpu, adcConfig);
    this.taskScheduler = new MicroTaskScheduler();
    this.speed = MHZ;
    this.workUnitCycles = 500000;
    this._running = false;
  }

  /** `analog` values as volts 0..5 per channel (index = channel number). */
  setAnalogChannels(channelVolts) {
    for (let i = 0; i < channelVolts.length; i++) {
      if (channelVolts[i] != null) this.adc.channelValues[i] = channelVolts[i];
      else this.adc.channelValues[i] = 0;
    }
  }

  /** Map an Arduino pin number to [port, bit index] (digital). */
  pinLocation(pin) {
    if (pin === 0) return [this.portD, 0]; // RX
    if (pin === 1) return [this.portD, 1]; // TX
    if (pin >= 2 && pin <= 7) return [this.portD, pin];
    if (pin === 8) return [this.portB, 0];
    if (pin >= 9 && pin <= 13) return [this.portB, pin - 8];
    if (pin >= 14 && pin <= 19) return [this.portC, pin - 14]; // A0..A5
    throw new Error('pin invalide: ' + pin);
  }

  /** Read a digital pin (Arduino numbering). */
  digitalPinState(pin) {
    const [port, idx] = this.pinLocation(pin);
    return port.pinState(idx);
  }

  /** Set an input pin level (for buttons reading via digitalRead). */
  setDigitalPin(pin, high) {
    const [port, idx] = this.pinLocation(pin);
    port.setPin(idx, high);
  }

  /** Analog reading for a given analog channel (0..5 => pins A0..A5 -> 14..19). */
  getAnalogChannel(ch) {
    return this.adc.channelValues[ch];
  }

  /** Whether an output pin is currently HIGH. */
  isOutputHigh(pin) {
    const [port, idx] = this.pinLocation(pin);
    return port.pinState(idx) === PinState.High;
  }

  addPortListener(port, fn) { port.addListener(fn); }

  start(workUnitCycles, callback, onError) {
    this._running = true;
    this.taskScheduler.start();
    const cyclesToRun = workUnitCycles != null ? this.workUnitCycles = workUnitCycles : this.workUnitCycles;
    const execute = () => {
      if (!this._running) return;
      const target = this.cpu.cycles + cyclesToRun;
      try {
        while (this.cpu.cycles < target) {
          avrInstruction(this.cpu);
          this.cpu.tick();
        }
        if (callback) callback(this.cpu);
        if (this._running) this.taskScheduler.postTask(execute);
      } catch (e) {
        this._running = false;
        this.taskScheduler.stop();
        if (onError) onError(e); else throw e;
      }
    };
    this.taskScheduler.postTask(execute);
    return this;
  }

  stop() {
    this._running = false;
    this.taskScheduler.stop();
  }
}