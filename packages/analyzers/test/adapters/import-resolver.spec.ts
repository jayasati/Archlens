import { describe, expect, it } from 'vitest';
import {
  buildModuleIndex,
  detectWrapperPackage,
  moduleFor,
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

describe('detectWrapperPackage', () => {
  it('returns null when multiple top-level packages exist', () => {
    expect(
      detectWrapperPackage(['main.py', 'models/user.py', 'routers/users.py', 'services/auth.py'])
    ).toBeNull();
  });

  it('detects a single top-level wrapper around multiple sub-packages', () => {
    expect(
      detectWrapperPackage([
        'app/__init__.py',
        'app/main.py',
        'app/api/endpoints.py',
        'app/core/config.py',
        'app/services/summarizer.py',
      ])
    ).toBe('app');
  });

  it('peels through nested wrappers (src/myapp/...)', () => {
    expect(
      detectWrapperPackage([
        'src/myapp/api/endpoints.py',
        'src/myapp/core/config.py',
        'src/myapp/services/auth.py',
      ])
    ).toBe('src.myapp');
  });

  it('does not peel when the wrapper has only one sub-package', () => {
    expect(detectWrapperPackage(['app/api/endpoints.py', 'app/api/schemas.py'])).toBeNull();
  });

  it('returns null on an empty file list', () => {
    expect(detectWrapperPackage([])).toBeNull();
  });
});

describe('moduleFor', () => {
  it('falls back to topPackage when no wrapper is set', () => {
    expect(moduleFor('routers.users', null)).toBe('routers');
    expect(moduleFor('main', null)).toBe('main');
  });

  it('peels the wrapper segment when present', () => {
    expect(moduleFor('app.api.endpoints', 'app')).toBe('api');
    expect(moduleFor('app.main', 'app')).toBe('main');
  });

  it('buckets the wrappers own __init__.py under the wrapper leaf', () => {
    // dotted("app/__init__.py") === "app"
    expect(moduleFor('app', 'app')).toBe('app');
    expect(moduleFor('src.myapp', 'src.myapp')).toBe('myapp');
  });

  it('peels nested wrappers', () => {
    expect(moduleFor('src.myapp.api.endpoints', 'src.myapp')).toBe('api');
  });
});
