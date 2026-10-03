#!/usr/bin/env python3
"""Private, resumable local publisher. Uses only the Python standard library."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import fcntl
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import plistlib
import re
import signal
import shutil
import subprocess
import sys
import time
import uuid
from urllib.request import urlopen

LABEL = "com.shimon.debate-club.daily"
REPO = "ShimonBezalel/debate-club"
ARTIFACTS = ("match.json", "transcript.md", "transcript.jsonl", "judge_votes.json", "scorecard.md", "timing.json", "tool_log.json")
CHECKS = ("typecheck", "test", "build", "public-db:export", "public-db:validate", "viewer:build")
LEASE_REF = "heads/debate-club-daily-lock"
LOCK_FD = None


class RunnerError(Exception):
    pass


class Busy(RunnerError):
    pass


def due_date(now):
    utc = now.astimezone(timezone.utc)
    if (utc.hour, utc.minute) < (3, 17):
        utc -= timedelta(days=1)
    return utc.date().isoformat()


def validate_date(value, now):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Date must use YYYY-MM-DD")
    parsed = datetime.strptime(value, "%Y-%m-%d").date()
    if parsed.isoformat() < "2026-09-03" or parsed > now.astimezone(timezone.utc).date():
        raise ValueError("Date must be between rollout and today (UTC)")
    return value


def clean_environment(path):
    # Deliberately do not inherit API keys, scope, endpoints, debug or git hooks.
    return {"HOME": str(Path.home()), "PATH": path, "LANG": "en_US.UTF-8", "CI": "true",
            "GIT_TERMINAL_PROMPT": "0", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null"}


def live_environment(base, config):
    if not config.get("key_file") or not config.get("account"):
        raise RunnerError("Existing OpenAI account and local credential file must be configured")
    key = private_secret(config["key_file"])
    env = {**base, "OPENAI_API_KEY": key}
    for option, variable in [("organization", "OPENAI_ORG_ID"), ("project", "OPENAI_PROJECT_ID")]:
        if config.get(option):
            env[variable] = config[option]
    return env


def private_secret(locator):
    path = Path(locator)
    if not path.is_file() or path.stat().st_uid != os.getuid() or path.stat().st_mode & 0o077:
        raise RunnerError("Credential file must be owned by the runner user and private (0600)")
    key = path.read_text().strip()
    if not key or "\n" in key:
        raise RunnerError("Credential file must contain one raw key")
    return key


@contextmanager
def run_lock(path):
    global LOCK_FD
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with path.open("a+") as handle:
        os.chmod(path, 0o600)
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Busy("Another local publisher holds the lock") from None
        LOCK_FD = handle.fileno()
        try:
            yield
        finally:
            LOCK_FD = None


def save_json(path, value):
    temp = path.with_suffix(".tmp")
    with temp.open("w") as handle:
        os.chmod(temp, 0o600)
        json.dump(value, handle, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


def next_action(state, complete, recover):
    if complete:
        return "done" if state and state["phase"] == "verified" else "publish"
    if state and state["phase"] in ("generating", "failed") and not recover:
        return "manual-recovery"
    return "generate"


def assert_cloud_idle(runs):
    if any(run["status"] != "completed" for run in runs):
        raise Busy("Cloud daily publication is active; defer local publication")


def assert_pending_date(porcelain, date):
    for line in porcelain.splitlines():
        path = line[3:]
        if path not in ("matches/index.json", "matches/README.md") and not path.startswith(f"matches/daily-{date}-"):
            raise RunnerError("Unexpected checkout changes or another pending date; recover that date first")


def release_lease(api, owner):
    ref = api("GET", f"repos/{REPO}/git/ref/{LEASE_REF}")
    if ref:
        commit = api("GET", f"repos/{REPO}/git/commits/{ref['object']['sha']}")
        if commit["message"] != f"Debate Club publication lease: {owner}":
            raise Busy("Shared publication lock belongs to another runner; inspect before recovery")
        api("DELETE", f"repos/{REPO}/git/refs/{LEASE_REF}")


def acquire_lease(api, owner):
    # A stable local owner may reclaim its own interrupted lease under the kernel lock.
    release_lease(api, owner)
    head = api("GET", f"repos/{REPO}/commits/main")
    commit = api("POST", f"repos/{REPO}/git/commits", {
        "message": f"Debate Club publication lease: {owner}",
        "tree": head["commit"]["tree"]["sha"], "parents": [head["sha"]]})
    try:
        api("POST", f"repos/{REPO}/git/refs", {"ref": f"refs/{LEASE_REF}", "sha": commit["sha"]})
    except RunnerError:
        raise Busy("Could not acquire shared publication lock; defer and inspect GitHub access") from None


def completed_match(root, date):
    folders = list(root.glob(f"daily-{date}-*"))
    if not folders:
        return None
    if len(folders) != 1:
        raise RunnerError("Multiple records for the requested UTC date; inspect ledger")
    folder = folders[0]
    if not all((folder / name).is_file() for name in ARTIFACTS):
        raise RunnerError("Incomplete match directory; quarantine it before explicit recovery")
    match = json.loads((folder / "match.json").read_text())
    turns, votes = match.get("transcript", []), match.get("judge_votes", [])
    if match.get("match_id") != folder.name or len(turns) != 6 or len(votes) != 1 or not match.get("result"):
        raise RunnerError("Match is incomplete or has an unexpected protocol")
    if any(item.get("metadata", {}).get("dry_run") is not False or item.get("metadata", {}).get("provider") != "openai" for item in turns + votes):
        raise RunnerError("Refusing to publish a dry-run or unverified provider record")
    return folder


def launchd_plist(root, python, script, user, daemon):
    job = {"Label": LABEL, "ProgramArguments": [python, script, "--config", str(root / "config.json")],
           "RunAtLoad": True, "StartInterval": 60, "ProcessType": "Standard", "Umask": 0o077,
           "WorkingDirectory": str(root), "StandardOutPath": str(root / "launchd.out.log"),
           "StandardErrorPath": str(root / "launchd.err.log"), "ExitTimeOut": 30}
    if daemon:
        job["UserName"] = user
    return job


def stage_install(root, python, npm, gh, path, user, daemon):
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    root.chmod(0o700)
    target = root / "local_daily.py"
    if Path(__file__).resolve() != target.resolve():
        shutil.copyfile(__file__, target)
    target.chmod(0o700)
    config = root / "config.json"
    if not config.exists():
        save_json(config, {"enabled": False, "owner": f"mac:{uuid.uuid4()}", "npm": npm, "gh": gh, "path": path})
    plist = root / f"{LABEL}.plist"
    with plist.open("wb") as handle:
        plistlib.dump(launchd_plist(root, python, str(target), user, daemon), handle)
    plist.chmod(0o600)
    return plist


def install_signal_handlers():
    def terminate(_signal, _frame):
        raise InterruptedError("Service stopping")
    signal.signal(signal.SIGTERM, terminate)


class Publisher:
    def __init__(self, config, root):
        self.config, self.root = config, root
        self.checkout = root / "checkout"
        self.env = clean_environment(config["path"])
        self.secrets = []
        self.log = logging.getLogger("debate-club")

    def sanitize(self, text):
        for secret in self.secrets:
            text = text.replace(secret, "[REDACTED]")
        return re.sub(r"(?:sk-|gh[pousr]_)[A-Za-z0-9_-]+", "[REDACTED]", text)

    def command(self, args, env=None, cwd=None, timeout=900):
        # Capture and sanitize output before logging; never log environment/credentials.
        self.log.info("command: %s", " ".join(args))
        with subprocess.Popen(args, cwd=cwd or self.checkout, env=env or self.env,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True,
                              pass_fds=(LOCK_FD,) if LOCK_FD is not None else ()) as process:
            try:
                output, _ = process.communicate(timeout=timeout)
            except BaseException:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.communicate(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.communicate()
                raise
        self.log.info("%s", self.sanitize(output).strip())
        if process.returncode:
            message = "OpenAI credit balance exhausted; billing action required" if "no credits remaining" in output else "Command failed; see sanitized runner log"
            raise RunnerError(message)
        return output.rstrip()

    def authenticate(self):
        # Pin the GitHub account instead of relying on the globally active gh user.
        if self.config.get("github_token_file"):
            token = private_secret(self.config["github_token_file"])
        else:
            result = subprocess.run([self.config["gh"], "auth", "token", "--hostname", "github.com", "--user", "ShimonBezalel"],
                                    env=self.env, capture_output=True, text=True, timeout=30)
            if result.returncode or not result.stdout.strip():
                raise RunnerError("ShimonBezalel GitHub credential is unavailable in this launchd session")
            token = result.stdout.strip()
        self.secrets.append(token)
        self.env["GH_TOKEN"] = token

    def git(self, *args):
        return self.command(["/usr/bin/git", "-c", "core.hooksPath=/dev/null", "-c", "credential.helper=",
                             "-c", f"credential.helper=!{self.config['gh']} auth git-credential", *args])

    def gh(self, *args):
        return self.command([self.config["gh"], *args], cwd=self.root, timeout=60)

    def api(self, method, endpoint, payload=None):
        args = [self.config["gh"], "api", "--method", method, endpoint]
        if payload is not None:
            args += ["--input", "-"]
        result = subprocess.run(args, input=json.dumps(payload) if payload is not None else None,
                                env=self.env, capture_output=True, text=True, timeout=60,
                                pass_fds=(LOCK_FD,) if LOCK_FD is not None else ())
        body = json.loads(result.stdout) if result.stdout.strip() else None
        if result.returncode:
            if method == "GET" and endpoint.endswith(f"git/ref/{LEASE_REF}") and body and body.get("status") == "404":
                return None
            raise RunnerError("GitHub publication lock API failed; check repository access")
        return body

    def cloud_idle(self):
        runs = json.loads(self.gh("run", "list", "--repo", REPO, "--workflow", "daily-debate.yml", "--limit", "30", "--json", "status"))
        assert_cloud_idle(runs)

    def prepare(self, date):
        if not self.checkout.exists():
            self.command(["/usr/bin/git", "-c", "credential.helper=", "-c", f"credential.helper=!{self.config['gh']} auth git-credential",
                          "clone", f"https://github.com/{REPO}.git", str(self.checkout)], cwd=self.root)
        self.git("fetch", "origin", "main")
        # Pending generated records are deliberately retained; never reset this checkout.
        dirt = self.git("status", "--porcelain", "--untracked-files=all")
        assert_pending_date(dirt, date)
        if not dirt:
            self.git("rebase", "origin/main")

    def validate(self):
        npm = self.config["npm"]
        for name in CHECKS:
            self.command([npm, "run", name])
        self.command([npm, "audit", "--omit=dev"])

    def checkpoint(self, date, phase, **extra):
        state = {"date": date, "phase": phase, "updated_at": datetime.now(timezone.utc).isoformat(), **extra}
        save_json(self.root / f"{date}.json", state)
        self.log.info("%s: %s", date, phase)

    def verify_viewer(self, match_id):
        url = "https://shimonbezalel.github.io/debate-club/db/index.json"
        with urlopen(f"{url}?verify={int(time.time())}", timeout=30) as response:
            index = json.load(response)
        if index["files"]["matches"] != "matches.json":
            raise RunnerError("Unexpected public database schema")
        with urlopen(f"https://shimonbezalel.github.io/debate-club/db/matches.json?verify={int(time.time())}", timeout=30) as response:
            matches = json.load(response)
        if not any(item["match_id"] == match_id for item in matches):
            raise RunnerError("Pages public index does not yet include this match")

    def publish(self, date, folder):
        self.validate()
        self.cloud_idle()
        self.git("add", "matches/")
        changed = bool(self.git("diff", "--cached", "--name-only"))
        if changed:
            self.git("-c", "user.name=Debate Club local runner", "-c", "user.email=ShimonBezalel@users.noreply.github.com",
                     "commit", "-m", f"data: publish daily debate {date}")
        self.git("fetch", "origin", "main")
        # A conflict stops publication. It never overwrites a concurrently published entry.
        self.git("rebase", "origin/main")
        self.command([self.config["npm"], "ci", "--no-audit", "--no-fund"])
        self.validate()
        sha = self.git("rev-parse", "HEAD")
        self.git("push", "origin", "HEAD:main")
        self.checkpoint(date, "pushed", match_id=folder.name, commit=sha)
        # Explicit dispatch also repairs deployment after an earlier push/crash.
        self.gh("workflow", "run", "pages.yml", "--repo", REPO, "--ref", "main")
        deadline = time.monotonic() + 1200
        while time.monotonic() < deadline:
            runs = json.loads(self.gh("run", "list", "--repo", REPO, "--workflow", "pages.yml", "--limit", "10",
                                     "--json", "databaseId,status,conclusion,headSha"))
            matching = [run for run in runs if run["headSha"] == sha]
            if any(run["conclusion"] == "success" for run in matching):
                try:
                    self.verify_viewer(folder.name)
                    self.checkpoint(date, "verified", match_id=folder.name, commit=sha)
                    return
                except RunnerError:
                    pass
            if matching and all(run["status"] == "completed" for run in matching) and not any(run["conclusion"] == "success" for run in matching):
                raise RunnerError("Pages deployment failed; completed match is retained")
            time.sleep(15)
        raise RunnerError("Pages verification timed out; completed match is retained")

    def run(self, date, recover=False, check=False):
        state_path = self.root / f"{date}.json"
        state = json.loads(state_path.read_text()) if state_path.exists() else None
        if not check and not recover and state:
            if state["phase"] == "verified":
                return "done"
            if state.get("retry_after", 0) > time.time():
                return "deferred"
            if state["phase"] in ("failed", "generating") and not completed_match(self.checkout / "matches", date):
                return "manual-recovery"
        self.authenticate()
        self.cloud_idle()
        if check:
            return self.run_locked(date, recover, check)
        acquire_lease(self.api, self.config["owner"])
        try:
            return self.run_locked(date, recover, check)
        finally:
            release_lease(self.api, self.config["owner"])

    def run_locked(self, date, recover=False, check=False):
        self.prepare(date)
        state_path = self.root / f"{date}.json"
        state = json.loads(state_path.read_text()) if state_path.exists() else None
        folder = completed_match(self.checkout / "matches", date)
        action = next_action(state, bool(folder), recover)
        if check:
            self.command([self.config["npm"], "ci", "--no-audit", "--no-fund"])
            self.validate()
            self.log.info("preflight verified; action for %s would be %s; no model calls or publication", date, action)
            return "checked"
        if action in ("done", "manual-recovery"):
            return action
        if state and not recover and state.get("retry_after", 0) > time.time():
            return "deferred"
        self.command([self.config["npm"], "ci", "--no-audit", "--no-fund"])
        try:
            if action == "generate":
                self.validate()
                self.cloud_idle()
                env = live_environment(self.env, self.config)
                self.secrets.append(env["OPENAI_API_KEY"])
                self.checkpoint(date, "generating")
                try:
                    self.command([self.config["npm"], "run", "daily:run", "--", "--date", date, "--live",
                                  "--model", "gpt-5.6-luna", "--judge-model", "gpt-5.6-luna", "--reasoning-effort", "none",
                                  "--max-output-tokens", "260", "--judge-max-output-tokens", "700", "--out", "matches"], env=env)
                except BaseException:
                    self.checkpoint(date, "failed")
                    raise
                folder = completed_match(self.checkout / "matches", date)
                if not folder:
                    raise RunnerError("Daily command did not produce a complete live match")
                self.checkpoint(date, "generated", match_id=folder.name)
            self.publish(date, folder)
            return "verified"
        except Exception:
            if folder:
                self.checkpoint(date, "generated", match_id=folder.name, retry_after=time.time() + 3600)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path)
    parser.add_argument("--lease", choices=("acquire", "release"), help="Shared cloud/local publication coordination")
    parser.add_argument("--owner", help="cloud:<GitHub run ID> for cloud coordination")
    parser.add_argument("--stage-install", choices=("agent", "daemon"), help="Stage private runtime, standby config and plist; no privileged changes")
    parser.add_argument("--service-dir", type=Path, default=Path.home() / "Library/Application Support/DebateClub")
    parser.add_argument("--date", help="Explicit UTC date; allowed in standby for verified recovery")
    parser.add_argument("--recover", action="store_true", help="Allow one new paid attempt for a failed/interrupted date")
    parser.add_argument("--check", action="store_true", help="Validate isolated checkout without calls, commits, pushes or deployment")
    args = parser.parse_args()
    os.umask(0o077)
    install_signal_handlers()
    if args.stage_install:
        for binary in ("npm", "gh"):
            if not shutil.which(binary):
                parser.error(f"{binary} is required")
        plist = stage_install(args.service_dir, sys.executable, shutil.which("npm"), shutil.which("gh"),
                              "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
                              os.environ.get("USER", "shimon"), args.stage_install == "daemon")
        print(plist)
        return 0
    if args.lease:
        if not args.owner or not args.owner.startswith("cloud:"):
            parser.error("Cloud lease operation requires --owner cloud:<run ID>")
        publisher = Publisher({"path": os.environ.get("PATH", "/usr/bin"), "gh": "gh"}, Path.cwd())
        publisher.env["GH_TOKEN"] = os.environ.get("GH_TOKEN", "")
        try:
            (acquire_lease if args.lease == "acquire" else release_lease)(publisher.api, args.owner)
            return 0
        except RunnerError as error:
            print(str(error), file=sys.stderr)
            return 1
    if not args.config:
        parser.error("--config is required for local publication")
    root = args.config.parent
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    log = logging.getLogger("debate-club")
    log.setLevel(logging.INFO)
    handler = RotatingFileHandler(root / "runner.log", maxBytes=5_000_000, backupCount=5)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(handler)
    try:
        with run_lock(root / "run.lock"):
            config = json.loads(args.config.read_text())
            now = datetime.now(timezone.utc)
            if not args.date and not args.check and not config.get("enabled", False):
                # Quiet, observable heartbeat while cloud remains the active scheduler.
                save_json(root / "heartbeat.json", {"at": now.isoformat(), "mode": "standby"})
                return 0
            date = validate_date(args.date or due_date(now), now)
            outcome = Publisher(config, root).run(date, args.recover, args.check)
            save_json(root / "heartbeat.json", {"at": datetime.now(timezone.utc).isoformat(), "mode": "check" if args.check else "live", "date": date, "outcome": outcome})
            print(f"{date}: {outcome}")
            return 0
    except Busy as error:
        log.info("deferred: %s", error)
        return 0
    except Exception as error:
        # Exception text may contain provider/server data; expose only known-safe errors.
        message = str(error) if isinstance(error, (RunnerError, ValueError)) else type(error).__name__
        log.error("stopped: %s", message)
        print(f"Local publisher stopped: {message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
