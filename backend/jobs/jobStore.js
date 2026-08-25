// jobs/jobStore.js
//
// In-memory job tracker for async video processing. Good enough for a
// single-server demo/dev setup. For production with multiple server
// instances, swap this for Redis or a database table.

const jobs = new Map();

export function createJob(id) {
  jobs.set(id, { id, status: "queued", progress: 0, resultPath: null, error: null });
  return jobs.get(id);
}

export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}
