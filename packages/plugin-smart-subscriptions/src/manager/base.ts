import type SubscriptionManager from '.';
import type { RegisterOptions } from '../types';

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
    for (const options of this.registrations) {
      this.manager.register(options);
    }
  }
}
