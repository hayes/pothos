// @ts-nocheck
/* eslint-disable @typescript-eslint/no-throw-literal */
/* eslint-disable no-await-in-loop */
import { RegisterOptions } from '../types.ts';
type Timer = ReturnType<typeof setTimeout>;
export default class SubscriptionManager implements AsyncIterator<object> {
    activeSubscriptions = new Set<string>();
    nextSubscriptions = new Set<string>();
    activeOptions = new Map<string, RegisterOptions[]>();
    nextOptions = new Map<string, RegisterOptions[]>();
    subscribeToName: (name: string, cb: (err: unknown, data: unknown) => void) => Promise<void> | void;
    unsubscribeFromName: (name: string) => Promise<void> | void;
    // Always trigger on first pull to push initial state to client
    pendingEvent = true;
    pendingError: unknown;
    pendingEvents: [
        string,
        unknown
    ][] = [];
    value: object;
    resolveNext: ((done?: boolean) => void) | null = null;
    rejectNext: ((err: unknown) => void) | null = null;
    stopped = false;
    debounceDelay: number | null = null;
    debounceRef: Timer | null = null;
    constructor({ value, debounceDelay, subscribe, unsubscribe, }: {
        value: object;
        debounceDelay?: number | null;
        subscribe: (name: string, cb: (err: unknown, data: unknown) => void) => Promise<void> | void;
        unsubscribe: (name: string) => Promise<void> | void;
    }) {
        this.subscribeToName = subscribe;
        this.unsubscribeFromName = unsubscribe;
        this.value = value;
        this.debounceDelay = debounceDelay ?? null;
    }
    register<T>({ name, ...options }: RegisterOptions<T>) {
        if (this.stopped) {
            return;
        }
        this.addOptions(name, options as RegisterOptions);
        if (this.nextSubscriptions.has(name)) {
            return;
        }
        this.nextSubscriptions.add(name);
        if (this.activeSubscriptions.has(name)) {
            return;
        }
        const maybePromise = this.subscribeToName(name, (err, value) => {
            if (err) {
                this.handleError(err);
            }
            else {
                this.handleValue(name, value);
            }
        });
        if (maybePromise) {
            maybePromise.catch((error) => void this.handleError(error));
        }
    }
    [Symbol.asyncIterator]() {
        return this;
    }
    async return() {
        if (this.pendingError) {
            throw this.pendingError;
        }
        await this.stop();
        return {
            done: true,
            value: this.value,
        };
    }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    throw(error: unknown) {
        this.handleError(error);
        return Promise.reject<IteratorResult<object>>(error as Error);
    }
    async next(): Promise<IteratorResult<object>> {
        if (this.pendingError) {
            throw this.pendingError;
        }
        if (this.stopped) {
            return {
                done: true,
                value: this.value,
            };
        }
        for (const name of this.activeSubscriptions) {
            if (!this.nextSubscriptions.has(name)) {
                await this.unsubscribeFromName(name);
            }
        }
        this.activeSubscriptions = this.nextSubscriptions;
        this.nextSubscriptions = new Set();
        this.activeOptions = this.nextOptions;
        this.nextOptions = new Map<string, RegisterOptions[]>();
        if (this.pendingEvent) {
            this.pendingEvent = false;
            return {
                done: false,
                value: this.value,
            };
        }
        return new Promise<IteratorResult<object>>((resolve, reject) => {
            this.resolveNext = (done = false) => {
                this.resolveNext = null;
                this.rejectNext = null;
                resolve({
                    done,
                    value: this.value,
                });
            };
            this.rejectNext = (err) => {
                this.resolveNext = null;
                this.rejectNext = null;
                reject(err as Error);
            };
            const pending = this.pendingEvents;
            if (pending.length > 0) {
                this.pendingEvents = [];
                for (const [name, value] of pending) {
                    this.handleValue(name, value);
                }
            }
        });
    }
    handleError(err: unknown) {
        this.pendingError = err;
        if (this.rejectNext) {
            this.rejectNext(err);
        }
        this.stop().catch((error) => void this.handleError(error));
    }
    private async stop() {
        if (this.stopped) {
            return;
        }
        if (this.debounceRef) {
            clearTimeout(this.debounceRef);
            this.debounceRef = null;
        }
        this.stopped = true;
        const names = new Set([...this.activeSubscriptions, ...this.nextSubscriptions]);
        this.activeSubscriptions = new Set();
        this.nextSubscriptions = new Set();
        this.activeOptions = new Map<string, RegisterOptions[]>();
        this.nextOptions = new Map<string, RegisterOptions[]>();
        if (this.pendingError && this.rejectNext) {
            this.rejectNext(this.pendingError);
        }
        else if (this.resolveNext) {
            this.resolveNext(true);
        }
        for (const name of names) {
            await this.unsubscribeFromName(name);
        }
    }
    private addOptions(name: string, options: RegisterOptions) {
        if (!this.nextOptions.has(name)) {
            this.nextOptions.set(name, []);
        }
        this.nextOptions.get(name)!.push(options);
    }
    private filterValue(name: string, value: unknown) {
        const optionsList = this.activeOptions.get(name);
        if (!optionsList) {
            return { allowed: true };
        }
        let allowed = false;
        const promises: Promise<void>[] = [];
        for (const options of optionsList) {
            const currentAllowed = !options.filter || options.filter(value);
            allowed ||= currentAllowed;
            if (currentAllowed && options.onValue) {
                const promise = options.onValue(value);
                if (promise) {
                    promises.push(promise);
                }
            }
        }
        return { allowed, promises: Promise.all(promises) };
    }
    private handleValue(name: string, value: unknown) {
        if (this.stopped) {
            return;
        }
        if (!this.resolveNext) {
            this.pendingEvents.push([name, value]);
            return;
        }
        const { allowed, promises } = this.filterValue(name, value);
        if (promises) {
            promises.catch((error) => void this.handleError(error));
        }
        if (!allowed) {
            return;
        }
        if (this.debounceRef) {
            return;
        }
        if (this.debounceDelay === null) {
            this.pushValue();
        }
        else {
            this.debounceRef = setTimeout(() => {
                this.debounceRef = null;
                this.pushValue();
            }, this.debounceDelay);
            if (typeof this.debounceRef === "object" && "unref" in this.debounceRef) {
                (this.debounceRef as unknown as {
                    unref: () => unknown;
                }).unref();
            }
        }
    }
    private pushValue() {
        if (this.stopped) {
            return;
        }
        if (this.resolveNext) {
            this.resolveNext();
        }
        else {
            this.pendingEvent = true;
        }
    }
}
