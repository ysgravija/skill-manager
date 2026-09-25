import hashlib
import json
import sys
from pathlib import Path

manifest = Path(sys.argv[1])
if len(sys.argv) > 2:
    hashes = {}
    for root in map(Path, sys.argv[2:]):
        for path in root.expanduser().rglob('SKILL.md'):
            if path.is_file():
                canonical = path.resolve()
                hashes[str(canonical)] = hashlib.sha256(canonical.read_bytes()).hexdigest()
    manifest.write_text(json.dumps(hashes, indent=2))
    print(f'Saved {len(hashes)} source hashes to {manifest}')
else:
    hashes = json.loads(manifest.read_text())
    changed = [name for name, digest in hashes.items()
               if not Path(name).is_file()
               or hashlib.sha256(Path(name).read_bytes()).hexdigest() != digest]
    if changed:
        print('\n'.join(changed))
        raise SystemExit('Source skills changed')
    print(f'All {len(hashes)} source skills are unchanged')
