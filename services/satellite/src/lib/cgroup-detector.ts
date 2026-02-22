import { readFileSync, writeFileSync, mkdirSync, existsSync, accessSync, constants } from 'fs';

export interface CgroupInfo {
  available: boolean;
  version: 'v2' | 'v1' | 'none';
  mountPath: string | null;      // e.g. "/sys/fs/cgroup/system.slice/deploystack-satellite.service"
  reason?: string;                // why unavailable
}

/**
 * Detect cgroup v2 availability and find the delegated cgroup path.
 *
 * When running as a systemd service with Delegate=yes, the process owns a
 * subtree under /sys/fs/cgroup (e.g. /sys/fs/cgroup/system.slice/deploystack-satellite.service).
 * nsjail must use this delegated path (not the root) to create per-process cgroups.
 *
 * Cgroup v2 has a "no internal process" constraint: a cgroup cannot both have
 * member processes AND enable controllers for children. To satisfy this, we move
 * the satellite process into a "satellite" child cgroup, leaving the service
 * cgroup root free for nsjail to write cgroup.subtree_control.
 */
export function detectCgroupV2(): CgroupInfo {
  // 1. Check cgroup v2 is mounted
  if (!existsSync('/sys/fs/cgroup/cgroup.controllers')) {
    return { available: false, version: 'none', mountPath: null, reason: 'cgroup v2 not mounted' };
  }

  // 2. Read our cgroup path from /proc/self/cgroup
  //    Format: "0::/system.slice/deploystack-satellite.service"
  try {
    const content = readFileSync('/proc/self/cgroup', 'utf-8').trim();
    const match = content.match(/0::(.+)/);
    if (!match || match[1] === '/') {
      return { available: false, version: 'v2', mountPath: null, reason: 'process is in root cgroup (no delegation)' };
    }

    const serviceCgroupRelative = match[1];
    const serviceCgroupPath = `/sys/fs/cgroup${serviceCgroupRelative}`;

    // 3. Verify the delegated path exists
    if (!existsSync(serviceCgroupPath)) {
      return { available: false, version: 'v2', mountPath: null, reason: `delegated path does not exist: ${serviceCgroupPath}` };
    }

    // 4. Verify write access to the delegated path
    try {
      accessSync(serviceCgroupPath, constants.W_OK);
    } catch {
      return { available: false, version: 'v2', mountPath: null, reason: `no write access to ${serviceCgroupPath}` };
    }

    // 5. Move ourselves into a child cgroup to satisfy the "no internal process" constraint.
    //    cgroup v2 requires that a cgroup with controllers enabled for children has no
    //    direct member processes. We create "satellite" child and move our PID there,
    //    freeing the service root for nsjail's subtree_control writes.
    const satelliteChildPath = `${serviceCgroupPath}/satellite`;
    try {
      if (!existsSync(satelliteChildPath)) {
        mkdirSync(satelliteChildPath);
      }
      // Move our process into the child cgroup by writing our PID to cgroup.procs
      writeFileSync(`${satelliteChildPath}/cgroup.procs`, String(process.pid));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { available: false, version: 'v2', mountPath: null, reason: `failed to move process to child cgroup: ${msg}` };
    }

    // 6. Enable memory and pids controllers on the service cgroup root
    //    This writes "+memory +pids" to cgroup.subtree_control so nsjail's
    //    per-process child cgroups can enforce limits.
    try {
      writeFileSync(`${serviceCgroupPath}/cgroup.subtree_control`, '+memory +pids');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { available: false, version: 'v2', mountPath: null, reason: `failed to enable controllers on subtree_control: ${msg}` };
    }

    return { available: true, version: 'v2', mountPath: serviceCgroupPath };
  } catch {
    return { available: false, version: 'v2', mountPath: null, reason: 'failed to read /proc/self/cgroup' };
  }
}
