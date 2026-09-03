const pendingSaves = new Map<string, Promise<void>>();

export async function serializeFilesystemSave(
  target: string,
  operation: () => Promise<void>,
): Promise<void> {
  const previous = pendingSaves.get(target) ?? Promise.resolve();
  const current = previous.then(operation, operation);
  pendingSaves.set(target, current);

  try {
    await current;
  } finally {
    if (pendingSaves.get(target) === current) pendingSaves.delete(target);
  }
}
