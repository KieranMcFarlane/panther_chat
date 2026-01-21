// Simple in-memory storage for email versions
// In production, this would use a proper database

const emailVersions = new Map<string, any[]>();
const emailThreads = new Map<string, any>();

export { emailVersions, emailThreads };