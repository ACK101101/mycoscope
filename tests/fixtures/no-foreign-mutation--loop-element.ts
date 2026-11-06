export function finish(tasks: { done: boolean }[]): void {
    for (const task of tasks) {
        task.done = true;
    }
}
