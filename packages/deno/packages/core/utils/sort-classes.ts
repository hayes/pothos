// @ts-nocheck
export function classDepth(obj: {}): number {
    const proto = Object.getPrototypeOf(obj) as {} | null;
    if (!proto) {
        return 0;
    }
    return 1 + classDepth(proto);
}
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function sortClasses<T extends new (...args: any[]) => unknown>(classes: T[]) {
    return [...classes].sort((a, b) => {
        const depthA = classDepth(a);
        const depthB = classDepth(b);
        if (depthA > depthB) {
            return -1;
        }
        if (depthB > depthA) {
            return 1;
        }
        return 0;
    });
}
