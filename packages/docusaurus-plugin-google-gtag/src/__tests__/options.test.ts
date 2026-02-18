/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {normalizePluginOptions} from '@docusaurus/utils-validation';
import {
  validateOptions,
  type PluginOptions,
  type Options,
  DEFAULT_OPTIONS,
  validateThemeConfig,
} from '../options';
import type {
  ThemeConfig,
  ThemeConfigValidationContext,
  Validate,
} from '@docusaurus/types';

function testValidateOptions(options: Options) {
  return validateOptions({
    validate: normalizePluginOptions as Validate<Options, PluginOptions>,
    options,
  });
}

function validationResult(options: Options) {
  return {
    id: 'default',
    ...DEFAULT_OPTIONS,
    ...options,
    trackingID:
      typeof options.trackingID === 'string'
        ? [options.trackingID]
        : options.trackingID,
  };
}

function testValidateThemeConfig(themeConfig: ThemeConfig) {
  return validateThemeConfig({
    themeConfig,
  } as ThemeConfigValidationContext<ThemeConfig>);
}

const MinimalConfig: Options = {
  trackingID: 'G-XYZ12345',
};

describe('validateOptions', () => {
  it('throws for undefined options', () => {
    expect(
      // @ts-expect-error: TS should error
      () => testValidateOptions(undefined),
    ).toThrowErrorMatchingInlineSnapshot(`""trackingID" is required"`);
  });

  it('throws for null options', () => {
    expect(
      // @ts-expect-error: TS should error
      () => testValidateOptions(null),
    ).toThrowErrorMatchingInlineSnapshot(`""value" must be of type object"`);
  });

  it('throws for empty object options', () => {
    expect(
      // @ts-expect-error: TS should error
      () => testValidateOptions({}),
    ).toThrowErrorMatchingInlineSnapshot(`""trackingID" is required"`);
  });

  it('throws for number options', () => {
    expect(
      // @ts-expect-error: TS should error
      () => testValidateOptions(42),
    ).toThrowErrorMatchingInlineSnapshot(`""value" must be of type object"`);
  });

  it('throws for null trackingID', () => {
    expect(
      // @ts-expect-error: TS should error
      () => testValidateOptions({trackingID: null}),
    ).toThrowErrorMatchingInlineSnapshot(
      `""trackingID" does not match any of the allowed types"`,
    );
  });
  it('throws for number trackingID', () => {
    expect(
      // @ts-expect-error: TS should error
      () => testValidateOptions({trackingID: 42}),
    ).toThrowErrorMatchingInlineSnapshot(
      `""trackingID" does not match any of the allowed types"`,
    );
  });
  it('throws for empty trackingID', () => {
    expect(() =>
      testValidateOptions({trackingID: ''}),
    ).toThrowErrorMatchingInlineSnapshot(
      `""trackingID" does not match any of the allowed types"`,
    );
  });

  it('accepts minimal config', () => {
    expect(testValidateOptions(MinimalConfig)).toEqual(
      validationResult(MinimalConfig),
    );
  });

  it('accepts anonymizeIP', () => {
    const config: Options = {
      ...MinimalConfig,
      anonymizeIP: true,
    };
    expect(testValidateOptions(config)).toEqual(validationResult(config));
  });

  it('accepts single trackingID', () => {
    const config: Options = {
      trackingID: 'G-ABCDEF123',
    };
    expect(testValidateOptions(config)).toEqual(validationResult(config));
  });

  it('accepts multiple trackingIDs', () => {
    const config: Options = {
      trackingID: ['G-ABCDEF123', 'UA-XYZ456789'],
    };
    expect(testValidateOptions(config)).toEqual(validationResult(config));
  });

  it('throws for empty trackingID arrays', () => {
    const config: Options = {
      // @ts-expect-error: TS should error
      trackingID: [],
    };
    expect(() =>
      testValidateOptions(config),
    ).toThrowErrorMatchingInlineSnapshot(
      `""trackingID" does not match any of the allowed types"`,
    );
  });

  it('throws for sparse trackingID arrays', () => {
    const config: Options = {
      // @ts-expect-error: TS should error
      trackingID: ['G-ABCDEF123', null, 'UA-XYZ456789'],
    };
    expect(() =>
      testValidateOptions(config),
    ).toThrowErrorMatchingInlineSnapshot(
      `""trackingID" does not match any of the allowed types"`,
    );
  });

  it('throws for bad trackingID arrays', () => {
    const config: Options = {
      // @ts-expect-error: TS should error
      trackingID: ['G-ABCDEF123', 42],
    };
    expect(() =>
      testValidateOptions(config),
    ).toThrowErrorMatchingInlineSnapshot(
      `""trackingID" does not match any of the allowed types"`,
    );
  });
});

describe('validateThemeConfig', () => {
  it('returns themeConfig if no gtag field is present', () => {
    const config = {
      navbar: {
        title: 'My Site',
      },
    } as ThemeConfig;

    expect(testValidateThemeConfig(config)).toBe(config);
  });

  it('returns empty object if no gtag field is present', () => {
    const config = {} as ThemeConfig;

    expect(testValidateThemeConfig(config)).toBe(config);
  });

  it('throws if gtag field is present', () => {
    const config = {
      gtag: {
        trackingID: 'G-XYZ12345',
      },
    } as ThemeConfig;

    expect(() =>
      testValidateThemeConfig(config),
    ).toThrowErrorMatchingInlineSnapshot(
      `"The "gtag" field in themeConfig should now be specified as option for plugin-google-gtag. More information at https://github.com/facebook/docusaurus/pull/5832."`,
    );
  });

  it('throws even if gtag is undefined', () => {
    const config = {
      gtag: undefined,
    } as ThemeConfig;

    expect(() =>
      testValidateThemeConfig(config),
    ).toThrowErrorMatchingInlineSnapshot(
      `"The "gtag" field in themeConfig should now be specified as option for plugin-google-gtag. More information at https://github.com/facebook/docusaurus/pull/5832."`,
    );
  });
});
