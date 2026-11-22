/** An error caused by bad user input or an unreadable file. The CLI exits with code 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}
