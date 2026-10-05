import importlib.util
import json
import io
import os
from pathlib import Path
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("local_daily", Path(__file__).parents[1] / "scripts/local_daily.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class LocalDailyTests(unittest.TestCase):
    def test_monthly_spend_reservation_stops_before_crossing_working_or_absolute_limit(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            now = datetime(2026, 10, 5, tzinfo=timezone.utc)
            for _ in range(50):
                runner.reserve_spend(root, "2026-10-02", 5, now)
            with self.assertRaises(runner.RunnerError):
                runner.reserve_spend(root, "2026-10-03", 5, now)
            # Failed attempts/retries stay reserved; the execution month owns backfills.
            book = json.loads((root / "spend-2026-10.json").read_text())
            self.assertEqual(book["reserved_cents"], 500)
            self.assertEqual(len(book["attempts"]), 50)
            self.assertFalse((root / "spend-2026-09.json").exists())
            with self.assertRaises(runner.RunnerError):
                runner.reserve_spend(root, "2026-10-03", 11, now)
            runner.reserve_spend(root, "2026-10-03", 5, datetime(2026, 11, 1, tzinfo=timezone.utc))
            self.assertEqual(json.loads((root / "spend-2026-11.json").read_text())["reserved_cents"], 10)

    def test_schedule_is_0317_utc_including_dst_and_restart(self):
        for instant, expected in [
            ("2026-10-03T03:16:59+00:00", "2026-10-02"),
            ("2026-10-03T03:17:00+00:00", "2026-10-03"),
            ("2026-10-25T05:17:00+02:00", "2026-10-25"),
            ("2026-10-27T23:59:00+00:00", "2026-10-27"),
        ]:
            self.assertEqual(runner.due_date(datetime.fromisoformat(instant)), expected)

    def test_date_input_cannot_be_future_or_shell_text(self):
        now = datetime(2026, 10, 3, 12, tzinfo=timezone.utc)
        for value in ["2026-02-30", "2026-10-04", "$(date)", "2026-9-3", "2026-09-02"]:
            with self.assertRaises(ValueError):
                runner.validate_date(value, now)
        self.assertEqual(runner.validate_date("2026-10-02", now), "2026-10-02")

    def test_explicit_file_is_required_and_ambient_provider_keys_are_removed(self):
        with tempfile.TemporaryDirectory() as folder:
            key = Path(folder) / "key.txt"
            key.write_text("unit-test-value")
            key.chmod(0o600)
            with patch.dict(os.environ, {"OPENAI_API_KEY": "wrong", "OPENAI_BASE_URL": "https://wrong", "OPENAI_ORG_ID": "wrong", "ANTHROPIC_API_KEY": "wrong"}):
                base = runner.clean_environment("/usr/bin")
                self.assertNotIn("OPENAI_API_KEY", base)
                self.assertNotIn("OPENAI_BASE_URL", base)
                self.assertNotIn("ANTHROPIC_API_KEY", base)
                live = runner.live_environment(base, {"key_file": str(key), "account": "approved"})
                self.assertEqual(live["OPENAI_API_KEY"], "unit-test-value")
                self.assertNotIn("OPENAI_ORG_ID", live)
                with self.assertRaises(runner.RunnerError):
                    runner.live_environment(base, {})
            key.chmod(0o644)
            with self.assertRaises(runner.RunnerError):
                runner.live_environment(base, {"key_file": str(key), "account": "approved"})

    def test_kernel_lock_prevents_duplicates_and_releases_on_process_death(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "lock"
            with runner.run_lock(path):
                with self.assertRaises(runner.Busy):
                    with runner.run_lock(path):
                        pass
            with runner.run_lock(path):
                pass

    def test_failed_or_interrupted_paid_attempt_requires_explicit_recovery(self):
        self.assertEqual(runner.next_action(None, False, False), "generate")
        for phase in ["generating", "failed"]:
            self.assertEqual(runner.next_action({"phase": phase}, False, False), "manual-recovery")
            self.assertEqual(runner.next_action({"phase": phase}, False, True), "generate")
        for phase in ["generating", "failed", "generated", "pushed"]:
            self.assertEqual(runner.next_action({"phase": phase}, True, False), "publish")
        self.assertEqual(runner.next_action({"phase": "verified"}, True, False), "done")

    def test_cloud_running_or_queued_prevents_live_calls(self):
        for status in ["queued", "in_progress", "waiting", "pending", "requested"]:
            with self.assertRaises(runner.Busy):
                runner.assert_cloud_idle([{"status": status}])
        runner.assert_cloud_idle([{"status": "completed", "conclusion": "failure"}])

    def test_match_must_be_complete_live_and_have_correct_date(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / "daily-2026-10-02-s01-topic_001"
            target.mkdir()
            self.assertIsNone(runner.completed_match(root, "2026-10-03"))
            with self.assertRaises(runner.RunnerError):
                runner.completed_match(root, "2026-10-02")
            match = {"match_id": target.name, "transcript": [{"metadata": {"dry_run": False, "provider": "openai"}}] * 6, "judge_votes": [{"metadata": {"dry_run": False, "provider": "openai"}}], "result": {"winner": "pro"}}
            for name in runner.ARTIFACTS:
                (target / name).write_text(json.dumps(match) if name == "match.json" else "test")
            self.assertEqual(runner.completed_match(root, "2026-10-02"), target)
            match["transcript"][0]["metadata"]["dry_run"] = True
            (target / "match.json").write_text(json.dumps(match))
            with self.assertRaises(runner.RunnerError):
                runner.completed_match(root, "2026-10-02")

    def test_plist_has_timer_startup_private_logs_and_no_secret(self):
        job = runner.launchd_plist(Path("/private/service"), "/usr/bin/python3", "/private/service/local_daily.py", "shimon", False)
        self.assertEqual(job["StartInterval"], 60)
        self.assertTrue(job["RunAtLoad"])
        self.assertEqual(job["ProgramArguments"][-1], "/private/service/config.json")
        self.assertNotIn("OPENAI_API_KEY", json.dumps(job))
        self.assertEqual(job["Umask"], 0o077)
        self.assertEqual(job["ProcessType"], "Standard")
        self.assertNotIn("UserName", job)
        daemon = runner.launchd_plist(Path("/private/service"), "/usr/bin/python3", "/private/service/local_daily.py", "shimon", True)
        self.assertEqual(daemon["UserName"], "shimon")

    def test_status_write_is_private_and_atomic(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "state.json"
            runner.save_json(path, {"phase": "generating"})
            runner.save_json(path, {"phase": "verified"})
            self.assertEqual(json.loads(path.read_text()), {"phase": "verified"})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_shared_lease_refuses_other_owner_and_recovers_own_crash(self):
        calls = []
        remote = {}
        def api(method, endpoint, payload=None):
            calls.append((method, endpoint))
            if method == "GET" and endpoint.endswith("git/ref/heads/debate-club-daily-lock"):
                return remote.get("ref")
            if method == "GET" and "/git/commits/" in endpoint:
                return {"message": remote["owner"]}
            if method == "GET":
                return {"sha": "head", "commit": {"tree": {"sha": "tree"}}}
            if method == "POST" and endpoint.endswith("git/commits"):
                remote["owner"] = payload["message"]
                return {"sha": "lease-commit"}
            if method == "POST":
                remote["ref"] = {"object": {"sha": "lease-commit"}}
                return remote["ref"]
            if method == "DELETE":
                del remote["ref"]
        runner.acquire_lease(api, "mac:approved-host")
        with self.assertRaises(runner.Busy):
            runner.acquire_lease(api, "cloud:123")
        runner.acquire_lease(api, "mac:approved-host")
        self.assertIn("ref", remote)
        with self.assertRaises(runner.Busy):
            runner.release_lease(api, "cloud:123")
        runner.release_lease(api, "mac:approved-host")
        self.assertNotIn("ref", remote)

    def test_secret_redaction_covers_provider_and_github_output(self):
        pub = runner.Publisher({"path": "/usr/bin"}, Path("/private/service"))
        pub.secrets = ["test-secret"]
        self.assertEqual(pub.sanitize("test-secret sk-example123 ghp_example123"), "[REDACTED] [REDACTED] [REDACTED]")

    def test_paid_failure_is_not_retried_by_restart_or_timer(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            key = root / "key"
            key.write_text("test-key")
            key.chmod(0o600)
            pub = runner.Publisher({"path": "/usr/bin", "npm": "npm", "key_file": str(key), "account": "approved"}, root)
            pub.checkout.mkdir()
            commands = []
            def command(args, **kwargs):
                commands.append(args)
                if "daily:run" in args:
                    raise runner.RunnerError("OpenAI credit balance exhausted; billing action required")
                return ""
            pub.command = command
            pub.prepare = lambda date: None
            pub.validate = lambda: None
            pub.cloud_idle = lambda: None
            with self.assertRaises(runner.RunnerError):
                pub.run_locked("2026-10-02")
            self.assertEqual(pub.run_locked("2026-10-02"), "manual-recovery")
            self.assertEqual(sum("daily:run" in args for args in commands), 1)
            self.assertEqual([args for args in commands if "ci" in args], [["npm", "ci", "--no-audit", "--no-fund"]])
            self.assertEqual(json.loads((root / "2026-10-02.json").read_text())["phase"], "failed")
            book = json.loads(next(root.glob("spend-*.json")).read_text())
            self.assertEqual(book["reserved_cents"], 10)

    def test_complete_artifacts_resume_publication_without_api_key_or_generation(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pub = runner.Publisher({"path": "/usr/bin", "npm": "npm"}, root)
            pub.prepare = lambda date: None
            pub.command = lambda *a, **kw: ""
            published = []
            pub.publish = lambda date, match: published.append((date, match))
            runner.save_json(root / "2026-10-02.json", {"phase": "generating"})
            with patch.object(runner, "completed_match", return_value=Path("complete-live-match")):
                self.assertEqual(pub.run_locked("2026-10-02"), "verified")
            self.assertEqual(published, [("2026-10-02", Path("complete-live-match"))])

    def test_installer_preserves_existing_enabled_config_and_creates_private_standby(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "service"
            path = runner.stage_install(root, "/usr/bin/python3", "/usr/bin/npm", "/usr/bin/gh", "/usr/bin", "shimon", True)
            config = json.loads((root / "config.json").read_text())
            self.assertFalse(config["enabled"])
            self.assertTrue((root / "local_daily.py").exists())
            self.assertEqual(root.stat().st_mode & 0o777, 0o700)
            self.assertEqual(path.name, runner.LABEL + ".plist")
            config.update(enabled=True, account="approved")
            runner.save_json(root / "config.json", config)
            runner.stage_install(root, "/usr/bin/python3", "/usr/bin/npm", "/usr/bin/gh", "/usr/bin", "shimon", True)
            self.assertEqual(json.loads((root / "config.json").read_text()), config)

    def test_pinned_github_file_auth_survives_locked_login_keychain(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            token = root / "github-token"
            token.write_text("fake-existing-token")
            token.chmod(0o600)
            pub = runner.Publisher({"path": "/usr/bin", "gh": "gh", "github_token_file": str(token)}, root)
            with patch.object(runner.subprocess, "run", side_effect=AssertionError("must not read login keychain")):
                pub.authenticate()
            self.assertEqual(pub.env["GH_TOKEN"], "fake-existing-token")
            token.unlink()
            with self.assertRaises(runner.RunnerError):
                pub.authenticate()

    def test_verified_timer_tick_avoids_network_and_model_calls(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            runner.save_json(root / "2026-10-02.json", {"phase": "verified"})
            pub = runner.Publisher({"path": "/usr/bin"}, root)
            with patch.object(pub, "authenticate", side_effect=AssertionError("no network on completed timer tick")):
                self.assertEqual(pub.run("2026-10-02"), "done")

    def test_timeout_kills_child_and_grandchild_and_logs_no_secret(self):
        with tempfile.TemporaryDirectory() as folder:
            pub = runner.Publisher({"path": "/usr/bin"}, Path(folder))
            pub.checkout = Path(folder)
            with self.assertRaises(runner.subprocess.TimeoutExpired):
                pub.command([runner.sys.executable, "-c", "import time; time.sleep(30)"], timeout=0.05)

    def test_viewer_verification_uses_the_existing_public_db_projection(self):
        pub = runner.Publisher({"path": "/usr/bin"}, Path("/private/service"))
        responses = [
            io.StringIO(json.dumps({"match_count": 1, "files": {"matches": "matches.json"}})),
            io.StringIO(json.dumps([{ "match_id": "daily-2026-10-02-test" }]))
        ]
        with patch.object(runner, "urlopen", side_effect=responses) as fetch:
            pub.verify_viewer("daily-2026-10-02-test")
        self.assertIn("/db/matches.json?", fetch.call_args_list[1].args[0])
        with patch.object(runner, "urlopen", side_effect=[io.StringIO(json.dumps({"match_count": 0, "files": {"matches": "matches.json"}})), io.StringIO("[]")]):
            with self.assertRaises(runner.RunnerError):
                pub.verify_viewer("daily-2026-10-02-test")

    def test_pending_other_date_cannot_get_swept_into_a_new_daily_commit(self):
        runner.assert_pending_date("?? matches/daily-2026-10-02-s01-topic/match.json\n M matches/index.json\n M matches/README.md", "2026-10-02")
        with self.assertRaises(runner.RunnerError):
            runner.assert_pending_date("?? matches/daily-2026-10-02-s01-topic/match.json", "2026-10-03")
        with self.assertRaises(runner.RunnerError):
            runner.assert_pending_date(" M src/daily/runDaily.ts", "2026-10-02")

    def test_command_preserves_git_porcelain_leading_spaces(self):
        with tempfile.TemporaryDirectory() as folder:
            pub = runner.Publisher({"path": "/usr/bin"}, Path(folder))
            pub.checkout = Path(folder)
            result = pub.command([runner.sys.executable, "-c", "print(' M matches/index.json')"])
            self.assertEqual(result, " M matches/index.json")

    def test_service_stop_raises_so_subprocess_cleanup_can_run(self):
        with patch.object(runner.signal, "signal") as install:
            runner.install_signal_handlers()
        handler = install.call_args.args[1]
        with self.assertRaises(InterruptedError):
            handler(runner.signal.SIGTERM, None)

    def test_restart_resumes_an_older_completed_date_before_generating_today(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            runner.save_json(root / "2026-10-02.json", {"phase": "generated"})
            now = datetime(2026, 10, 4, 12, tzinfo=timezone.utc)
            with patch.object(runner, "completed_match", return_value=Path("complete-live-match")):
                self.assertEqual(runner.scheduled_date(root, now), "2026-10-02")
            runner.save_json(root / "2026-10-02.json", {"phase": "verified"})
            self.assertEqual(runner.scheduled_date(root, now), "2026-10-04")

    def test_old_failed_generation_is_accounted_for_without_automatic_paid_backfill(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            runner.save_json(root / "2026-10-02.json", {"phase": "failed"})
            now = datetime(2026, 10, 4, 12, tzinfo=timezone.utc)
            with patch.object(runner, "completed_match", return_value=None):
                self.assertEqual(runner.scheduled_date(root, now), "2026-10-04")
            runner.save_json(root / "2026-10-02.json", {"phase": "generated"})
            with patch.object(runner, "completed_match", return_value=None):
                with self.assertRaises(runner.RunnerError):
                    runner.scheduled_date(root, now)


if __name__ == "__main__":
    unittest.main()
