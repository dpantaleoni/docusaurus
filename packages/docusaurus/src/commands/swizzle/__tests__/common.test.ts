/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Must be before importing ../common
import logger from '@docusaurus/logger';
import {
  findStringIgnoringCase,
  findClosestValue,
  actionStatusColor,
  actionStatusSuffix,
} from '../common';

jest.mock('@docusaurus/logger', () => {
  const green = jest.fn((str: string) => `GREEN(${str})`);
  const yellow = jest.fn((str: string) => `YELLOW(${str})`);
  const red = jest.fn((str: string) => `RED(${str})`);

  return {
    __esModule: true,
    default: {green, yellow, red},
    // (optional but harmless) in case something imports {logger}
    logger: {green, yellow, red},
  };
});

describe('findStringIgnoringCase', () => {
  it('exact match', () => {
    const matches = findStringIgnoringCase('foo', ['foo', 'bar']);
    expect(matches).toBe('foo');
  });

  it('different case match', () => {
    const matches = findStringIgnoringCase('Foo', ['foo', 'bar']);
    expect(matches).toBe('foo');
  });

  it('close but not a match', () => {
    const matches = findStringIgnoringCase('fo', ['foo', 'bar']);
    expect(matches).toBe(undefined);
  });

  it('empty string', () => {
    const matches = findStringIgnoringCase('', ['foo', 'bar']);
    expect(matches).toBe(undefined);
  });

  it('empty values', () => {
    const matches = findStringIgnoringCase('foo', []);
    expect(matches).toBe(undefined);
  });

  it('special characters', () => {
    const matches = findStringIgnoringCase('this#test', ['this#test', 'bar']);
    expect(matches).toBe('this#test');
  });

  it('escape sequence', () => {
    const matches = findStringIgnoringCase('test\n', ['test\n', 'bar']);
    expect(matches).toBe('test\n');
  });

  it('numbers', () => {
    const matches = findStringIgnoringCase('cloud9', ['cloud9', 'bar']);
    expect(matches).toBe('cloud9');
  });

  it('large string', () => {
    const matches = findStringIgnoringCase(
      'this is a large string test test test test test test test',
      ['this is a large string test test test test test test test', 'bar'],
    );
    expect(matches).toBe(
      'this is a large string test test test test test test test',
    );
  });

  it('multiple case variants picks first occurrence', () => {
    const matches = findStringIgnoringCase('foo', ['FOO', 'Foo', 'foo', 'bar']);
    expect(matches).toBe('FOO');
  });
});

describe('findClosestValue', () => {
  // maxLevenshtein is 3 by default
  it('exact match', () => {
    const matches = findClosestValue('fooz', ['fooz', 'barz']);
    expect(matches).toBe('fooz');
  });

  it('different case match', () => {
    const matches = findClosestValue('Fooz', ['fooz', 'barz']);
    expect(matches).toBe('fooz');
  });

  it('a match but missing > 3 characters', () => {
    const matches = findClosestValue('f', ['foozy', 'barzy']);
    expect(matches).toBe(undefined);
  });

  it('a match but missing 3 characters', () => {
    const matches = findClosestValue('fo', ['foozy', 'barz']);
    expect(matches).toBe('foozy');
  });

  it('a match but missing < 3 characters', () => {
    const matches = findClosestValue('fooz', ['foozy', 'barz']);
    expect(matches).toBe('foozy');
  });

  it('a match but 1 inner insertion needed', () => {
    const matches = findClosestValue('fooy', ['foozy', 'barz']);
    expect(matches).toBe('foozy');
  });

  it('a match but 3 inner insertions needed', () => {
    const matches = findClosestValue('fooybrbz', ['foozybarbaz', 'barz']);
    expect(matches).toBe('foozybarbaz');
  });

  it('5 inner insertions needed to match', () => {
    const matches = findClosestValue('fooybz', ['foozybarbaz', 'barz']);
    expect(matches).toBe(undefined);
  });

  it('5 inner deletions needed to match', () => {
    const matches = findClosestValue('foozybarbaz', ['fooybz', 'barz']);
    expect(matches).toBe(undefined);
  });

  it('a match but 3 inner deletions needed', () => {
    const matches = findClosestValue('foozybarbaz', ['fooybrbrz', 'barz']);
    expect(matches).toBe('fooybrbrz');
  });

  it('a match but 1 inner deletion needed', () => {
    const matches = findClosestValue('foozy', ['fooy', 'barz']);
    expect(matches).toBe('fooy');
  });

  it('empty string but smallest value length is 3 or less', () => {
    const matches = findClosestValue('', ['foo', 'barz']);
    expect(matches).toBe('foo');
  });

  it('empty string but smallest value length is greater than 3', () => {
    const matches = findClosestValue('', ['foozy', 'barzy']);
    expect(matches).toBe(undefined);
  });

  it('returns first match when multiple candidates have same distance', () => {
    const matches = findClosestValue('fooz', ['foaz', 'fozz', 'barz']);
    expect(matches).toBe('foaz');
  });
});

describe('swizzle status helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('actionStatusColor', () => {
    it('safe -> logger.green', () => {
      expect(actionStatusColor('safe', 'X')).toBe('GREEN(X)');
      expect(logger.green as jest.Mock).toHaveBeenCalledWith('X');
    });

    it('unsafe -> logger.yellow', () => {
      expect(actionStatusColor('unsafe', 'X')).toBe('YELLOW(X)');
      expect(logger.yellow as jest.Mock).toHaveBeenCalledWith('X');
    });

    it('forbidden -> logger.red', () => {
      expect(actionStatusColor('forbidden', 'X')).toBe('RED(X)');
      expect(logger.red as jest.Mock).toHaveBeenCalledWith('X');
    });
  });

  describe('actionStatusSuffix', () => {
    it('safe includes colored label; partiallySafe adds hint', () => {
      expect(actionStatusSuffix('safe')).toBe(' (GREEN(Safe))');
      expect(actionStatusSuffix('safe', {partiallySafe: true})).toBe(
        ' (GREEN(Safe)RED(*))',
      );
    });

    it('unsafe includes colored label; partiallySafe adds hint', () => {
      expect(actionStatusSuffix('unsafe')).toBe(' (YELLOW(Unsafe))');
      expect(actionStatusSuffix('unsafe', {partiallySafe: true})).toBe(
        ' (YELLOW(Unsafe)RED(*))',
      );
    });

    it('forbidden includes colored label; partiallySafe adds hint', () => {
      expect(actionStatusSuffix('forbidden')).toBe(' (RED(Forbidden))');
      expect(actionStatusSuffix('forbidden', {partiallySafe: true})).toBe(
        ' (RED(Forbidden)RED(*))',
      );
    });
  });
});
