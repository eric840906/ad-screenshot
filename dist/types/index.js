"use strict";
/**
 * Core type definitions for the Ad Screenshot Automation System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorType = exports.JobPriority = void 0;
var JobPriority;
(function (JobPriority) {
    JobPriority[JobPriority["LOW"] = 1] = "LOW";
    JobPriority[JobPriority["NORMAL"] = 5] = "NORMAL";
    JobPriority[JobPriority["HIGH"] = 10] = "HIGH";
    JobPriority[JobPriority["CRITICAL"] = 20] = "CRITICAL";
})(JobPriority || (exports.JobPriority = JobPriority = {}));
var ErrorType;
(function (ErrorType) {
    ErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorType["SELECTOR_NOT_FOUND"] = "SELECTOR_NOT_FOUND";
    ErrorType["BROWSER_CRASH"] = "BROWSER_CRASH";
    ErrorType["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    ErrorType["UPLOAD_ERROR"] = "UPLOAD_ERROR";
    ErrorType["PARSING_ERROR"] = "PARSING_ERROR";
    ErrorType["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
//# sourceMappingURL=index.js.map