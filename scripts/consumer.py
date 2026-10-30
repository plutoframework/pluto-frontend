"""Inspect and install the actual tarball in isolated ESM consumers."""
from pathlib import Path
import json
import subprocess
import tarfile
import tempfile

root = Path(__file__).resolve().parents[1]
subprocess.run(['npm', 'run', 'build'], cwd=root, check=True)
with tempfile.TemporaryDirectory(prefix='pluto-frontend-consumer-') as temporary:
    temporary = Path(temporary)
    subprocess.run(['npm', 'pack', '--ignore-scripts', '--pack-destination', str(temporary)], cwd=root, check=True)
    package = next(temporary.glob('*.tgz'))
    with tarfile.open(package) as tar:
        files = tar.getnames()
        assert all(name.startswith('package/dist/') or name in ('package/README.md', 'package/LICENSE', 'package/package.json') for name in files), files
        manifest = json.load(tar.extractfile('package/package.json'))
        assert not manifest.get('dependencies'), 'State acquired runtime dependencies'
    for react in [None, '18.3.1', '19.3.1']:
        app = temporary / ('pure' if react is None else react)
        app.mkdir()
        (app/'package.json').write_text('{"name":"consumer","private":true,"type":"module"}')
        args = ['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', str(package)]
        if react:
            args += [f'react@{react}', f'react-dom@{react}']
        subprocess.run(args, cwd=app, check=True)
        if react is None:
            assert not (app/'node_modules/react').exists(), 'Pure consumer acquired React'
        source = '''import { createMachine } from '@plutoframework/frontend/state';
const flow = createMachine({initial:'idle', transition:()=>({accepted:true,state:'done'})});
if(flow.getSnapshot() !== 'idle') throw Error('wrong initial');
await flow.send('start');
if(flow.getSnapshot() !== 'done') throw Error('transition failed');
'''
        if react:
            source += '''import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {useMachine} from '@plutoframework/frontend/react';
const ssr = createMachine({initial:'initial',transition:current=>({accepted:false,state:current})});
function View(){return createElement('span',null,useMachine(ssr).state);}
if(!renderToString(createElement(View)).includes('initial')) throw Error('SSR failed');
'''
        (app/'consumer.mjs').write_text(source)
        subprocess.run(['node', 'consumer.mjs'], cwd=app, check=True)
        (app/'types.mts').write_text("import {createMachine} from '@plutoframework/frontend/state';\nconst flow = createMachine<string,string>({initial:'idle',transition:state=>({accepted:false,state})});\nawait flow.send('start');\n")
        subprocess.run([str(root/'node_modules/.bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'types.mts'], cwd=app, check=True)
        print(f'PASS: packed consumer / React {react or "absent"}', flush=True)
