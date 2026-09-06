#!/usr/bin/env python3
"""Spawn YAHRIA dev server as a detached daemon (double-fork, reparent to init).

This mimics how the platform's own dev.sh leaves `bun run dev` re-parented to
PID 1 after its shell exits — required for the process to survive between
tool-call sessions in this sandbox.
"""
import os
import sys

def daemonize_exec(argv):
    pid = os.fork()
    if pid == 0:
        # First child: new session, detach stdio
        os.setsid()
        try:
            pid2 = os.fork()
        except OSError:
            os._exit(1)
        if pid2 == 0:
            # Second child: reparented to init when middle process exits
            devnull = os.open(os.devnull, os.O_RDWR)
            os.dup2(devnull, 0)
            os.dup2(devnull, 1)
            os.dup2(devnull, 2)
            if devnull > 2:
                os.close(devnull)
            os.chdir('/home/z/my-project')
            os.execvp(argv[0], argv)
            os._exit(127)  # exec failed
        os._exit(0)
    os.waitpid(pid, 0)

if __name__ == '__main__':
    cmd = sys.argv[1:] or ['bun', 'run', 'dev']
    daemonize_exec(cmd)
    print(f"daemon spawned: {' '.join(cmd)}")
