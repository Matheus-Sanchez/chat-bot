function createAbortError(message = 'Request aborted before it reached LM Studio.') {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}

class ChatQueue {
    constructor() {
        this.activeJob = null;
        this.jobs = [];
        this.nextId = 1;
        this.isDraining = false;
    }

    enqueue({ run, signal, onPositionChange }) {
        if (signal?.aborted) {
            return Promise.reject(createAbortError());
        }

        return new Promise((resolve, reject) => {
            const job = {
                id: this.nextId++,
                run,
                resolve,
                reject,
                signal,
                onPositionChange,
                abortQueued: null,
            };

            job.abortQueued = () => {
                if (this.activeJob === job) return;
                const removed = this.removeQueuedJob(job);
                if (removed) {
                    reject(createAbortError());
                    this.broadcastPositions();
                }
            };

            signal?.addEventListener('abort', job.abortQueued, { once: true });
            this.jobs.push(job);
            this.broadcastPositions();
            this.drain();
        });
    }

    getSnapshot() {
        return {
            active: Boolean(this.activeJob),
            activeJobId: this.activeJob?.id || null,
            queued: this.jobs.length,
        };
    }

    removeQueuedJob(job) {
        const index = this.jobs.indexOf(job);
        if (index === -1) return false;
        this.jobs.splice(index, 1);
        job.signal?.removeEventListener('abort', job.abortQueued);
        return true;
    }

    broadcastPositions() {
        this.jobs.forEach((job, index) => {
            job.onPositionChange?.({
                active: Boolean(this.activeJob),
                position: index + 1,
                queued: this.jobs.length,
            });
        });
    }

    async drain() {
        if (this.isDraining || this.activeJob || this.jobs.length === 0) return;

        this.isDraining = true;
        const job = this.jobs.shift();
        this.activeJob = job;
        job.signal?.removeEventListener('abort', job.abortQueued);
        this.broadcastPositions();

        try {
            if (job.signal?.aborted) {
                throw createAbortError('Request aborted before processing started.');
            }

            await job.run();
            job.resolve();
        } catch (error) {
            job.reject(error);
        } finally {
            this.activeJob = null;
            this.isDraining = false;
            this.broadcastPositions();
            setImmediate(() => this.drain());
        }
    }
}

const chatQueue = new ChatQueue();

module.exports = {
    chatQueue,
    ChatQueue,
    createAbortError,
};
