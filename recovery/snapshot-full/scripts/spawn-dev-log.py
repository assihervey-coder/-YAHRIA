#!/usr/bin/env python3
"""Spawn a command as a detached daemon (double-fork, reparent to init) with logging.

Usage: spawn-dev-log.py <logfile> <cmd> [args...]
Survives between tool-call sessions in this sandbox (same mechanism as the
platform's dev.sh — re-parented to PID 1 after the shell exits).
"""
import os
import sys

def daemonize_exec(logfile, argv):
    pid = os.fork()
    if pid == 0:
        os.setsid()
        try:
            pid2 = os.fork()
        except OSError:
            os._exit(1)
        if pid2 == 0:
            devnull = os.open(os.devnull, os.O_RDWR)
            os.dup2(devnull, 0)
            log = os.open(logfile, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
            os.dup2(log, 1)
            os.dup2(log, 2)
            if devnull > 2:
                os.close(devnull)
            if log > 2:
                os.close(log)
            os.chdir('/home/z/my-project')
            os.execvp(argv[0], argv)
            os._exit(127)
        os._exit(0)
    os.waitpid(pid, 0)

if __name__ == '__main__':
    logfile = sys.argv[1]
    cmd = sys.argv[2:]
    daemonize_exec(logfile, cmd)
    print(f"daemon spawned: {' '.join(cmd)} -> {logfile}")
