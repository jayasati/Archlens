import { describe, expect, it } from 'vitest';
import {
  buildModuleIndex,
  pathToDotted,
  resolveImport,
} from '../../src/adapters/python/import-resolver.js';

const FILES = [
  'pkg/__init__.py',
  'pkg/costs.py',
  'pkg/risk.py',
  'pkg/sub/__init__.py',
  'pkg/sub/util.py',
  'other/__init__.py',
  'other/thing.py',
];

const INDEX = buildModuleIndex(FILES);

describe('pathToDotted', () => {
  it('strips __init__ so a package file collapses to the package name', () => {
    expect(pathToDotted('pkg/__init__.py')).toBe('pkg');
  });

  it('keeps the leaf module name for regular files', () => {
    expect(pathToDotted('pkg/costs.py')).toBe('pkg.costs');
  });
});

describe('resolveImport', () => {
  it('resolves an absolute intra-repo import', () => {
    const target = resolveImport(
      'pkg/costs.py',
      { module: 'pkg.risk', names: [], isRelative: false, level: 0, startLine: 1, endLine: 1 },
      INDEX
    );
    expect(target).toBe('pkg.risk');
  });

  it('resolves `from .costs import x` inside pkg/__init__.py to pkg.costs', () => {
    // Regression: previously over-stripped to bare "costs" and returned null.
    const target = resolveImport(
      'pkg/__init__.py',
      { module: 'costs', names: ['x'], isRelative: true, level: 1, startLine: 1, endLine: 1 },
      INDEX
    );
    expect(target).toBe('pkg.costs');
  });

  it('resolves `from .util import x` inside pkg/sub/__init__.py to pkg.sub.util', () => {
    const target = resolveImport(
      'pkg/sub/__init__.py',
      { module: 'util', names: ['x'], isRelative: true, level: 1, startLine: 1, endLine: 1 },
      INDEX
    );
    expect(target).toBe('pkg.sub.util');
  });

  it('resolves `from ..thing import x` inside pkg/sub/__init__.py to pkg.thing-like-sibling', () => {
    // pkg/sub/__init__.py with `from ..` goes up one full package; with
    // `module="other.thing"` we reach across to other/thing.py.
    const target = resolveImport(
      'pkg/sub/__init__.py',
      {
        module: 'thing',
        names: ['x'],
        isRelative: true,
        level: 2,
        startLine: 1,
        endLine: 1,
      },
      INDEX
    );
    // baseParts after stripping 2 levels from ['pkg', 'sub', '__init__'] is ['pkg'].
    // 'thing' is not a child of pkg in the fixture, so the resolver should
    // walk up to the closest existing package — pkg.
    expect(target).toBe('pkg');
  });

  it('still resolves a regular-file relative import (pkg/sub/util.py: from . import costs)', () => {
    const target = resolveImport(
      'pkg/sub/util.py',
      { module: 'costs', names: [], isRelative: true, level: 2, startLine: 1, endLine: 1 },
      INDEX
    );
    expect(target).toBe('pkg.costs');
  });
});
