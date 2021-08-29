import { RegisterOptions } from '../types';

import { SubscriptionManager } from '..';

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
