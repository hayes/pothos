function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    }
    else {
        obj[key] = value;
    }
    return obj;
}
import { PothosValidationError } from '@pothos/core';
export class InputValidationError extends PothosValidationError {
    constructor(issues) {
        super(issues.map((issue) => {
            var _issue_path;
            var _issue_path_map_join;
            return `${(_issue_path_map_join = (_issue_path = issue.path) === null || _issue_path === void 0 ? void 0 : _issue_path.map((path) => {
                if (typeof path === "string" || typeof path === "number" || typeof path === "symbol") {
                    return path.toString();
                }
                return path.key.toString();
            }).join(".")) !== null && _issue_path_map_join !== void 0 ? _issue_path_map_join : "unknown"}: ${issue.message}`;
        }).join(", ")), _define_property(this, "issues", void 0);
        this.issues = issues;
    }
}
//# sourceMappingURL=errors.js.map
