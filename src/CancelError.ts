export class CancelError extends Error {
    constructor(message?: string) {
        super(message);
    }
}