"""Seeded mutation smoke checks in disposable copies; original sources stay intact."""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
mutations = [
    ('rejected event result', 'src/state/machine.ts', 'if (!decision.accepted) {\n      return false;\n    }',
     'if (!decision.accepted) {\n      return true;\n    }'),
    ('reset callback epoch', 'src/state/machine.ts',
     'if (!active || generation !== epoch || disposed)', 'if (!active || disposed)'),
    ('disposed event guard', 'src/state/machine.ts', 'if (disposed) {\n      return false;\n    }',
     'if (false) {\n      return false;\n    }'),
    ('abort signal', 'src/state/machine.ts', 'controller.abort();', 'void controller;'),
    ('completed callback guard', 'src/state/machine.ts', 'active = false;', 'active = true;'),
    ('response correlation', 'examples/purchases/approval.ts',
     'event.type === "resolved" && event.requestId === current.requestId',
     'event.type === "resolved"'),
]
for name, filename, before, after in mutations:
    with tempfile.TemporaryDirectory(prefix='pluto-frontend-mutant-') as temporary:
        checkout = Path(temporary) / 'repo'
        shutil.copytree(root, checkout, ignore=shutil.ignore_patterns('.git', 'node_modules', 'dist', '*.tgz'))
        (checkout / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
        target = checkout / filename
        source = target.read_text()
        assert source.count(before) == 1, f'Anchor drift: {name}'
        target.write_text(source.replace(before, after, 1))
        build = subprocess.run(['npm', 'exec', '--', 'tsc', '--noEmit'], cwd=checkout, capture_output=True, text=True, timeout=30)
        if build.returncode:
            raise SystemExit(f'INVALID: {name}\n{build.stdout}{build.stderr}')
        result = subprocess.run(['npm', 'test'], cwd=checkout, capture_output=True, text=True, timeout=30)
        if not result.returncode or 'FAIL' not in result.stdout + result.stderr:
            raise SystemExit(f'NOT KILLED: {name}\n{result.stdout}{result.stderr}')
        print(f'KILLED: {name}', flush=True)
print(f'PASS: {len(mutations)} killed; zero survivors, invalid builds or timeouts')
