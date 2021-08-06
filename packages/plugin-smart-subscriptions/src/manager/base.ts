import { SubscriptionManager } from '../index.js';
import { RegisterOptions } from '../types.js';

export default class BaseSubscriptionManager {
  manager: SubscriptionManager;

  registrations: RegisterOptions[] = [];

  constructor(manager: SubscriptionManager) {
    this.manager = manager;
  }

  addRegistration<T>(options: RegisterOptions<T>) {
    this.registrations.push(options as RegisterOptions);
    this.manager.register<T>(options);
  }

  reRegister() {
    this.registrations.forEach((options) => void this.manager.register(options));
  }
}
